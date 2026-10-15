import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ZoneCalibration} from '../scripts/zone/calibration.mjs';
import {overlayFixture,event} from './helpers/overlay-fixture.mjs';

function fixture(){
  const f=overlayFixture();const children=[];
  class Element extends EventTarget{
    constructor(){super();this.nodes=new Map();this.hidden=false;this.style={};}
    setAttribute(){}
    querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new Element());return this.nodes.get(selector);}
    remove(){const index=children.indexOf(this);if(index>=0)children.splice(index,1);}
    click(){this.dispatchEvent(new Event('click'));}
  }
  f.env.document.createElement=()=>new Element();f.env.document.body={append:node=>children.push(node)};
  f.store.scene.id='zone';f.env.game.scenes=new Map([['zone',f.store.scene]]);
  f.env.ui.notifications.warn=()=>{};
  f.calibration=new ZoneCalibration(f.store,f.overlay,f.env);f.children=children;
  f.click=(x,y)=>f.board.dispatchEvent(event('pointerdown',{button:0,clientX:x,clientY:y}));
  f.button=name=>f.calibration.panel.querySelector(`[data-calibration-${name}]`);
  return f;
}
test('three clicks preview without saving; confirmation returns new dimensions and restores the previous overlay',async()=>{
  const f=fixture(),previous=structuredClone(f.store.config);f.overlay.draw();
  const pending=f.calibration.start('zone',previous.grid);assert(f.calibration.active);assert.equal(f.overlay.root,null);assert.equal(f.store.config.overlay.enabled,true);
  f.click(100,100);f.click(200,100);f.click(100,180);
  assert(f.overlay.preview);assert.equal(f.button('confirm').hidden,false);assert.deepEqual(f.store.config,previous);
  f.button('confirm').click();const result=await pending;
  assert.deepEqual([result.originX,result.originY,result.width,result.height],[30,30,100,80]);assert(!f.calibration.active);assert.equal(f.children.length,0);assert.equal(f.overlay.preview,null);assert.equal(f.overlay.suppressed,false);assert(f.overlay.root);assert.equal(f.stage.children.length,1);assert.equal(f.overlay.cancelPick,null);assert.deepEqual(f.store.config,previous);
  const second=f.calibration.start('zone',previous.grid);assert.equal(f.calibration.proposed,null);f.calibration.cancel();assert.equal(await second,null);
});
test('Escape removes listeners and markers and preserves a previously hidden overlay',async()=>{
  const f=fixture();f.store.config.overlay.enabled=false;const pending=f.calibration.start('zone',f.store.config.grid);
  f.click(100,100);assert.equal(f.stage.children.length,1);
  f.env.document.dispatchEvent(event('keydown',{key:'Escape'}));assert.equal(await pending,null);
  assert.equal(f.stage.children.length,0);assert.equal(f.children.length,0);assert.equal(f.overlay.cancelPick,null);assert.equal(f.board.style.cursor,'default');
  f.click(200,100);assert.equal(f.calibration.points.length,1);assert.equal(f.store.config.overlay.enabled,false);
});
test('rotated/skewed clicks show an error with retry, and cancel from review discards the proposal',async()=>{
  const f=fixture();const pending=f.calibration.start('zone',f.store.config.grid);
  f.click(100,100);f.click(200,110);f.click(100,180);
  assert.match(f.button('message').textContent,/rotated or skewed/);assert.equal(f.button('confirm').hidden,true);assert.equal(f.button('retry').hidden,false);
  f.button('retry').click();assert.equal(f.calibration.points.length,0);
  f.click(100,100);f.click(200,100);f.click(100,180);assert(f.calibration.proposed);
  f.button('cancel').click();assert.equal(await pending,null);assert.equal(f.store.config.grid.width,100);assert.equal(f.store.config.grid.height,100);assert.equal(f.overlay.preview,null);assert.equal(f.children.length,0);
});
test('canceling while Scene.view is pending prevents a late calibration interface from opening',async()=>{
  const f=fixture();let viewed;
  f.env.canvas.scene={id:'combat'};
  f.store.scene.view=()=>new Promise(resolve=>viewed=resolve);
  const pending=f.calibration.start('zone',f.store.config.grid);f.calibration.cancel();f.env.canvas.scene={id:'zone'};viewed();
  assert.equal(await pending,null);assert.equal(f.children.length,0);assert(!f.calibration.active);assert.equal(f.overlay.cancelPick,null);
});
test('Ark highlight is a passive whole-cell overlay and tracks the fixed coordinate, including changes and clears',()=>{
  const f=fixture();f.store.config.arkCoordinate='A1';f.overlay.draw();const first=f.overlay.root;assert(first.children.some(child=>child.text==='⌂ Ark'));assert.equal(first.eventMode,'none');
  f.store.config.arkCoordinate='B2';f.overlay.draw();const label=f.overlay.root.children.find(child=>child.text==='⌂ Ark');assert.equal(label.x,150);assert.equal(label.y,150);assert(first.destroyed);
  f.store.config.arkCoordinate=null;f.overlay.draw();assert(!f.overlay.root.children.some(child=>child.text==='⌂ Ark'));
});
