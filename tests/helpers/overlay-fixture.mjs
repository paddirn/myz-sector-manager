import {ZoneOverlay} from '../../scripts/zone/overlay.mjs';
export function overlayFixture(){
  class Container{constructor(){this.children=[];}addChild(child){this.children.push(child);child.parent=this;return child;}removeChild(child){this.children=this.children.filter(item=>item!==child);child.parent=null;}destroy(){this.destroyed=true;for(const child of this.children)child.destroy?.();}}
  class Graphics extends Container{clear(){return this;}drawCircle(){return this;}lineStyle(){return this;}moveTo(){return this;}lineTo(){return this;}beginFill(){return this;}drawRect(){return this;}endFill(){return this;}}
  class Text extends Container{constructor(text){super();this.text=text;this.position={set:(x,y)=>{this.x=x;this.y=y;}};}}
  const board=new EventTarget();board.style={cursor:'default'};board.getBoundingClientRect=()=>({left:20,top:20,width:400,height:200});
  const document=new EventTarget();
  const stage=new Container();stage.toLocal=point=>({x:(point.x-100)/2,y:(point.y-100)/2});
  const canvas={ready:true,scene:{id:'zone'},stage,app:{view:board,screen:{width:800,height:400}}};
  const store={isGM:true,scene:{width:300,height:200,dimensions:{sceneRect:{x:0,y:0,width:300,height:200}}},get live(){return canvas.ready&&canvas.scene?.id==='zone';},config:{sceneId:'zone',grid:{reference:'A1',originX:0,originY:0,width:100,height:100,columns:3,rows:2,columnAxis:'x',columnDirection:1,rowDirection:1},overlay:{enabled:true,boundaries:true,labels:true,status:true}}};
  const env={canvas,document,PIXI:{Container,Graphics,Text,Point:class{constructor(x,y){this.x=x;this.y=y;}}},game:{journal:[{getFlag:()=>({version:1,code:'A1',status:'Explored'})}]},ui:{notifications:{info(){}}}};
  return {overlay:new ZoneOverlay(store,env),store,env,board,stage};
}
export function event(type,properties){const e=new Event(type,{cancelable:true});for(const [key,value] of Object.entries(properties))Object.defineProperty(e,key,{value});return e;}

