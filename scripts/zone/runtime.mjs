import {ZoneStore,MODULE} from './store.mjs';
import {ZoneOverlay} from './overlay.mjs';
import {createZoneConfigClass,escapeHTML} from './config.mjs';
import {positionToCoordinate,coordinateToBounds,sceneCellSize} from './grid.mjs';

export class ZoneRuntime {
  constructor({onChange=()=>{},openSector=async()=>{},createSector=async()=>{}}={},env=globalThis){
    this.env=env;this.store=new ZoneStore(env);this.overlay=new ZoneOverlay(this.store,env);
    this.onChange=onChange;this.openSector=openSector;this.createSector=createSector;this.hooks=[];this.suspended=false;this.pending=false;
  }
  register(){this.store.register();}
  schedule(){
    if(this.pending)return;
    this.pending=true;
    queueMicrotask(()=>{this.pending=false;if(!this.suspended)this.overlay.draw();this.onChange();});
  }
  start(){
    if(!this.store.isGM||this.hooks.length)return;
    this.suspended=false;
    const {Hooks}=this.env;
    const on=(name,fn)=>this.hooks.push([name,Hooks.on(name,fn)]);
    const refresh=()=>{void this.store.refreshTracking().catch(()=>{});};
    this.unsubscribe=this.store.subscribe(()=>this.schedule());
    this.store.reload();
    on('canvasReady',()=>{this.suspended=false;this.store.emit();refresh();});
    on('canvasTearDown',()=>{this.suspended=true;this.overlay.stop();});
    on('updateToken',(token,changes)=>{void this.store.tokenChanged(token,changes).catch(()=>{});});
    for(const event of ['deleteToken','createToken','moveToken','stopToken','pauseToken'])on(event,token=>{void this.store.tokenChanged(token).catch(()=>{});});
    for(const event of ['updateScene','deleteScene'])on(event,scene=>{if(scene.id===this.store.config.sceneId){this.store.emit();refresh();}});
    for(const event of ['createJournalEntry','updateJournalEntry','deleteJournalEntry'])on(event,doc=>{
      if(doc.id===this.store.documentId){this.store.reload();refresh();}
      else if(doc.getFlag(MODULE,'sector')?.version===1||event==='deleteJournalEntry')this.schedule();
    });
    on('updateUser',()=>{if(!this.store.isGM){this.overlay.stop();this.dialog?.close();}else refresh();});
    this.schedule();refresh();
  }
  stop(){for(const [name,id] of this.hooks)this.env.Hooks.off(name,id);this.hooks=[];this.suspended=true;this.unsubscribe?.();this.overlay.stop();}
  async configure(){
    if(!this.store.isGM)return;
    if(this.dialog?.rendered){this.dialog.bringToFront();return;}
    const Dialog=createZoneConfigClass(this.env.foundry.applications.api.ApplicationV2);
    this.dialog=new Dialog(this);await this.dialog.render(true);
  }
  summary(){
    if(!this.store.isGM)return '';
    const {config,scene}=this.store;
    let warning='';
    if(this.store.documentId&&!this.store.document)warning='Zone configuration Journal is missing or unavailable.';
    else if(config.sceneId&&!scene)warning='Designated Zone Scene is missing or unavailable. Last-known positions are retained.';
    else if(scene&&config.calibration&&(scene.width!==config.calibration.sceneWidth||scene.height!==config.calibration.sceneHeight||sceneCellSize(scene).width!==config.calibration.cellWidth||sceneCellSize(scene).height!==config.calibration.cellHeight))warning='Scene dimensions or tactical grid size changed. Saved Zone pixel dimensions are unchanged; use Reconfigure Grid if needed.';
    const tracks=this.store.trackingRows().map(track=>{
      const issue={outside:'outside Zone', 'missing-token':'token missing','missing-scene':'Scene missing',unavailable:'position unavailable'}[track.status];
      return `<span><strong>${escapeHTML(track.name)}:</strong> ${escapeHTML(track.coordinate||'Unknown')} <em>(${track.live?'live':'last known'}${issue?` · ${escapeHTML(issue)}`:''})</em></span>`;
    }).join('');
    return `<style>.sm-zone-summary{flex-shrink:0;border-bottom:1px solid #888;padding:6px 12px;font-size:12px}.sm-zone-summary .zm-actions,.sm-zone-summary .zm-positions{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px}.sm-zone-summary button{width:auto;height:auto;white-space:normal}.sm-zone-summary .zm-positions{margin-top:4px}.sm-zone-summary p{margin:4px 0}.sm-zone-summary em{opacity:.8}</style>
      <details ${this.toolsOpen?'open':''}><summary>Zone Map / Tracking: <strong>${escapeHTML(scene?.name||config.sceneId||'Not configured')}</strong></summary><div class="zm-actions"><button type="button" data-zone-config>Configure / Tracking</button><button type="button" data-zone-view ${scene?'':'disabled'}>View Zone</button><button type="button" data-zone-select ${this.store.live&&config.grid?'':'disabled'}>Select on map</button><button type="button" data-zone-overlay aria-pressed="${Boolean(config.overlay.enabled)}" ${scene&&config.grid?'':'disabled'}>${config.overlay.enabled?'Hide':'Show'} overlay</button></div></details>
      ${warning?`<p role="alert">${escapeHTML(warning)}</p>`:''}${tracks?`<div class="zm-positions">${tracks}</div>`:''}`;
  }
  bindSummary(container){
    if(!container||!this.store.isGM)return;
    container.querySelector('details')?.addEventListener('toggle',event=>{this.toolsOpen=event.target.open;});
    const run=handler=>async()=>{try{await handler();}catch(error){this.env.ui.notifications.error(`Zone Map: ${error.message}`);}};
    container.querySelector('[data-zone-config]')?.addEventListener('click',run(()=>this.configure()));
    container.querySelector('[data-zone-view]')?.addEventListener('click',run(()=>this.store.scene?.view()));
    container.querySelector('[data-zone-overlay]')?.addEventListener('click',run(()=>this.store.setOverlay(!this.store.config.overlay.enabled)));
    container.querySelector('[data-zone-select]')?.addEventListener('click',run(()=>this.overlay.pick(point=>{void this.selectPoint(point).catch(error=>this.env.ui.notifications.error(`Zone Map: ${error.message}`));})));
  }
  async selectPoint(point){
    if(!this.store.isGM||!this.store.live)return;
    const sceneId=this.store.config.sceneId;
    const code=positionToCoordinate(point,this.store.config.grid);
    if(!code){this.env.ui.notifications.warn('That point is outside the configured Zone grid.');return;}
    let matches=this.store.sectorRecords(code);
    if(matches.length){
      if(matches.length>1)this.env.ui.notifications.warn(`Multiple sector records match ${code}; opening the first. Use the sidebar to choose another.`);
      await this.openSector(matches[0].id);return;
    }
    if(!await this.env.foundry.applications.api.DialogV2.confirm({window:{title:`No record for ${code}`},content:`Create a GM-only sector record for ${code}?`}))return;
    if(sceneId!==this.store.config.sceneId||!this.store.live)return;
    // Another GM may have created it while the confirmation was open.
    matches=this.store.sectorRecords(code);
    if(matches.length)await this.openSector(matches[0].id);else await this.createSector(code);
  }
  api(){
    return {
      configure:()=>this.configure(),
      positionToSector:point=>this.store.isGM&&this.store.scene?positionToCoordinate(point,this.store.config.grid):null,
      sectorBounds:coordinate=>this.store.isGM&&this.store.scene&&this.store.config.grid?coordinateToBounds(coordinate,this.store.config.grid):null,
      tracking:()=>this.store.isGM?structuredClone(this.store.trackingRows()):[]
    };
  }
}
