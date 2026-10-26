import test from 'node:test';
import assert from 'node:assert/strict';
import {freshGame,takeAction,actionReason,chooseEvent,choiceReason,eventFor,advanceMonth,forecast,restore,serialize,atSea,livingTotal,voyageTerms,crisisFor,resolveCrisis,monthBlock,setPolicy} from '../engine.js';

function answer(s){
  if(crisisFor(s))s=resolveCrisis(s,'suppress').state;
  if(eventFor(s).personal&&!s.eventDone){const i=eventFor(s).choices.findIndex((c,i)=>!choiceReason(s,i));s=chooseEvent(s,i).state;}
  return s;
}
test('emigration removes mouths from town but preserves every person in the ledger',()=>{
  const initial=freshGame(42),s=takeAction(initial,'emigrate').state;
  assert.equal(s.population,1140);assert.equal(atSea(s),60);assert.equal(livingTotal(s),1200);
  assert.equal(s.resettled,0);assert.equal(s.deaths,0);assert.equal(s.money,132);assert.ok(s.morale<initial.morale);
  assert.equal(s.voyages[0].remaining,2);assert.equal(forecast(s).foodUsed,22.8);
  assert.ok(actionReason(advanceMonth(s),'emigrate'));
});
test('arrival rolls individual deaths once, records settlement and harms family morale',()=>{
  let s=advanceMonth(takeAction(freshGame(42),'emigrate').state);s=answer(s);
  const before=serialize(s),f=forecast(s),a=advanceMonth(s),b=advanceMonth(restore(before));
  assert.equal(serialize(s),before);assert.equal(a.seaDeaths,b.seaDeaths);assert.deepEqual(a.lastReport,f);
  assert.ok(a.seaDeaths>0);assert.ok(a.resettled>0);assert.equal(a.resettled+a.seaDeaths,60);
  assert.equal(atSea(a),0);assert.equal(livingTotal(a)+a.deaths,1200);
  assert.ok(a.morale<s.morale);assert.ok(a.log.some(e=>e.title==='바다 건너에서 온 편지'));
});
test('route, date, extra provisions and health change cost and mortality risk',()=>{
  const s=freshGame();assert.ok(takeAction(s,'emigrate',{destination:'australia'}).error);
  const funded=takeAction({...s,turn:36},'emigrate',{destination:'australia',provisioned:true});
  assert.equal(funded.error,null);assert.equal(funded.state.voyages[0].remaining,4);assert.equal(funded.state.population,1160);assert.equal(funded.state.money,74);
  const normal=voyageTerms(s),extra=voyageTerms(s,{provisioned:true}),sick=voyageTerms({...s,hunger:100});
  assert.ok(extra.risk<normal.risk);assert.ok(sick.risk>normal.risk);assert.equal(extra.cost,normal.cost+24);
  assert.ok(takeAction({...s,money:50},'emigrate',{provisioned:true}).error);
  const outcomes=new Set();for(let seed=1;seed<=8;seed++){let v=takeAction(freshGame(seed),'emigrate').state;v=advanceMonth(v);v=advanceMonth(answer(v));outcomes.add(v.seaDeaths);}assert.ok(outcomes.size>1);
});
test('an empty town waits for its ship; the last departure is never automatically survival',()=>{
  let s=takeAction({...freshGame(42),population:1,deaths:1199},'emigrate').state;
  assert.equal(s.population,0);assert.equal(s.ended,false);s=advanceMonth(s);assert.equal(s.ended,false);
  s=advanceMonth(s);assert.equal(s.ended,true);assert.equal(atSea(s),0);assert.equal(livingTotal(s)+s.deaths,1200);
});
test('1852 ends with unresolved passengers separately counted, without inventing arrivals',()=>{
  let s=takeAction({...freshGame(),turn:95},'emigrate',{destination:'australia'}).state;s=advanceMonth(answer(s));
  assert.equal(s.ended,true);assert.equal(atSea(s),40);assert.equal(s.resettled,0);assert.equal(s.voyages[0].remaining,3);
  assert.equal(livingTotal(s)+s.deaths,1200);
});
test('workhouses give conditional support and shelter without reducing town population',()=>{
  const s=takeAction({...freshGame(),homeless:100},'workhouse').state;
  assert.equal(s.workhouse,60);assert.equal(s.homeless,40);assert.equal(s.population,1200);assert.equal(s.money,202);
  assert.equal(forecast(s).workhouseFood,1.2);assert.equal(s.morale,63);
  assert.ok(actionReason({...s,used:[],actionsLeft:2,workhouse:240},'workhouse'));
  const released=takeAction(s,'release').state;assert.equal(released.workhouse,0);assert.equal(released.homeless,100);
});
test('overcrowding and hard labour combine with malnutrition into fever deaths',()=>{
  const base={...freshGame(),workhouse:180,hunger:55,fever:40,laborStrain:60};
  const safe=forecast({...freshGame(),hunger:55}),crowded=forecast(base),clinic=forecast({...base,clinic:3});
  assert.ok(crowded.fever>40);assert.ok(crowded.disease>safe.disease);assert.ok(clinic.disease<crowded.disease);
  const rest=takeAction(base,'sanitation').state;assert.equal(rest.fever,18);assert.equal(rest.laborStrain,48);assert.ok(forecast(rest).disease<crowded.disease);
  const works=takeAction(base,'works').state;assert.equal(works.money,212);assert.equal(works.pendingAid,4);assert.equal(works.laborStrain,78);assert.ok(forecast(works).disease>crowded.disease);
});
test('an active riot blocks silent month advance and administrative actions',()=>{
  const s={...freshGame(),unrest:70};assert.ok(crisisFor(s));assert.ok(monthBlock(s));
  assert.equal(advanceMonth(s),s);assert.ok(takeAction(s,'divert').error);assert.ok(chooseEvent(s,0).error);
  assert.equal(crisisFor({...freshGame(),hunger:75,morale:30}).id,'riot');
});
test('shooting rioters kills residents immediately and reduces reputation and morale',()=>{
  const s={...freshGame(),unrest:80,homeless:40,workhouse:60},n=resolveCrisis(s,'suppress').state;
  assert.ok(n.violenceDeaths>0);assert.equal(n.population+n.deaths,1200);assert.ok(n.trust<s.trust&&n.morale<s.morale);
  assert.equal(n.grain,s.grain);assert.equal(crisisFor(n),null);assert.ok(n.homeless+n.workhouse<=n.population);
  assert.ok(resolveCrisis(n,'standaside').error);
});
test('standing aside feeds people but causes collective eviction even with available rent assets',()=>{
  const s={...freshGame(),unrest:70,homeless:10,workhouse:60};let n=resolveCrisis(s,'standaside').state;
  assert.equal(n.grain,0);assert.equal(n.food,s.food+s.grain*.6);assert.equal(n.deaths,0);
  n=setPolicy(n,{exportTarget:22,cattleExport:4});assert.equal(n.exportTarget,0);assert.equal(n.cattleExport,0);
  const f=forecast(n);assert.equal(f.collectiveEviction,true);assert.equal(f.evicted,1130);assert.equal(f.shortfall,22);
  const settled=advanceMonth(answer(n));assert.equal(settled.riotRetaliation,false);assert.equal(livingTotal(settled)+settled.deaths,1200);
});
test('seed-potato story requires a decision, offers mercy at a cost and affects next harvest',()=>{
  const s={...freshGame(),turn:25};assert.equal(eventFor(s).id,'seed-family');assert.equal(advanceMonth(s),s);
  const expelled=chooseEvent(s,0).state,forgiven=chooseEvent(s,1).state,paid=chooseEvent(s,2).state;
  assert.equal(expelled.homeless,6);assert.equal(expelled.seedReserve,86);assert.equal(forgiven.food,224);
  assert.equal(paid.money,160);assert.equal(paid.seedReserve,100);assert.ok(paid.storySeen.includes('seed-family'));
  assert.equal(eventFor(paid).id,'seed-family','resolved personal story remains on the desk for this month');
  assert.ok(forecast({...expelled,turn:32}).harvest<forecast({...paid,turn:32}).harvest);
  assert.ok(!eventFor(advanceMonth(paid)).personal);
});
test('small unhoused families are exposed to winter losses instead of rounding to immortality',()=>{
  const winter=forecast({...freshGame(),homeless:6}),summer=forecast({...freshGame(),turn:6,homeless:6});
  assert.ok(winter.cold>0);assert.equal(summer.cold,0);
  const n=advanceMonth({...freshGame(),homeless:6});assert.equal(livingTotal(n)+n.deaths,1200);assert.equal(n.homeless,6-winter.cold);
});
test('old saves migrate in place; new save validation enforces passenger and death conservation',()=>{
  const original=freshGame(),old={...original,version:1};for(const key of ['morale','fever','laborStrain','workhouse','unrest','seedReserve','voyages','resettled','seaDeaths','violenceDeaths','feverDeaths','rng','voyageSerial','emigrationReady','riotReady','riotRetaliation','storySeen'])delete old[key];
  const migrated=restore(JSON.stringify(old));assert.equal(migrated.version,2);assert.equal(migrated.population,1200);assert.equal(migrated.turn,0);assert.equal(migrated.seedReserve,100);
  const s=takeAction(freshGame(),'emigrate').state;assert.deepEqual(restore(serialize(s)),s);
  for(const corrupt of [{...s,resettled:100},{...s,seaDeaths:100},{...s,workhouse:240,homeless:1100},{...s,storySeen:['bad']},{...s,rng:-1},{...s,voyages:[{...s.voyages[0],remaining:0}]}])assert.equal(restore(serialize(corrupt)),null);
});
