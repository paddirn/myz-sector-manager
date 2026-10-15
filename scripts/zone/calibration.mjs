import {canonicalCoordinate,gridFromCorners} from './grid.mjs';

// Temporary client-only workflow. Confirmation returns an unsaved grid to the
// settings dialog; no Journal or Scene writes occur here.
export class ZoneCalibration {
  constructor(store,overlay,env=globalThis){this.store=store;this.overlay=overlay;this.env=env;this.active=false;this.generation=0;this.panel=null;this.marks=null;}
  async start(sceneId,base){
    this.cancel();
    const generation=this.generation;
    if(!this.store.isGM)throw new Error('GM access only.');
    const scene=this.env.game.scenes.get(sceneId);
    if(!scene)throw new Error('Choose an available Zone Scene.');
    if(!this.env.canvas?.ready||this.env.canvas.scene?.id!==sceneId)await scene.view();
    if(generation!==this.generation)return null;
    if(!this.env.canvas?.ready||this.env.canvas.scene?.id!==sceneId)throw new Error('View the selected Zone Scene before calibrating.');
    this.sceneId=sceneId;this.base=structuredClone(base);this.base.reference=canonicalCoordinate(base.reference)||'A1';
    this.points=[];this.proposed=null;this.active=true;this.overlay.hideForCalibration();
    this.panel=this.env.document.createElement('section');this.panel.className='myz-zone-calibration';
    this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-label','Calibrate Zone grid');
    this.panel.innerHTML=`<style>.myz-zone-calibration{position:fixed;right:16px;bottom:16px;z-index:10000;max-width:340px;padding:12px;background:#20262e;color:#fff;border:2px solid #e7b85c;border-radius:6px;font:14px sans-serif}.myz-zone-calibration p{margin:8px 0}.myz-zone-calibration button{width:auto;height:auto;white-space:normal;margin-right:6px;background:#f1f1f1;color:#171717}.myz-zone-calibration [hidden]{display:none!important}</style><strong>Calibrate Zone grid</strong><p data-calibration-message aria-live="polite"></p><small>Axis-aligned rectangles only. Pan/zoom are supported. Escape cancels.</small><p><button type="button" data-calibration-confirm hidden>Confirm calibration</button><button type="button" data-calibration-retry hidden>Retry</button><button type="button" data-calibration-cancel>Cancel</button></p>`;
    this.env.document.body.append(this.panel);
    this.keyListener=event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();this.cancel();}};
    this.env.document.addEventListener('keydown',this.keyListener,{capture:true});
    this.panel.querySelector('[data-calibration-cancel]').addEventListener('click',()=>this.cancel());
    this.panel.querySelector('[data-calibration-retry]').addEventListener('click',()=>{this.points=[];this.proposed=null;this.overlay.hideForCalibration();this.clearMarks();this.next();});
    this.panel.querySelector('[data-calibration-confirm]').addEventListener('click',()=>{if(this.proposed)this.finish(structuredClone(this.proposed));});
    return new Promise(resolve=>{this.resolve=resolve;this.next();});
  }
  next(){
    if(!this.active)return;
    this.panel.querySelector('[data-calibration-confirm]').hidden=true;
    this.panel.querySelector('[data-calibration-retry]').hidden=true;
    const corners=['top-left','top-right','bottom-left'];
    this.panel.querySelector('[data-calibration-message]').textContent=`Step ${this.points.length+1}/3: click the ${corners[this.points.length]} corner of sector ${this.base.reference}.`;
    try{
      this.overlay.pick(point=>{if(!this.active)return;this.points.push(point);this.drawMarks();if(this.points.length<3)this.next();else this.review();},{sceneId:this.sceneId,onCancel:()=>this.cancel(),notify:false});
    }catch(error){this.cancel();this.env.ui.notifications.warn(error.message);}
  }
  review(){
    this.clearMarks();
    this.panel.querySelector('[data-calibration-retry]').hidden=false;
    try{
      this.proposed=gridFromCorners(...this.points,this.base);
      this.overlay.previewGrid(this.sceneId,this.proposed);
      const grid=this.proposed;
      this.panel.querySelector('[data-calibration-message]').textContent=`Preview: ${grid.width.toFixed(2)} × ${grid.height.toFixed(2)} pixels at (${grid.originX.toFixed(2)}, ${grid.originY.toFixed(2)}). Confirm to apply to the settings form, then Save to persist; or retry/cancel.`;
      this.panel.querySelector('[data-calibration-confirm]').hidden=false;
    }catch(error){this.proposed=null;this.panel.querySelector('[data-calibration-message]').textContent=error.message;}
  }
  drawMarks(){
    this.clearMarks();
    const {PIXI,canvas}=this.env;
    const root=this.marks=new PIXI.Container();root.name='myz-zone-calibration';root.eventMode='none';root.interactiveChildren=false;
    const graphics=new PIXI.Graphics().lineStyle(2,0xffd77d,1);
    for(const {x,y} of this.points)graphics.moveTo(x-8,y).lineTo(x+8,y).moveTo(x,y-8).lineTo(x,y+8);
    root.addChild(graphics);canvas.stage.addChild(root);
  }
  clearMarks(){if(this.marks){this.marks.parent?.removeChild(this.marks);if(!this.marks.destroyed)this.marks.destroy({children:true});this.marks=null;}}
  finish(result){
    if(!this.active)return;
    this.active=false;this.generation++;
    this.overlay.cancelPick?.();this.clearMarks();this.overlay.endCalibration();
    this.env.document.removeEventListener('keydown',this.keyListener,{capture:true});this.panel?.remove();this.panel=null;
    const resolve=this.resolve;this.resolve=null;resolve?.(result);
  }
  cancel(){this.generation++;if(this.active)this.finish(null);}
}
