import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SectorEntryTriggers} from '../scripts/zone/entry-triggers.mjs';
function fixture(){
 const token={id:'party',uuid:'Scene.zone.Token.party',parent:{id:'zone'},x:0,y:0,width:1,height:1};
 const scene={id:'zone',grid:{size:100},tokens:new Map([['party',token]])};
 let history={records:[]};const sector={version:1,code:'B1',effects:[{triggerId:'first',macroUuid:'Macro.one',macroEnabled:true},{triggerId:'second',macroUuid:'Compendium.test.macros.Macro.two',macroEnabled:true}]};
 const journal={id:'stable-sector',getFlag:(module,key)=>structuredClone(key==='sector'?sector:history),setFlag:async(module,key,value)=>{assert.equal(key,'entryTriggers');history=structuredClone(value);}};
 const events=[],errors=[];let authoritative=true;
 const store={get authoritative(){return authoritative;},config:{sceneId:'zone',groups:[{tokenId:'party',sceneId:'zone'}],grid:{reference:'A1',originX:0,originY:0,width:500,height:500,columnAxis:'x',columnDirection:1,rowDirection:1,columns:10,rows:10}},scene,sectorRecords:coordinate=>coordinate===sector.code?[journal]:[]};
 const env={fromUuid:async uuid=>({documentName:'Macro',canExecute:true,execute:async()=>{events.push(uuid);}}),ui:{notifications:{error:m=>errors.push(m)}}};
 const service=new SectorEntryTriggers(store,env);service.prime();
 const move=async x=>{token.x=x;await service.moved(token,{x});};
 return {service,store,token,scene,journal,sector,env,events,errors,move,history:()=>history.records,setAuthority:value=>authoritative=value};
}
test('registered token entry fires in order once, survives reload and renaming, new trigger and reset allow later entries',async()=>{
 const f=fixture();await f.move(500);assert.equal(f.events.length,2);assert(Object.values(f.history()).every(r=>r.status==='completed'));
 await f.move(520);await f.move(0);await f.move(500);assert.equal(f.events.length,2);
 const reloaded=new SectorEntryTriggers(f.store,f.env);reloaded.prime();await reloaded.moved(f.token,{x:500});assert.equal(f.events.length,2);
 f.sector.code='C1';await f.move(1000);assert.equal(f.events.length,2);
 f.sector.effects.push({triggerId:'new',macroUuid:'Macro.three',macroEnabled:true});await f.move(0);await f.move(1000);assert.equal(f.events.length,3);
 await f.service.reset(f.journal,'first');await f.move(0);await f.move(1000);assert.equal(f.events.length,4);
 await f.service.reset(f.journal);assert.deepEqual(f.history(),[]);
});
test('Promises are awaited; errors recorded; missing/denied Macro never executes; later trigger continues',async()=>{
 const f=fixture();let finish;const pending=new Promise(resolve=>finish=resolve);f.env.fromUuid=async uuid=>({documentName:'Macro',canExecute:true,execute:async()=>{f.events.push(uuid);if(uuid==='Macro.one')await pending;else throw Error('Macro failed');}});
 f.token.x=500;const moving=f.service.moved(f.token,{x:500});await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.events,['Macro.one']);finish();await moving;assert.equal(f.events.length,2);assert.equal(f.errors.length,1);assert.equal(Object.values(f.history())[1].status,'failed');
 await f.service.reset(f.journal);f.env.fromUuid=async()=>({documentName:'Macro',canExecute:false,execute:()=>assert.fail()});await f.move(0);await f.move(500);assert(Object.values(f.history()).every(r=>r.status==='failed'));
});
test('unrelated tokens, initialization, inactive GMs, same-sector and endpoint-only movements never fire incorrectly',async()=>{
 const f=fixture();await f.service.moved({...f.token,id:'stranger',uuid:'other',x:500},{x:500});assert.equal(f.events.length,0);
 await f.move(20);await f.move(1500);assert.equal(f.events.length,0);
 f.setAuthority(false);await f.move(500);assert.equal(f.events.length,0);assert.deepEqual(f.history(),[]);
 f.setAuthority(true);await f.move(0);await f.move(500);assert.equal(f.events.length,2);
 const other=new SectorEntryTriggers({...f.store,authoritative:false},f.env);other.prime();f.token.x=0;await other.moved(f.token,{x:0});assert.equal(f.events.length,2);
});
test('rapid duplicate updates and Macro-induced moves do not reenter; disabled triggers and Special content ignored',async()=>{
 const f=fixture();f.env.fromUuid=async uuid=>({documentName:'Macro',canExecute:true,execute:async()=>{f.events.push(uuid);await f.move(0);await f.move(500);}});await f.move(500);assert.equal(f.events.length,2);
 await f.service.reset(f.journal);f.sector.sectorType='special';await f.move(0);await f.move(500);assert.equal(f.events.length,2);
});
test('v14 pending/paused waypoints wait for stop; endpoint only, completed teleports and duplicate hooks remain safe',async()=>{
 const f=fixture();f.token.movement={state:'pending'};f.token.x=500;await f.service.updated(f.token,{x:500});assert.equal(f.events.length,0);
 f.token.x=1500;await f.service.updated(f.token,{x:1500});f.token.movement.state='completed';await f.service.stopped(f.token);assert.equal(f.events.length,0);
 f.token.movement.state='paused';f.token.x=500;await f.service.updated(f.token,{x:500});assert.equal(f.events.length,0);f.token.movement.state='stopped';await f.service.stopped(f.token);assert.equal(f.events.length,2);await f.service.stopped(f.token);await f.service.updated(f.token,{x:500});assert.equal(f.events.length,2);
});
test('each registered Expedition token has independent history; failed persistence cannot execute; disabled and missing Macro handling',async()=>{
 const f=fixture();await f.move(500);const second={...f.token,id:'expedition',uuid:'Scene.zone.Token.expedition',x:0};f.scene.tokens.set(second.id,second);f.store.config.groups.push({sceneId:'zone',tokenId:second.id});f.service.prime();second.x=500;await f.service.updated(second,{x:500});assert.equal(f.events.length,4);assert.equal(f.history().length,4);
 await f.service.reset(f.journal);f.sector.effects[0].macroDisabled=true;f.env.fromUuid=async()=>null;await f.move(0);await f.move(500);assert.equal(f.history().length,1);assert.equal(f.history()[0].status,'failed');assert.match(f.history()[0].error,/missing/);
 await f.service.reset(f.journal);f.journal.setFlag=async()=>{throw Error('Write denied');};await f.move(0);await f.move(500);assert.equal(f.events.length,4);assert(f.errors.some(message=>message.includes('Write denied')));
});
test('unchecked repeat mode executes on each reentry, ignores old fired history, and keeps one latest outcome per token',async()=>{
 const f=fixture();await f.move(500);assert.equal(f.events.length,2);
 for(const effect of f.sector.effects)effect.macroRunOnce=false;
 for(let visit=0;visit<3;visit++){await f.move(0);await f.move(500);assert.equal(f.events.length,4+visit*2);await f.service.updated(f.token,{x:500});assert.equal(f.events.length,4+visit*2);}
 assert.equal(f.history().length,2);assert(f.history().every(record=>record.runOnce===false));
 const reloaded=new SectorEntryTriggers(f.store,f.env);reloaded.prime();await reloaded.updated(f.token,{x:500});assert.equal(f.events.length,8);f.token.x=0;await reloaded.updated(f.token,{x:0});f.token.x=500;await reloaded.updated(f.token,{x:500});assert.equal(f.events.length,10);
 for(const effect of f.sector.effects)effect.macroRunOnce=true;
 await f.move(0);await f.move(500);assert.equal(f.events.length,10);await f.service.reset(f.journal,'first');await f.move(0);await f.move(500);assert.equal(f.events.length,11);
});
test('legacy unchecked and missing mode are repeatable; separate disabled state remains independent',async()=>{
 const f=fixture();f.sector.effects[0].macroEnabled=false;delete f.sector.effects[1].macroEnabled;
 await f.move(500);await f.move(0);await f.move(500);assert.equal(f.events.length,4);
 f.sector.effects[0].macroDisabled=true;await f.move(0);await f.move(500);assert.equal(f.events.length,5);
});
test('repeatable Macros remain sequential, await async completion, and keep token histories independent',async()=>{
 const f=fixture();for(const effect of f.sector.effects)effect.macroRunOnce=false;
 let finish;const gate=new Promise(resolve=>finish=resolve);f.env.fromUuid=async uuid=>({documentName:'Macro',canExecute:true,execute:async()=>{f.events.push(uuid);if(uuid==='Macro.one')await gate;}});
 f.token.x=500;const pending=f.service.updated(f.token,{x:500});await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.events,['Macro.one']);finish();await pending;assert.equal(f.events.length,2);
 const second={...f.token,id:'other',uuid:'Scene.zone.Token.other',x:0};f.scene.tokens.set(second.id,second);f.store.config.groups.push({sceneId:'zone',tokenId:second.id});f.service.prime();second.x=500;await f.service.updated(second,{x:500});assert.equal(f.events.length,4);assert.equal(f.history().length,4);
 await f.move(0);await f.move(500);assert.equal(f.events.length,6);assert.equal(f.history().length,4);
});
test('repeatable v14 waypoints cannot fire passed-through sectors or startup stop hooks',async()=>{
 const f=fixture();for(const effect of f.sector.effects)effect.macroRunOnce=false;await f.service.stopped(f.token);assert.equal(f.events.length,0);
 f.token.movement={state:'pending'};f.token.x=500;await f.service.updated(f.token,{x:500});f.token.x=1500;await f.service.updated(f.token,{x:1500});f.token.movement.state='completed';await f.service.stopped(f.token);assert.equal(f.events.length,0);
 for(let i=0;i<2;i++){f.token.movement.state='pending';f.token.x=500;await f.service.updated(f.token,{x:500});f.token.movement.state='completed';await f.service.stopped(f.token);assert.equal(f.events.length,(i+1)*2);f.token.x=0;await f.service.updated(f.token,{x:0});}
});
