import {gridBounds,coordinateToBounds,positionToCoordinate,canonicalCoordinate} from './grid.mjs';
import {MODULE} from './store.mjs';
import {sectorIndicators,drawSectorIcon} from '../sector-icons.mjs';

// Passive PIXI objects; board listeners observe background gestures without
// cancelling Foundry events. One-shot calibration remains explicitly armed.
export class ZoneOverlay {
  constructor(store,env=globalThis){this.store=store;this.env=env;this.root=null;this.cancelPick=null;this.suppressed=false;this.preview=null;this.cells=new Map();this.onSelect=async()=>{};}
  destroy(){
    this.unbind?.();this.unbind=null;this.tooltip?.remove();this.tooltip=null;this.hoverCode=null;this.gesture=null;this.cells.clear();this.signature=null;
    if(this.root){this.root.parent?.removeChild(this.root);if(!this.root.destroyed)this.root.destroy({children:true});this.root=null;}
  }
  stop(){this.cancelPick?.();this.destroy();}
  active(){return Boolean(this.store.isGM&&this.store.live&&this.store.config.overlay.enabled&&!this.suppressed&&!this.preview&&this.root&&!this.cancelPick);}
  draw(){
    const {canvas,PIXI}=this.env;
    const config=this.preview?{...this.store.config,...this.preview,arkCoordinate:null,overlay:{enabled:true,boundaries:true,labels:true,status:false}}:this.store.config;
    const scene=this.env.game.scenes?.get(config.sceneId)||(!this.preview?this.store.scene:null);
    const live=this.preview?canvas?.ready&&canvas.scene?.id===config.sceneId:this.store.live;
    if(!this.store.isGM||!live||!scene||!config.grid||!config.overlay.enabled||!canvas.stage||(this.suppressed&&!this.preview)){this.destroy();return;}
    const bounds=gridBounds(config.grid),rect=scene.dimensions?.sceneRect||{x:0,y:0,width:scene.width,height:scene.height};
    const clip={x:Math.max(rect.x,bounds.x),y:Math.max(rect.y,bounds.y),right:Math.min(rect.x+rect.width,bounds.x+bounds.width),bottom:Math.min(rect.y+rect.height,bounds.y+bounds.height)};
    if(clip.right<=clip.x||clip.bottom<=clip.y){this.destroy();return;}
    // Cull label work to the viewport, so panning across large maps never leaves
    // distant squares without labels merely because they were created last.
    let labelClip=clip;
    if(canvas.app?.screen&&canvas.stage.toLocal){
      const a=canvas.stage.toLocal(new PIXI.Point(0,0)),b=canvas.stage.toLocal(new PIXI.Point(canvas.app.screen.width,canvas.app.screen.height));
      labelClip={x:Math.max(clip.x,Math.min(a.x,b.x)-config.grid.width),y:Math.max(clip.y,Math.min(a.y,b.y)-config.grid.height),right:Math.min(clip.right,Math.max(a.x,b.x)+config.grid.width),bottom:Math.min(clip.bottom,Math.max(a.y,b.y)+config.grid.height)};
    }
    const signature=JSON.stringify([config.sceneId,config.grid,config.overlay,config.arkCoordinate,clip,labelClip,Boolean(this.preview)]);
    if(this.root&&this.signature===signature&&this.root.parent===canvas.stage){this.refreshSectors();return;}
    this.destroy();this.signature=signature;this.clip=clip;this.config=config;
    const root=this.root=new PIXI.Container();root.eventMode='none';root.interactiveChildren=false;root.name='myz-zone-overlay';canvas.stage.addChild(root);
    const graphics=new PIXI.Graphics();root.addChild(graphics);
    const mask=new PIXI.Graphics().beginFill(0xffffff).drawRect(clip.x,clip.y,clip.right-clip.x,clip.bottom-clip.y).endFill();mask.eventMode='none';root.addChild(mask);root.mask=mask;
    if(config.overlay.boundaries){
      graphics.lineStyle(1,0xe2c98a,.7);
      for(let x=bounds.x;x<=bounds.x+bounds.width;x+=config.grid.width)if(x>=clip.x&&x<=clip.right)graphics.moveTo(x,clip.y).lineTo(x,clip.bottom);
      for(let y=bounds.y;y<=bounds.y+bounds.height;y+=config.grid.height)if(y>=clip.y&&y<=clip.bottom)graphics.moveTo(clip.x,y).lineTo(clip.right,y);
    }
    const ark=coordinateToBounds(config.arkCoordinate,config.grid);
    if(ark){
      graphics.lineStyle(2,0xe7b85c,.9).beginFill(0xe7b85c,.22).drawRect(ark.x,ark.y,ark.width,ark.height).endFill();
      const label=new PIXI.Text('⌂ Ark',{fontFamily:'Arial',fontSize:Math.max(10,Math.min(20,ark.width/5,ark.height/5)),fill:0xffd77d,stroke:0x111111,strokeThickness:3});label.anchor?.set(.5,.5);label.position.set(ark.x+ark.width/2,ark.y+ark.height/2);label.eventMode='none';root.addChild(label);
    }
    this.hover=new PIXI.Graphics();this.hover.eventMode='none';root.addChild(this.hover);
    this.refreshSectors();
    if(config.overlay.labels&&labelClip.right>labelClip.x&&labelClip.bottom>labelClip.y){
      // Preserve the existing 2,000-label budget. All squares remain navigable.
      let labels=0;
      for(let x=bounds.x+Math.floor((labelClip.x-bounds.x)/config.grid.width)*config.grid.width;x<labelClip.right;x+=config.grid.width){
        for(let y=bounds.y+Math.floor((labelClip.y-bounds.y)/config.grid.height)*config.grid.height;y<labelClip.bottom;y+=config.grid.height){
          if(labels++>=2000)break;
          const code=positionToCoordinate({x:x+config.grid.width/2,y:y+config.grid.height/2},config.grid);if(!code)continue;
          const cell={code,bounds:{x,y,width:config.grid.width,height:config.grid.height},signature:null,root:null};this.cells.set(code,cell);this.updateCell(cell);
        }
        if(labels>=2000)break;
      }
    }
    if(!this.preview)this.bind();
  }
  refreshSectors(){
    this.records=new Map();
    for(const journal of this.env.game.journal){const data=journal.getFlag(MODULE,'sector');if(data?.version!==1)continue;const code=canonicalCoordinate(data.code);if(code&&!this.records.has(code))this.records.set(code,data);}
    for(const cell of this.cells.values())this.updateCell(cell);
    if(this.hoverCode&&this.lastPointer)this.showTooltip(this.hoverCode,this.lastPointer);
  }
  updateCell(cell){
    const data=this.records.get(cell.code),info=data?sectorIndicators(data):null;
    const signature=JSON.stringify(info);if(cell.signature===signature&&cell.root)return;
    cell.signature=signature;
    if(cell.root){this.root.removeChild(cell.root);cell.root.destroy({children:true});}
    const {PIXI}=this.env,b=cell.bounds,root=cell.root=new PIXI.Container();root.eventMode='none';root.interactiveChildren=false;this.root.addChild(root);
    const mask=new PIXI.Graphics().beginFill(0xffffff).drawRect(b.x+1,b.y+1,b.width-2,b.height-2).endFill();root.addChild(mask);root.mask=mask;
    const font=Math.max(1,Math.min(18,b.width/7,b.height/7)),padding=Math.min(4,b.width*.04,b.height*.04),available=b.width-padding*2;
    const text=(value,x,y,size=font,fill=0xfaf0d4)=>{
      const label=new PIXI.Text(String(value),{fontFamily:'Arial',fontSize:size,fill,stroke:0x111111,strokeThickness:Math.min(3,font/5),wordWrap:true,wordWrapWidth:available,breakWords:true});label.eventMode='none';label.position.set(x,y);root.addChild(label);return label;
    };
    text(cell.code,b.x+padding,b.y+padding,font,data?0xfaf0d4:0x929a9f);
    if(!info)return;
    if(info.terrain.visible)text(info.terrain.value,b.x+padding,b.y+padding+font*1.25,font*.7);
    const size=font*.85,step=font*1.35;let x=b.x+padding,y=b.y+b.height*.56;
    for(const key of ['rot','encounters','phenomena','loot','status']){
      const indicator=info[key];if(!indicator.visible||(key==='status'&&!this.config.overlay.status))continue;
      const width=size+(indicator.value!==''?size*.65*String(indicator.value).length:0)+padding;
      if(x+width>b.x+b.width-padding){x=b.x+padding;y+=step;}
      const icon=drawSectorIcon(PIXI,indicator.icon,size);icon.x=x;icon.y=y;icon.sectorTooltip=indicator.title;root.addChild(icon);
      if(indicator.value!=='')text(indicator.value,x+size,y,font*.7);
      x+=width;
    }
  }
  point(event){
    const {canvas,PIXI}=this.env,board=canvas.app?.canvas||canvas.app?.view,rect=board?.getBoundingClientRect(),screen=canvas.app?.screen;
    if(!rect?.width||!rect?.height||!screen)return null;
    return canvas.stage.toLocal(new PIXI.Point((event.clientX-rect.left)*screen.width/rect.width,(event.clientY-rect.top)*screen.height/rect.height));
  }
  coordinate(point){const c=this.clip;return point&&point.x>=c.x&&point.x<c.right&&point.y>=c.y&&point.y<c.bottom?positionToCoordinate(point,this.config.grid):null;}
  tokenAt(point){if(!point)return false;return this.env.canvas.tokens?.placeables?.some(token=>token.visible!==false&&(token.bounds?.contains?.(point.x,point.y)||token.hitArea?.contains?.(point.x-token.x,point.y-token.y)||(()=>{const d=token.document,size=this.env.canvas.grid?.size;return d&&size&&point.x>=d.x&&point.y>=d.y&&point.x<d.x+d.width*size&&point.y<d.y+d.height*size;})()))||false;}
  clearHover(){this.hover?.clear();this.hoverCode=null;this.lastPointer=null;if(this.tooltip)this.tooltip.hidden=true;}
  showTooltip(code,event){
    if(!this.env.document?.createElement)return;
    if(!this.tooltip){const node=this.tooltip=this.env.document.createElement('div');node.className='myz-sector-overlay-tooltip';node.setAttribute('role','tooltip');node.style.cssText='position:fixed;z-index:100000;pointer-events:none;max-width:260px;white-space:pre-line;overflow-wrap:anywhere;padding:5px 8px;border:1px solid #aaa;border-radius:4px;background:#191919;color:#faf0d4;font:12px sans-serif;';this.env.document.body.append(node);}
    const info=this.records.get(code);this.tooltip.textContent=[code,...(info?Object.entries(sectorIndicators(info)).filter(([key,value])=>value.visible&&(key!=='status'||this.config.overlay.status)).map(([,value])=>value.title):[])].join('\n');
    this.tooltip.hidden=false;this.tooltip.style.left=Math.max(0,Math.min(event.clientX+14,(this.env.innerWidth||1000)-280))+'px';this.tooltip.style.top=Math.max(0,Math.min(event.clientY+14,(this.env.innerHeight||800)-this.tooltip.offsetHeight-8))+'px';
  }
  bind(){
    const board=this.env.canvas.app?.canvas||this.env.canvas.app?.view;if(!board)return;
    const listeners=[],on=(name,fn)=>{board.addEventListener(name,fn,{passive:true});listeners.push([name,fn]);};
    const usable=e=>this.active()&&e.target===board&&e.isPrimary!==false&&(!e.pointerType||e.pointerType==='mouse')&&!e.shiftKey&&!e.ctrlKey&&!e.altKey&&!e.metaKey;
    on('pointermove',event=>{
      if(this.gesture&&Math.hypot(event.clientX-this.gesture.x,event.clientY-this.gesture.y)>6)this.gesture.dragged=true;
      if(!usable(event)||event.buttons){this.clearHover();return;}
      const point=this.point(event),code=this.coordinate(point);if(!code||this.tokenAt(point)){this.clearHover();return;}
      if(this.hoverCode!==code){this.hover.clear();const b=coordinateToBounds(code,this.config.grid);this.hover.beginFill(0x32b85a,.22).drawRect(b.x,b.y,b.width,b.height).endFill();this.hoverCode=code;}
      this.lastPointer={clientX:event.clientX,clientY:event.clientY};this.showTooltip(code,event);
    });
    on('pointerdown',event=>{this.gesture=null;if(!usable(event)||event.button!==0||this.tokenAt(this.point(event)))return;const code=this.coordinate(this.point(event));if(code)this.gesture={x:event.clientX,y:event.clientY,code,id:event.pointerId};});
    on('pointerup',event=>{
      const down=this.gesture;this.gesture=null;
      if(!down||!usable(event)||event.button!==0||down.id!==event.pointerId||down.dragged||Math.hypot(event.clientX-down.x,event.clientY-down.y)>6)return;
      const point=this.point(event);if(this.coordinate(point)!==down.code||this.tokenAt(point))return;
      if(this.navigating)return;
      const activeRoot=this.root;this.clearHover();this.navigating=true;Promise.resolve().then(()=>this.active()&&this.root===activeRoot?this.onSelect(down.code):null).catch(error=>this.env.ui.notifications.error(`Zone Map: ${error.message}`)).finally(()=>{this.navigating=false;});
    });
    for(const name of ['pointerleave','pointercancel','wheel'])on(name,()=>{this.gesture=null;this.clearHover();});
    this.unbind=()=>{for(const [name,fn] of listeners)board.removeEventListener(name,fn);};
  }
  hideForCalibration(){this.suppressed=true;this.preview=null;this.draw();}
  previewGrid(sceneId,grid){this.preview={sceneId,grid};this.draw();}
  endCalibration(){this.preview=null;this.suppressed=false;this.draw();}
  pick(callback,{sceneId=this.store.config.sceneId,onCancel=()=>{},notify=true}={}){
    this.cancelPick?.();
    const {canvas,document,PIXI}=this.env;
    if(!this.store.isGM||!canvas?.ready||!sceneId||canvas.scene?.id!==sceneId)throw new Error('View the selected Zone Scene before selecting a point.');
    const board=canvas.app?.view;
    if(!board)throw new Error('Canvas is unavailable.');
    const capture={capture:true};
    const cleanup=()=>{board.removeEventListener('pointerdown',onPointer,capture);document.removeEventListener('keydown',onKey,capture);board.style.cursor=oldCursor;this.cancelPick=null;};
    const oldCursor=board.style.cursor;
    const onKey=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.cancelPick?.();}};
    const onPointer=event=>{
      if(event.button!==0)return;
      if(!canvas.ready||canvas.scene?.id!==sceneId){this.cancelPick?.();return;}
      event.preventDefault();event.stopImmediatePropagation();
      const rect=board.getBoundingClientRect(),screen=canvas.app.screen;
      const global=new PIXI.Point((event.clientX-rect.left)*screen.width/rect.width,(event.clientY-rect.top)*screen.height/rect.height);
      const point=canvas.stage.toLocal(global);
      cleanup();callback({x:point.x,y:point.y});
    };
    this.cancelPick=()=>{cleanup();onCancel();};board.style.cursor='crosshair';
    board.addEventListener('pointerdown',onPointer,capture);document.addEventListener('keydown',onKey,capture);
    if(notify)this.env.ui.notifications.info('Click the Zone canvas once. Escape cancels. Normal canvas controls resume afterward.');
  }
}
