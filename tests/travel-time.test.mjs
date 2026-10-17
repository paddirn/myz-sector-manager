import {test} from 'node:test';
import assert from 'node:assert/strict';
import {travelOptions,travelTimes,formatDuration,sectorTravelOptions,storedTravel} from '../scripts/travel-time.mjs';
import {sectorNaming,sectorName} from '../scripts/journal-organization.mjs';
test('foot and vehicle durations are independent of exploration modifiers',()=>{
  assert.deepEqual(travelTimes(),{explore:240,pass:60});assert.deepEqual(travelTimes({mode:'vehicle'}),{explore:120,pass:30});
  for(const [key,factor] of [['rushed',.25],['stalker',.5],['open',.5],['difficult',2],['night',2]]){
    assert.deepEqual(travelTimes({[key]:true}),{explore:240*factor,pass:60});
    assert.deepEqual(travelTimes({mode:'vehicle',[key]:true}),{explore:120*factor,pass:30});
  }
});
test('stacking, adjustable terrain and fractional duration formatting',()=>{
  assert.equal(travelTimes({rushed:true,night:true}).explore,120);
  assert.equal(travelTimes({stalker:true,open:true}).explore,60);
  assert.equal(travelTimes({mode:'vehicle',rushed:true,stalker:true,open:true}).explore,7.5);
  assert.equal(travelTimes({difficult:true,difficulty:3.5}).explore,840);
  for(const difficulty of [1,-5,'invalid',Infinity])assert.equal(travelOptions({difficulty}).difficulty,2);
  assert.equal(travelOptions({open:true,difficult:true}).open,false);
  for(const [value,expected] of [[240,'4 hours'],[60,'1 hour'],[30,'30 minutes'],[7.5,'7.5 minutes'],[67.5,'1 hour 7.5 minutes']])assert.equal(formatDuration(value),expected);
});
test('travel calculation preserves its input and unrelated sector properties',()=>{
  const sector={travel:{mode:'vehicle',night:true,difficulty:4},loot:[{uuid:'Item.keep'}]},before=structuredClone(sector);
  assert.deepEqual(travelTimes(sector.travel),{explore:240,pass:30});assert.deepEqual(sector,before);
});
test('legacy names migrate conservatively; explicit overrides survive terrain changes and reset',()=>{
  const data={code:'A3',terrain:'Overgrown Ruins',loot:[{uuid:'Item.keep'}]};
  assert.equal(sectorNaming(data,'A3 - Overgrown Ruins').nameOverride,false);
  const custom=sectorNaming(data,'The Old Tower');assert.equal(custom.nameOverride,true);
  assert.equal(sectorName({...custom,code:'B7',terrain:'Thick Woods'}),'The Old Tower');
  assert.equal(sectorName({...custom,nameOverride:false}),'A3 - Overgrown Ruins');
  assert.equal(data.nameOverride,undefined);assert.deepEqual(custom.loot,data.loot);
});

test('linked stunt multipliers are authoritative and apply exactly once, including when combined',()=>{
  for(const [halfTime,rush,expected] of [[false,false,240],[true,false,120],[false,true,60],[true,true,30]]){
    const data={pathStunts:{halfTime,rush},travel:{stalker:!halfTime,rushed:!rush,night:true}};
    const options=sectorTravelOptions(data);assert.equal(options.stalker,halfTime);assert.equal(options.rushed,rush);
    assert.deepEqual(travelTimes({...options,night:false}),{explore:expected,pass:60});
    assert.deepEqual(travelTimes(options),{explore:expected*2,pass:60});
    assert.deepEqual(storedTravel(options),{mode:'foot',open:false,difficult:false,difficulty:2,night:true});
  }
  assert.equal(sectorTravelOptions({travel:{stalker:true,rushed:true}}).stalker,false);
});
