/* Deterministic, side-effect-free monthly simulation. Food is measured in
 * provision units: one unit sustains 50 residents for one month. */
export const VERSION = 3;
export const INITIAL_POPULATION = 1200;
export const YEARS = [1845,1846,1847,1848,1849,1850,1851,1852];
export const HARVEST = [300,8,45,20,75,160,210,285];
export const ACTIONS = {
  import: {name:'구호 옥수수 수입', cost:58, desc:'기금 £58 → 옥수수 36단위. 칼로리를 보충하지만 비타민 C와 이용 가능한 니아신·단백질이 부족한 편중 식단을 만들 수 있습니다.'},
  freshFood: {name:'채소·콩·우유 확보', cost:44, desc:'기금 £44 → 다양한 신선식품 18단위. 옥수수보다 비싸지만 비타민 C와 니아신·트립토판 공급을 보완합니다.'},
  divert: {name:'수출 창고 개방', cost:0, desc:'봉인 곡물 최대 30단위를 식량으로 전환. 행정 압력 +24.'},
  crops: {name:'대체 작물 경작', cost:52, desc:'매달 식량 +2.4단위. 최대 5단계. 감자 마름병의 영향을 받지 않습니다.'},
  shelter: {name:'임시 거처 마련', cost:32, desc:'노숙 주민 최대 90명에게 거처 제공. 주민 신뢰 +4.'},
  petition: {name:'구호 청원 발송', cost:6, desc:'이번 달 말 식량 26단위 도착. 3개월 간격으로 청원 가능.'},
  works: {name:'공공근로 동원', cost:0, desc:'도로 포장·돌 깨기에 주민 동원. 정부 기금 +£32, 월말 식량 +4. 영양 결핍 +6, 노동 부담 +18, 발열 위험 +6, 사기 −4.'},
  clinic: {name:'진료소 확충', cost:42, desc:'질병 피해 감소. 최대 3단계. 운영비는 단계당 월 £2.'},
  slaughter: {name:'지주 가축 도축', cost:0, desc:'가축 4마리 → 주민 식량 24단위. 행정 압력 +18.'},
  emigrate: {name:'이민선 마련', cost:48, desc:'북미 또는 호주 항로를 마련합니다. 승선자는 항해 중·정착·해상 사망으로 계속 추적됩니다. 항로와 추가 보급에 따라 비용·위험이 달라집니다.'},
  workhouse: {name:'구빈원 수용', cost:10, desc:'최대 60명 수용, 총 정원 240명. 정부 기금 +£32와 수용자 몫의 월별 식량을 받지만 과밀과 가족 분리로 발열 위험·사기가 악화됩니다.'},
  release: {name:'구빈원 퇴소', cost:0, desc:'최대 60명을 퇴소시켜 과밀을 줄입니다. 퇴소자는 거처가 필요합니다. 발열 위험 −5, 주민 사기 +3.'},
  sanitation: {name:'격리·세탁·휴식', cost:24, desc:'발열 위험 −22, 노동 부담 −12. 격리와 작업 중단으로 주민 사기 −2. 이미 발생한 사망을 되돌릴 수는 없습니다.'},
};
export const ROUTES={
  america:{name:'북미행 이민선',destination:'북아메리카',cost:48,capacity:60,months:2,risk:.26},
  australia:{name:'호주 지원 항로',destination:'호주',cost:82,capacity:40,months:4,risk:.06,from:1848},
};
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const round = n => Math.round(n*100)/100;
export function dateOf(s) { return {year:1845+Math.floor(s.turn/12), month:s.turn%12+1}; }
export function quotaOf(s) { return 22+2*Math.floor(Math.min(95,s.turn)/12); }
export function foodNeed(s) { return round(s.population/50); }
export function seasonOf(s) { const m=dateOf(s).month; return m===12||m<=2?'겨울':m<=5?'봄':m<=8?'여름':'가을'; }
export function atSea(s) { return s.voyages.reduce((n,v)=>n+v.passengers,0); }
export function livingTotal(s) { return s.population+s.resettled+atSea(s); }
export function freshGame(seed=18451852) {
  return {version:VERSION,turn:0,population:1200,deaths:0,food:228,grain:110,cattle:48,money:180,
    hunger:0,homeless:0,pressure:14,trust:70,crops:0,clinic:0,actionsLeft:2,used:[],
    ration:1,exportTarget:22,cattleExport:0,petitionReady:0,pendingAid:0,eventDone:false,resolvedEvent:null,
    morale:70,fever:0,laborStrain:0,workhouse:0,unrest:0,seedReserve:100,
    provisions:{potato:228,maize:0,grain:0,diverse:0,animal:0},foodPolicy:'mixed',potatoFreshness:.8,
    vitaminC:85,niacin:85,cDeficientMonths:0,bDeficientMonths:0,licePressure:8,scurvyDeaths:0,pellagraDeaths:0,
    voyages:[],resettled:0,seaDeaths:0,violenceDeaths:0,feverDeaths:0,rng:seed>>>0,
    voyageSerial:0,emigrationReady:0,riotReady:0,riotRetaliation:false,storySeen:[],
    log:[{turn:0,title:'새 행정관의 부임',text:'킬모라의 1,200명이 당신의 결정을 기다립니다. 겨울 비축 감자는 주민의 것, 항구의 곡물과 가축은 지주의 것입니다.',tone:'neutral'}],history:[],ended:false,lastReport:null};
}
function record(s,title,text,tone='neutral') { s.log.unshift({turn:s.turn,title,text,tone}); }
// Relative dietary adequacy coefficients for this game, not milligrams or clinical predictions.
export const FOODS={
  potato:{name:'감자',c:1.45,b3:1.15},maize:{name:'구호 옥수수',c:0,b3:.18},
  grain:{name:'곡물',c:.02,b3:.95},diverse:{name:'채소·콩·우유',c:2,b3:1.8},animal:{name:'동물성 식품',c:.02,b3:2},
};
const foodKeys=Object.keys(FOODS);
const stockTotal=s=>round(foodKeys.reduce((n,k)=>n+s.provisions[k],0));
// Reconcile programmatic scenarios using the old aggregate food field. Saved v3 data is validated strictly.
export function reconcileProvisions(s) {
  if(!s.provisions)s.provisions={potato:0,maize:0,grain:0,diverse:0,animal:0};
  const total=stockTotal(s),difference=round(s.food-total);
  if(difference>0)s.provisions.diverse=round(s.provisions.diverse+difference);
  else if(difference<0){
    let left=round(s.food);for(const k of foodKeys){const q=k===foodKeys.at(-1)?left:Math.min(left,round(s.provisions[k]*s.food/Math.max(.01,total)));s.provisions[k]=q;left=round(left-q);}
  }
  s.food=stockTotal(s);return s;
}
function addFood(s,kind,amount) {
  amount=round(Math.max(0,amount));
  if(kind==='potato'&&amount){const old=s.provisions.potato;s.potatoFreshness=(old*s.potatoFreshness+amount)/Math.max(.01,old+amount);}
  s.provisions[kind]=round(s.provisions[kind]+amount);s.food=stockTotal(s);
}
function eatFood(s,amount,policy=s.foodPolicy) {
  const total=s.food,target=round(Math.min(amount,total)),eaten=Object.fromEntries(foodKeys.map(k=>[k,0]));let left=target;
  const take=(k,n)=>{n=Math.min(left,s.provisions[k],round(Math.max(0,n)));s.provisions[k]=round(s.provisions[k]-n);eaten[k]=round(eaten[k]+n);left=round(left-n);};
  if(policy==='mixed')for(const k of foodKeys)take(k,total?target*s.provisions[k]/total:0);
  const order=policy==='relief'?['maize','grain','potato','animal','diverse']:['diverse','potato','animal','grain','maize'];
  for(const k of order)if(left>0)take(k,left);
  s.food=stockTotal(s);return {used:round(target-left),eaten};
}
function dietHealth(s,eaten,need) {
  const c=need?foodKeys.reduce((n,k)=>n+eaten[k]*FOODS[k].c*(k==='potato'?s.potatoFreshness:1),0)/need:1;
  const b3=need?foodKeys.reduce((n,k)=>n+eaten[k]*FOODS[k].b3,0)/need:1;
  const maizeShare=eaten.maize/Math.max(.01,foodKeys.reduce((n,k)=>n+eaten[k],0));
  if(need){
    adjust(s,'vitaminC',c>=1?6*Math.min(c,1.5):-(1-c)*14);
    adjust(s,'niacin',b3>=1?6*Math.min(b3,1.5):-(1-b3)*12);
    s.cDeficientMonths=s.vitaminC<30?s.cDeficientMonths+1:0;
    s.bDeficientMonths=s.niacin<30?s.bDeficientMonths+1:0;
  }
  const scurvy=s.cDeficientMonths>=2?clamp((30-s.vitaminC)/30,0,1):0;
  const pellagra=s.bDeficientMonths>=3?clamp((30-s.niacin)/30,0,1):0;
  s.potatoFreshness=Math.max(.2,s.potatoFreshness*.96);
  return {cAdequacy:round(c),b3Adequacy:round(b3),maizeShare:round(maizeShare),scurvy,pellagra};
}
function adjust(s,key,amount) { s[key]=clamp(s[key]+amount,0,100); }
function loseResidents(s,n) {
  n=Math.min(s.population,Math.max(0,Math.round(n)));const before=Math.max(1,s.population);
  s.homeless-=Math.floor(n*s.homeless/before);s.workhouse-=Math.floor(n*s.workhouse/before);
  s.population-=n;s.deaths+=n;s.homeless=Math.min(s.homeless,s.population);s.workhouse=Math.min(s.workhouse,s.population-s.homeless);
  return n;
}
function evict(s,n) { const count=Math.max(0,Math.min(s.population-s.workhouse-s.homeless,n));s.homeless+=count;return count; }
function random(s) { s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296; }
export function voyageTerms(s,options={}) {
  const id=options.destination||'america',route=ROUTES[id];if(!route)return null;
  const risk=clamp(route.risk+s.hunger*(id==='america'?.0012:.0005),0,.6)*(options.provisioned?.45:1);
  return {...route,id,cost:route.cost+(options.provisioned?24:0),risk:round(risk),passengers:Math.min(route.capacity,s.population),provisioned:!!options.provisioned};
}
export function crisisFor(s) {
  if(s.ended||s.population<1||s.turn<s.riotReady)return null;
  if(s.unrest>=65||(s.hunger>=70&&s.morale<=42))return {id:'riot',title:'창고 앞에 선 사람들',body:'굶주린 주민들이 봉인된 창고와 항구로 몰려왔습니다. 돌을 쥔 손과 빈 자루가 보입니다. 군을 부르면 발포가 허용됩니다. 길을 열어 주면 식량을 얻지만, 지주의 대리인은 마을 주거지 전체에 축출을 집행하겠다고 통보합니다.'};
  return null;
}
export function resolveCrisis(state,choice) {
  if(!crisisFor(state)||!['suppress','standaside'].includes(choice))return {state,error:'지금 결정할 수 없는 위기 대응입니다.'};
  const s=reconcileProvisions(structuredClone(state));s.riotReady=s.turn+4;
  if(choice==='suppress'){
    const killed=loseResidents(s,Math.ceil(s.population*.018+s.unrest*.08));s.violenceDeaths+=killed;
    adjust(s,'morale',-24);adjust(s,'trust',-22);adjust(s,'pressure',-16);adjust(s,'unrest',-52);
    record(s,'발포 명령',`군이 주민들에게 발포했습니다. ${killed}명이 사망했습니다. 창고의 봉인은 유지되었습니다. 살아남은 가족들은 당신의 이름을 기억합니다.`,'danger');
  }else{
    const grain=s.grain;s.grain=0;addFood(s,'grain',grain*.6);s.riotRetaliation=true;s.exportTarget=0;s.cattleExport=0;
    adjust(s,'morale',8);adjust(s,'trust',-8);adjust(s,'pressure',18);adjust(s,'unrest',-45);
    record(s,'군을 부르지 않은 밤',`주민들이 곡물 ${grain}단위를 가져갔습니다. 운반 중 손실을 제외한 ${round(grain*.6)}단위가 식량이 되었습니다. 월말에 구빈원 밖의 모든 주거지에 집단 축출이 집행됩니다.`,'danger');
  }
  if(!s.population&&!atSea(s))s.ended=true;
  return {state:s,error:null};
}
export function actionReason(s,id,options={}) {
  const a=ACTIONS[id];
  if(!a) return '알 수 없는 조치입니다.';
  if(s.ended) return '통치 기록이 종료되었습니다.';
  if(crisisFor(s))return '먼저 창고 앞 폭동에 대응해야 합니다.';
  if(!s.population)return '마을에는 항해 중인 주민을 기다리는 장부만 남았습니다.';
  if(s.actionsLeft<1) return '이번 달 행정 조치를 모두 사용했습니다.';
  if(s.used.includes(id)) return '이번 달 이미 시행했습니다.';
  if(s.money<a.cost) return '기금이 부족합니다.';
  if(id==='divert'&&s.grain<1) return '창고에 곡물이 없습니다.';
  if(id==='slaughter'&&s.cattle<4) return '가축 4마리가 필요합니다.';
  if(id==='crops'&&s.crops>=5) return '대체 경작지가 최대 규모입니다.';
  if(id==='clinic'&&s.clinic>=3) return '진료소가 최대 규모입니다.';
  if(id==='shelter'&&s.homeless===0) return '현재 노숙 주민이 없습니다.';
  if(id==='petition'&&s.turn<s.petitionReady) return `${s.petitionReady-s.turn}개월 뒤 다시 청원할 수 있습니다.`;
  if(id==='workhouse'&&(s.workhouse>=240||s.workhouse>=s.population))return '추가로 수용할 수 없습니다.';
  if(id==='release'&&!s.workhouse)return '구빈원에 수용된 주민이 없습니다.';
  if(id==='emigrate'){
    const terms=voyageTerms(s,options);if(!terms)return '알 수 없는 항로입니다.';
    if(terms.from&&dateOf(s).year<terms.from)return `${terms.from}년부터 지원 항로를 이용할 수 있습니다.`;
    if(s.money<terms.cost)return '선임과 보급을 위한 기금이 부족합니다.';
    if(s.turn<s.emigrationReady)return `${s.emigrationReady-s.turn}개월 뒤 다시 선박을 마련할 수 있습니다.`;
  }
  return '';
}
export function takeAction(state,id,options={}) {
  const reason=actionReason(state,id,options); if(reason) return {state,error:reason};
  const s=reconcileProvisions(structuredClone(state)), a=ACTIONS[id]; s.money-=a.cost; s.actionsLeft--; s.used.push(id);
  let detail=a.desc;
  if(id==='import')addFood(s,'maize',36);
  if(id==='freshFood')addFood(s,'diverse',18);
  if(id==='divert') {const n=Math.min(30,s.grain);s.grain-=n;addFood(s,'grain',n);s.pressure=clamp(s.pressure+24,0,100);s.trust=clamp(s.trust+5,0,100);detail=`봉인 곡물 ${n}단위를 주민에게 돌렸습니다. 행정 압력이 24 증가했습니다.`;}
  if(id==='crops') s.crops++;
  if(id==='shelter') {const n=Math.min(s.homeless,90);s.homeless-=n;s.trust=clamp(s.trust+4,0,100);detail=`노숙 주민 ${n}명에게 거처를 마련했습니다.`;}
  if(id==='petition') {s.pendingAid+=26;s.petitionReady=s.turn+3;}
  if(id==='works') {s.money+=32;s.pendingAid+=4;adjust(s,'hunger',6);adjust(s,'laborStrain',18);adjust(s,'fever',6);adjust(s,'licePressure',8);adjust(s,'morale',-4);}
  if(id==='clinic') s.clinic++;
  if(id==='slaughter') {s.cattle-=4;addFood(s,'animal',24);s.pressure=clamp(s.pressure+18,0,100);}
  if(id==='workhouse'){
    const n=Math.min(60,240-s.workhouse,s.population-s.workhouse);s.workhouse+=n;s.homeless=Math.max(0,s.homeless-n);s.money+=32;
    adjust(s,'fever',5);adjust(s,'licePressure',5);adjust(s,'morale',-7);detail=`${n}명을 구빈원에 수용했습니다. 가족은 서로 다른 병동으로 나뉘었습니다. 정부 지원 £32가 도착했고 과밀 위험이 높아졌습니다.`;
  }
  if(id==='release') {const n=Math.min(60,s.workhouse);s.workhouse-=n;evict(s,n);adjust(s,'fever',-5);adjust(s,'morale',3);detail=`${n}명이 구빈원을 나왔습니다. 이들은 다시 거처가 필요합니다.`;}
  if(id==='sanitation'){adjust(s,'fever',-22);adjust(s,'licePressure',-28);adjust(s,'laborStrain',-12);adjust(s,'morale',-2);}
  if(id==='emigrate'){
    const terms=voyageTerms(s,options),n=terms.passengers;s.money-=terms.cost-a.cost;
    const unhoused=Math.min(n,s.homeless);s.homeless-=unhoused;s.workhouse=Math.max(0,s.workhouse-(n-unhoused));s.population-=n;
    s.voyages.push({id:++s.voyageSerial,destination:terms.id,passengers:n,remaining:terms.months,risk:terms.risk,provisioned:terms.provisioned,departedTurn:s.turn});
    s.emigrationReady=s.turn+3;adjust(s,'morale',-6);adjust(s,'trust',-4);
    detail=`${n}명이 ${terms.destination}로 떠났습니다. 항해 ${terms.months}개월, 1인당 사망 위험 ${Math.round(terms.risk*100)}%. 선임·보급 £${terms.cost}. 출항은 생존의 확인이 아닙니다.`;
  }
  record(s,a.name,detail,id==='divert'||id==='slaughter'?'danger':'neutral');
  return {state:s,error:null};
}
const events = {
  scurvy:{id:'scurvy',personal:true,tag:'식량 장부와 몸의 장부 · 괴혈병',title:'배는 채웠는데 상처가 낫지 않는다',body:'노라의 가족은 배급을 받고 있습니다. 배급 장부에는 식사가 기록되지만 피로와 잇몸 통증은 가시지 않습니다. 의사는 식탁에서 신선한 감자와 채소를 마지막으로 본 때를 묻습니다.',choices:[{label:'채소와 콩을 별도 확보한다',effect:'기금 −£24 · 다양한 식량 +10 · 다음 배급부터 영양 공급 개선',money:-24,food:10,foodKind:'diverse'},{label:'일을 쉬게 하고 현재 배급을 유지한다',effect:'노동 부담 −8 · 사기 −3 · 식단 결핍은 남음',laborStrain:-8,morale:-3}]},
  pellagra:{id:'pellagra',personal:true,tag:'단조로운 식탁 · 펠라그라',title:'같은 죽을 먹은 달들',body:'구호 식량은 빈 그릇을 채웠습니다. 그러나 오랫동안 부족하고 단조로운 식사를 한 주민들에게 피부 이상과 설사, 쇠약이 겹칩니다. 칼로리를 더 들여오는 것만으로는 해결되지 않습니다.',choices:[{label:'콩과 우유를 식단에 보탠다',effect:'기금 −£22 · 다양한 식량 +10 · 니아신·단백질 공급 보완',money:-22,food:10,foodKind:'diverse'},{label:'추가 옥수수 구호를 요청한다',effect:'월말 옥수수 +12 · 편중 식단의 위험은 남음',aid:12}]},
  seedFamily:{id:'seed-family',personal:true,tag:'오브라이언 가족 · 씨감자',title:'내년의 봄을 먹은 가족',body:'노라 오브라이언이 자녀들의 손을 잡고 서 있습니다. 가족 여섯 명은 공동 종자 창고의 씨감자를 훔쳐 먹었습니다. “아이들이 밤새 울었습니다.” 대리인은 계약 위반을 이유로 이 가족을 집에서 내쫓으라고 요구합니다.',choices:[{label:'요구대로 가족을 축출한다',effect:'최대 6명 노숙 · 종자 −14 · 사기 −8 · 평판 −6 · 압력 −4',evict:6,seedReserve:-14,morale:-8,trust:-6,pressure:-4},{label:'눈감아 주고 남은 식량을 나눈다',effect:'식량 최대 4 사용 · 종자 −8 · 사기 +6 · 압력 +6',spendFood:4,seedReserve:-8,morale:6,pressure:6},{label:'£20로 종자를 보충하고 가족을 지킨다',effect:'기금 −£20 · 종자 손실 방지 · 사기 +5 · 압력 +3',money:-20,morale:5,pressure:3}]},
  stoneRoad:{id:'stone-road',personal:true,tag:'패트릭의 작업장 · 공공근로',title:'어디에도 닿지 않는 길',body:'해안의 돌밭에서 패트릭이 쓰러졌습니다. 나흘째 돌을 깨던 그는 자신이 닦는 길이 어디로 이어지는지 모릅니다. 감독관은 출석 명부가 줄면 지원금도 줄어든다고 말합니다.',choices:[{label:'작업을 중단하고 휴식을 준다',effect:'기금 −£12 · 노동 부담 −18 · 발열 위험 −6 · 사기 +4',money:-12,laborStrain:-18,fever:-6,morale:4},{label:'명부를 채우고 작업을 계속한다',effect:'기금 +£14 · 월말 식량 +4 · 노동 부담 +12 · 사기 −8',money:14,aid:4,laborStrain:12,morale:-8}]},
  separated:{id:'separated-family',personal:true,tag:'메리와 브리짓 · 구빈원',title:'문 하나를 사이에 둔 목소리',body:'구빈원에 들어온 메리는 딸 브리짓과 다른 병동에 배치되었습니다. 밤마다 아이의 기침 소리가 벽을 넘어옵니다. 원장은 가족의 면회를 허용하면 격리와 규율을 유지하기 어렵다고 말합니다.',choices:[{label:'간호 인력과 별도 방을 마련한다',effect:'기금 −£18 · 발열 위험 −12 · 사기 +6',money:-18,fever:-12,morale:6},{label:'규율에 따라 병동을 분리한다',effect:'사기 −9 · 행정 압력 −4 · 발열 위험 +5',morale:-9,pressure:-4,fever:5}]},
  feverWard:{id:'fever-ward',personal:true,tag:'발열 병동 · 연쇄 재난',title:'담요 아래의 열',body:'진료소의 명부에 같은 주소가 반복됩니다. 과밀한 병동, 씻지 못한 옷, 지친 몸을 따라 발진티푸스가 번집니다. 의사는 식사만으로는 이 열을 멈출 수 없다고 말합니다.',choices:[{label:'병동을 비우고 세탁·격리를 시행한다',effect:'기금 −£24 · 발열 위험 −24 · 노동 부담 −10 · 사기 −3',money:-24,fever:-24,laborStrain:-10,morale:-3},{label:'문을 열어 둔 채 구호를 계속한다',effect:'월말 식량 +5 · 발열 위험 +12 · 사기 +2',aid:5,fever:12,morale:2}]},
  emptyChair:{id:'empty-chair',personal:true,tag:'항구의 가족 · 이별',title:'식탁에 남은 빈자리',body:'이민선이 수평선 너머로 사라졌습니다. 아일린은 아버지가 앉던 의자를 치우지 못합니다. 사람들은 식량이 조금 더 오래 갈 것이라 말하지만, 도착했다는 편지는 아직 오지 않았습니다.',choices:[{label:'남은 가족의 식사를 지원한다',effect:'식량 최대 5 사용 · 사기 +6 · 평판 +3',spendFood:5,morale:6,trust:3},{label:'항해 결과가 올 때까지 기다린다',effect:'사기 −4',morale:-4}]},
  arrival:{tag:'부임 문서',title:'두 개의 장부',body:'주민 명부에는 1,200명의 이름이, 지주의 장부에는 매달 내보낼 곡물의 양이 적혀 있습니다. 첫 공문에 무엇을 적겠습니까?',choices:[{label:'겨울 구호를 우선한다',effect:'식량 +14 · 행정 압력 +6',food:14,pressure:6},{label:'계약 이행을 약속한다',effect:'기금 +£18 · 주민 신뢰 −5',money:18,trust:-5}]},
  first:{tag:'1845 · 첫 징후',title:'검게 변한 잎사귀',body:'일부 밭에서 이상한 냄새가 납니다. 이번 수확의 일부를 잃었습니다. 아직은 겨울을 넘길 수 있다는 말이 돌고 있습니다.',choices:[{label:'종자와 대체 작물을 확보한다',effect:'£25 사용 · 대체 경작 +1',money:-25,crops:1},{label:'남은 감자를 나누어 준다',effect:'식량 +10 · 주민 신뢰 +4',food:10,trust:4}]},
  blight:{tag:'1846 · 감자 마름병',title:'땅은 아무것도 돌려주지 않았다',body:'감자를 캐면 검은 물이 흘러내립니다. 올해 수확은 평년의 약 2%. 항구에는 여전히 곡물 자루가 쌓여 있습니다. 지주의 수출 계약은 바뀌지 않았습니다.',choices:[{label:'재난 구호를 긴급 청원한다',effect:'월말 식량 +32 · 행정 압력 +4',aid:32,pressure:4},{label:'사유 창고를 긴급 개방한다',effect:'곡물 최대 24 → 식량 · 행정 압력 +20',divert:24,pressure:20}]},
  soup:{tag:'1847 · 구호의 계절',title:'수프 한 그릇의 행렬',body:'한시적인 무료 급식 지원이 도착했습니다. 교회 앞에 길게 늘어선 행렬은 해가 질 때까지 줄어들지 않습니다.',choices:[{label:'식량을 즉시 배급한다',effect:'식량 +42',food:42},{label:'구호소에 식량과 거처를 배분한다',effect:'식량 +22 · 노숙 주민 최대 60명 수용',food:22,shelter:60}]},
  repeal:{tag:'1847 · 행정 통보',title:'구호의 책임은 지방으로',body:'한시 구호 지원이 끝나갑니다. 중앙의 공문은 지역의 부담을 늘리고 있습니다. 겨울이 오기 전에 준비해야 합니다.',choices:[{label:'지역 모금으로 이어간다',effect:'기금 +£28 · 주민 신뢰 −8',money:28,trust:-8},{label:'공식 이의를 제기한다',effect:'주민 신뢰 +6 · 행정 압력 +8',trust:6,pressure:8}]},
  frost:{tag:'겨울 보고',title:'지붕 없는 겨울',body:'해안에서 찬바람이 불어옵니다. 축출된 가족에게 겨울은 또 하나의 기근입니다. 식량과 거처를 함께 살펴야 합니다.',choices:[{label:'빈 건물에 가족들을 들인다',effect:'£12 사용 · 최대 50명 수용',money:-12,shelter:50},{label:'교회에 담요와 이탄을 요청한다',effect:'최대 18명 수용 · 주민 신뢰 +2',shelter:18,trust:2}]},
  agent:{tag:'지주의 대리인',title:'런던에서 온 편지',body:'“토지 계약의 의무는 변하지 않습니다.” 대리인은 봉인 상태를 살피고, 다음 배의 출항일을 확인합니다.',choices:[{label:'행정 비용을 부담하고 협상한다',effect:'£12 사용 · 행정 압력 −14',money:-12,pressure:-14},{label:'주민들의 탄원서를 내민다',effect:'주민 신뢰 +4 · 행정 압력 +3',trust:4,pressure:3}]},
  mutual:{tag:'마을 소식',title:'서로의 이름을 부르는 사람들',body:'이웃들이 함께 감자를 심고 아픈 가족을 돌봅니다. 작은 연대에도 땔감과 시간, 무엇보다 먹을 것이 필요합니다.',choices:[{label:'공동 경작을 지원한다',effect:'£16 사용 · 식량 +13 · 신뢰 +3',money:-16,food:13,trust:3},{label:'자원 돌봄을 조직한다',effect:'영양 결핍 −4 · 주민 신뢰 +2',hunger:-4,trust:2}]},
};
export function eventFor(s) {
  const {year,month}=dateOf(s);
  if(s.eventDone&&s.resolvedEvent&&events[s.resolvedEvent])return events[s.resolvedEvent];
  if(s.population===0)return events.mutual;
  if(s.turn===0)return events.arrival;
  if(year===1845&&month===9)return events.first;
  if(year===1846&&month===9)return events.blight;
  if(year===1847&&month===5)return events.soup;
  if(year===1847&&month===9)return events.repeal;
  if(!s.storySeen.includes('scurvy')&&s.cDeficientMonths>=1)return events.scurvy;
  if(!s.storySeen.includes('pellagra')&&s.bDeficientMonths>=2)return events.pellagra;
  if(!s.storySeen.includes('fever-ward')&&s.fever>=50)return events.feverWard;
  if(!s.storySeen.includes('separated-family')&&s.workhouse>0)return events.separated;
  if(!s.storySeen.includes('stone-road')&&s.laborStrain>=12)return events.stoneRoad;
  if(!s.storySeen.includes('empty-chair')&&atSea(s)>0)return events.emptyChair;
  if(!s.storySeen.includes('seed-family')&&(s.turn>=25||(s.turn>=18&&s.hunger>=18)))return events.seedFamily;
  if(month===12)return events.frost;
  if(month===3||month===7)return events.agent;
  return events.mutual;
}
export function choiceReason(s,index) {
  const c=eventFor(s).choices[index];
  if(!c)return '선택할 수 없는 응답입니다.';
  if(s.ended||s.eventDone)return '이미 결정한 사안입니다.';
  if(crisisFor(s))return '먼저 창고 앞 폭동에 대응해야 합니다.';
  if(c.money<0&&s.money+c.money<0)return '기금이 부족합니다.';
  if(c.crops&&s.crops>=5)return '대체 경작지가 최대 규모입니다.';
  if(c.divert&&s.grain<1)return '창고에 곡물이 없습니다.';
  return '';
}
export function chooseEvent(state,index) {
  const error=choiceReason(state,index);if(error)return {state,error};
  const s=reconcileProvisions(structuredClone(state)),e=eventFor(s),c=e.choices[index];
  for(const k of ['money','trust','pressure','hunger','crops','morale','fever','laborStrain','seedReserve'])if(c[k])s[k]+=c[k];
  if(c.food)addFood(s,c.foodKind||(e===events.arrival||e===events.first?'potato':e===events.mutual?'diverse':'grain'),c.food);
  for(const k of ['trust','pressure','hunger','morale','fever','laborStrain','seedReserve'])s[k]=clamp(s[k],0,100);
  if(c.shelter)s.homeless=Math.max(0,s.homeless-c.shelter);
  if(c.aid)s.pendingAid+=c.aid;
  if(c.divert){const n=Math.min(s.grain,c.divert);s.grain-=n;addFood(s,'grain',n);}
  if(c.spendFood)eatFood(s,c.spendFood,'mixed');
  if(c.evict)evict(s,c.evict);
  if(e.personal)s.storySeen.push(e.id);
  s.eventDone=true;s.resolvedEvent=Object.keys(events).find(key=>events[key]===e)||null;
  record(s,e.title,`${c.label}. ${c.effect}`,e===events.blight?'danger':'neutral');
  return {state:s,error:null};
}
export function setPolicy(state,patch) {
  if(state.ended)return state;
  const s=structuredClone(state);
  if([0.75,1,1.25].includes(patch.ration))s.ration=patch.ration;
  if(Number.isFinite(patch.exportTarget))s.exportTarget=clamp(Math.round(patch.exportTarget),0,quotaOf(s));
  if(Number.isFinite(patch.cattleExport))s.cattleExport=clamp(Math.round(patch.cattleExport),0,Math.min(4,s.cattle));
  if(['mixed','fresh','relief'].includes(patch.foodPolicy))s.foodPolicy=patch.foodPolicy;
  if(s.riotRetaliation){s.exportTarget=0;s.cattleExport=0;}
  return s;
}
function settle(state) {
  const s=reconcileProvisions(structuredClone(state)),{year,month}=dateOf(s), before=s.population;
  const report={year,month,harvest:0,crops:0,foodUsed:0,grainShipped:0,cattleShipped:0,quota:quotaOf(s),shortfall:0,evicted:0,punished:false,starved:0,cold:0,disease:0,income:0,upkeep:0,aid:s.pendingAid,workhouseFood:0,collectiveEviction:false,seaLost:0,voyageLetters:[]};
  // Aid and crops are available before this month's meals. Grain arrivals belong to the landlord.
  addFood(s,'maize',s.pendingAid);s.pendingAid=0;
  const labor=0.55+0.45*s.population/INITIAL_POPULATION;
  report.crops=round(s.crops*2.4*labor);addFood(s,'diverse',report.crops);
  report.workhouseFood=round(s.workhouse/50);addFood(s,'maize',report.workhouseFood);
  if(month===9){report.harvest=Math.round((HARVEST[year-1845]||0)*labor*(.5+s.seedReserve/200));addFood(s,'potato',report.harvest);}
  if(month===3)s.cattle+=Math.max(0,Math.floor(s.cattle/6));
  const supply=Math.round(17*labor)+(month===9?65:0);s.grain+=supply;
  report.cattleShipped=s.riotRetaliation?0:Math.min(s.cattleExport,s.cattle,4);s.cattle-=report.cattleShipped;
  const cattleCredit=report.cattleShipped*4;
  report.grainShipped=s.riotRetaliation?0:Math.min(s.grain,s.exportTarget,Math.max(0,report.quota-cattleCredit));s.grain-=report.grainShipped;
  report.shortfall=Math.max(0,report.quota-report.grainShipped-cattleCredit);
  if(report.shortfall){
    report.evicted=evict(s,s.riotRetaliation?s.population:Math.ceil(report.shortfall/report.quota*54));
    report.collectiveEviction=s.riotRetaliation;s.pressure+=8+report.shortfall*0.35;s.trust-=6;
  }else{s.pressure-=5;}
  s.riotRetaliation=false;
  // Requisition crosses a visible threshold; threshold and consequences are shown in UI.
  if(s.pressure>=65){
    report.punished=true;s.money=Math.max(0,s.money-30);s.grain=Math.max(0,s.grain-20);
    report.evicted+=evict(s,45);s.pressure-=22;s.trust-=8;
  }
  const need=foodNeed(s), target=round(need*s.ration);
  const meal=eatFood(s,target);report.foodUsed=meal.used;report.diet=meal.eaten;
  const nutrition=dietHealth(s,meal.eaten,need);Object.assign(report,nutrition);
  const coverage=need?report.foodUsed/need:1;
  s.hunger=clamp(s.hunger+(1-coverage)*35-(coverage>=1?10:0),0,100);
  const crowding=s.workhouse/24+Math.max(0,s.workhouse-120)/18;
  s.licePressure=clamp(s.licePressure+crowding*1.2+s.homeless/Math.max(1,s.population)*10+s.laborStrain*.04-3-s.clinic*.8,0,100);
  const vulnerability=1+nutrition.scurvy*.6+nutrition.pellagra*.25+Math.max(0,s.hunger-40)*.006;
  s.fever=clamp(s.fever+(crowding+s.laborStrain*.18+6)*s.licePressure/100*vulnerability-5-s.clinic*2,0,100);
  report.starved=Math.min(before,Math.ceil(before*Math.max(0,s.hunger-24)/100*0.065));
  const winter=month===12||month<=2;
  report.cold=Math.min(before-report.starved,winter?Math.ceil(s.homeless*.09):Math.floor(s.homeless*.012));
  const epidemic=s.fever>=35?(before*s.fever/100*.018+s.workhouse*s.fever/100*.045):0;
  let available=before-report.starved-report.cold;
  report.scurvyDeaths=Math.min(available,Math.floor(before*nutrition.scurvy*.006*(1-s.clinic*.1)));available-=report.scurvyDeaths;
  report.pellagraDeaths=Math.min(available,Math.floor(before*nutrition.pellagra*.004*(1-s.clinic*.1)));available-=report.pellagraDeaths;
  report.typhusDeaths=Math.min(available,Math.floor(epidemic*vulnerability*(1-s.clinic*.23)));
  report.disease=report.scurvyDeaths+report.pellagraDeaths+report.typhusDeaths;
  // Exposure deaths belong to the unhoused; other casualties affect both wards and homes.
  s.homeless-=report.cold;s.population-=report.cold;s.deaths+=report.cold;loseResidents(s,report.starved+report.disease);
  const lost=report.starved+report.cold+report.disease;s.feverDeaths+=report.typhusDeaths;s.scurvyDeaths+=report.scurvyDeaths;s.pellagraDeaths+=report.pellagraDeaths;
  s.laborStrain=Math.max(0,s.laborStrain-7);
  const underway=[];
  for(const v of s.voyages){
    v.remaining--;
    if(v.remaining>0){underway.push(v);continue;}
    let dead=0;for(let i=0;i<v.passengers;i++)if(random(s)<v.risk)dead++;
    const arrived=v.passengers-dead;s.resettled+=arrived;s.deaths+=dead;s.seaDeaths+=dead;report.seaLost+=dead;
    report.voyageLetters.push({id:v.id,destination:ROUTES[v.destination].destination,passengers:v.passengers,dead,arrived});
    adjust(s,'morale',dead?-Math.ceil(dead/Math.max(1,v.passengers)*30):3);adjust(s,'trust',dead?-Math.ceil(dead/Math.max(1,v.passengers)*24):2);
  }
  s.voyages=underway;
  report.income=round(7+s.trust*0.1+report.grainShipped*0.22+report.cattleShipped*1.5);report.upkeep=s.clinic*2;
  s.money=round(Math.max(0,s.money+report.income-report.upkeep));
  s.trust=clamp(s.trust+(coverage>=1?2:-4)-(lost?3:0),0,100);s.pressure=clamp(s.pressure,0,100);
  adjust(s,'morale',(coverage>=1?1:-6)-(lost?4:0)-(s.homeless>s.population*.25?2:0));
  const unrestGain=Math.max(0,s.hunger-35)*.3+Math.max(0,45-s.morale)*.22+(lost?4:0);
  s.unrest=clamp(s.unrest+unrestGain-(coverage>=1&&s.morale>45?12:3),0,100);
  report.lost=lost;report.survivors=s.population;report.coverage=coverage;report.foodAfter=s.food;report.grainAfter=s.grain;
  report.fever=round(s.fever);report.unrest=round(s.unrest);report.totalSurvivors=livingTotal(s);report.allDeaths=lost+report.seaLost;
  report.vitaminC=round(s.vitaminC);report.niacin=round(s.niacin);report.licePressure=round(s.licePressure);
  return {s,report};
}
export function forecast(s) { return settle(s).report; }
export function monthBlock(s) {
  if(s.ended)return '';
  if(crisisFor(s))return '먼저 폭동에 대응해야 합니다.';
  if(eventFor(s).personal&&!s.eventDone)return '한 가족의 사연에 응답한 뒤 마감하세요.';
  return '';
}
export function advanceMonth(state) {
  if(state.ended||monthBlock(state))return state;
  const {s,report}=settle(state);
  if(report.harvest)record(s,'9월 감자 수확',`${report.harvest}단위를 수확했습니다.${dateOf(s).year===1846?' 감자 마름병으로 수확량이 붕괴했습니다.':''}`,report.harvest<50?'danger':'neutral');
  if(report.evicted)record(s,report.punished?'군경의 징벌 집행':'소작료 체납과 축출',`${report.evicted}명이 거처를 잃었습니다.${report.punished?' 기금 최대 £30와 봉인 곡물 최대 20단위를 압수당했습니다.':''}`,'danger');
  if(report.collectiveEviction)record(s,'마을 주거지의 집단 축출','창고 습격에 대한 보복으로 구빈원 밖의 주거지를 비우라는 명령이 집행되었습니다.','danger');
  if(report.disease)record(s,'병동의 명부',`괴혈병 ${report.scurvyDeaths}명 · 펠라그라 ${report.pellagraDeaths}명 · 티푸스 ${report.typhusDeaths}명 사망. 칼로리 배급과 영양 충족은 서로 다른 장부입니다.`,'danger');
  for(const letter of report.voyageLetters)record(s,'바다 건너에서 온 편지',`${letter.destination}행 ${letter.passengers}명 중 ${letter.arrived}명 도착, ${letter.dead}명 해상 사망. 떠난 사람들의 운명도 이 마을의 장부에 남습니다.`,letter.dead?'danger':'neutral');
  record(s,`${report.month}월 결산`,`${report.lost}명 마을 내 사망 · 마을 주민 ${report.survivors}명. 식량 ${report.foodAfter}단위, 지주 곡물 ${report.grainAfter}단위. 정착 ${s.resettled}명, 항해 중 ${atSea(s)}명.`,report.lost?'danger':'neutral');
  s.history.push(report);s.lastReport=report;s.turn++;
  s.ended=s.turn>=96||(s.population===0&&atSea(s)===0);s.actionsLeft=2;s.used=[];s.eventDone=false;s.resolvedEvent=null;
  if(!s.ended)s.exportTarget=quotaOf(s);s.cattleExport=0;
  if(s.ended)record(s,'행정 기록의 마지막 장',`처음의 1,200명 중 확인된 생존 ${s.population+s.resettled}명, 항해 중 ${atSea(s)}명, 사망 ${s.deaths}명. 해상 사망 ${s.seaDeaths}명, 발포 사망 ${s.violenceDeaths}명을 포함합니다.`);
  return s;
}
export function serialize(s) { return JSON.stringify(s); }
export function restore(raw) {
  try {
    let s=JSON.parse(raw);
    if(!s||![1,2,VERSION].includes(s.version)||!Array.isArray(s.log)||!Array.isArray(s.history)||!Array.isArray(s.used))return null;
    if(s.version===1){
      if(s.population+s.deaths!==1200)return null;
      const additions=freshGame();for(const key of ['morale','fever','laborStrain','workhouse','unrest','seedReserve','voyages','resettled','seaDeaths','violenceDeaths','feverDeaths','rng','voyageSerial','emigrationReady','riotReady','riotRetaliation','storySeen'])s[key]=structuredClone(additions[key]);
      s.morale=clamp(s.trust,0,100);s.version=2;
    }
    if(s.version===2){
      // Existing food had no composition record. Preserve the quantity as an explicitly estimated mixed stock.
      const potato=round(s.food*.4),grain=round(s.food*.3);
      s.provisions={potato,maize:0,grain,diverse:round(s.food-potato-grain),animal:0};
      for(const key of ['foodPolicy','potatoFreshness','vitaminC','niacin','cDeficientMonths','bDeficientMonths','licePressure','scurvyDeaths','pellagraDeaths'])s[key]=freshGame()[key];
      s.version=VERSION;
    }
    s.resolvedEvent??=null;
    if(s.resolvedEvent!==null&&(typeof s.resolvedEvent!=='string'||!Object.hasOwn(events,s.resolvedEvent)))return null;
    const ranges={turn:[0,96],population:[0,1200],deaths:[0,1200],food:[0,1e6],grain:[0,1e6],cattle:[0,1e6],money:[0,1e6],hunger:[0,100],homeless:[0,1200],pressure:[0,100],trust:[0,100],crops:[0,5],clinic:[0,3],actionsLeft:[0,2],exportTarget:[0,36],cattleExport:[0,4],petitionReady:[0,100],pendingAid:[0,1e4]};
    for(const [k,[lo,hi]] of Object.entries(ranges))if(!Number.isFinite(s[k])||s[k]<lo||s[k]>hi)return null;
    for(const k of ['turn','population','deaths','homeless','crops','clinic','actionsLeft','cattleExport'])if(!Number.isInteger(s[k]))return null;
    const extraRanges={morale:[0,100],fever:[0,100],laborStrain:[0,100],workhouse:[0,240],unrest:[0,100],seedReserve:[0,100],resettled:[0,1200],seaDeaths:[0,1200],violenceDeaths:[0,1200],feverDeaths:[0,1200],rng:[0,4294967295],voyageSerial:[0,100],emigrationReady:[0,100],riotReady:[0,100]};
    for(const [k,[lo,hi]]of Object.entries(extraRanges))if(!Number.isFinite(s[k])||s[k]<lo||s[k]>hi)return null;
    for(const k of ['workhouse','resettled','seaDeaths','violenceDeaths','feverDeaths','rng','voyageSerial','emigrationReady','riotReady'])if(!Number.isInteger(s[k]))return null;
    for(const k of ['vitaminC','niacin','licePressure'])if(!Number.isFinite(s[k])||s[k]<0||s[k]>100)return null;
    if(!Number.isFinite(s.potatoFreshness)||s.potatoFreshness<0||s.potatoFreshness>1||!['mixed','fresh','relief'].includes(s.foodPolicy))return null;
    for(const k of ['cDeficientMonths','bDeficientMonths'])if(!Number.isInteger(s[k])||s[k]<0||s[k]>96)return null;
    for(const k of ['scurvyDeaths','pellagraDeaths'])if(!Number.isInteger(s[k])||s[k]<0||s[k]>s.deaths)return null;
    if(!s.provisions||Array.isArray(s.provisions)||Object.keys(s.provisions).length!==foodKeys.length||foodKeys.some(k=>!Number.isFinite(s.provisions[k])||s.provisions[k]<0||s.provisions[k]>1e6)||Math.abs(stockTotal(s)-s.food)>.011)return null;
    if(!Array.isArray(s.voyages)||s.voyages.length>32||!Array.isArray(s.storySeen)||s.storySeen.length>20||s.storySeen.some(id=>!['seed-family','stone-road','separated-family','fever-ward','empty-chair','scurvy','pellagra'].includes(id))||new Set(s.storySeen).size!==s.storySeen.length)return null;
    const voyageIds=new Set();
    for(const v of s.voyages){
      if(!v||!ROUTES[v.destination]||!Number.isInteger(v.passengers)||v.passengers<1||v.passengers>ROUTES[v.destination].capacity||!Number.isInteger(v.remaining)||v.remaining<1||v.remaining>ROUTES[v.destination].months||!Number.isFinite(v.risk)||v.risk<0||v.risk>1||typeof v.provisioned!=='boolean'||!Number.isInteger(v.id)||v.id<1||v.id>s.voyageSerial||voyageIds.has(v.id)||!Number.isInteger(v.departedTurn)||v.departedTurn<0||v.departedTurn>s.turn)return null;
      voyageIds.add(v.id);
    }
    if(livingTotal(s)+s.deaths!==1200||s.homeless+s.workhouse>s.population||s.seaDeaths+s.violenceDeaths+s.feverDeaths+s.scurvyDeaths+s.pellagraDeaths>s.deaths||![0.75,1,1.25].includes(s.ration)||typeof s.eventDone!=='boolean'||typeof s.ended!=='boolean'||typeof s.riotRetaliation!=='boolean')return null;
    if(s.ended!==(s.turn===96||(s.population===0&&atSea(s)===0))||s.history.length!==s.turn)return null;
    if(s.used.some(id=>!ACTIONS[id])||new Set(s.used).size!==s.used.length||s.used.length!==2-s.actionsLeft)return null;
    if(s.log.length>2000||s.log.some(e=>!e||!Number.isInteger(e.turn)||typeof e.title!=='string'||typeof e.text!=='string'||e.title.length>200||e.text.length>2000))return null;
    if(s.history.some(r=>!r||!Number.isFinite(r.survivors)||!Number.isFinite(r.lost)||r.survivors<0||r.lost<0))return null;
    return s;
  }catch{return null;}
}
