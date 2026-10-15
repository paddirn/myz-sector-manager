import {gridBounds,coordinateToBounds,positionToCoordinate,canonicalCoordinate} from './grid.mjs';
import {MODULE} from './store.mjs';

// A non-interactive GM-only stage child. Picking is a separate, explicitly armed
// one-shot canvas gesture; the overlay never captures normal pointer events.
export class ZoneOverlay {
  constructor(store,env=globalThis){this.store=store;this.env=env;this.root=null;this.cancelPick=null;this.suppressed=false;this.preview=null;}
  destroy(){if(this.root){this.root.parent?.removeChild(this.root);if(!this.root.destroyed)this.root.destroy({children:true});this.root=null;}}
  stop(){this.cancelPick?.();this.destroy();}
  draw(){
    this.destroy();
    const {canvas,PIXI}=this.env;
    const config=this.preview?{...this.store.config,...this.preview,arkCoordinate:null,overlay:{enabled:true,boundaries:true,labels:true,status:false}}:this.store.config;
    const scene=this.env.game.scenes?.get(config.sceneId)||(!this.preview?this.store.scene:null);
    const live=this.preview?canvas?.ready&&canvas.scene?.id===config.sceneId:this.store.live;
    if(!this.store.isGM||!live||!scene||!config.grid||!config.overlay.enabled||!canvas.stage||(this.suppressed&&!this.preview))return;
    const bounds=gridBounds(config.grid);
    const rect=scene.dimensions?.sceneRect||{x:0,y:0,width:scene.width,height:scene.height};
    const clip={x:Math.max(rect.x,bounds.x),y:Math.max(rect.y,bounds.y),right:Math.min(rect.x+rect.width,bounds.x+bounds.width),bottom:Math.min(rect.y+rect.height,bounds.y+bounds.height)};
    if(clip.right<=clip.x||clip.bottom<=clip.y)return;
    const root=this.root=new PIXI.Container();root.eventMode='none';root.interactiveChildren=false;
    root.name='myz-zone-overlay';canvas.stage.addChild(root);
    const graphics=new PIXI.Graphics();root.addChild(graphics);
    const mask=new PIXI.Graphics().beginFill(0xffffff).drawRect(clip.x,clip.y,clip.right-clip.x,clip.bottom-clip.y).endFill();
    mask.eventMode='none';root.addChild(mask);root.mask=mask;
    if(config.overlay.status){
      const colors={Explored:0x418859,Cleared:0x437eaa,Visited:0x9d833c,Scouted:0x8972a4,Lost:0xa34c42};
      const seen=new Set();
      for(const journal of this.env.game.journal){
        const sector=journal.getFlag(MODULE,'sector');
        if(sector?.version!==1)continue;
        const code=canonicalCoordinate(sector.code),cell=coordinateToBounds(code,config.grid);
        if(!cell||seen.has(code)||!colors[sector.status])continue;
        seen.add(code);
        const x=Math.max(cell.x,clip.x),y=Math.max(cell.y,clip.y),right=Math.min(cell.x+cell.width,clip.right),bottom=Math.min(cell.y+cell.height,clip.bottom);
        if(right>x&&bottom>y)graphics.beginFill(colors[sector.status],.15).drawRect(x,y,right-x,bottom-y).endFill();
      }
    }
    const ark=coordinateToBounds(config.arkCoordinate,config.grid);
    if(ark){
      graphics.lineStyle(2,0xe7b85c,.9).beginFill(0xe7b85c,.22).drawRect(ark.x,ark.y,ark.width,ark.height).endFill();
      const label=new PIXI.Text('⌂ Ark',{fontFamily:'Arial',fontSize:Math.max(10,Math.min(20,ark.width/5,ark.height/5)),fill:0xffd77d,stroke:0x111111,strokeThickness:3});
      label.anchor?.set(.5,.5);label.position.set(ark.x+ark.width/2,ark.y+ark.height/2);label.eventMode='none';root.addChild(label);
    }
    if(config.overlay.boundaries){
      graphics.lineStyle(1,0xe2c98a,.7);
      for(let x=bounds.x;x<=bounds.x+bounds.width;x+=config.grid.width){if(x>=clip.x&&x<=clip.right)graphics.moveTo(x,clip.y).lineTo(x,clip.bottom);}
      for(let y=bounds.y;y<=bounds.y+bounds.height;y+=config.grid.height){if(y>=clip.y&&y<=clip.bottom)graphics.moveTo(clip.x,y).lineTo(clip.right,y);}
    }
    if(config.overlay.labels){
      // Bound label work by Scene intersection and cap it on very large maps.
      let labels=0;
      for(let x=Math.max(bounds.x,bounds.x+Math.floor((clip.x-bounds.x)/config.grid.width)*config.grid.width);x<clip.right;x+=config.grid.width){
        for(let y=Math.max(bounds.y,bounds.y+Math.floor((clip.y-bounds.y)/config.grid.height)*config.grid.height);y<clip.bottom;y+=config.grid.height){
          if(labels++>=2000)return;
          const code=positionToCoordinate({x:x+config.grid.width/2,y:y+config.grid.height/2},config.grid);
          if(!code)continue;
          const label=new PIXI.Text(code,{fontFamily:'Arial',fontSize:Math.max(8,Math.min(18,config.grid.width/5,config.grid.height/5)),fill:0xfaf0d4,stroke:0x111111,strokeThickness:3});
          label.position.set(Math.max(x+4,clip.x),Math.max(y+4,clip.y));label.eventMode='none';root.addChild(label);
        }
      }
    }
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
