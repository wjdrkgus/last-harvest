import {freshGame,dateOf,seasonOf,quotaOf,foodNeed,eventFor,choiceReason,chooseEvent,ACTIONS,actionReason,takeAction,setPolicy,forecast,advanceMonth,serialize,restore,HARVEST,atSea,livingTotal,voyageTerms,ROUTES,crisisFor,resolveCrisis,monthBlock,FOODS} from './engine.js';
import {townMap,residentPortraits} from './map.js';
const $=id=>document.getElementById(id),KEY='last-harvest-v1';
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:1});
const newGame=()=>freshGame(crypto.getRandomValues(new Uint32Array(1))[0]);
let storageAvailable=true,invalidSave=false,migratedSave=false,motionEnabled=!matchMedia('(prefers-reduced-motion: reduce)').matches;
let state=newGame();
try{
  const raw=localStorage.getItem(KEY);
  if(raw){const saved=restore(raw);if(saved){state=saved;const oldVersion=JSON.parse(raw).version;migratedSave=oldVersion<3;const backupKey=oldVersion===1?KEY+'-backup':KEY+'-v2-backup';if(migratedSave&&!localStorage.getItem(backupKey))localStorage.setItem(backupKey,raw);}else invalidSave=true;}
  const motion=localStorage.getItem('last-harvest-motion');if(motion!==null)motionEnabled=motion==='on';
}catch{storageAvailable=false;}
let activeView='village',toastTimer;const presentedNotices=new Set();
let closingMonth=false,stampCleanup=null;
function cancelStamp(){if(stampCleanup){const cleanup=stampCleanup;stampCleanup=null;cleanup();}}
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3800);}
function save(){try{localStorage.setItem(KEY,serialize(state));storageAvailable=true;}catch{storageAvailable=false;}$('save-status').textContent=storageAvailable?'이 브라우저에 자동 저장됨':'저장 불가 · 이 창에서만 유지';}
function modal(html){cancelStamp();$('modal-body').innerHTML=html;if(!$('modal').open)$('modal').showModal();$('modal-body').scrollTop=0;$('modal').scrollTop=0;}
function closeModal(){if(closingMonth)return;cancelStamp();$('modal').close();}
$('close-modal').addEventListener('click',closeModal);
$('modal').addEventListener('cancel',e=>{if(closingMonth)e.preventDefault();else cancelStamp();});
$('modal').addEventListener('click',e=>{if(e.target===$('modal')){const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
function applyChoice(index){const r=chooseEvent(state,index);if(r.error){toast(r.error);return;}state=r.state;closeModal();save();render();toast('당신의 결정을 행정 기록에 남겼습니다.');showTurnNotice();}
function choiceButtons(event,attribute='data-choice'){
  return event.choices.map((c,i)=>`<button class="choice" ${attribute}="${i}" ${choiceReason(state,i)?'disabled':''} title="${esc(choiceReason(state,i)||c.effect)}">${esc(c.label)}<small>${esc(c.effect)}</small></button>`).join('');
}
function showCrisis(){
  const c=crisisFor(state);if(!c)return;
  presentedNotices.add(`riot:${state.turn}`);
  const victims=Math.min(state.population,Math.ceil(state.population*.018+state.unrest*.08));
  const displaced=Math.max(0,state.population-state.workhouse-state.homeless);
  modal(`<span class="eyebrow">THE GRANARY RIOT · 결정이 필요한 위기</span><h2>${c.title}</h2><p>${c.body}</p><div class="story-choices"><button class="choice crisis-choice" data-crisis="suppress">영국군을 불러 발포를 허가한다<small>주민 ${victims}명 즉시 사망 · 사기 −24 · 평판 −22 · 압력 −16 · 불안 −52</small></button><button class="choice" data-crisis="standaside">군을 부르지 않고 길을 열어 준다<small>봉인 곡물 약탈 · 60% 식량화 · 월말 최대 ${displaced}명 추가 축출 · 압력 +18</small></button></div><p class="story-foot">창을 닫고 장부를 확인할 수 있습니다. 어느 쪽이든 결정해야 다음 달로 진행됩니다.</p>`);
  $('modal-body').querySelectorAll('[data-crisis]').forEach(b=>b.onclick=()=>{const r=resolveCrisis(state,b.dataset.crisis);if(r.error){toast(r.error);return;}state=r.state;closeModal();save();render();if(state.ended)resultSummary();else showTurnNotice();});
}
function showTurnNotice(force=false){
  if($('modal').open||state.ended)return;
  if(crisisFor(state)){if(force||!presentedNotices.has(`riot:${state.turn}`))showCrisis();return;}
  const e=eventFor(state),key=`story:${state.turn}:${e.id}`;
  if(e.personal&&!state.eventDone&&(force||!presentedNotices.has(key))){
    presentedNotices.add(key);modal(`<span class="eyebrow">A LIFE IN KILMORA · ${esc(e.tag)}</span><div class="story-ornament" aria-hidden="true">❦</div><h2>${esc(e.title)}</h2><p>${esc(e.body)}</p><div class="story-choices">${choiceButtons(e,'data-story-choice')}</div><p class="story-foot">이 인물과 사연은 게임을 위해 구성한 가상 서사입니다.</p>`);
    $('modal-body').querySelectorAll('[data-story-choice]').forEach(b=>b.onclick=()=>applyChoice(+b.dataset.storyChoice));return;
  }
  const letters=state.lastReport?.voyageLetters||[],letterKey=`letters:${state.turn}`;
  if(letters.length&&!presentedNotices.has(letterKey)){
    presentedNotices.add(letterKey);modal(`<span class="eyebrow">A LETTER FROM ACROSS THE SEA</span><h2>도착하지 못한 이름들</h2><p>출항일에 적었던 명부가 항구로 돌아왔습니다. 남겨진 가족들이 봉투를 열기 전에 당신의 표정을 살핍니다.</p>${letters.map(l=>`<div class="voyage-letter"><h3>${esc(l.destination)}행 선박</h3><p>${l.passengers}명 승선 · <strong>${l.arrived}명 도착</strong> · <strong class="danger">${l.dead}명 해상 사망</strong></p></div>`).join('')}<p class="story-foot">해상 사망은 총 사망자에 포함되며 주민 사기와 행정관 평판에 영향을 줍니다.</p><div class="modal-actions"><button id="letter-close">이름들을 기록한다</button></div>`);$('letter-close').onclick=()=>{closeModal();showTurnNotice();};
  }
}
function resultSummary(){
  const known=state.population+state.resettled,sea=atSea(state),rate=(known/1200*100).toFixed(1);
  modal(`<span class="eyebrow">${state.turn>=96?'DECEMBER 1852 · THE RECORD REMAINS':'THE RECORD ENDS HERE'}</span><h2>${known?'마지막 겨울을 건넌 사람들':'더는 부를 이름이 없습니다'}</h2><p>킬모라에 처음 살던 1,200명 가운데</p><div class="big-number">${num(known)} <small>명의 생존이 확인되었습니다</small></div><div class="result-grid"><div>마을에 남음<strong>${num(state.population)}</strong></div><div>해외에 정착<strong>${num(state.resettled)}</strong></div><div>총 사망<strong>${num(state.deaths)}</strong></div><div>그중 해상 사망<strong>${num(state.seaDeaths)}</strong></div><div>그중 발포 사망<strong>${num(state.violenceDeaths)}</strong></div><div>그중 괴혈병 사망<strong>${num(state.scurvyDeaths)}</strong></div><div>그중 펠라그라 사망<strong>${num(state.pellagraDeaths)}</strong></div><div>그중 티푸스 사망<strong>${num(state.feverDeaths)}</strong></div><div>항해 중 · 결말 미확인<strong>${num(sea)}</strong></div></div><p>확인 생존 비율 ${rate}% · ${state.turn}개월의 기록. ${sea?'아직 항해 중인 주민은 정착 생존자로 계산하지 않았습니다.':''} 이 결과는 실제 대기근의 생존율 추정치가 아닙니다.</p><div class="modal-actions"><button id="result-download">기록 내려받기</button><button id="result-restart">새 기록 시작</button></div>`);
  $('result-download').onclick=download;$('result-restart').onclick=restartDialog;
}
function resource(title,value,unit,foot,icon,gold=false){return `<article class="resource ${gold?'gold':''}"><div class="resource-head"><span>${title}</span>${gold?'<span class="lock-tag">봉인</span>':`<span class="icon" aria-hidden="true">${icon}</span>`}</div><div class="resource-number">${value}<small>${unit}</small></div><div class="resource-foot">${foot}</div></article>`;}
const cowIcon='<svg viewBox="0 0 50 35" aria-hidden="true"><path d="M10 12h24v14H10Zm24 2 9-3v11h-9M12 26v7m7-7v7m11-7v7m-22-19L4 8v12M38 12l-2-7m7 6 3-7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 12v6h8v-6" fill="currentColor"/></svg>';
let lastCargoDrag=-1000;
function renderCargo(){
  const blocked=state.ended||state.riotRetaliation||closingMonth,max=Math.min(4,state.cattle),available=Math.max(0,max-state.cattleExport);
  $('cattle-stock').innerHTML=Array.from({length:available},(_,i)=>`<button type="button" class="cattle-token" draggable="${!blocked}" data-cattle-load="${i}" aria-label="가축 1마리 선적" ${blocked?'disabled':''}>${cowIcon}<span>1마리</span></button>`).join('')||'<span class="cargo-empty">선적 대기 없음</span>';
  const load=()=>{if(blocked)return;state=setPolicy(state,{cattleExport:state.cattleExport+1});save();render();};
  $('cattle-stock').querySelectorAll('[data-cattle-load]').forEach(button=>{
    button.onclick=e=>{if(e.detail&&performance.now()-lastCargoDrag<300)return;load();if(!e.detail)$('cattle-stock').querySelector('button')?.focus({preventScroll:true});};
    button.ondragstart=e=>{if(blocked){e.preventDefault();return;}lastCargoDrag=performance.now();e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',`last-harvest-cattle:${state.turn}`);button.classList.add('dragging');};
    button.ondragend=()=>{lastCargoDrag=performance.now();button.classList.remove('dragging');$('ship-cargo').classList.remove('drag-over');};
  });
  $('ship-cargo').ondragover=e=>{if(blocked)return;e.preventDefault();e.dataTransfer.dropEffect='move';$('ship-cargo').classList.add('drag-over');};
  $('ship-cargo').ondragleave=e=>{if(!$('ship-cargo').contains(e.relatedTarget))$('ship-cargo').classList.remove('drag-over');};
  $('ship-cargo').ondrop=e=>{e.preventDefault();$('ship-cargo').classList.remove('drag-over');if(e.dataTransfer.getData('text/plain')!==`last-harvest-cattle:${state.turn}`)return;lastCargoDrag=performance.now();load();};
  $('cargo-count').textContent=`${state.cattleExport}마리 선적 · ${state.cattleExport*4}단위 대납`;
  $('loaded-cattle').innerHTML=Array.from({length:state.cattleExport},()=>`<button type="button" class="cargo-return" aria-label="가축 1마리 선적 취소" ${blocked?'disabled':''}>${cowIcon}<span>되돌리기</span></button>`).join('');
  $('loaded-cattle').querySelectorAll('button').forEach(b=>b.onclick=()=>{state=setPolicy(state,{cattleExport:state.cattleExport-1});save();render();});
}
function approvalDocument(){
  if(closingMonth)return;
  const f=forecast(state),d=dateOf(state);
  modal(`<div class="export-writ"><div class="writ-topline"><span>RELIEF COMMISSION</span><span>No. ${String(state.turn+1).padStart(3,'0')} / KILMORA</span></div><div class="wax-seal writ-wax" aria-hidden="true"><span>♛</span>V · R</div><p class="writ-destination">TO THE AGENT IN LONDON</p><h2>수출·배급 집행 승인서</h2><p class="writ-date">${d.year}년 ${d.month}월 · 지방 행정관 결재</p><dl class="writ-ledger"><div><dt>항구로 보낼 곡물</dt><dd>${num(f.grainShipped)}단위</dd></div><div><dt>선적된 가축</dt><dd>${f.cattleShipped}마리</dd></div><div><dt>소작료 할당량 / 미납</dt><dd>${f.quota} / ${num(f.shortfall)}단위</dd></div><div><dt>주민에게 돌아갈 식량</dt><dd>${num(f.foodUsed)}단위</dd></div><div><dt>예상 마을 사망 / 축출</dt><dd>${f.lost}명 / ${f.evicted}명</dd></div></dl><p class="writ-clause">이 서명 아래 자산은 항구로 이송되고, 배급과 축출 명령이 함께 집행됩니다. 마을의 이름을 대신하여 승인합니다.</p><div class="seal-space"><div id="approval-imprint" class="approval-imprint" aria-hidden="true">APPROVED<span>EXPORT · KILMORA</span></div><button type="button" id="approval-seal" class="approval-seal" aria-describedby="seal-instruction"><span class="seal-crown" aria-hidden="true">♛</span><strong>EXPORT<br>APPROVAL</strong><span id="seal-progress">누르고 유지</span></button></div><p id="seal-instruction" class="seal-instruction">도장을 1.4초 이상 누른 뒤, 도장 안에서 놓으세요.<br>키보드: Space 또는 Enter를 누르고 유지한 뒤 놓기. 짧게 누르거나 밖으로 옮기면 취소됩니다.</p><button id="cancel-writ" class="writ-cancel">아직 승인하지 않는다</button></div>`);
  $('cancel-writ').insertAdjacentHTML('beforebegin','<details class="seal-alternative"><summary>길게 누르기 어려운 경우</summary><p>두 동작으로 결재할 수 있습니다. 마지막 날인 때 월말이 집행됩니다.</p><button id="ink-seal" type="button">1. 인장에 잉크를 묻힌다</button><button id="place-seal" type="button" hidden>2. 서류에 도장을 찍는다</button></details>');
  $('cancel-writ').onclick=closeModal;
  const button=$('approval-seal');let start=0,frame=0,active=null,pointer=null;
  const reset=()=>{cancelAnimationFrame(frame);start=0;active=null;button.classList.remove('pressing');button.style.setProperty('--seal-progress','0deg');if($('seal-progress'))$('seal-progress').textContent='누르고 유지';if(pointer!==null&&button.hasPointerCapture(pointer))button.releasePointerCapture(pointer);pointer=null;};
  const tick=()=>{if(!start)return;const progress=Math.min(1,(performance.now()-start)/1400);button.style.setProperty('--seal-progress',`${progress*360}deg`);$('seal-progress').textContent=progress>=1?'놓아서 날인':'누른 채 유지';frame=requestAnimationFrame(tick);};
  const begin=kind=>{if(closingMonth||active)return;reset();active=kind;start=performance.now();button.classList.add('pressing');stampCleanup=reset;tick();};
  const commit=()=>{if(closingMonth)return;reset();closingMonth=true;button.disabled=true;$('ink-seal').disabled=true;$('place-seal').disabled=true;$('close-modal').disabled=true;$('cancel-writ').disabled=true;$('approval-imprint').classList.add('visible');$('modal-body').querySelector('.export-writ').classList.add('sealed');setTimeout(silentMonth,240);};
  const finish=kind=>{if(active!==kind)return;const valid=performance.now()-start>=1400;reset();if(valid)commit();};
  $('ink-seal').onclick=()=>{reset();$('ink-seal').disabled=true;$('ink-seal').textContent='1. 인장에 잉크가 묻었습니다';$('place-seal').hidden=false;$('place-seal').focus();};
  $('place-seal').onclick=commit;
  $('place-seal').onkeydown=e=>{if(e.repeat)e.preventDefault();};
  button.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();begin('pointer');pointer=e.pointerId;button.setPointerCapture(pointer);};
  button.onpointermove=e=>{if(active!=='pointer')return;const r=button.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)reset();};
  button.onpointerup=e=>{e.preventDefault();const r=button.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){reset();return;}finish('pointer');};button.onpointercancel=reset;button.onlostpointercapture=()=>{if(active==='pointer')reset();};
  button.onkeydown=e=>{if(!['Space','Enter'].includes(e.code))return;e.preventDefault();if(!e.repeat)begin(e.code);};
  button.onkeyup=e=>{if(!['Space','Enter'].includes(e.code))return;e.preventDefault();finish(e.code);};
  button.onclick=e=>e.preventDefault();button.oncontextmenu=e=>e.preventDefault();button.onblur=()=>{if(!closingMonth)reset();};
}
function silentMonth(){
  cancelStamp();clearTimeout(toastTimer);$('toast').classList.remove('visible');$('modal').close();$('close-modal').disabled=false;
  document.querySelector('main').inert=true;document.querySelector('.rail').inert=true;
  $('month-mark').textContent='';$('month-veil').classList.add('visible');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(()=>{
    state=advanceMonth(state);save();render();const d=dateOf(state);$('month-mark').textContent=state.ended?'행정 기록 마감':`${d.year} · ${String(d.month).padStart(2,'0')}`;
    $('month-announcement').textContent=state.ended?'행정 기록 마감':`${d.year}년 ${d.month}월. 소작료 할당량 ${quotaOf(state)}단위.`;
    setTimeout(()=>{$('month-veil').classList.remove('visible');document.querySelector('main').inert=false;document.querySelector('.rail').inert=false;closingMonth=false;renderCargo();$('next-month').focus({preventScroll:true});if(state.ended)resultSummary();else showTurnNotice();},reduced?120:420);
  },reduced?120:380);
}
function render(){
  const t=Math.max(0,state.turn-(state.ended?1:0)),display={year:Math.min(1852,1845+Math.floor(t/12)),month:t%12+1};
  const f=forecast(state),q=quotaOf(state),need=foodNeed(state),crisis=crisisFor(state);
  document.body.classList.toggle('motion-paused',!motionEnabled);document.body.classList.toggle('town-distressed',state.hunger>50||state.fever>=50||state.vitaminC<30||state.niacin<30);document.body.classList.toggle('town-crisis',!!crisis);
  $('motion-toggle').textContent=motionEnabled?'비 연출 켜짐':'비 연출 꺼짐';$('motion-toggle').setAttribute('aria-pressed',String(motionEnabled));
  $('date').textContent=`${display.year}년 ${display.month}월`;$('season').textContent=seasonOf(state);$('turn').textContent=state.ended?'기록 종료':`${state.turn+1} / 96개월`;
  $('resources').innerHTML=resource('마을에 남은 주민',num(state.population),'명',`총 사망 ${num(state.deaths)}명 <span class="${state.homeless?'bad':''}">· 노숙 ${num(state.homeless)}명</span>`,'♧')+resource('주민의 식량',num(state.food),'단위',`정상 배급 <span class="${state.food<need?'bad':'good'}">${need?num(state.food/need):0}개월분</span>`,'◒')+resource('수출용 곡물',num(state.grain),'단위','주민 배급에 자동 사용되지 않음','',true)+resource('지주의 가축',num(state.cattle),'마리','대납 가능 · 도축 시 행정 압력','',true)+resource('구호 기금',`£${num(state.money)}`,'',`대체 경작 ${state.crops}/5 · 진료소 ${state.clinic}/3`,'✧');
  $('crisis-banner').classList.toggle('hidden',!crisis&&!state.riotRetaliation);
  $('crisis-banner').innerHTML=crisis?'<div><strong>식량 폭동 · 창고와 항구에 주민들이 모였습니다.</strong><span>위기에 대응해야 월말을 마감할 수 있습니다.</span></div><button id="review-crisis">결정하러 가기 →</button>':state.riotRetaliation?'<div><strong>집단 축출 예고</strong><span>다음 월말에 구빈원 밖의 모든 주거지에 축출이 집행됩니다. 겨울 노출 피해를 확인하세요.</span></div>':'';
  if($('review-crisis'))$('review-crisis').onclick=showCrisis;
  $('map').innerHTML=townMap(state);
  $('map-weather').textContent=state.ended?'행정관의 기록이 마감되었습니다.':crisis?'항구의 빗소리 사이로 사람들의 외침이 들립니다.':state.hunger>45?'차가운 비 속에서 주민들의 등이 굽어 갑니다.':state.fever>=50?'비에 젖은 구빈원에서 기침 소리가 멎지 않습니다.':'대서양의 차가운 비가 지붕과 밭을 두드립니다.';
  $('map').querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>placeInfo(b.dataset.place));
  renderSurvival();renderNutrition();renderVoyages();
  $('ration-value').textContent=`${num(need*state.ration)}단위 / 월`;
  $('rations').querySelectorAll('button').forEach(b=>{b.classList.toggle('selected',+b.dataset.ration===state.ration);b.setAttribute('aria-pressed',String(+b.dataset.ration===state.ration));b.disabled=state.ended;});
  $('exports').max=q;$('exports').value=state.exportTarget;$('exports').disabled=state.ended||state.riotRetaliation;
  $('export-label').textContent=`${state.exportTarget} / ${q}단위`;
  renderCargo();
  $('food-hint').textContent=`1단위 = 50명의 한 달 칼로리. 칼로리 결핍 ${num(state.hunger)} / 100. ${state.ration<1?'긴축 배급은 허기와 불안을 누적시킵니다.':'칼로리를 채워도 비타민 결핍은 남을 수 있습니다.'}`;
  $('food-policies').querySelectorAll('button').forEach(b=>{b.classList.toggle('selected',b.dataset.foodPolicy===state.foodPolicy);b.setAttribute('aria-pressed',String(b.dataset.foodPolicy===state.foodPolicy));b.disabled=state.ended;});
  $('forecast').innerHTML=state.ended?'기록이 마감되었습니다. 장부와 행정 기록을 살펴볼 수 있습니다.':crisis?'<span class="danger">폭동 대응 대기 · 대응을 정한 뒤 월말 예상이 확정됩니다.</span>':`<span>월말 예상</span><span>배급 <strong>${num(f.foodUsed)}</strong></span><span>할당량 <strong class="${f.shortfall?'danger':''}">${num(f.quota-f.shortfall)} / ${q}</strong></span><span>마을 사망 <strong class="${f.lost?'danger':''}">${f.lost}명</strong></span><span>그중 질병 <strong class="${f.disease?'danger':''}">${f.disease}명</strong></span><span>축출 <strong class="${f.evicted?'danger':''}">${f.evicted}명</strong></span>${f.harvest?`<span>9월 수확 <strong>+${f.harvest}</strong></span>`:''}${f.aid+f.workhouseFood?`<span>구호 <strong>+${num(f.aid+f.workhouseFood)}</strong></span>`:''}${f.voyageLetters.length?'<span>이민선 도착 예정 · 항해 결과는 편지로 확인</span>':''}${f.punished?'<span class="danger">⚑ 군경 징벌 예상</span>':''}`;
  const e=eventFor(state);$('event-tag').textContent=state.ended?'마지막 장':crisis?'긴급 위기':e.tag;$('event-title').textContent=state.ended?'남겨진 이름들':crisis?crisis.title:e.title;
  $('event-body').textContent=state.ended?`마을 ${num(state.population)}명, 해외 정착 ${num(state.resettled)}명, 항해 중 ${atSea(state)}명. 사망한 ${num(state.deaths)}명의 이름도 이 기록에 남습니다.`:crisis?crisis.body:e.body;
  $('event-choices').innerHTML=state.ended?'<button class="choice" id="show-results">통치 결과 보기 ↗</button>':crisis?'<button class="choice crisis-choice" id="desk-crisis">창고 앞의 위기에 대응한다 →</button>':state.eventDone?'<div class="event-resolved">✓ 이번 달의 결정을 기록했습니다.<br><small>배분과 행정 조치를 확인한 뒤 월말을 마감하세요.</small></div>':choiceButtons(e);
  $('event-choices').querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>applyChoice(+b.dataset.choice));
  if($('show-results'))$('show-results').onclick=resultSummary;if($('desk-crisis'))$('desk-crisis').onclick=showCrisis;
  $('action-count').textContent=`${state.ended?0:state.actionsLeft} / 2 남음`;
  const icons={import:'⇣',freshFood:'❧',divert:'⚿',crops:'♧',shelter:'⌂',petition:'✉',works:'⚒',clinic:'✚',slaughter:'◇',emigrate:'⚓',workhouse:'▥',release:'⇥',sanitation:'✧'};
  const subs={import:'£58 · 옥수수 +36',freshFood:'£44 · 다양한 식품 +18',divert:'곡물 → 식량 · 압력 +24',crops:'£52 · 매월 신선식품 +2.4',shelter:'£32 · 최대 90명 수용',petition:'£6 · 월말 옥수수 +26',works:'정부 £32 · 중노동·발열',clinic:'£42 · 질병 피해 완화',slaughter:'가축 4 → 식량 24',emigrate:'£48부터 · 항해 사망 위험',workhouse:'£10 · 정부 지원·과밀',release:'최대 60명 · 거처 필요',sanitation:'£24 · 발열 −22 · 이 노출 −28'};
  $('actions').innerHTML=Object.entries(ACTIONS).map(([id,a])=>`<button class="action ${['divert','slaughter','emigrate','works','workhouse'].includes(id)?'risky':''}" data-action="${id}" ${actionReason(state,id)?'disabled':''} title="${esc(actionReason(state,id)||a.desc)}"><span class="action-symbol" aria-hidden="true">${icons[id]}</span><strong>${a.name}${state.used.includes(id)?' ✓':''}</strong><small>${esc(actionReason(state,id)||subs[id])}</small></button>`).join('');
  $('actions').querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>actionDialog(b.dataset.action));
  $('trust-meter').style.width=state.trust+'%';$('trust-value').textContent=Math.round(state.trust)+'%';$('pressure-meter').style.width=state.pressure+'%';$('pressure-value').textContent=Math.round(state.pressure)+'%';
  $('pressure-note').textContent='월말 행정 압력 65 이상: 기금·곡물 압수와 최대 45명 축출. 할당량 완납 시 압력 −5. 가족의 사망과 발포는 사기·평판에도 상처를 남깁니다.';
  $('footer-note').textContent=state.lastReport?`지난달 마을 사망 ${state.lastReport.lost}명 · 해상 사망 ${state.lastReport.seaLost||0}명 · 축출 ${state.lastReport.evicted}명`:'목표: 1852년 12월까지, 마을을 떠난 사람까지 한 명이라도 더 살려내세요.';
  $('next-month').innerHTML=state.ended?'마지막 기록을 펼치다 <span>↗</span>':crisis?'폭동에 대응하다 <span>→</span>':'집행 공문을 펼치다 <span>→</span>';
  renderLedger();renderJournal();
}
function renderSurvival(){
  const item=(name,value,detail,danger=false)=>`<div class="hardship-stat ${danger?'critical':''}"><span>${name}</span><strong>${value}</strong><small>${detail}</small></div>`;
  $('survival-monitor').innerHTML=`${residentPortraits(state)}<div class="hardship-grid">${item('주민 사기',num(state.morale)+'%','죽음과 가족 분리의 무게',state.morale<35)}${item('발열 위험',num(state.fever)+'/100',state.fever>=35?'발진티푸스 사망 위험':'35부터 전염병 사망 발생',state.fever>=35)}${item('사회 불안',num(state.unrest)+'/100','65부터 식량 폭동',state.unrest>=55)}${item('구빈원',state.workhouse+' / 240명','120명 초과 시 과밀 가중',state.workhouse>120)}${item('노동 부담',num(state.laborStrain)+'/100','중노동 → 발열 위험',state.laborStrain>=35)}${item('씨감자 비축',num(state.seedReserve)+'%','다음 감자 수확에 반영',state.seedReserve<80)}</div>`;
}
function renderNutrition(){
  const f=forecast(state);
  $('human-note').textContent=state.vitaminC<30?'배급은 적혀 있었다. 아물지 않는 상처는 적혀 있지 않았다.':state.niacin<30?'매일 같은 그릇이었다. 몸은 그것만으로 버티지 못했다.':state.hunger>50?'이름을 부르면, 어제보다 작은 목소리가 돌아왔다.':'장부에는 이름 대신 단위가 적혀 있었다.';
  $('nutrition-monitor').innerHTML=`<div class="nutrition-heading"><button id="nutrition-help" class="text-link">식단과 질병의 관계 ↗</button></div><div class="nutrition-indices"><div class="${state.vitaminC<30?'deficient':''}"><span>비타민 C 상태</span><strong>${num(state.vitaminC)} / 100</strong><small>${state.cDeficientMonths?`낮은 상태 ${state.cDeficientMonths}개월 · 괴혈병 위험`:'감자·신선식품의 공급과 저장 상태'}</small></div><div class="${state.niacin<30?'deficient':''}"><span>니아신·단백질 충족 상태</span><strong>${num(state.niacin)} / 100</strong><small>${state.bDeficientMonths?`낮은 상태 ${state.bDeficientMonths}개월 · 펠라그라 위험`:'이용 가능한 B3와 트립토판 공급'}</small></div><div><span>이·위생 노출 지수</span><strong>${num(state.licePressure)} / 100</strong><small>영양 결핍이 감염을 스스로 만들지는 않음</small></div></div><div class="food-stocks">${Object.entries(FOODS).map(([id,food])=>`<span><i class="food-dot ${id}"></i>${food.name}<strong>${num(state.provisions[id])}</strong></span>`).join('')}</div><p class="nutrition-note">이번 배급의 상대 충족도: 비타민 C ${num(f.cAdequacy*100)}% · 니아신 ${num(f.b3Adequacy*100)}%. 지수와 시간·사망 규칙은 게임용 추정값이며 임상 수치가 아닙니다.</p><p class="nutrition-note">월말 예상 사망: 괴혈병 ${f.scurvyDeaths}명 · 펠라그라 ${f.pellagraDeaths}명 · 티푸스 ${f.typhusDeaths}명</p>`;
  $('nutrition-help').onclick=nutritionHelp;
}
function renderVoyages(){
  $('voyages-panel').innerHTML=`<div class="panel-heading"><div><span class="eyebrow">THE ONES WHO LEFT</span><h2>바다 너머의 이름들</h2></div><span class="subtle">출항은 생존이 아닙니다</span></div><div class="migration-totals"><span>항해 중 <strong>${atSea(state)}명</strong></span><span>정착 확인 <strong>${state.resettled}명</strong></span><span>해상 사망 <strong class="${state.seaDeaths?'danger':''}">${state.seaDeaths}명</strong></span></div><div class="voyage-list">${state.voyages.length?state.voyages.map(v=>`<article class="voyage-row"><div><strong>${esc(ROUTES[v.destination].name)}</strong><small>${v.passengers}명 승선 · ${v.provisioned?'추가 보급':'최소 보급'} · 사망 위험 ${Math.round(v.risk*100)}%</small></div><span>${v.remaining}개월 남음</span></article>`).join(''):'<p class="empty-voyage">항구를 떠난 뒤에도, 그 사람들의 운명을 기다립니다.</p>'}</div>`;
}
function renderLedger(){
  const q=quotaOf(state),f=forecast(state);
  $('ledger').innerHTML=`<p class="ledger-explainer">같은 땅에서 자란 식량.<br>그러나 같은 사람의 몫은 아닙니다.</p><div class="ledger-row"><span>주민에게 배급할 수 있는 식량</span><span>${num(state.food)}</span></div><div class="ledger-row"><span>주민이 먹을 수 없는 봉인 곡물</span><span>${num(state.grain)}</span></div><div class="ledger-row"><span>이번 달 계약 / 예상 미납</span><span>${q} / ${num(f.shortfall)}</span></div><div class="ledger-row"><span>행정 수입 / 진료소 운영비</span><span>£${num(f.income)} / £${num(f.upkeep)}</span></div><div class="ledger-row"><span>누적 괴혈병 / 펠라그라 / 티푸스 사망</span><span>${state.scurvyDeaths} / ${state.pellagraDeaths} / ${state.feverDeaths}명</span></div><div class="ledger-row population-equation"><span>마을 + 정착 + 항해 중 + 사망</span><span>${state.population} + ${state.resettled} + ${atSea(state)} + ${state.deaths} = 1200</span></div><div class="ledger-block"><h3>유보는 곧 배급이 아닙니다.</h3><p>곡물은 창고 개방 명령으로만 주민 식량이 됩니다. 구빈원 지원은 수용자 몫만큼, 공공근로 구호는 노동의 대가로 들어옵니다. 그 대가에는 과밀과 질병이 따릅니다.</p></div><div class="history-chart" role="img" aria-label="월별 마을 인구: 처음 1200명, 현재 ${state.population}명">${[1200,...state.history.map(r=>r.survivors)].map(n=>`<i style="height:${Math.max(1,n/1200*100)}%" title="마을 ${n}명"></i>`).join('')}</div><div class="history-chart-label">1845년 1월 → 현재 · 마을 인구 변화. 이민으로 떠난 주민은 별도 추적합니다.</div>`;
}
function renderJournal(){
  $('journal').innerHTML=state.log.map(e=>{const t=Math.min(e.turn,95);return `<article class="entry ${e.tone==='danger'?'danger':''}"><time>${1845+Math.floor(t/12)}<br>${String(t%12+1).padStart(2,'0')}월</time><div><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p></div></article>`;}).join('');
}
function actionDialog(id){
  const a=ACTIONS[id],risky=['divert','slaughter','emigrate','works','workhouse'].includes(id);
  const extra=id==='emigrate'?`<div class="voyage-form"><label for="voyage-destination">이민 항로<select id="voyage-destination"><option value="america">북미행 · 최대 60명 · 2개월</option><option value="australia" ${dateOf(state).year<1848?'disabled':''}>호주 지원 항로 · 최대 40명 · 4개월${dateOf(state).year<1848?' · 1848년 개방':''}</option></select></label><label class="supply-check"><input type="checkbox" id="voyage-supplies">추가 식량·의료 보급 £24 · 사망 위험 55% 감소</label><div id="voyage-plan" class="modal-callout"></div></div>`:['workhouse','works'].includes(id)?'<p class="modal-callout">정부 지원은 당장의 식사를 돕지만, 과밀과 중노동은 발열 위험을 누적시킵니다. 영양 결핍까지 겹치면 발진티푸스로 사망자가 늘어납니다.</p>':['divert','slaughter'].includes(id)?'<p class="modal-callout">행정 압력과 할당량을 확인하세요. 월말 압력 65 이상이면 징벌이 집행됩니다.</p>':'';
  modal(`<span class="eyebrow">ADMINISTRATIVE ORDER · ${state.actionsLeft} ACTIONS LEFT</span><h2>${a.name}</h2><p>${a.desc}</p>${extra}<p class="order-cost">행정 조치 1회를 사용합니다.${id!=='emigrate'&&a.cost?` 기금 £${a.cost}를 즉시 지출합니다.`:''}</p><div class="modal-actions"><button id="execute-action" class="${risky?'risky':''}">${id==='emigrate'?'출항을 허가한다':'명령 집행'}</button><button id="cancel-action">돌아가기</button></div>`);
  const options=()=>id==='emigrate'?{destination:$('voyage-destination').value,provisioned:$('voyage-supplies').checked}:{};
  const updateVoyage=()=>{const terms=voyageTerms(state,options()),reason=actionReason(state,id,options());$('voyage-plan').innerHTML=`<p><strong>${terms.passengers}명 승선 · 총 £${terms.cost} · ${terms.months}개월</strong><br>승선자 한 명당 해상 사망 위험 ${Math.round(terms.risk*100)}%. 영양 상태와 보급에 따라 달라집니다. 출항 시 사기 −6, 평판 −4. 항해 중에는 마을 식량을 소비하지 않습니다.</p>${reason?`<p class="danger">${esc(reason)}</p>`:''}`;$('execute-action').disabled=!!reason;};
  if(id==='emigrate'){$('voyage-destination').onchange=updateVoyage;$('voyage-supplies').onchange=updateVoyage;updateVoyage();}
  $('cancel-action').onclick=closeModal;$('execute-action').onclick=()=>{const r=takeAction(state,id,options());if(r.error){toast(r.error);return;}state=r.state;closeModal();save();render();toast(`${a.name} 명령을 집행했습니다.`);showTurnNotice();};
}
function placeInfo(id){
  const year=Math.min(1852,dateOf(state).year),f=forecast(state);
  const details={
    fields:['감자밭',`${year}년 기본 수확은 ${HARVEST[year-1845]}단위이며 노동력과 씨감자 비축(${state.seedReserve}%)에 따라 줄어듭니다. 매년 9월 수확합니다. 1846년에는 마름병으로 수확이 거의 사라집니다. 대체 경작은 매월 별도의 식량을 제공합니다.`],
    homes:['마을 주거지',`마을 ${num(state.population)}명, 노숙 ${num(state.homeless)}명, 구빈원 ${state.workhouse}명. 굶주림이 누적되면 주민들의 몸이 앙상해지고 사기가 떨어집니다. 겨울에는 거처 없는 주민의 피해가 커집니다.`],
    granary:['봉인된 곡물 창고',`현재 ${num(state.grain)}단위. 이 물량은 주민 식량으로 자동 전환되지 않습니다. 창고 개방은 배급을 돕지만 행정 압력을 높입니다. 사회 불안이 65에 도달하거나 영양 결핍 70 이상·사기 42 이하가 겹치면 폭동이 일어납니다.`],
    estate:['부재 지주의 저택',`이번 달 할당량은 ${quotaOf(state)}단위입니다. 미달 비율에 따라 최대 54명이 축출됩니다. 압력 65 이상이면 군경 징벌이 집행됩니다. 폭동을 방관하면 별도의 집단 축출이 예고됩니다.`],
    church:['교회와 구호소',`대체 경작 ${state.crops}/5, 진료소 ${state.clinic}/3단계입니다. 진료소는 발열 위험과 질병 사망을 줄이며, 격리·세탁·휴식은 발열 위험과 노동 부담을 낮춥니다.`],
    harbor:['수출과 이민의 항구',`예상 수출은 곡물 ${num(f.grainShipped)}단위와 가축 ${f.cattleShipped}마리입니다. 이민선은 3개월 간격으로 마련할 수 있습니다. 현재 항해 중 ${atSea(state)}명, 정착 확인 ${state.resettled}명, 해상 사망 ${state.seaDeaths}명입니다. 호주 지원 항로는 1848년부터 열립니다.`],
    workhouse:['구빈원',`${state.workhouse}/240명 수용 중입니다. 60명씩 수용·퇴소할 수 있습니다. 수용자는 정부 식량을 받고 겨울 노출 피해를 피하지만, 120명을 넘어서면 과밀 위험이 더 빨리 증가합니다. 퇴소자는 다시 거처가 필요합니다. 발열 위험 35부터 질병 사망이 발생할 수 있습니다.`],
  };const [title,body]=details[id];modal(`<span class="eyebrow">A PLACE IN KILMORA</span><h2>${title}</h2><p>${body}</p>`);
}
function nutritionHelp(){modal(`<h2>칼로리와 영양소는 같은 것이 아닙니다</h2><p>식량 단위는 칼로리를, 두 영양 지수는 식단의 상대적 충족 상태를 표현합니다. 모든 지수·시간·계수는 게임용 추정값입니다. 혈중 농도나 실제 권장 섭취량을 뜻하지 않습니다.</p><h3>감자와 비타민 C</h3><p>감자는 당시 아일랜드 빈농의 주요 비타민 C 공급원이었습니다. 게임에서는 감자 저장 기간이 길어질수록 C 공급이 줄고, 마름병 뒤 곡물·옥수수 중심 식단으로 바뀌면 C 지수가 내려갑니다. 지수 30 미만이 2개월 이상 이어지면 괴혈병 피해를 계산합니다. 채소·콩·우유 확보와 대체 경작으로 식단을 보완할 수 있습니다.</p><h3>옥수수와 펠라그라</h3><p>옥수수가 독이어서 병이 생기는 것은 아닙니다. 이용 가능한 니아신과 단백질의 트립토판이 부족한 단조로운 식사를 오래 지속하는 것이 문제입니다. 다양한 식품과 동물성 식품은 니아신·단백질 공급을 보완합니다. 게임에서는 지수 30 미만이 3개월 이상 이어질 때 펠라그라 피해를 계산하며, 반드시 옥수수를 먹어야만 결핍이 생기는 것도 아닙니다.</p><h3>영양실조와 티푸스</h3><p>티푸스는 감염된 몸니를 매개로 전파됩니다. 괴혈병이 티푸스로 변하는 것은 아닙니다. 게임에서는 과밀·노숙·옷과 위생 환경을 나타내는 이 노출 지수가 감염 압력을 만들고, 영양 결핍은 그 피해를 가중합니다. 감염 환경이 없으면 비타민 지수가 낮다는 이유만으로 티푸스가 새로 생기지 않습니다. 격리·세탁·휴식은 이 노출을 낮추지만 영양소를 공급하지는 않습니다.</p><h3>배급 방식</h3><p>‘재고 혼합’은 식품 재고 비율대로, ‘신선식품 우선’은 다양한 식품과 감자부터, ‘구호 식량 우선’은 옥수수와 곡물부터 배급합니다. 같은 칼로리에서도 영양 공급과 남는 재고가 달라집니다.</p><h3>근거 자료</h3><ul><li><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC3467765/" target="_blank" rel="noreferrer">Geber·Murphy — 대기근 유골의 괴혈병 증거</a></li><li><a href="https://ods.od.nih.gov/factsheets/VitaminC-HealthProfessional/" target="_blank" rel="noreferrer">NIH — 비타민 C 결핍과 괴혈병</a></li><li><a href="https://ods.od.nih.gov/factsheets/Niacin-HealthProfessional/" target="_blank" rel="noreferrer">NIH — 니아신·트립토판과 펠라그라</a></li><li><a href="https://www.cdc.gov/typhus/about/epidemic.html" target="_blank" rel="noreferrer">CDC — 몸니·과밀과 유행성 티푸스</a></li></ul>`);}
function hardshipHelp(){modal(`<h2>서로를 밀어 올리는 재난</h2><h3>구빈원과 공공근로</h3><p>구빈원은 정원 240명입니다. 수용자 50명당 월 옥수수 1단위를 지원받으며, 120명을 넘으면 과밀 위험이 더 빠르게 증가합니다. 공공근로는 £32와 옥수수 4단위를 얻는 대신 허기·노동 부담·위생 노출을 높입니다.</p><h3>영양 결핍과 감염</h3><p>칼로리를 채워도 비타민 C나 니아신 부족이 이어질 수 있습니다. 과밀·노숙·옷의 위생 환경은 몸니 노출을 높이고, 영양 결핍은 감염의 피해를 가중합니다. 진료소·격리·세탁·휴식과 식단 보완은 서로 다른 부분을 다룹니다.</p><h3>폭동과 집단 축출</h3><p>사회 불안 65 이상, 또는 칼로리 결핍 70 이상·사기 42 이하가 겹치면 폭동이 발생합니다. 발포는 주민을 죽이고 사기·평판을 떨어뜨립니다. 방관은 곡물을 식량으로 돌리지만, 월말에 구빈원 밖 주거지 전체에 축출이 집행됩니다. 대응 후 4개월은 재발하지 않습니다.</p><h3>계약과 항해</h3><p>소작료 할당량은 1845년 22단위에서 매년 2단위씩 늘며, 주민이 줄어도 줄지 않습니다. 북미행과 호주 지원 항로의 비용·기간·위험은 다릅니다. £24의 추가 보급으로 항해 위험을 낮출 수 있고, 결과는 도착 편지로 확인합니다.</p><div class="modal-actions"><button id="hardship-nutrition">식단과 질병 자세히</button></div>`);$('hardship-nutrition').onclick=nutritionHelp;}
function help(){modal(`<h2>한 달을 버티는 법</h2><p>1845년 1월부터 1852년 12월까지 처음의 1,200명 중 최대한 많은 주민을 살려내세요. 마을을 떠난 사람도 장부에서 사라지지 않습니다.</p><ol><li><strong>공문·주민 사연·폭동</strong>에 응답합니다. 개인 사연과 위기는 결정해야 월말을 마감할 수 있습니다.</li><li><strong>행정 조치 2회</strong>로 구호·경작·의료·거처·이민을 마련합니다.</li><li><strong>배급량과 식단</strong>을 정합니다. 옥수수만으로 칼로리를 채워도 영양 결핍이 남을 수 있습니다.</li><li><strong>선적</strong>할 가축 카드를 배로 끌어 놓습니다. 클릭·키보드로도 선적하고 되돌릴 수 있습니다.</li><li><strong>집행 공문</strong>을 열어 수출·배급·피해를 확인합니다. 도장을 1.4초 이상 누른 뒤 도장 안에서 놓으면 월말을 집행합니다. 키보드는 Space 또는 Enter를 누르고 유지했다 놓으세요. 길게 누르기 어렵다면 공문의 보조 조작에서 잉크 묻히기와 날인을 차례로 선택하세요.</li></ol><h3>조용한 월말</h3><p>승인 후 화면이 잠시 어두워지고 다음 달의 장부가 나타납니다. 소작료 완납에 대한 축하나 효과음은 없습니다. 월별 피해는 하단과 행정 기록에서 확인합니다.</p><h3>저장과 연출</h3><p>같은 브라우저·주소에서 자동으로 이어집니다. 이전 버전의 식품 구성은 총량을 보존한 혼합 재고로 추정하며, 과거 피해를 재계산하지 않습니다. 비 연출을 끄거나 시스템의 동작 줄이기 설정을 사용할 수 있습니다. 도장을 누르는 시간은 동작 줄이기 설정에서도 유지됩니다.</p><div class="modal-actions"><button id="help-hardship">가혹한 시스템의 규칙</button><button id="help-nutrition">식단과 질병</button><button id="help-sources">역사적 배경과 출처</button></div>`);$('help-sources').onclick=sources;$('help-hardship').onclick=hardshipHelp;$('help-nutrition').onclick=nutritionHelp;}
function sources(){modal(`<h2>역사와 게임의 경계</h2><p>아일랜드 대기근, 작황 붕괴, 소작료·수출·축출, 구빈원과 구호 노동, 질병과 이민의 문제에서 출발한 가상 시뮬레이션입니다.</p><h3>이민 항로의 차이</h3><p>‘관선(棺船, Coffin Ship)’은 정부 소유 선박이라는 뜻이 아니라 관에 빗댄 표현입니다. 북미행의 일부 열악한 항해와 호주의 정부 지원 이민을 같은 조건으로 볼 수는 없습니다. 호주 국립박물관은 정부 감독 항로의 식량·의료 조건이 대체로 더 나았다고 설명합니다. 게임에서도 북미와 호주 항로의 비용·기간·위험을 구분했습니다. 두 항로의 정원과 사망 확률은 실제 통계가 아닙니다.</p><h3>구호와 전염병</h3><p>구빈원의 과밀과 열악한 조건, 영양실조와 질병은 중요한 역사적 맥락입니다. 그러나 모든 구호가 구빈원 수용이나 무의미한 노동만을 조건으로 한 것은 아닙니다. 게임에는 청원·식량 수입·급식 지원도 남아 있습니다. ‘발열 위험’은 발진티푸스를 포함한 질병 환경을 압축한 게임 지표이며 의학적 전파 모형이 아닙니다.</p><h3>가상으로 구성한 부분</h3><p>킬모라와 노라·패트릭·메리 등 개인 인물은 가상입니다. 씨감자 절도에 대한 의무적 추방 법률을 재현한 것이 아닙니다. 지방 행정관의 집중된 권한, 매달 할당량, 압력 65에서의 징벌, 폭동 방관에 대한 마을 전체 축출은 사용자 제안의 갈등을 압축한 가상 규칙입니다. 실제 지역별 제도나 사건을 그대로 재현하지 않습니다. 실제 마름병은 1845년에 시작되었으며 게임은 1846년의 큰 피해와 구분합니다.</p><h3>배경 자료</h3><ul><li><a href="https://www.nationalarchives.ie/topics/famine/Great_Famine.pdf" target="_blank" rel="noreferrer">아일랜드 국립기록원 — 대기근 자료 안내</a></li><li><a href="https://www.ighm.org/learn.html" target="_blank" rel="noreferrer">아일랜드 대기근 박물관 — 구호·질병·이민</a></li><li><a href="https://www.nma.gov.au/exhibitions/not-just-ned/background" target="_blank" rel="noreferrer">호주 국립박물관 — 아일랜드 이민과 항해 조건</a></li><li><a href="https://researchrepository.ucd.ie/bitstreams/d1bb85a4-0f0f-453a-a543-688e916d0507/download" target="_blank" rel="noreferrer">UCD — 대기근기 에니스킬런 구빈원 연구</a></li><li><a href="https://historyireland.com/food-exports-from-ireland-1846-47/" target="_blank" rel="noreferrer">History Ireland — 식량 수출</a></li><li><a href="https://www.cambridge.org/core/journals/irish-historical-studies/article/abs/irish-grain-trade-183948/A1F5D0804E3F3AB283D9228F80171D43" target="_blank" rel="noreferrer">Irish Historical Studies — 곡물 무역</a></li></ul><p>게임의 생존 수치는 실제 역사 통계나 개인의 책임에 대한 판단이 아닙니다.</p>`);}
function restartDialog(){modal('<h2>새 행정 기록을 시작할까요?</h2><p>현재 자동 저장 기록이 새 게임으로 바뀝니다. 필요하면 먼저 기록을 내려받으세요.</p><div class="modal-actions"><button id="restart-download">기록 내려받기</button><button id="confirm-restart" class="risky">1845년으로 돌아가기</button></div>');$('restart-download').onclick=download;$('confirm-restart').onclick=()=>{state=newGame();presentedNotices.clear();save();render();closeModal();toast('1845년 1월, 새 기록을 시작합니다.');};}
function download(){const lines=['마지막 수확 — 킬모라 행정 기록',`마을 ${state.population}명 / 정착 ${state.resettled}명 / 항해 중 ${atSea(state)}명 / 총 사망 ${state.deaths}명`,`해상 사망 ${state.seaDeaths}명 / 발포 사망 ${state.violenceDeaths}명 / 경과 ${state.turn}개월`,`괴혈병 사망 ${state.scurvyDeaths}명 / 펠라그라 사망 ${state.pellagraDeaths}명 / 티푸스 사망 ${state.feverDeaths}명`,`현재 비타민 C 지수 ${num(state.vitaminC)} / 니아신 지수 ${num(state.niacin)} / 이 노출 지수 ${num(state.licePressure)}`,'가상 시뮬레이션의 플레이 기록. 영양 지수와 사망 규칙은 게임용 추정값이며 역사 통계나 임상 예측이 아닙니다.','',...state.log.slice().reverse().map(e=>`[${1845+Math.floor(Math.min(e.turn,95)/12)}.${String(Math.min(e.turn,95)%12+1).padStart(2,'0')}] ${e.title}\n${e.text}\n`)];const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\n')],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='마지막-수확-행정기록.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('행정 기록을 내려받았습니다.');}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{activeView=b.dataset.view;document.querySelectorAll('[data-view]').forEach(n=>{n.classList.toggle('active',n.dataset.view===activeView);n.setAttribute('aria-pressed',String(n.dataset.view===activeView));});document.querySelectorAll('.view').forEach(v=>v.classList.toggle('hidden',v.id!==activeView+'-view'));}));
$('rations').addEventListener('click',e=>{const b=e.target.closest('[data-ration]');if(!b)return;state=setPolicy(state,{ration:+b.dataset.ration});save();render();});
$('exports').addEventListener('input',e=>{state=setPolicy(state,{exportTarget:+e.target.value});save();render();});
$('food-policies').addEventListener('click',e=>{const b=e.target.closest('[data-food-policy]');if(!b)return;state=setPolicy(state,{foodPolicy:b.dataset.foodPolicy});save();render();});
$('next-month').addEventListener('click',()=>{if(closingMonth)return;if(state.ended){resultSummary();return;}if(monthBlock(state)){showTurnNotice(true);return;}approvalDocument();});
window.addEventListener('blur',cancelStamp);
$('motion-toggle').onclick=()=>{motionEnabled=!motionEnabled;try{localStorage.setItem('last-harvest-motion',motionEnabled?'on':'off');}catch{}render();};
$('help').onclick=help;$('hardship-info').onclick=hardshipHelp;$('map-info').onclick=help;$('restart').onclick=restartDialog;$('download').onclick=download;$('sources-link').onclick=sources;document.querySelector('.monogram').onclick=e=>{e.preventDefault();document.querySelector('[data-view="village"]').click();};
render();save();showTurnNotice();if(invalidSave)toast('이전 저장 기록을 읽을 수 없어 새 게임을 시작했습니다.');else if(migratedSave)toast('기존 기록을 이어받았습니다. 식품 구성은 기존 총량을 보존해 혼합 재고로 추정했습니다.');else if(!storageAvailable)toast('브라우저 저장소를 사용할 수 없습니다. 이 창을 닫으면 진행이 사라집니다.');
