import {freshGame,dateOf,seasonOf,quotaOf,foodNeed,eventFor,choiceReason,chooseEvent,ACTIONS,actionReason,takeAction,setPolicy,forecast,advanceMonth,serialize,restore,HARVEST,atSea,livingTotal,voyageTerms,ROUTES,crisisFor,resolveCrisis,monthBlock} from './engine.js';
import {townMap,residentPortraits} from './map.js';
const $=id=>document.getElementById(id),KEY='last-harvest-v1';
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:1});
const newGame=()=>freshGame(crypto.getRandomValues(new Uint32Array(1))[0]);
let storageAvailable=true,invalidSave=false,migratedSave=false,motionEnabled=!matchMedia('(prefers-reduced-motion: reduce)').matches;
let state=newGame();
try{
  const raw=localStorage.getItem(KEY);
  if(raw){const saved=restore(raw);if(saved){state=saved;migratedSave=JSON.parse(raw).version===1;if(migratedSave&&!localStorage.getItem(KEY+'-backup'))localStorage.setItem(KEY+'-backup',raw);}else invalidSave=true;}
  const motion=localStorage.getItem('last-harvest-motion');if(motion!==null)motionEnabled=motion==='on';
}catch{storageAvailable=false;}
let activeView='village',toastTimer;const presentedNotices=new Set();
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3800);}
function save(){try{localStorage.setItem(KEY,serialize(state));storageAvailable=true;}catch{storageAvailable=false;}$('save-status').textContent=storageAvailable?'이 브라우저에 자동 저장됨':'저장 불가 · 이 창에서만 유지';}
function modal(html){$('modal-body').innerHTML=html;if(!$('modal').open)$('modal').showModal();$('modal-body').scrollTop=0;}
function closeModal(){$('modal').close();}
$('close-modal').addEventListener('click',closeModal);
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
  modal(`<span class="eyebrow">${state.turn>=96?'DECEMBER 1852 · THE RECORD REMAINS':'THE RECORD ENDS HERE'}</span><h2>${known?'마지막 겨울을 건넌 사람들':'더는 부를 이름이 없습니다'}</h2><p>킬모라에 처음 살던 1,200명 가운데</p><div class="big-number">${num(known)} <small>명의 생존이 확인되었습니다</small></div><div class="result-grid"><div>마을에 남음<strong>${num(state.population)}</strong></div><div>해외에 정착<strong>${num(state.resettled)}</strong></div><div>총 사망<strong>${num(state.deaths)}</strong></div><div>그중 해상 사망<strong>${num(state.seaDeaths)}</strong></div><div>그중 발포 사망<strong>${num(state.violenceDeaths)}</strong></div><div>항해 중 · 결말 미확인<strong>${num(sea)}</strong></div></div><p>확인 생존 비율 ${rate}% · ${state.turn}개월의 기록. ${sea?'아직 항해 중인 주민은 정착 생존자로 계산하지 않았습니다.':''} 이 결과는 실제 대기근의 생존율 추정치가 아닙니다.</p><div class="modal-actions"><button id="result-download">기록 내려받기</button><button id="result-restart">새 기록 시작</button></div>`);
  $('result-download').onclick=download;$('result-restart').onclick=restartDialog;
}
function resource(title,value,unit,foot,icon,gold=false){return `<article class="resource ${gold?'gold':''}"><div class="resource-head"><span>${title}</span>${gold?'<span class="lock-tag">봉인</span>':`<span class="icon" aria-hidden="true">${icon}</span>`}</div><div class="resource-number">${value}<small>${unit}</small></div><div class="resource-foot">${foot}</div></article>`;}
function render(){
  const t=Math.max(0,state.turn-(state.ended?1:0)),display={year:Math.min(1852,1845+Math.floor(t/12)),month:t%12+1};
  const f=forecast(state),q=quotaOf(state),need=foodNeed(state),crisis=crisisFor(state);
  document.body.classList.toggle('motion-paused',!motionEnabled);document.body.classList.toggle('town-distressed',state.hunger>50||state.fever>=50);document.body.classList.toggle('town-crisis',!!crisis);
  $('motion-toggle').textContent=motionEnabled?'비 연출 켜짐':'비 연출 꺼짐';$('motion-toggle').setAttribute('aria-pressed',String(motionEnabled));
  $('date').textContent=`${display.year}년 ${display.month}월`;$('season').textContent=seasonOf(state);$('turn').textContent=state.ended?'기록 종료':`${state.turn+1} / 96개월`;
  $('resources').innerHTML=resource('마을에 남은 주민',num(state.population),'명',`총 사망 ${num(state.deaths)}명 <span class="${state.homeless?'bad':''}">· 노숙 ${num(state.homeless)}명</span>`,'♧')+resource('주민의 식량',num(state.food),'단위',`정상 배급 <span class="${state.food<need?'bad':'good'}">${need?num(state.food/need):0}개월분</span>`,'◒')+resource('수출용 곡물',num(state.grain),'단위','주민 배급에 자동 사용되지 않음','',true)+resource('지주의 가축',num(state.cattle),'마리','대납 가능 · 도축 시 행정 압력','',true)+resource('구호 기금',`£${num(state.money)}`,'',`대체 경작 ${state.crops}/5 · 진료소 ${state.clinic}/3`,'✧');
  $('crisis-banner').classList.toggle('hidden',!crisis&&!state.riotRetaliation);
  $('crisis-banner').innerHTML=crisis?'<div><strong>식량 폭동 · 창고와 항구에 주민들이 모였습니다.</strong><span>위기에 대응해야 월말을 마감할 수 있습니다.</span></div><button id="review-crisis">결정하러 가기 →</button>':state.riotRetaliation?'<div><strong>집단 축출 예고</strong><span>다음 월말에 구빈원 밖의 모든 주거지에 축출이 집행됩니다. 겨울 노출 피해를 확인하세요.</span></div>':'';
  if($('review-crisis'))$('review-crisis').onclick=showCrisis;
  $('map').innerHTML=townMap(state);
  $('map-weather').textContent=state.ended?'행정관의 기록이 마감되었습니다.':crisis?'항구의 빗소리 사이로 사람들의 외침이 들립니다.':state.hunger>45?'차가운 비 속에서 주민들의 등이 굽어 갑니다.':state.fever>=50?'비에 젖은 구빈원에서 기침 소리가 멎지 않습니다.':'대서양의 차가운 비가 지붕과 밭을 두드립니다.';
  $('map').querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>placeInfo(b.dataset.place));
  renderSurvival();renderVoyages();
  $('ration-value').textContent=`${num(need*state.ration)}단위 / 월`;
  $('rations').querySelectorAll('button').forEach(b=>{b.classList.toggle('selected',+b.dataset.ration===state.ration);b.setAttribute('aria-pressed',String(+b.dataset.ration===state.ration));b.disabled=state.ended;});
  $('exports').max=q;$('exports').value=state.exportTarget;$('exports').disabled=state.ended||state.riotRetaliation;
  $('export-label').textContent=`${state.exportTarget} / ${q}단위`;
  $('cattle-exports').value=state.cattleExport;$('cattle-exports').disabled=state.ended||state.riotRetaliation;
  [...$('cattle-exports').options].forEach(o=>o.disabled=+o.value>state.cattle);
  $('food-hint').textContent=`1단위 = 50명의 한 달 식사. 영양 결핍 ${num(state.hunger)} / 100. ${state.ration<1?'긴축 배급은 결핍과 불안을 누적시킵니다.':state.ration>1?'회복 배급은 영양 결핍을 더 빨리 줄입니다.':'충분히 배급하면 영양 결핍이 회복됩니다.'}`;
  $('forecast').innerHTML=state.ended?'기록이 마감되었습니다. 장부와 행정 기록을 살펴볼 수 있습니다.':crisis?'<span class="danger">폭동 대응 대기 · 대응을 정한 뒤 월말 예상이 확정됩니다.</span>':`<span>월말 예상</span><span>배급 <strong>${num(f.foodUsed)}</strong></span><span>할당량 <strong class="${f.shortfall?'danger':''}">${num(f.quota-f.shortfall)} / ${q}</strong></span><span>마을 사망 <strong class="${f.lost?'danger':''}">${f.lost}명</strong></span><span>그중 질병 <strong class="${f.disease?'danger':''}">${f.disease}명</strong></span><span>축출 <strong class="${f.evicted?'danger':''}">${f.evicted}명</strong></span>${f.harvest?`<span>9월 수확 <strong>+${f.harvest}</strong></span>`:''}${f.aid+f.workhouseFood?`<span>구호 <strong>+${num(f.aid+f.workhouseFood)}</strong></span>`:''}${f.voyageLetters.length?'<span>이민선 도착 예정 · 항해 결과는 편지로 확인</span>':''}${f.punished?'<span class="danger">⚑ 군경 징벌 예상</span>':''}`;
  const e=eventFor(state);$('event-tag').textContent=state.ended?'마지막 장':crisis?'긴급 위기':e.tag;$('event-title').textContent=state.ended?'남겨진 이름들':crisis?crisis.title:e.title;
  $('event-body').textContent=state.ended?`마을 ${num(state.population)}명, 해외 정착 ${num(state.resettled)}명, 항해 중 ${atSea(state)}명. 사망한 ${num(state.deaths)}명의 이름도 이 기록에 남습니다.`:crisis?crisis.body:e.body;
  $('event-choices').innerHTML=state.ended?'<button class="choice" id="show-results">통치 결과 보기 ↗</button>':crisis?'<button class="choice crisis-choice" id="desk-crisis">창고 앞의 위기에 대응한다 →</button>':state.eventDone?'<div class="event-resolved">✓ 이번 달의 결정을 기록했습니다.<br><small>배분과 행정 조치를 확인한 뒤 월말을 마감하세요.</small></div>':choiceButtons(e);
  $('event-choices').querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>applyChoice(+b.dataset.choice));
  if($('show-results'))$('show-results').onclick=resultSummary;if($('desk-crisis'))$('desk-crisis').onclick=showCrisis;
  $('action-count').textContent=`${state.ended?0:state.actionsLeft} / 2 남음`;
  const icons={import:'⇣',divert:'⚿',crops:'♧',shelter:'⌂',petition:'✉',works:'⚒',clinic:'✚',slaughter:'◇',emigrate:'⚓',workhouse:'▥',release:'⇥',sanitation:'✧'};
  const subs={import:'£58 · 식량 +36',divert:'곡물 → 식량 · 압력 +24',crops:'£52 · 매월 식량 +2.4',shelter:'£32 · 최대 90명 수용',petition:'£6 · 월말 식량 +26',works:'정부 £32 · 중노동·발열',clinic:'£42 · 질병 피해 완화',slaughter:'가축 4 → 식량 24',emigrate:'£48부터 · 항해 사망 위험',workhouse:'£10 · 정부 지원·과밀',release:'최대 60명 · 거처 필요',sanitation:'£24 · 발열 위험 −22'};
  $('actions').innerHTML=Object.entries(ACTIONS).map(([id,a])=>`<button class="action ${['divert','slaughter','emigrate','works','workhouse'].includes(id)?'risky':''}" data-action="${id}" ${actionReason(state,id)?'disabled':''} title="${esc(actionReason(state,id)||a.desc)}"><span class="action-symbol" aria-hidden="true">${icons[id]}</span><strong>${a.name}${state.used.includes(id)?' ✓':''}</strong><small>${esc(actionReason(state,id)||subs[id])}</small></button>`).join('');
  $('actions').querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>actionDialog(b.dataset.action));
  $('trust-meter').style.width=state.trust+'%';$('trust-value').textContent=Math.round(state.trust)+'%';$('pressure-meter').style.width=state.pressure+'%';$('pressure-value').textContent=Math.round(state.pressure)+'%';
  $('pressure-note').textContent='월말 행정 압력 65 이상: 기금·곡물 압수와 최대 45명 축출. 할당량 완납 시 압력 −5. 가족의 사망과 발포는 사기·평판에도 상처를 남깁니다.';
  $('footer-note').textContent=state.lastReport?`지난달 마을 사망 ${state.lastReport.lost}명 · 해상 사망 ${state.lastReport.seaLost||0}명 · 축출 ${state.lastReport.evicted}명`:'목표: 1852년 12월까지, 마을을 떠난 사람까지 한 명이라도 더 살려내세요.';
  $('next-month').innerHTML=state.ended?'마지막 기록을 펼치다 <span>↗</span>':crisis?'폭동에 대응하다 <span>→</span>':'한 달을 마감하다 <span>→</span>';
  renderLedger();renderJournal();
}
function renderSurvival(){
  const item=(name,value,detail,danger=false)=>`<div class="hardship-stat ${danger?'critical':''}"><span>${name}</span><strong>${value}</strong><small>${detail}</small></div>`;
  $('survival-monitor').innerHTML=`${residentPortraits(state)}<div class="hardship-grid">${item('주민 사기',num(state.morale)+'%','죽음과 가족 분리의 무게',state.morale<35)}${item('발열 위험',num(state.fever)+'/100',state.fever>=35?'발진티푸스 사망 위험':'35부터 전염병 사망 발생',state.fever>=35)}${item('사회 불안',num(state.unrest)+'/100','65부터 식량 폭동',state.unrest>=55)}${item('구빈원',state.workhouse+' / 240명','120명 초과 시 과밀 가중',state.workhouse>120)}${item('노동 부담',num(state.laborStrain)+'/100','중노동 → 발열 위험',state.laborStrain>=35)}${item('씨감자 비축',num(state.seedReserve)+'%','다음 감자 수확에 반영',state.seedReserve<80)}</div>`;
}
function renderVoyages(){
  $('voyages-panel').innerHTML=`<div class="panel-heading"><div><span class="eyebrow">THE ONES WHO LEFT</span><h2>바다 너머의 이름들</h2></div><span class="subtle">출항은 생존이 아닙니다</span></div><div class="migration-totals"><span>항해 중 <strong>${atSea(state)}명</strong></span><span>정착 확인 <strong>${state.resettled}명</strong></span><span>해상 사망 <strong class="${state.seaDeaths?'danger':''}">${state.seaDeaths}명</strong></span></div><div class="voyage-list">${state.voyages.length?state.voyages.map(v=>`<article class="voyage-row"><div><strong>${esc(ROUTES[v.destination].name)}</strong><small>${v.passengers}명 승선 · ${v.provisioned?'추가 보급':'최소 보급'} · 사망 위험 ${Math.round(v.risk*100)}%</small></div><span>${v.remaining}개월 남음</span></article>`).join(''):'<p class="empty-voyage">항구를 떠난 뒤에도, 그 사람들의 운명을 기다립니다.</p>'}</div>`;
}
function renderLedger(){
  const q=quotaOf(state),f=forecast(state);
  $('ledger').innerHTML=`<p class="ledger-explainer">같은 땅에서 자란 식량.<br>그러나 같은 사람의 몫은 아닙니다.</p><div class="ledger-row"><span>주민에게 배급할 수 있는 식량</span><span>${num(state.food)}</span></div><div class="ledger-row"><span>주민이 먹을 수 없는 봉인 곡물</span><span>${num(state.grain)}</span></div><div class="ledger-row"><span>이번 달 계약 / 예상 미납</span><span>${q} / ${num(f.shortfall)}</span></div><div class="ledger-row"><span>행정 수입 / 진료소 운영비</span><span>£${num(f.income)} / £${num(f.upkeep)}</span></div><div class="ledger-row population-equation"><span>마을 + 정착 + 항해 중 + 사망</span><span>${state.population} + ${state.resettled} + ${atSea(state)} + ${state.deaths} = 1200</span></div><div class="ledger-block"><h3>유보는 곧 배급이 아닙니다.</h3><p>곡물은 창고 개방 명령으로만 주민 식량이 됩니다. 구빈원 지원은 수용자 몫만큼, 공공근로 구호는 노동의 대가로 들어옵니다. 그 대가에는 과밀과 질병이 따릅니다.</p></div><div class="history-chart" role="img" aria-label="월별 마을 인구: 처음 1200명, 현재 ${state.population}명">${[1200,...state.history.map(r=>r.survivors)].map(n=>`<i style="height:${Math.max(1,n/1200*100)}%" title="마을 ${n}명"></i>`).join('')}</div><div class="history-chart-label">1845년 1월 → 현재 · 마을 인구 변화. 이민으로 떠난 주민은 별도 추적합니다.</div>`;
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
function hardshipHelp(){modal(`<h2>서로를 밀어 올리는 재난</h2><h3>구빈원과 공공근로</h3><p>구빈원은 정원 240명, 1회 최대 60명을 수용합니다. 수용자 50명당 월 식량 1단위를 지원받습니다. 120명을 넘으면 과밀로 발열 위험이 더 빠르게 증가합니다. 공공근로는 £32와 식량 4단위를 얻는 대신 영양 결핍·노동 부담·발열 위험을 올립니다.</p><h3>발진티푸스</h3><p>영양 결핍, 노동 부담, 과밀은 발열 위험을 누적시킵니다. 35 이상부터 전염병 사망이 발생하며, 구빈원에 수용자가 많을수록 피해도 커집니다. 진료소·격리·세탁·휴식과 노동 중단으로 낮출 수 있습니다. 식량이 있어도 이미 번진 전염병은 즉시 사라지지 않습니다.</p><h3>폭동과 집단 축출</h3><p>사회 불안 65 이상, 또는 영양 결핍 70 이상·사기 42 이하가 겹치면 폭동이 발생합니다. 발포는 즉시 주민을 죽이고 사기·평판을 떨어뜨립니다. 방관은 창고 곡물을 주민 식량으로 전환하지만, 월말에는 구빈원 밖의 모든 주거지에서 축출이 집행됩니다. 대응 후 4개월은 같은 위기가 재발하지 않습니다.</p><h3>항해</h3><p>북미는 저렴하고 빠르지만 사망 위험이 높습니다. 호주 지원 항로는 1848년부터 열리며 비용과 시간이 더 들고 위험은 낮습니다. £24의 추가 보급으로 위험을 줄일 수 있습니다. 항해 결과는 도착 때 확률로 정해지며 저장한 진행을 다시 열어도 같은 항해 결과가 유지됩니다. 이 수치는 게임용 가정입니다.</p>`);}
function help(){modal(`<h2>한 달을 버티는 법</h2><p>1845년 1월부터 1852년 12월까지 처음의 1,200명 중 최대한 많은 주민을 살려내세요. 마을을 떠난 사람도 장부에서 사라지지 않습니다.</p><ol><li><strong>책상 위 공문과 주민 사연</strong>에 응답합니다. 개인 사연과 폭동은 결정해야 월말을 마감할 수 있습니다.</li><li><strong>행정 조치 2회</strong>로 구호·경작·거처·이민·의료를 마련합니다. 같은 조치는 한 달에 한 번만 가능합니다.</li><li><strong>배급과 수출</strong>을 정하고 월말 사망·축출·질병 예상을 확인합니다.</li><li><strong>한 달을 마감</strong>하면 식사와 사망, 항해 도착, 기금 정산을 계산하고 자동 저장합니다.</li></ol><h3>1846년을 대비하세요</h3><p>9월 감자 수확이 붕괴합니다. 대체 작물과 기금을 준비하세요. 겨울은 12·1·2월입니다. 식량과 거처뿐 아니라 사기, 발열 위험, 사회 불안을 함께 살펴야 합니다.</p><h3>저장과 연출</h3><p>같은 브라우저·주소에서 자동으로 이어집니다. 기존 버전의 저장도 이어받습니다. 기록은 텍스트로 내려받을 수 있습니다. 지도 아래 ‘비 연출’을 끄면 비와 주민 움직임을 멈춥니다. 동작 줄이기 시스템 설정도 따릅니다.</p><div class="modal-actions"><button id="help-hardship">가혹한 시스템의 규칙</button><button id="help-sources">역사적 배경과 출처</button></div>`);$('help-sources').onclick=sources;$('help-hardship').onclick=hardshipHelp;}
function sources(){modal(`<h2>역사와 게임의 경계</h2><p>아일랜드 대기근, 작황 붕괴, 소작료·수출·축출, 구빈원과 구호 노동, 질병과 이민의 문제에서 출발한 가상 시뮬레이션입니다.</p><h3>이민 항로의 차이</h3><p>‘관선(棺船, Coffin Ship)’은 정부 소유 선박이라는 뜻이 아니라 관에 빗댄 표현입니다. 북미행의 일부 열악한 항해와 호주의 정부 지원 이민을 같은 조건으로 볼 수는 없습니다. 호주 국립박물관은 정부 감독 항로의 식량·의료 조건이 대체로 더 나았다고 설명합니다. 게임에서도 북미와 호주 항로의 비용·기간·위험을 구분했습니다. 두 항로의 정원과 사망 확률은 실제 통계가 아닙니다.</p><h3>구호와 전염병</h3><p>구빈원의 과밀과 열악한 조건, 영양실조와 질병은 중요한 역사적 맥락입니다. 그러나 모든 구호가 구빈원 수용이나 무의미한 노동만을 조건으로 한 것은 아닙니다. 게임에는 청원·식량 수입·급식 지원도 남아 있습니다. ‘발열 위험’은 발진티푸스를 포함한 질병 환경을 압축한 게임 지표이며 의학적 전파 모형이 아닙니다.</p><h3>가상으로 구성한 부분</h3><p>킬모라와 노라·패트릭·메리 등 개인 인물은 가상입니다. 씨감자 절도에 대한 의무적 추방 법률을 재현한 것이 아닙니다. 지방 행정관의 집중된 권한, 매달 할당량, 압력 65에서의 징벌, 폭동 방관에 대한 마을 전체 축출은 사용자 제안의 갈등을 압축한 가상 규칙입니다. 실제 지역별 제도나 사건을 그대로 재현하지 않습니다. 실제 마름병은 1845년에 시작되었으며 게임은 1846년의 큰 피해와 구분합니다.</p><h3>배경 자료</h3><ul><li><a href="https://www.nationalarchives.ie/topics/famine/Great_Famine.pdf" target="_blank" rel="noreferrer">아일랜드 국립기록원 — 대기근 자료 안내</a></li><li><a href="https://www.ighm.org/learn.html" target="_blank" rel="noreferrer">아일랜드 대기근 박물관 — 구호·질병·이민</a></li><li><a href="https://www.nma.gov.au/exhibitions/not-just-ned/background" target="_blank" rel="noreferrer">호주 국립박물관 — 아일랜드 이민과 항해 조건</a></li><li><a href="https://researchrepository.ucd.ie/bitstreams/d1bb85a4-0f0f-453a-a543-688e916d0507/download" target="_blank" rel="noreferrer">UCD — 대기근기 에니스킬런 구빈원 연구</a></li><li><a href="https://historyireland.com/food-exports-from-ireland-1846-47/" target="_blank" rel="noreferrer">History Ireland — 식량 수출</a></li><li><a href="https://www.cambridge.org/core/journals/irish-historical-studies/article/abs/irish-grain-trade-183948/A1F5D0804E3F3AB283D9228F80171D43" target="_blank" rel="noreferrer">Irish Historical Studies — 곡물 무역</a></li></ul><p>게임의 생존 수치는 실제 역사 통계나 개인의 책임에 대한 판단이 아닙니다.</p>`);}
function restartDialog(){modal('<h2>새 행정 기록을 시작할까요?</h2><p>현재 자동 저장 기록이 새 게임으로 바뀝니다. 필요하면 먼저 기록을 내려받으세요.</p><div class="modal-actions"><button id="restart-download">기록 내려받기</button><button id="confirm-restart" class="risky">1845년으로 돌아가기</button></div>');$('restart-download').onclick=download;$('confirm-restart').onclick=()=>{state=newGame();presentedNotices.clear();save();render();closeModal();toast('1845년 1월, 새 기록을 시작합니다.');};}
function download(){const lines=['마지막 수확 — 킬모라 행정 기록',`마을 ${state.population}명 / 정착 ${state.resettled}명 / 항해 중 ${atSea(state)}명 / 총 사망 ${state.deaths}명`,`해상 사망 ${state.seaDeaths}명 / 발포 사망 ${state.violenceDeaths}명 / 경과 ${state.turn}개월`,'가상 시뮬레이션의 플레이 기록. 역사 통계가 아닙니다.','',...state.log.slice().reverse().map(e=>`[${1845+Math.floor(Math.min(e.turn,95)/12)}.${String(Math.min(e.turn,95)%12+1).padStart(2,'0')}] ${e.title}\n${e.text}\n`)];const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\n')],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='마지막-수확-행정기록.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('행정 기록을 내려받았습니다.');}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{activeView=b.dataset.view;document.querySelectorAll('[data-view]').forEach(n=>{n.classList.toggle('active',n.dataset.view===activeView);n.setAttribute('aria-pressed',String(n.dataset.view===activeView));});document.querySelectorAll('.view').forEach(v=>v.classList.toggle('hidden',v.id!==activeView+'-view'));}));
$('rations').addEventListener('click',e=>{const b=e.target.closest('[data-ration]');if(!b)return;state=setPolicy(state,{ration:+b.dataset.ration});save();render();});
$('exports').addEventListener('input',e=>{state=setPolicy(state,{exportTarget:+e.target.value});save();render();});
$('cattle-exports').addEventListener('change',e=>{state=setPolicy(state,{cattleExport:+e.target.value});save();render();});
$('next-month').addEventListener('click',()=>{if(state.ended){resultSummary();return;}if(monthBlock(state)){showTurnNotice(true);return;}state=advanceMonth(state);save();render();if(state.ended)resultSummary();else{const r=state.lastReport;toast(`${r.year}년 ${r.month}월 마감 · 마을 사망 ${r.lost}명${r.evicted?' · 축출 '+r.evicted+'명':''}`);showTurnNotice();}});
$('motion-toggle').onclick=()=>{motionEnabled=!motionEnabled;try{localStorage.setItem('last-harvest-motion',motionEnabled?'on':'off');}catch{}render();};
$('help').onclick=help;$('hardship-info').onclick=hardshipHelp;$('map-info').onclick=help;$('restart').onclick=restartDialog;$('download').onclick=download;$('sources-link').onclick=sources;document.querySelector('.monogram').onclick=e=>{e.preventDefault();document.querySelector('[data-view="village"]').click();};
render();save();showTurnNotice();if(invalidSave)toast('이전 저장 기록을 읽을 수 없어 새 게임을 시작했습니다.');else if(migratedSave)toast('기존 기록을 이어받았습니다. 이민·구빈원·폭동 시스템이 추가되었습니다.');else if(!storageAvailable)toast('브라우저 저장소를 사용할 수 없습니다. 이 창을 닫으면 진행이 사라집니다.');
