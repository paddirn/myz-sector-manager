import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ZoneStore,MODULE,CONFIG_KEY,emptyConfiguration} from '../scripts/zone/store.mjs';
import {ZoneRuntime} from '../scripts/zone/runtime.mjs';

function fixture(){
  let writes=0,creations=0;
  const config={...emptyConfiguration(),sceneId:'zone',grid:{reference:'A1',originX:0,originY:0,width:500,height:400,columns:30,rows:30,columnAxis:'x',columnDirection:1,rowDirection:1},ark:{sceneId:'zone',tokenId:'ark'},groups:[{id:'group1',name:'Alpha',sceneId:'zone',tokenId:'party',actorUuid:''}]};
  const zone={id:'zone',name:'The Zone',grid:{size:100},width:3000,height:3000,tokens:new Map()};
  const combat={id:'combat',grid:{size:50},tokens:new Map()};
  const token=(id,x,y,parent=zone)=>({id,x,y,width:1,height:1,parent});
  zone.tokens.set('ark',token('ark',0,0));zone.tokens.set('party',token('party',500,0));combat.tokens.set('party',token('party',500,0,combat));
  const configDoc={id:'config',getFlag:(module,key)=>key===CONFIG_KEY?configDoc.value:null,value:structuredClone(config),async setFlag(module,key,value){assert.equal(module,MODULE);assert.equal(key,CONFIG_KEY);writes++;this.value=structuredClone(value);}};
  const journal=[configDoc,{id:'sector',getFlag:(mod,key)=>key==='sector'?{version:1,code:'a-01',custom:{keep:true}}:null}];journal.get=id=>journal.find(doc=>doc.id===id);
  const callbacks=new Map();let sequence=0;
  const Hooks={on:(name,fn)=>{const id=++sequence;if(!callbacks.has(name))callbacks.set(name,new Map());callbacks.get(name).set(id,fn);return id;},off:(name,id)=>callbacks.get(name)?.delete(id),call:(name,...args)=>{for(const fn of callbacks.get(name)?.values()||[])fn(...args);}};
  const settings=new Map([['zoneConfigurationId','config']]);
  const env={game:{user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}},journal,scenes:new Map([['zone',zone],['combat',combat]]),settings:{register(){},get:(module,key)=>settings.get(key),set:async(module,key,value)=>settings.set(key,value)}},canvas:{ready:true,scene:zone},Hooks,ui:{notifications:{error(){},warn(){},info(){}}},JournalEntry:{create:async data=>{creations++;const doc={...configDoc,id:'newConfig',value:data.flags[MODULE][CONFIG_KEY],ownership:data.ownership};journal.push(doc);return doc;}},foundry:{applications:{api:{DialogV2:{confirm:async()=>true}}}},fromUuid:async uuid=>uuid==='Actor.valid'?{documentName:'Actor'}:null};
  const store=new ZoneStore(env);store.reload();
  return {store,env,zone,combat,configDoc,config,settings,callbacks,writes:()=>writes,creations:()=>creations};
}

