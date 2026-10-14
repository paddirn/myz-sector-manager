import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ZoneOverlay} from '../scripts/zone/overlay.mjs';

function fixture(){
  class Container{constructor(){this.children=[];}addChild(child){this.children.push(child);child.parent=this;return child;}removeChild(child){this.children=this.children.filter(item=>item!==child);child.parent=null;}destroy(){this.destroyed=true;for(const child of this.children)child.destroy?.();}}
  class Graphics extends Container{lineStyle(){return this;}moveTo(){return this;}lineTo(){return this;}beginFill(){return this;}drawRect(){return this;}endFill(){return this;}}
  class Text extends Container{constructor(text){super();this.text=text;this.position={set:(x,y)=>{this.x=x;this.y=y;}};}}
  const board=new EventTarget();board.style={cursor:'default'};board.getBoundingClientRect=()=>({left:20,top:20,width:400,height:200});
  const document=new EventTarget();
  const stage=new Container();stage.toLocal=point=>({x:(point.x-100)/2,y:(point.y-100)/2});
  const canvas={ready:true,scene:{id:'zone'},stage,app:{view:board,screen:{width:800,height:400}}};
  const store={isGM:true,scene:{width:300,height:200,dimensions:{sceneRect:{x:0,y:0,width:300,height:200}}},get live(){return canvas.ready&&canvas.scene?.id==='zone';},config:{sceneId:'zone',grid:{reference:'A1',originX:0,originY:0,width:100,height:100,columns:3,rows:2,columnAxis:'x',columnDirection:1,rowDirection:1},overlay:{enabled:true,boundaries:true,labels:true,status:true}}};
  const env={canvas,document,PIXI:{Container,Graphics,Text,Point:class{constructor(x,y){this.x=x;this.y=y;}}},game:{journal:[{getFlag:()=>({version:1,code:'A1',status:'Explored'})}]},ui:{notifications:{info(){}}}};
  return {overlay:new ZoneOverlay(store,env),store,env,board,stage};
}
function event(type,properties){const e=new Event(type,{cancelable:true});for(const [key,value] of Object.entries(properties))Object.defineProperty(e,key,{value});return e;}

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
