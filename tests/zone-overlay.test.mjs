import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ZoneOverlay} from '../scripts/zone/overlay.mjs';

import {overlayFixture as fixture,event} from './helpers/overlay-fixture.mjs';

test('overlay is GM-only, Scene-isolated, non-interactive, and replaces rather than duplicates stage children',()=>{
  const f=fixture();f.overlay.draw();const root=f.overlay.root;assert.equal(root.eventMode,'none');assert.equal(root.interactiveChildren,false);assert.equal(f.stage.children.length,1);
  assert.equal(root.children.filter(child=>child.text).length,6);
  f.overlay.draw();assert(root.destroyed);assert.equal(f.stage.children.length,1);
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
