import {freshGame,advanceMonth,takeAction,actionReason,chooseEvent,choiceReason,eventFor,forecast,setPolicy,quotaOf,crisisFor,resolveCrisis} from '../engine.js';
const results=[];
for(const strategy of ['contract-only','prepared-relief','open-granaries']){
  let s=freshGame();
  while(!s.ended){
    if(strategy!=='contract-only'){
      s=chooseEvent(s,1).state;
      const act=id=>{if(!actionReason(s,id))s=takeAction(s,id).state;};
      if(strategy==='prepared-relief'){
        if(s.crops<5)act('crops');
        if(s.food<100)act('petition');
        if(s.homeless>15)act('shelter');
        if(forecast(s).coverage<1)act('import');
        if(forecast(s).coverage<1)act('divert');
        if(s.money<70)act('works');
        if(forecast(s).shortfall>0)s=setPolicy(s,{cattleExport:Math.min(4,Math.ceil(forecast(s).shortfall/4))});
      }else{act('divert');act('slaughter');s=setPolicy(s,{exportTarget:0});}
    }
    if(crisisFor(s))s=resolveCrisis(s,strategy==='open-granaries'?'standaside':'suppress').state;
    if(!s.eventDone&&eventFor(s).personal){const i=eventFor(s).choices.findIndex((c,i)=>!choiceReason(s,i));s=chooseEvent(s,i).state;}
    s=advanceMonth(s);
  }
  results.push({strategy,months:s.turn,survivors:s.population,deaths:s.deaths,homeless:s.homeless,money:s.money,evictions:s.history.reduce((n,r)=>n+r.evicted,0),punishments:s.history.filter(r=>r.punished).length});
}
console.table(results);
if(results[1].survivors<=results[0].survivors)throw new Error('Prepared relief should improve survival over inaction.');