test('tracking persists crossings once and skips same-sector, unrelated updates and combat Scene movement',async()=>{
  const f=fixture();await f.store.refreshTracking();assert.equal(f.writes(),1);
  assert.equal(f.store.config.ark.lastKnown,'A1');assert.equal(f.store.config.groups[0].lastKnown,'B1');
  f.zone.tokens.get('party').x=550;await f.store.tokenChanged(f.zone.tokens.get('party'),{x:550});assert.equal(f.writes(),1);
  await f.store.tokenChanged(f.combat.tokens.get('party'),{x:5000});assert.equal(f.writes(),1);
  f.zone.tokens.get('party').x=1000;await f.store.tokenChanged(f.zone.tokens.get('party'),{x:1000});assert.equal(f.writes(),2);assert.equal(f.store.config.groups[0].lastKnown,'C1');
  await f.store.tokenChanged(f.zone.tokens.get('party'),{name:'Renamed'});assert.equal(f.writes(),2);
  const reloaded=new ZoneStore(f.env);reloaded.reload();assert.equal(reloaded.config.groups[0].lastKnown,'C1');
  f.env.canvas.scene=f.combat;assert.equal(reloaded.trackingRows()[1].live,false);assert.equal(reloaded.trackingRows()[1].coordinate,'C1');
});
test('missing/deleted and off-map tokens keep last-known coordinates and do not change sector flags',async()=>{
  const f=fixture();const original=structuredClone(f.env.game.journal[1].getFlag(MODULE,'sector'));
  await f.store.refreshTracking();const token=f.zone.tokens.get('party');f.zone.tokens.delete('party');await f.store.tokenChanged(token);
  assert.equal(f.store.config.groups[0].lastKnown,'B1');assert.equal(f.store.trackingRows()[1].status,'missing-token');
  f.zone.tokens.get('ark').x=-1000;await f.store.tokenChanged(f.zone.tokens.get('ark'),{x:-1000});assert.equal(f.store.config.ark.lastKnown,'A1');assert.equal(f.store.trackingRows()[0].status,'outside');
  f.env.game.scenes.delete('zone');await f.store.refreshTracking();assert.equal(f.store.trackingRows()[0].status,'missing-scene');assert.equal(f.store.config.ark.lastKnown,'A1');
  assert.deepEqual(f.env.game.journal[1].getFlag(MODULE,'sector'),original);
});
test('only the active GM writes movement state and players cannot access integration data or save configuration',async()=>{
  const f=fixture();f.env.game.users.activeGM={id:'otherGM'};await f.store.refreshTracking();assert.equal(f.writes(),0);
  f.env.game.user.isGM=false;assert.deepEqual(f.store.trackingRows(),[]);await assert.rejects(f.store.save(f.config),/GM access/);
  const runtime=new ZoneRuntime({},f.env);assert.equal(runtime.summary(),'');assert.deepEqual(runtime.api().tracking(),[]);assert.equal(runtime.api().positionToSector({x:0,y:0}),null);runtime.start();assert.equal(runtime.hooks.length,0);
});
test('configuration rejects foreign, duplicated or missing tokens and wrong Actor references',async()=>{
  const f=fixture();
  for(const change of [{ark:{sceneId:'combat',tokenId:'party'}},{ark:{sceneId:'zone',tokenId:'newMissing'}},{ark:{sceneId:'zone',tokenId:'party'}},{groups:[{...f.config.groups[0],actorUuid:'Item.wrong'}]}])await assert.rejects(f.store.save({...structuredClone(f.config),...change}));
  await f.store.save({...structuredClone(f.config),groups:[{...f.config.groups[0],actorUuid:'Actor.valid'}]});
  assert.equal(f.store.config.groups[0].actorUuid,'Actor.valid');
});
test('map matching normalizes coordinates without duplicating or altering sector data',()=>{
  const f=fixture();assert.equal(f.store.sectorRecords('A1')[0].id,'sector');assert.equal(f.store.sectorRecords('A-001').length,1);assert.equal(f.store.sectorRecords('invalid').length,0);assert.equal(f.store.sectorRecords('AA1').length,0);
});
test('reconfiguring or toggling overlays does not regress last-known coordinates from a stale dialog',async()=>{
  const f=fixture();await f.store.refreshTracking();const stale=structuredClone(f.store.config);
  f.zone.tokens.get('party').x=1000;await f.store.tokenChanged(f.zone.tokens.get('party'),{x:1000});
  const token=f.zone.tokens.get('party');f.zone.tokens.delete('party');await f.store.tokenChanged(token);
  stale.overlay.enabled=true;await f.store.save(stale);assert.equal(f.store.config.groups[0].lastKnown,'C1');
  await f.store.setOverlay(false);assert.equal(f.store.config.groups[0].lastKnown,'C1');assert.equal(f.store.config.overlay.enabled,false);
});
test('optional integration creates a separate GM-only Journal on first save and only its ID is a world setting',async()=>{
  const f=fixture();f.settings.set('zoneConfigurationId','');f.store.reload();assert.equal(f.creations(),0);
  await f.store.save(f.config);assert.equal(f.creations(),1);assert.equal(f.settings.get('zoneConfigurationId'),'newConfig');assert.deepEqual(f.store.document.ownership,{default:0});
  await f.store.setOverlay(true);assert.equal(f.creations(),1);
});
test('runtime hooks keep tracking when closed, ignore other Scenes, and do not duplicate listeners',async()=>{
  const f=fixture();const runtime=new ZoneRuntime({},f.env);runtime.overlay.draw=()=>{};runtime.overlay.stop=()=>{};runtime.start();const hooks=runtime.hooks.length;runtime.start();assert.equal(runtime.hooks.length,hooks);
  await runtime.store.queue;
  f.zone.tokens.get('party').x=1500;f.env.Hooks.call('updateToken',f.zone.tokens.get('party'),{x:1500});await runtime.store.queue;
  assert.equal(runtime.store.config.groups[0].lastKnown,'D1');
  f.env.canvas.scene=f.combat;f.env.Hooks.call('canvasReady');await runtime.store.queue;assert.equal(runtime.store.config.groups[0].lastKnown,'D1');
  f.combat.tokens.get('party').x=9000;f.env.Hooks.call('updateToken',f.combat.tokens.get('party'),{x:9000});await runtime.store.queue;assert.equal(runtime.store.config.groups[0].lastKnown,'D1');
  runtime.stop();assert.equal(runtime.hooks.length,0);for(const values of f.callbacks.values())assert.equal(values.size,0);
});
test('map selection opens existing records, creates only after confirmation, and rejects outside points',async()=>{
  const f=fixture(),opened=[],created=[];const runtime=new ZoneRuntime({openSector:async id=>opened.push(id),createSector:async code=>created.push(code)},f.env);runtime.store.reload();
  await runtime.selectPoint({x:100,y:100});assert.deepEqual(opened,['sector']);
  await runtime.selectPoint({x:600,y:100});assert.deepEqual(created,['B1']);
  f.env.foundry.applications.api.DialogV2.confirm=async()=>false;await runtime.selectPoint({x:1100,y:100});assert.equal(created.length,1);
  await runtime.selectPoint({x:-100,y:0});assert.equal(created.length,1);
});


test('a pending map-create confirmation cannot create a record after the Zone Scene changes',async()=>{
  const f=fixture();let confirm;const created=[];
  f.env.foundry.applications.api.DialogV2.confirm=()=>new Promise(resolve=>confirm=resolve);
  const runtime=new ZoneRuntime({createSector:async code=>created.push(code)},f.env);runtime.store.reload();
  const pending=runtime.selectPoint({x:600,y:100});runtime.store.config.sceneId='combat';confirm(true);await pending;assert.deepEqual(created,[]);
});
test('viewing or resizing other Scenes never modifies saved grid calibration',async()=>{
  const f=fixture();await f.store.refreshTracking();const grid=structuredClone(f.store.config.grid);
  const runtime=new ZoneRuntime({},f.env);runtime.overlay.draw=()=>{};runtime.overlay.stop=()=>{};runtime.start();await runtime.store.queue;
  f.combat.width=9000;f.env.canvas.scene=f.combat;f.env.Hooks.call('updateScene',f.combat,{width:9000});f.env.Hooks.call('canvasReady');await runtime.store.queue;
  assert.deepEqual(runtime.store.config.grid,grid);runtime.stop();
});
