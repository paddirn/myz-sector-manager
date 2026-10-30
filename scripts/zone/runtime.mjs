import {WanderingTokens} from '../wandering/service.mjs';
import {registerWandering} from '../wandering/ui.mjs';
import {registerTravelSettings} from '../travel/settings.mjs';
import {TravelEvents} from '../travel/service.mjs';
import {SectorEntryTriggers} from './entry-triggers.mjs';
import {ZoneStore,MODULE} from './store.mjs';
import {ZoneOverlay} from './overlay.mjs';
import {createZoneConfigClass,escapeHTML} from './config.mjs';
import {positionToCoordinate,coordinateToBounds,sceneCellSize,tokenCenter,formatDistance,sectorDistance,canonicalCoordinate} from './grid.mjs';

import {ZoneCalibration} from './calibration.mjs';
import {portraitCandidates} from './presentation.mjs';
import {registerOverlayShortcut,warnShortcutConflict} from './shortcut.mjs';

export class ZoneRuntime {
  constructor({onChange=()=>{},openSector=async()=>{},createSector=async()=>{},onDestination=null}={},env=globalThis){
    this.env=env;this.store=new ZoneStore(env);this.travel=new TravelEvents(this.store,env);this.wandering=new WanderingTokens(this.store,env);this.triggers=new SectorEntryTriggers(this.store,env,{onDestination,beforeMacros:context=>this.travel.onEntry(context).catch(()=>{}),afterTravel:context=>this.wandering.onEntry(context)});this.overlay=new ZoneOverlay(this.store,env);this.overlay.onSelect=code=>this.selectCoordinate(code);this.calibrator=new ZoneCalibration(this.store,this.overlay,env);
    this.onChange=onChange;this.openSector=openSector;this.createSector=createSector;this.hooks=[];this.suspended=false;this.pending=false;
  }
  register(){this.store.register();registerTravelSettings(this,this.env);registerWandering(this,this.env);this.env.Hooks.once('setup',()=>registerOverlayShortcut(this));}
  schedule(){
    if(this.pending)return;
    this.pending=true;
    queueMicrotask(()=>{this.pending=false;if(!this.suspended)this.overlay.draw();this.onChange();});
  }
  start(){
    if(!this.store.isGM||this.hooks.length)return;
    this.suspended=false;warnShortcutConflict(this);
    const {Hooks}=this.env;
    const on=(name,fn)=>this.hooks.push([name,Hooks.on(name,fn)]);
    const refresh=()=>{void this.store.refreshTracking().catch(()=>{});};
    this.unsubscribe=this.store.subscribe(()=>this.schedule());
    this.store.reload();this.triggers.prime();
    on('canvasPan',()=>this.schedule());
    on('canvasReady',()=>{this.suspended=false;this.store.emit();refresh();});
    on('canvasTearDown',()=>{if(this.calibrator.active)this.calibrator.cancel();this.suspended=true;this.overlay.stop();});
    on('updateToken',(token,changes,options={})=>{if(!options.myzWandering)void this.triggers.updated(token,changes); void this.store.tokenChanged(token,changes).catch(()=>{});if(changes.flags?.[MODULE]?.pendingTravelEntries)void this.travel.recoverPendingMoves().catch(()=>{});});
    on('moveToken',token=>{void this.triggers.updated(token,{x:token.x,y:token.y});});
    on('stopToken',token=>{void this.triggers.stopped(token);});
    for(const event of ['deleteToken','createToken','moveToken','stopToken','pauseToken'])on(event,token=>{void this.store.tokenChanged(token).catch(()=>{});});
    for(const event of ['updateScene','deleteScene'])on(event,scene=>{if(scene.id===this.store.config.sceneId){this.store.emit();refresh();}});
    for(const event of ['createJournalEntry','updateJournalEntry','deleteJournalEntry'])on(event,doc=>{
      if(doc.id===this.store.documentId){const assignments=JSON.stringify([this.store.config.sceneId,this.store.config.grid,this.store.config.groups.map(g=>[g.sceneId,g.tokenId])]);this.store.reload();if(assignments!==JSON.stringify([this.store.config.sceneId,this.store.config.grid,this.store.config.groups.map(g=>[g.sceneId,g.tokenId])]))this.triggers.prime();refresh();if(this.store.authoritative&&Object.keys(doc.getFlag(MODULE,'pendingTravelReports')||{}).length)void this.travel.enqueue(()=>this.travel.mergeHandoverReports()).catch(()=>{});}
      else if(doc.getFlag(MODULE,'sector')?.version===1||event==='deleteJournalEntry')this.schedule();
    });
    on('updateUser',()=>{if(!this.store.isGM){void this.travel.activeDialog?.close();this.calibrator.cancel();this.overlay.stop();this.dialog?.close();}else{refresh();if(this.store.authoritative)void this.travel.recoverPendingMoves().catch(()=>{});}});
    this.schedule();refresh();void this.travel.recoverPendingMoves().catch(()=>{});
  }
  stop(){for(const [name,id] of this.hooks)this.env.Hooks.off(name,id);this.hooks=[];this.suspended=true;this.unsubscribe?.();this.calibrator.cancel();this.overlay.stop();}
  async configure(){
    if(!this.store.isGM)return;
    if(this.dialog?.rendered){this.dialog.bringToFront();return;}
    const Dialog=createZoneConfigClass(this.env.foundry.applications.api.ApplicationV2);
    this.dialog=new Dialog(this);await this.dialog.render(true);
  }
  summary(selected=null){
    if(!this.store.isGM)return '';
    const {config,scene}=this.store;
    let warning='';
    if(this.store.documentId&&!this.store.document)warning='Zone configuration Journal is missing or unavailable.';
    else if(config.sceneId&&!scene)warning='Designated Zone Scene is missing or unavailable. Last-known positions are retained.';
    else if(scene&&config.calibration&&(scene.width!==config.calibration.sceneWidth||scene.height!==config.calibration.sceneHeight||sceneCellSize(scene).width!==config.calibration.cellWidth||sceneCellSize(scene).height!==config.calibration.cellHeight))warning='Scene dimensions or tactical grid size changed. Saved Zone pixel dimensions are unchanged; use Reconfigure Grid if needed.';
    const validCoordinate=value=>scene&&config.grid&&coordinateToBounds(value,config.grid)?canonicalCoordinate(value):null;
    const selectedCode=validCoordinate(selected?.code);
    const distanceFrom=(distance,origin)=>distance?`${formatDistance(distance)} from the ${origin}`:'Distance unavailable';
    const selectedCell=(from,origin)=>`<div class="zm-selected">${selectedCode?`<span>${escapeHTML(distanceFrom(sectorDistance(validCoordinate(from),selectedCode,config.kmPerSector),origin))}</span>`:`<span>${selected?'Selected sector coordinates unavailable':'No sector selected'}</span>`}</div>`;
    const groups=this.store.trackingRows().filter(track=>track.kind==='expedition');
    const partyDistance=groups.length?groups.map(track=>{
      const distance=validCoordinate(config.arkCoordinate)&&validCoordinate(track.coordinate)?track.distance:null;
      const subject=groups.length>1?track.name:'Party';
      const label=distance?`${subject} is ${distanceFrom(distance,'Ark')}`:`${subject}: Distance unavailable`;
      return `<span>${escapeHTML(label)}${!track.live?' (last known)':''}</span>`;
    }).join(''):'No party configured';
    const tracks=groups.map(track=>{
      const issue={outside:'outside Zone', 'missing-token':'token missing','missing-scene':'Scene missing',unavailable:'position unavailable'}[track.status];
      const label=`View Zone Scene and center on ${track.name}`;
      return `<div class="zm-expedition"><button type="button" class="zm-portrait" data-zone-center="${escapeHTML(track.id)}" title="${escapeHTML(label)}" aria-label="${escapeHTML(label)}"><i class="fa-solid fa-user-group" aria-hidden="true"></i></button><div class="zm-group-location"><strong>${escapeHTML(track.name)}</strong><div>${escapeHTML(track.coordinate||'Unknown')} <em>(${track.live?'live':'last known'}${issue?` · ${escapeHTML(issue)}`:''})</em></div></div><div class="zm-original-distance"></div>${selectedCell(track.status==='located'?track.coordinate:null,'Party')}</div>`;
    }).join('');
    if(config.arkCoordinate&&config.grid&&!coordinateToBounds(config.arkCoordinate,config.grid))warning+=(warning?' ':'')+'Ark is outside the configured grid; its map highlight is unavailable.';
    const sharedSelected=selectedCode?`<button type="button" class="zm-coordinate zm-shared-selected" style="grid-row:1 / span ${Math.max(1,groups.length+(config.sceneId||config.arkCoordinate?1:0))}" data-zone-coordinate="${escapeHTML(selectedCode)}" title="Center on selected sector ${escapeHTML(selectedCode)}" aria-label="Center on selected sector ${escapeHTML(selectedCode)}">${escapeHTML(selectedCode)}</button>`:'';
    return `<style>.sm-zone-summary{flex-shrink:0;border-bottom:1px solid #888;padding:6px 12px;font-size:12px}.sm-zone-summary .zm-actions,.sm-zone-summary .zm-positions{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px}.sm-zone-summary button{width:auto;height:auto;white-space:normal}.sm-zone-summary .zm-positions{margin-top:4px}.sm-zone-summary p{margin:4px 0}.sm-zone-summary em{opacity:.8}.sm-zone-summary .zm-expedition{display:grid;grid-template-columns:36px minmax(64px,88px) minmax(0,1fr) minmax(0,1.1fr);column-gap:6px;row-gap:4px;align-items:center;max-width:100%}.sm-zone-summary .zm-positions{display:block}.sm-zone-summary .zm-original-distance{display:flex;flex-direction:column;white-space:nowrap;min-width:0}.sm-zone-summary .zm-selected{display:flex;align-items:center;gap:4px;min-width:0;overflow-wrap:anywhere}.sm-zone-summary .zm-selected span{white-space:nowrap}.sm-zone-summary .zm-coordinate{width:36px;height:36px;flex:0 0 36px;font-size:10px;line-height:1.1;overflow-wrap:anywhere;padding:2px;border-radius:6px;font-weight:bold}.sm-zone-summary .zm-expedition+.zm-expedition{margin-top:6px}@container (max-width:640px){.sm-zone-summary .zm-expedition{grid-template-columns:36px minmax(0,1fr)}.sm-zone-summary .zm-selected{grid-column:2}.sm-zone-summary .zm-original-distance{grid-column:2;white-space:normal}.sm-zone-summary .zm-selected{flex-wrap:wrap}.sm-zone-summary .zm-selected span{white-space:normal}}.sm-zone-summary .zm-group-location{min-width:0;overflow-wrap:anywhere}.sm-zone-summary .zm-portrait{width:36px;height:36px;flex:0 0 36px;padding:0;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center}.sm-zone-summary .zm-portrait img{width:100%;height:100%;object-fit:contain}.sm-zone-summary .zm-portrait:focus-visible{outline:2px solid #d49a3d;outline-offset:2px}.sm-zone-summary .zm-tracking-grid{display:grid;grid-template-columns:36px minmax(64px,88px) minmax(0,1fr) 36px minmax(0,1.1fr);gap:6px;align-items:center}.sm-zone-summary .zm-tracking-grid .zm-expedition,.sm-zone-summary .zm-tracking-grid .zm-positions{display:contents}.sm-zone-summary .zm-tracking-grid .zm-expedition> :nth-child(1){grid-column:1}.sm-zone-summary .zm-tracking-grid .zm-expedition> :nth-child(2){grid-column:2}.sm-zone-summary .zm-tracking-grid .zm-original-distance{grid-column:3;white-space:normal}.sm-zone-summary .zm-tracking-grid .zm-selected{grid-column:5}.sm-zone-summary .zm-tracking-grid .zm-selected span{white-space:normal}.sm-zone-summary .zm-shared-selected{grid-column:4;height:100%;min-height:36px;align-self:stretch}.sm-zone-summary .zm-tracking-grid .zm-expedition+.zm-expedition{margin-top:0}@container(max-width:640px){.sm-zone-summary .zm-tracking-grid{grid-template-columns:32px minmax(48px,.7fr) minmax(0,1fr) 32px minmax(0,1fr);font-size:11px}.sm-zone-summary .zm-tracking-grid .zm-coordinate{width:32px}}</style>
      <div class="zm-zone-heading">Zone Map / Tracking: <strong>${escapeHTML(scene?.name||config.sceneId||'Not configured')}</strong>${this.selection?.sceneId===config.sceneId?` · Selected square: <strong data-zone-selection>${escapeHTML(this.selection.code)}</strong>`:''}</div>
      ${warning?`<p role="alert">${escapeHTML(warning)}</p>`:''}<div class="zm-tracking-grid">${sharedSelected}${config.sceneId||config.arkCoordinate?`<div class="zm-ark zm-expedition">${config.grid&&coordinateToBounds(config.arkCoordinate,config.grid)?'<button type="button" class="zm-portrait" data-zone-ark title="Center on the Ark sector" aria-label="Center on the Ark sector"><i class="fa-solid fa-house" aria-hidden="true"></i></button>':'<span class="zm-portrait" aria-hidden="true">⌂</span>'}<div>Ark: <strong>${escapeHTML(config.arkCoordinate||'Not designated')}</strong></div><div class="zm-original-distance">${partyDistance}</div>${selectedCell(config.arkCoordinate,'Ark')}</div>`:''}${tracks?`<div class="zm-positions">${tracks}</div>`:''}</div>`;
  }
  settingsActions(){
    const scene=this.store.scene,config=this.store.config;
    return `<div class="zm-actions"><button type="button" data-zone-config>Configure / Tracking</button><button type="button" data-zone-view ${scene?'':'disabled'}>View Zone</button><button type="button" data-zone-select ${this.store.live&&config.grid?'':'disabled'}>Select on map</button><button type="button" data-zone-overlay aria-pressed="${Boolean(config.overlay.enabled)}" ${scene&&config.grid?'':'disabled'}>${config.overlay.enabled?'Hide':'Show'} overlay</button><button type="button" data-zone-wander>Wander Now</button><button type="button" data-zone-wander-settings>Wandering Tokens</button><button type="button" data-zone-wander-enable>Enable Wandering for Selected Tokens</button><button type="button" data-zone-wander-disable>Disable Wandering for Selected Tokens</button></div>`;
  }
  setSelection(code){
    const canonical=canonicalCoordinate(code),sceneId=this.store.config.sceneId;
    if(!canonical||!this.store.config.grid||!coordinateToBounds(canonical,this.store.config.grid)){if(this.selection){this.selection=null;this.selectionRevision=(this.selectionRevision||0)+1;this.onChange();}return;}
    if(this.selection?.code===canonical&&this.selection?.sceneId===sceneId)return;
    this.selection={code:canonical,sceneId};this.selectionRevision=(this.selectionRevision||0)+1;this.onChange();
  }
  bindSummary(container){
    if(!container||!this.store.isGM)return;
    const run=handler=>async()=>{try{await handler();}catch(error){this.env.ui.notifications.error(`Zone Map: ${error.message}`);}};
    container.querySelector('[data-zone-wander]')?.addEventListener('click',run(()=>this.wandering.manual()));
    container.querySelector('[data-zone-wander-settings]')?.addEventListener('click',run(()=>new this.WanderingSettings().render(true)));
    container.querySelector('[data-zone-wander-enable]')?.addEventListener('click',run(()=>this.wandering.bulk(true)));
    container.querySelector('[data-zone-wander-disable]')?.addEventListener('click',run(()=>this.wandering.bulk(false)));
    container.querySelector('[data-zone-config]')?.addEventListener('click',run(()=>this.configure()));
    container.querySelector('[data-zone-ark]')?.addEventListener('click',run(()=>this.centerSector(this.store.config.arkCoordinate)));
    for(const button of container.querySelectorAll('[data-zone-coordinate]'))button.addEventListener('click',run(()=>this.centerSector(button.dataset.zoneCoordinate)));
    container.querySelector('[data-zone-view]')?.addEventListener('click',run(()=>this.store.scene?.view()));
    container.querySelector('[data-zone-overlay]')?.addEventListener('click',run(()=>this.toggleOverlay()));
    for(const button of container.querySelectorAll('[data-zone-center]')){button.addEventListener('click',run(()=>this.centerGroup(button.dataset.zoneCenter)));void this.attachPortrait(button,button.dataset.zoneCenter);}
    container.querySelector('[data-zone-select]')?.addEventListener('click',run(()=>this.overlay.pick(point=>{void this.selectPoint(point).catch(error=>this.env.ui.notifications.error(`Zone Map: ${error.message}`));})));
  }
  async toggleOverlay(notify=false){
    if(!this.store.isGM||!this.store.scene||!this.store.config.grid)return false;
    if(this.calibrator.active){this.env.ui.notifications.warn('Finish or cancel grid calibration before toggling the overlay.');return false;}
    await this.store.setOverlay();
    if(notify)this.env.ui.notifications.info(`Zone overlay ${this.store.config.overlay.enabled?'shown':'hidden'}${this.store.live?'':' when viewing the designated Zone Scene'}.`);
    return true;
  }
  async attachPortrait(button,id){
    const track=this.store.config.groups.find(group=>group.id===id);
    if(!track)return;
    const sources=await portraitCandidates(track,this.store.scene,uuid=>this.env.fromUuid(uuid));
    if(!button.isConnected||!this.store.isGM)return;
    const image=this.env.document.createElement('img');image.alt='';image.width=36;image.height=36;
    const next=()=>{
      if(!button.isConnected)return;
      const source=sources.shift();
      if(source){image.src=source;button.replaceChildren(image);}
      else{const icon=this.env.document.createElement('i');icon.className='fa-solid fa-user-group';icon.setAttribute('aria-hidden','true');button.replaceChildren(icon);}
    };
    image.addEventListener('error',next);next();
  }
  async centerSector(coordinate){
    if(!this.store.isGM)return false;
    const {scene,config}=this.store;
    if(!scene||!config.grid){this.env.ui.notifications.warn('Configure a Zone Scene and grid in Zone Map / Tracking first.');return false;}
    const gridSnapshot=JSON.stringify(config.grid);
    const bounds=coordinateToBounds(coordinate,config.grid);
    if(!bounds){this.env.ui.notifications.warn('This sector has no valid coordinates within the configured Zone grid.');return false;}
    this.calibrator.cancel();
    if(!this.store.live)await scene.view();
    if(!this.store.isGM||!this.store.live||scene!==this.store.scene||gridSnapshot!==JSON.stringify(this.store.config.grid))return false;
    await this.env.canvas.animatePan({x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2,duration:350});
    return true;
  }
  async centerGroup(id){
    if(!this.store.isGM)return false;
    const scene=this.store.scene,track=this.store.config.groups.find(group=>group.id===id);
    if(!scene||!track||track.sceneId!==scene.id||!scene.tokens.get(track.tokenId)){this.env.ui.notifications.warn('The expedition token or designated Zone Scene is unavailable.');return false;}
    this.calibrator.cancel();
    if(!this.store.live)await scene.view(); // GM-local view, never Scene.activate().
    const current=this.store.config.groups.find(group=>group.id===id);
    if(!this.store.live||scene.id!==this.store.config.sceneId||current?.tokenId!==track.tokenId)return false;
    const center=tokenCenter(scene.tokens.get(track.tokenId),scene);
    if(!center||!Number.isFinite(center.x)||!Number.isFinite(center.y)){this.env.ui.notifications.warn('The expedition token position is unavailable.');return false;}
    await this.env.canvas.animatePan({...center,duration:350});
    return true;
  }
  async selectPoint(point){
    if(!this.store.isGM||!this.store.live)return;
    const sceneId=this.store.config.sceneId;
    const code=positionToCoordinate(point,this.store.config.grid);
    if(!code){this.env.ui.notifications.warn('That point is outside the configured Zone grid.');return;}
    this.setSelection(code);
    let matches=this.store.sectorRecords(code);
    if(matches.length){
      if(matches.length>1)this.env.ui.notifications.warn(`Multiple sector records match ${code}; opening the first. Use the sidebar to choose another.`);
      await this.openSector(matches[0].id);return;
    }
    await this.createSector(code,()=>sceneId===this.store.config.sceneId&&this.store.live);
  }
  async selectCoordinate(code){
    const bounds=this.store.config.grid&&coordinateToBounds(code,this.store.config.grid);
    if(bounds)await this.selectPoint({x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2});
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
