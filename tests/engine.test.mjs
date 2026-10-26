import test from 'node:test';
import assert from 'node:assert/strict';
import {freshGame,dateOf,quotaOf,foodNeed,ACTIONS,actionReason,takeAction,setPolicy,eventFor,choiceReason,chooseEvent,forecast,advanceMonth,restore,serialize,crisisFor,resolveCrisis,monthBlock,livingTotal,atSea} from '../engine.js';

function decide(s){
  if(crisisFor(s))s=resolveCrisis(s,'suppress').state;
  if(!s.ended&&eventFor(s).personal&&!s.eventDone){const i=eventFor(s).choices.findIndex((c,i)=>!choiceReason(s,i));s=chooseEvent(s,i).state;}
  return s;
}

test('sealed grain and cattle cannot automatically feed residents',()=>{
  const s={...freshGame(),food:0,grain:400,cattle:100};
  const f=forecast(s);assert.equal(f.foodUsed,0);assert.ok(f.grainAfter>300);assert.ok(f.lost>0);
  assert.equal(s.grain,400);assert.equal(s.food,0);
});
test('opening a granary transfers food and adds pressure without creating assets',()=>{
  const s={...freshGame(),food:0,grain:17};const r=takeAction(s,'divert');
  assert.equal(r.state.food,17);assert.equal(r.state.grain,0);assert.equal(r.state.pressure,38);assert.equal(r.state.actionsLeft,1);
  assert.ok(takeAction(r.state,'divert').error);assert.equal(s.grain,17);
});
test('actions enforce funds, monthly limits, cooldown and upgrade caps',()=>{
  assert.ok(takeAction({...freshGame(),money:0},'import').error);
  let s=takeAction(freshGame(),'petition').state;
  assert.ok(takeAction(advanceMonth(s),'petition').error);
  s=advanceMonth(advanceMonth(advanceMonth(s)));assert.equal(actionReason(s,'petition'),'');
  s=takeAction(takeAction(freshGame(),'works').state,'import').state;
  assert.ok(takeAction(s,'divert').error);
  assert.ok(takeAction({...freshGame(),crops:5},'crops').error);
  assert.ok(takeAction({...freshGame(),clinic:3},'clinic').error);
  assert.ok(takeAction(freshGame(),'nonexistent').error);
});
test('1846 blight destroys the September potato harvest; other crops persist',()=>{
  const healthy=forecast({...freshGame(),turn:8});
  const blight=forecast({...freshGame(),turn:20,crops:2});
  assert.equal(healthy.harvest,300);assert.equal(blight.harvest,8);assert.equal(blight.crops,4.8);
  assert.match(eventFor({...freshGame(),turn:20}).title,/땅/);
});
test('full quota prevents eviction; grain shortfall evicts and winter exposure kills',()=>{
  assert.equal(forecast(freshGame()).evicted,0);
  const winter=forecast({...freshGame(),exportTarget:0});
  const summer=forecast({...freshGame(),turn:6,exportTarget:0});
  assert.equal(winter.evicted,54);assert.equal(winter.shortfall,22);assert.ok(winter.cold>summer.cold);
});
test('cattle pay rent without becoming resident food',()=>{
  const s={...freshGame(),food:0,exportTarget:6,cattleExport:4};const f=forecast(s);
  assert.equal(f.cattleShipped,4);assert.equal(f.grainShipped,6);assert.equal(f.shortfall,0);assert.equal(f.foodUsed,0);
});
test('punishment triggers after quota pressure settlement and has named costs',()=>{
  const s={...freshGame(),pressure:75};const f=forecast(s),n=advanceMonth(s);
  assert.equal(f.punished,true);assert.equal(f.evicted,45);assert.equal(n.pressure,48);
  assert.equal(n.money,Math.round((s.money-30+f.income-f.upkeep)*100)/100);
});
test('shelter reduces winter exposure; clinic reduces disease only',()=>{
  const s={...freshGame(),homeless:90};const housed=takeAction(s,'shelter').state;
  assert.ok(forecast(s).cold>forecast(housed).cold);
  const sick={...freshGame(),hunger:100,food:0};const a=forecast(sick),b=forecast({...sick,clinic:3});
  assert.ok(a.disease>b.disease);assert.equal(a.starved,b.starved);
});
test('petition aid arrives before meals and is delivered exactly once',()=>{
  const s=takeAction({...freshGame(),food:0},'petition').state;
  const f=forecast(s),n=advanceMonth(s);assert.equal(f.aid,26);assert.equal(f.foodUsed,24);assert.equal(n.pendingAid,0);assert.equal(forecast(n).aid,0);
});
test('rationing accumulates hunger; extra food helps recovery',()=>{
  let s=setPolicy(freshGame(),{ration:.75});for(let i=0;i<5;i++)s=advanceMonth(s);
  assert.ok(s.hunger>40);assert.ok(s.deaths>0);
  const normal=forecast({...freshGame(),hunger:70}),extra=forecast({...freshGame(),hunger:70,ration:1.25});
  assert.ok(extra.starved<normal.starved);
});
test('event decisions are single-use and respect costs',()=>{
  let s=chooseEvent(freshGame(),0).state;assert.equal(s.food,242);assert.equal(s.actionsLeft,2);
  assert.ok(chooseEvent(s,1).error);assert.ok(chooseEvent({...freshGame(),turn:2,money:0},0).error);
});
test('forecast is exact and never mutates the pending month',()=>{
  let s=takeAction(freshGame(),'divert').state;s=setPolicy(s,{exportTarget:0,ration:.75});
  const original=serialize(s),f=forecast(s),n=advanceMonth(s);
  assert.equal(serialize(s),original);assert.deepEqual(n.lastReport,f);
  assert.equal(n.population,1200-f.lost);assert.equal(n.homeless,f.evicted-f.cold);
});
test('a full 96-month campaign ends in December 1852 with conserved population',()=>{
  let s=freshGame();for(let i=0;i<96;i++){
    // A well-supplied control run checks end conditions independently of balance.
    s.food+=100;s.grain+=100;s=advanceMonth(decide(s));
    assert.equal(s.population+s.deaths,1200);assert.ok(s.food>=0&&s.grain>=0&&s.money>=0);
  }
  assert.equal(s.turn,96);assert.equal(s.ended,true);assert.equal(s.history.at(-1).year,1852);assert.equal(s.history.at(-1).month,12);
  assert.equal(advanceMonth(s),s);assert.ok(takeAction(s,'works').error);assert.equal(setPolicy(s,{ration:.75}),s);
});
test('a village with no survivors ends early, without negative population',()=>{
  let s={...freshGame(),population:1,deaths:1199,hunger:100,food:0,homeless:1};
  // Integer death rounding must not make the last resident immortal.
  for(let i=0;i<24&&!s.ended;i++)s=advanceMonth(s);
  assert.equal(s.population,0);assert.equal(s.ended,true);assert.equal(s.deaths,1200);
});
test('save data round trips and rejects invalid, corrupt or tampered structures',()=>{
  const s=advanceMonth(takeAction(freshGame(),'crops').state);assert.deepEqual(restore(serialize(s)),s);
  for(const bad of ['{','null','{}',JSON.stringify({...s,food:-1}),JSON.stringify({...s,population:999}),JSON.stringify({...s,turn:100}),JSON.stringify({...s,history:[]}),JSON.stringify({...s,used:['not-an-action']}),JSON.stringify({...s,ended:true})])assert.equal(restore(bad),null);
});
test('population, economy and state invariants survive varied complete runs',()=>{
  for(let seed=1;seed<=20;seed++){
    let n=seed,s=freshGame();const random=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};
    while(!s.ended){
      const ids=Object.keys(ACTIONS);for(let a=0;a<2;a++){const id=ids[Math.floor(random()*ids.length)];s=takeAction(s,id).state;}
      s=chooseEvent(s,random()>.5?1:0).state;
      s=setPolicy(s,{ration:[.75,1,1.25][Math.floor(random()*3)],exportTarget:Math.floor(random()*(quotaOf(s)+1)),cattleExport:Math.floor(random()*5)});
      s=advanceMonth(decide(s));
      assert.equal(livingTotal(s)+s.deaths,1200);assert.ok(s.homeless+s.workhouse<=s.population);assert.ok(s.food>=0&&s.grain>=0&&s.cattle>=0&&s.money>=0);
      assert.ok(restore(serialize(s)),`invalid state at turn ${s.turn}`);
    }
  }
});
