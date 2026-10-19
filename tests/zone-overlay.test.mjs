import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ZoneOverlay} from '../scripts/zone/overlay.mjs';

import {overlayFixture as fixture,event} from './helpers/overlay-fixture.mjs';

test('overlay is GM-only, Scene-isolated, non-interactive, and replaces rather than duplicates stage children',()=>{
  const f=fixture();f.overlay.draw();const root=f.overlay.root;assert.equal(root.eventMode,'none');assert.equal(root.interactiveChildren,false);assert.equal(f.stage.children.length,1);
  assert.equal(f.overlay.cells.size,6);assert.equal(f.overlay.cells.get('B1').root.children.filter(child=>child.text).length,1);
  f.overlay.draw();assert.equal(f.overlay.root,root);assert(!root.destroyed);assert.equal(f.stage.children.length,1);
  f.env.canvas.scene={id:'combat'};f.overlay.draw();assert.equal(f.stage.children.length,0);
  f.env.canvas.scene={id:'zone'};f.store.isGM=false;f.overlay.draw();assert.equal(f.stage.children.length,0);
});
test('one-shot picking converts CSS coordinates through the canvas transform and cleans up afterward',()=>{
  const f=fixture();const points=[];f.overlay.pick(point=>points.push(point));assert.equal(f.board.style.cursor,'crosshair');
  f.board.dispatchEvent(event('pointerdown',{button:0,clientX:220,clientY:120}));
  assert.deepEqual(points,[{x:150,y:50}]);assert.equal(f.board.style.cursor,'default');assert.equal(f.overlay.cancelPick,null);
  f.board.dispatchEvent(event('pointerdown',{button:0,clientX:220,clientY:120}));assert.equal(points.length,1);
});
test('Escape, teardown and replacement remove selection listeners; off-Scene/player picks are denied',()=>{
  const f=fixture();let picks=0;f.overlay.pick(()=>picks++);f.env.document.dispatchEvent(event('keydown',{key:'Escape'}));assert.equal(f.overlay.cancelPick,null);
  f.overlay.pick(()=>picks++);f.overlay.pick(()=>picks+=10);f.board.dispatchEvent(event('pointerdown',{button:0,clientX:20,clientY:20}));assert.equal(picks,10);
  f.overlay.pick(()=>picks++);f.overlay.stop();f.board.dispatchEvent(event('pointerdown',{button:0,clientX:20,clientY:20}));assert.equal(picks,10);
  f.env.canvas.scene={id:'combat'};assert.throws(()=>f.overlay.pick(()=>{}),/View the selected/);
  f.store.isGM=false;assert.throws(()=>f.overlay.pick(()=>{}),/View the selected/);
});

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const pointer=(f,type,extra={})=>{const e=event(type,{button:0,buttons:0,pointerId:1,clientX:120,clientY:120,...extra});f.board.dispatchEvent(e);return e;};
test('enabled hover aligns to transformed grid cells, leaves one highlight, and ignores drags/right clicks/tokens',async()=>{
  const f=fixture(),selected=[];f.overlay.onSelect=async code=>selected.push(code);f.overlay.draw();
  pointer(f,'pointermove');assert.equal(f.overlay.hoverCode,'A1');
  const e=pointer(f,'pointerdown');pointer(f,'pointerup');await tick();assert.deepEqual(selected,['A1']);assert.equal(e.defaultPrevented,false);
  pointer(f,'pointerdown',{button:2});pointer(f,'pointerup',{button:2});await tick();assert.equal(selected.length,1);
  pointer(f,'pointerdown');pointer(f,'pointermove',{clientX:140,buttons:1});pointer(f,'pointermove',{clientX:120,buttons:1});pointer(f,'pointerup');await tick();assert.equal(selected.length,1);
  pointer(f,'pointerdown',{shiftKey:true});pointer(f,'pointerup',{shiftKey:true});await tick();assert.equal(selected.length,1);
  f.env.canvas.tokens={placeables:[{visible:true,bounds:{contains:()=>true}}]};pointer(f,'pointermove');assert.equal(f.overlay.hoverCode,null);pointer(f,'pointerdown');pointer(f,'pointerup');await tick();assert.equal(selected.length,1);
  f.env.canvas.tokens.placeables=[];pointer(f,'pointermove',{clientX:220});assert.equal(f.overlay.hoverCode,'B1');pointer(f,'pointerleave');assert.equal(f.overlay.hoverCode,null);
  pointer(f,'pointerdown',{pointerType:'touch'});pointer(f,'pointerup',{pointerType:'touch'});await tick();assert.equal(selected.length,1);
});
test('disabled and off-Scene overlays remove all observers and highlights; re-enabling never duplicates listeners',async()=>{
  const f=fixture(),selected=[];f.overlay.onSelect=async code=>selected.push(code);f.overlay.draw();f.overlay.draw();
  pointer(f,'pointerdown');pointer(f,'pointerup');await tick();assert.equal(selected.length,1);
  f.store.config.overlay.enabled=false;f.overlay.draw();pointer(f,'pointermove');pointer(f,'pointerdown');pointer(f,'pointerup');await tick();assert.equal(selected.length,1);assert.equal(f.overlay.root,null);assert.equal(f.overlay.hoverCode,null);
  f.store.config.overlay.enabled=true;f.overlay.draw();pointer(f,'pointerdown');pointer(f,'pointerup');await tick();assert.equal(selected.length,2);
  f.env.canvas.scene={id:'combat'};f.overlay.draw();pointer(f,'pointerdown');pointer(f,'pointerup');await tick();assert.equal(selected.length,2);
  f.env.canvas.scene={id:'zone'};f.overlay.draw();f.overlay.stop();pointer(f,'pointerdown');pointer(f,'pointerup');await tick();assert.equal(selected.length,2);
});
test('saved sector updates replace only affected label containers, retaining zero Rot and removing deleted/moved information',()=>{
  const f=fixture();let data={version:1,code:'A1',terrain:'Thick Woods',rot:0,status:'Scouted',encounters:[{title:'Creature'}],effects:[{category:'Phenomenon'}],loot:[{title:'Artifact'}]};f.env.game.journal=[{getFlag:()=>data}];f.overlay.draw();
  const root=f.overlay.root,a=f.overlay.cells.get('A1'),b=f.overlay.cells.get('B1'),beforeA=a.root,beforeB=b.root;
  const titles=()=>a.root.children.filter(c=>c.sectorTooltip).map(c=>c.sectorTooltip);
  assert(titles().includes('Rot Level: 0'));assert(titles().includes('1 Inhabitant'));assert(titles().includes('1 Phenomenon'));assert(titles().includes('Uncollected Gear & Artifacts Available'));
  data={...data,rot:2,status:'Explored',loot:[{title:'Artifact',status:'Collected'}]};f.overlay.draw();assert.equal(f.overlay.root,root);assert(beforeA.destroyed);assert.equal(b.root,beforeB);assert(titles().includes('Rot Level: 2'));assert(!titles().includes('Uncollected Gear & Artifacts Available'));
  data={...data,code:'B1'};f.overlay.draw();assert.equal(a.root.children.filter(c=>c.text).length,1);assert.notEqual(b.root,beforeB);
  f.env.game.journal=[];f.overlay.draw();assert.equal(b.root.children.filter(c=>c.text).length,1);
});
test('calibration picking suppresses normal navigation and queued clicks cannot survive disabling or permission loss',async()=>{
  const f=fixture(),selected=[];f.overlay.onSelect=async code=>selected.push(code);f.overlay.draw();let picked=0;f.overlay.pick(()=>picked++);
  pointer(f,'pointerdown');pointer(f,'pointerup');await tick();assert.equal(picked,1);assert.deepEqual(selected,[]);
  pointer(f,'pointerdown');pointer(f,'pointerup');f.store.isGM=false;await tick();assert.deepEqual(selected,[]);
  f.overlay.draw();assert.equal(f.overlay.root,null);
});
test('viewport culling follows panning far across large maps, rather than labeling only the first squares',()=>{
  const f=fixture();f.store.config.grid.columns=100;f.store.config.grid.rows=100;f.store.scene.width=10000;f.store.scene.height=10000;f.store.scene.dimensions.sceneRect={x:0,y:0,width:10000,height:10000};
  f.env.canvas.stage.toLocal=point=>({x:point.x+6000,y:point.y+6000});f.overlay.draw();assert(f.overlay.cells.has('BI61'));assert(!f.overlay.cells.has('A1'));assert(f.overlay.cells.size<2000);
  f.env.canvas.stage.toLocal=point=>point;f.overlay.draw();assert(f.overlay.cells.has('A1'));assert(!f.overlay.cells.has('BI61'));
});
