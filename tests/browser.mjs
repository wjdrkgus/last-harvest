// Optional local UI verification. Uses an isolated browser profile, never player saves.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {freshGame,advanceMonth,restore,serialize} from '../engine.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const output=new URL('../qa-output/',import.meta.url);await mkdir(output,{recursive:true});
const context=await browser.newContext({viewport:{width:1440,height:1050},acceptDownloads:true});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=process.env.GAME_URL||'http://127.0.0.1:8765/';
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('last-harvest-v1')));
const stories=['seed-family','stone-road','separated-family','fever-ward','empty-chair'];
async function screenshot(name){await page.screenshot({path:fileURLToPath(new URL(name+'.png',output)),fullPage:true});}
function fixture(turn=0,patch={}){
  let s={...freshGame(42),food:10000,grain:10000,storySeen:stories.slice()};
  while(s.turn<turn)s=advanceMonth(s);
  s={...s,...patch};assert.ok(restore(serialize(s)),'invalid test fixture');return s;
}
async function load(s){assert.ok(restore(serialize(s)));await page.evaluate(raw=>localStorage.setItem('last-harvest-v1',raw),serialize(s));await page.reload({waitUntil:'networkidle'});}
async function close(){if(await page.locator('dialog').isVisible())await page.keyboard.press('Escape');}
async function act(id){await page.locator(`[data-action="${id}"]`).click();await page.locator('#execute-action').click();}
async function answerPopup(index=1){const choices=page.locator('[data-story-choice]:enabled');if(await choices.count())await choices.nth(Math.min(index,(await choices.count())-1)).click();}
try{
  await page.goto(url,{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'마지막 수확 The Last Harvest'}).waitFor();
  assert.equal((await saved()).population,1200);await screenshot('desktop');
  await page.getByRole('button',{name:'겨울 구호를 우선한다'}).click();
  assert.equal((await saved()).food,242);
  await act('divert');assert.equal((await saved()).food,272);assert.equal((await saved()).grain,80);
  await page.locator('#next-month').click();assert.equal((await saved()).turn,1);
  const before=await saved();await page.reload({waitUntil:'networkidle'});assert.deepEqual(await saved(),before);
  await page.getByRole('button',{name:'긴축 75%'}).click();assert.equal((await saved()).ration,.75);
  await page.locator('#exports').fill('0');await page.locator('#cattle-exports').selectOption('2');
  await page.locator('#next-month').click();assert.ok((await saved()).lastReport.evicted>0);
  await page.locator('[data-place="homes"]').click();await close();
  await page.getByRole('button',{name:'자원 장부',exact:true}).click();assert.equal(await page.locator('#ledger-view').isVisible(),true);
  await page.getByRole('button',{name:'행정 기록',exact:true}).click();
  const downloadEvent=page.waitForEvent('download');await page.locator('#download').click();assert.match((await downloadEvent).suggestedFilename(),/행정기록/);
  await page.locator('#help').click();await page.locator('#help-sources').click();assert.equal(await page.locator('#modal-body a').count(),6);await close();
  await page.locator('#restart').click();await page.locator('#confirm-restart').click();assert.equal((await saved()).turn,0);
  await page.getByRole('button',{name:'마을 지도',exact:true}).click();
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'390px overflow');await screenshot('mobile');
  await page.setViewportSize({width:320,height:720});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'320px overflow');
  await page.setViewportSize({width:1440,height:1050});

  // Departure, route pricing, family story, arrival letter and saved RNG.
  await load({...freshGame(42)});await page.locator('[data-action="emigrate"]').click();
  await page.locator('#voyage-supplies').check();assert.match(await page.locator('#voyage-plan').textContent(),/£72/);
  assert.equal(await page.locator('#voyage-destination option[value="australia"]').evaluate(el=>el.disabled),true);
  await page.locator('#execute-action').click();assert.equal((await saved()).population,1140);assert.equal((await saved()).voyages[0].passengers,60);
  await page.locator('#next-month').click();assert.match(await page.locator('#modal-body').textContent(),/식탁/);
  await answerPopup(1);await page.locator('#next-month').click();
  assert.match(await page.locator('#modal-body').textContent(),/도착하지 못한 이름들/);await screenshot('voyage-letter');
  const arrival=await saved();assert.equal(arrival.resettled+arrival.seaDeaths,60);assert.ok(arrival.seaDeaths>0);await close();
  await page.reload({waitUntil:'networkidle'});assert.equal((await saved()).seaDeaths,arrival.seaDeaths);await close();

  // Workhouse support triggers a personal popup, then heavy labour adds hazards.
  await load(fixture(1,{food:100,grain:110,storySeen:[]}));await act('workhouse');
  assert.match(await page.locator('#modal-body').textContent(),/메리/);assert.equal((await saved()).workhouse,60);await answerPopup(1);
  await act('works');assert.ok((await saved()).laborStrain>0);await page.locator('#next-month').click();await answerPopup(1);await close();

  // The seed family cannot be skipped by closing the popup.
  await load(fixture(25,{food:100,storySeen:stories.filter(id=>id!=='seed-family')}));
  assert.match(await page.locator('#modal-body').textContent(),/노라/);await screenshot('seed-family');await close();
  await page.locator('#next-month').click();assert.equal((await saved()).turn,25);await answerPopup(1);
  assert.equal((await saved()).seedReserve,92);assert.equal((await saved()).food,96);

  // Unhealthy models, rain toggle, fever forecast and treatment.
  await load(fixture(30,{food:0,workhouse:180,hunger:65,fever:65,laborStrain:70,morale:60,unrest:20}));
  assert.ok(await page.locator('.resident.emaciated').count()>0);assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('town-distressed')),true);
  assert.match(await page.locator('#forecast').textContent(),/질병/);await screenshot('fever');
  await page.locator('#motion-toggle').click();assert.equal(await page.locator('.cold-rain').isVisible(),false);
  const feverBefore=(await saved()).fever;await act('sanitation');assert.equal((await saved()).fever,feverBefore-22);

  // Both riot decisions are playable and have different irreversible consequences.
  await load(fixture(30,{food:100,grain:110,unrest:80,hunger:80,morale:20,workhouse:60}));
  assert.equal(await page.locator('[data-crisis="suppress"]').isVisible(),true);await screenshot('riot');await close();
  await page.locator('#next-month').click();assert.equal((await saved()).turn,30);await page.locator('[data-crisis="suppress"]').click();
  assert.ok((await saved()).violenceDeaths>0);assert.equal((await saved()).population+(await saved()).deaths,1200);
  await load(fixture(30,{food:100,grain:110,unrest:80,hunger:80,morale:20,workhouse:60}));
  await page.locator('[data-crisis="standaside"]').click();assert.equal((await saved()).riotRetaliation,true);assert.equal(await page.locator('#exports').isDisabled(),true);
  await page.locator('#next-month').click();assert.equal((await saved()).lastReport.collectiveEviction,true);assert.equal((await saved()).lastReport.evicted,1140);await close();

  // A full control campaign confirms the final date; in-transit lives remain unresolved.
  await load(fixture());for(let i=0;i<96;i++)await page.locator('#next-month').click();
  assert.equal((await saved()).turn,96);assert.equal((await saved()).ended,true);await close();
  assert.equal(await page.locator('.action:enabled').count(),0);
  await load(fixture(95,{food:100,money:200}));await page.locator('[data-action="emigrate"]').click();await page.locator('#voyage-destination').selectOption('australia');await page.locator('#execute-action').click();
  await page.locator('#next-month').click();const final=await saved();assert.equal(final.ended,true);assert.equal(final.voyages[0].passengers,40);assert.equal(final.resettled,0);assert.match(await page.locator('#modal-body').textContent(),/항해 중 · 결말 미확인/);await screenshot('ending');await close();
  await page.reload({waitUntil:'networkidle'});assert.equal((await saved()).ended,true);await page.locator('#next-month').click();await close();

  // Migration preserves the old record and backs it up before writing version 2.
  const legacy={...freshGame(),version:1};for(const key of ['morale','fever','laborStrain','workhouse','unrest','seedReserve','voyages','resettled','seaDeaths','violenceDeaths','feverDeaths','rng','voyageSerial','emigrationReady','riotReady','riotRetaliation','storySeen'])delete legacy[key];
  await load(legacy);assert.equal((await saved()).version,2);assert.equal((await saved()).population,1200);assert.ok(await page.evaluate(()=>localStorage.getItem('last-harvest-v1-backup')));
  assert.deepEqual(errors,[]);
  console.log('Browser checks passed: original controls, save/reload, downloads, 320/390px layouts, migration, departure/arrival and family letters, both routes, workhouses, labour, personal choices, seed reserves, fever and resident models, rain toggle, both riot outcomes, 96-month ending and unresolved passengers.');
}finally{await browser.close();}
