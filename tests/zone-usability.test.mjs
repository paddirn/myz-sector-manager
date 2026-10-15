import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/zone-fixture.mjs';
import {ZoneRuntime} from '../scripts/zone/runtime.mjs';
import {CONFIG_KEY,normalizeConfiguration} from '../scripts/zone/store.mjs';
import {sectorDistance,formatDistance,gridFromCorners} from '../scripts/zone/grid.mjs';
import {portraitCandidates,safeImageSource} from '../scripts/zone/presentation.mjs';
import {chooseOverlayBinding,bindingConflicts,registerOverlayShortcut,warnShortcutConflict,OVERLAY_BINDINGS} from '../scripts/zone/shortcut.mjs';

test('fixed Ark coordinates persist without a token or record, normalize labels, and can be explicitly cleared',async()=>{
  const f=fixture();f.zone.tokens.delete('ark');
  await f.store.save({...f.config,arkCoordinate:'aa-012'});assert.equal(f.store.config.arkCoordinate,'AA12');assert.equal(f.store.trackingRows()[0].status,'fixed');
  assert.equal(f.store.sectorRecords('AA12').length,0);
  await f.store.save({...f.store.config,arkCoordinate:null});f.store.reload();assert.equal(f.store.config.arkCoordinate,null);assert.equal(f.store.trackingRows().length,1);
  assert.deepEqual(f.configDoc.value.ark,{sceneId:'zone',tokenId:'ark'}); // legacy reference retained, never authoritative
  await assert.rejects(f.store.save({...f.store.config,arkCoordinate:'not a sector'}),/Ark location/);
  await assert.rejects(f.store.save({...f.store.config,kmPerSector:0}),/Kilometers/);
});
test('legacy Ark data seeds a fixed coordinate once without changing the old reference or following future token movement',async()=>{
  const f=fixture();delete f.configDoc.value.arkCoordinate;f.configDoc.value.ark.lastKnown='b-007';const original=structuredClone(f.configDoc.value.ark);
  f.store.reload();assert.equal(f.store.config.arkCoordinate,'B7');assert(!Object.hasOwn(f.configDoc.value,'arkCoordinate'));
  await f.store.refreshTracking();assert.equal(f.configDoc.value.arkCoordinate,'B7');assert.deepEqual(f.configDoc.value.ark,original);
  const writes=f.writes();f.zone.tokens.get('ark').x=9000;await f.store.tokenChanged(f.zone.tokens.get('ark'),{x:9000});assert.equal(f.writes(),writes);assert.equal(f.store.config.arkCoordinate,'B7');
  await f.store.save({...f.store.config,arkCoordinate:''});f.store.reload();assert.equal(f.store.config.arkCoordinate,null);
  const old={...f.config,ark:{sceneId:'zone',tokenId:'ark'}};delete old.arkCoordinate;f.zone.tokens.get('ark').x=0;
  assert.equal(normalizeConfiguration(old,f.zone).arkCoordinate,'A1');assert(!Object.hasOwn(old,'arkCoordinate'));
});
test('distances use eight-neighbor grid travel with configurable kilometers and clear unavailable/zero formatting',()=>{
  assert.deepEqual(sectorDistance('A1','D4'),{sectors:3,kilometers:4.800000000000001});
  assert.deepEqual(sectorDistance('Z1','AA1',2),{sectors:1,kilometers:2});
  assert.equal(formatDistance(sectorDistance('A1','D4')),'3 sectors (4.8 km)');
  assert.equal(formatDistance(sectorDistance('AA12','AA12')),'0 sectors (0 km)');
  assert.equal(formatDistance(sectorDistance('B3','D8')),'5 sectors (8 km)');
  for(const args of [[null,'A1'],['A1','invalid'],['A1','B2',-1]])assert.equal(sectorDistance(...args),null);
  assert.equal(formatDistance(null),'Distance unavailable');
});
test('each group distance refreshes independently after crossings, fixed-Ark changes, and scale changes',async()=>{
  const f=fixture();f.zone.tokens.set('other',{id:'other',x:1000,y:800,width:1,height:1,parent:f.zone});
  await f.store.save({...f.config,groups:[...f.config.groups,{id:'group2',name:'Beta',sceneId:'zone',tokenId:'other'}]});
  let groups=f.store.trackingRows().filter(row=>row.kind==='expedition');assert.equal(groups[0].distance.sectors,1);assert.equal(groups[1].distance.sectors,2);
  f.zone.tokens.get('party').x=1500;await f.store.tokenChanged(f.zone.tokens.get('party'),{x:1500});groups=f.store.trackingRows().filter(row=>row.kind==='expedition');assert.equal(groups[0].distance.sectors,3);assert.equal(groups[1].distance.sectors,2);
  await f.store.save({...f.store.config,arkCoordinate:'D1',kmPerSector:2});groups=f.store.trackingRows().filter(row=>row.kind==='expedition');assert.deepEqual(groups[0].distance,{sectors:0,kilometers:0});assert.equal(groups[1].distance.kilometers,4);
  f.zone.tokens.delete('other');await f.store.refreshTracking();assert.equal(f.store.trackingRows().find(row=>row.id==='group2').distance,null);
});
test('three-point calibration preserves orientation/reference while rejecting negative, rotated, or skewed rectangles',()=>{
  const base=fixture().config.grid;const grid=gridFromCorners({x:125,y:250},{x:625,y:250},{x:125,y:550},{...base,reference:'B7',columnDirection:-1});
  assert.deepEqual([grid.originX,grid.originY,grid.width,grid.height,grid.reference,grid.columnDirection],[125,250,500,300,'B7',-1]);
  assert.equal(base.originX,0);assert.equal(base.width,500);
  for(const points of [[{x:1,y:1},{x:0,y:1},{x:1,y:2}],[{x:0,y:0},{x:100,y:10},{x:0,y:100}],[{x:0,y:0},{x:100,y:0},{x:10,y:100}]])assert.throws(()=>gridFromCorners(...points,base));
});
test('shortcut defaults avoid exact and reserved-modifier conflicts; occupied alternatives leave the action unbound',()=>{
  const actions=new Map();assert.deepEqual(chooseOverlayBinding(actions),OVERLAY_BINDINGS[0]);
  actions.set('core.undo',{editable:[{key:'KeyZ',modifiers:['Control']}],reservedModifiers:['Shift']});assert.deepEqual(chooseOverlayBinding(actions),OVERLAY_BINDINGS[1]);
  actions.set('system.action',{editable:[OVERLAY_BINDINGS[1]]});assert.deepEqual(chooseOverlayBinding(actions),OVERLAY_BINDINGS[2]);
  actions.set('module.action',{uneditable:[OVERLAY_BINDINGS[2]]});assert.equal(chooseOverlayBinding(actions),null);
  assert(bindingConflicts(OVERLAY_BINDINGS[0],{key:'KeyZ',modifiers:['CONTROL','SHIFT']}));
  assert(bindingConflicts(OVERLAY_BINDINGS[0],{logicalKey:'z',modifiers:['Control','Shift']}));
});
test('native shortcut is editable, GM-only, toggles persisted state off-Scene without displaying it there, and warns about late conflicts',async()=>{
  const f=fixture(),registered=[];f.env.game.keybindings={actions:new Map(),register:(mod,id,options)=>registered.push({mod,id,options}),bindings:new Map()};
  const runtime=new ZoneRuntime({},f.env);runtime.store.reload();runtime.overlay.draw=()=>{};
  registerOverlayShortcut(runtime);const {options}=registered[0];assert.equal(options.restricted,true);assert.equal(options.repeat,false);assert.equal(options.editable[0].key,'KeyZ');
  f.env.canvas.scene=f.combat;assert(options.onDown());await runtime.store.queue;assert.equal(runtime.store.config.overlay.enabled,true);assert.equal(runtime.store.live,false);
  f.env.game.user.isGM=false;assert.equal(options.onDown(),false);f.env.game.user.isGM=true;
  let warnings=0;f.env.ui.notifications.warn=()=>warnings++;
  f.env.game.keybindings.bindings.set('myz-sector-manager.toggleZoneOverlay',[OVERLAY_BINDINGS[0]]);f.env.game.keybindings.bindings.set('late.module',[OVERLAY_BINDINGS[0]]);warnShortcutConflict(runtime);assert.equal(warnings,1);
});
test('portrait candidates prefer texture, then associated Actor, then token Actor and reject unsafe/video sources',async()=>{
  const f=fixture(),track=f.config.groups[0],token=f.zone.tokens.get('party');token.texture={src:'worlds/zone/group.png'};token.actor={img:'actors/token-actor.webp'};track.actorUuid='Actor.one';
  assert.deepEqual(await portraitCandidates(track,f.zone,async()=>({documentName:'Actor',img:'actors/associated.webp'})),['worlds/zone/group.png','actors/associated.webp','actors/token-actor.webp']);
  token.texture.src='worlds/zone/token.webm';assert.deepEqual(await portraitCandidates(track,f.zone,async()=>{throw new Error('missing');}),['actors/token-actor.webp']);
  f.zone.tokens.delete('party');assert.deepEqual(await portraitCandidates({...track,actorUuid:''},f.zone,async()=>null),[]);
  assert.equal(safeImageSource('javascript:alert(1)'),null);assert.equal(safeImageSource('data:text/html,unsafe'),null);assert.equal(safeImageSource('icons/svg/mystery-man.svg'),'icons/svg/mystery-man.svg');
});
test('portrait navigation uses GM-local Scene.view and pans to the token midpoint without selecting or moving it',async()=>{
  const f=fixture(),runtime=new ZoneRuntime({},f.env),pans=[];runtime.store.reload();
  f.env.canvas.scene=f.combat;let viewed=0;f.zone.view=async()=>{viewed++;f.env.canvas.scene=f.zone;};f.env.canvas.animatePan=async point=>pans.push(point);
  const original=structuredClone({x:f.zone.tokens.get('party').x,y:f.zone.tokens.get('party').y});
  assert(await runtime.centerGroup('group1'));assert.equal(viewed,1);assert.deepEqual(pans[0],{x:550,y:50,duration:350});assert.deepEqual({x:f.zone.tokens.get('party').x,y:f.zone.tokens.get('party').y},original);
  f.zone.tokens.delete('party');assert.equal(await runtime.centerGroup('group1'),false);assert.equal(pans.length,1);
  f.env.game.user.isGM=false;assert.equal(await runtime.centerGroup('group1'),false);
});
