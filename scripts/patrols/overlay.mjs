import {coordinateToBounds} from '../zone/grid.mjs';
import {overlayTextResolution} from '../zone/overlay.mjs';
import {gridKey} from './model.mjs';
// Passive GM-only geometry on Foundry's existing PIXI stage.
export class PatrolOverlay {
 constructor(service,env=globalThis){this.service=service;this.env=env;}
 destroy(){if(this.root){this.root.parent?.removeChild(this.root);if(!this.root.destroyed)this.root.destroy({children:true});this.root=null;}this.signature=null;}
 draw(){
  const {store}=this.service,{canvas,PIXI}=this.env;
  if(!store.isGM||!store.live||!store.config.grid||!canvas?.stage||!PIXI){this.destroy();return;}
  let routes;try{routes=this.service.read().routes;}catch{this.destroy();return;}
  const entries=(this.draft?[...routes.filter(r=>r.id!==this.draft.id),this.draft]:routes).filter(r=>r.sceneId===store.scene.id&&r.gridKey===gridKey(store.config));
  const signature=JSON.stringify([store.config.grid,entries.map(r=>[r.id,r.waypoints,r.pattern,r.index,r.direction]),this.selectedId,overlayTextResolution(this.env)]);
  if(this.signature===signature&&!this.root?.destroyed&&this.root?.parent===canvas.stage)return;
  this.destroy();this.signature=signature;if(!entries.length)return;
  const root=this.root=new PIXI.Container();root.name='myz-patrol-routes';root.eventMode='none';root.interactiveChildren=false;canvas.stage.addChild(root);
  for(const r of entries){
   const selected=r.id===this.selectedId,points=r.waypoints.map(code=>{const b=coordinateToBounds(code,store.config.grid);return b?{x:b.x+b.width/2,y:b.y+b.height/2}:null;});
   const g=new PIXI.Graphics();g.eventMode='none';root.addChild(g);const size=Math.max(4,Math.min(store.config.grid.width,store.config.grid.height)*.025);g.lineStyle(selected?3:1.5,selected?0xffcf66:0x66b7cf,selected?.95:.45);
   const segments=r.pattern==='loop'&&points.length>2?[...points,points[0]]:points;
   for(let i=1;i<segments.length;i++){let a=segments[i-1],b=segments[i];if(!a||!b)continue;g.moveTo(a.x,a.y).lineTo(b.x,b.y);if(selected){if(r.pattern==='pingpong'&&r.direction===-1||r.pattern==='loop'&&points.length===2&&r.index===1)[a,b]=[b,a];const x=(a.x+b.x)/2,y=(a.y+b.y)/2,angle=Math.atan2(b.y-a.y,b.x-a.x);g.moveTo(x-Math.cos(angle-.6)*size*2,y-Math.sin(angle-.6)*size*2).lineTo(x,y).lineTo(x-Math.cos(angle+.6)*size*2,y-Math.sin(angle+.6)*size*2);}}
   const labels=new Map();for(const [i,p] of points.entries()){if(!p)continue;g.drawCircle(p.x,p.y,size);const code=r.waypoints[i];if(!labels.has(code))labels.set(code,{point:p,indices:[]});labels.get(code).indices.push(i+1);}
   if(selected)for(const [code,{point,indices}] of labels){const text=new PIXI.Text(`${indices.join('/')} · ${code}${r.waypoints[r.index]===code?' ●':''}`,{fontFamily:'Arial',fontSize:Math.max(12,Math.min(22,store.config.grid.height/9)),fill:0xffdf89,stroke:0x111111,strokeThickness:3});text.resolution=overlayTextResolution(this.env);text.eventMode='none';text.position.set(point.x+size*2,point.y-size*2);root.addChild(text);}
  }
 }
}
