import {requireDocument,parseDocumentDrop} from '../ui/documents.mjs';
import {documentLink,referenceState} from '../ui/reference.mjs';
import {sceneCellSize,canonicalCoordinate,displayGridCounts,storedGridCounts} from './grid.mjs';
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number=(label,name,value,extra='')=>`<label>${label}<input type="number" name="${name}" value="${escapeHTML(value)}" step="any" ${extra}></label>`;
const option=(value,label,selected)=>`<option value="${escapeHTML(value)}" ${String(value)===String(selected)?'selected':''}>${escapeHTML(label)}</option>`;
const defaultGrid=()=>({reference:'A1',originX:0,originY:0,width:1000,height:1000,columns:30,rows:30,columnAxis:'x',columnDirection:1,rowDirection:1});

export function createZoneConfigClass(ApplicationV2) {
  return class ZoneConfiguration extends ApplicationV2 {
    static DEFAULT_OPTIONS={id:'myz-zone-configuration',window:{title:'Zone Map / Tracking',resizable:true},position:{width:680,height:740},classes:['myz-zone-configuration']};
    constructor(runtime){super();this.runtime=runtime;this.draft=structuredClone(runtime.store.config);this.draft.grid??=defaultGrid();this.unit='pixels';}
    get scene(){return game.scenes.get(this.draft.sceneId);}
    tokenOptions(selected){
      const tokens=Array.from(this.scene?.tokens?.values()||[]);
      return option('','None',selected)+tokens.map(token=>option(token.id,token.name,selected)).join('')+(selected&&!tokens.some(token=>token.id===selected)?option(selected,'Missing token (clear or replace)',selected):'');
    }
    async _renderHTML(){
      const root=document.createElement('div');root.className='zm-config';this.actorReferenceRoot=root;
      const grid=this.draft.grid,counts=displayGridCounts(grid), size=this.unit==='cells'?sceneCellSize(this.scene):{width:1,height:1};
      const sectors=game.journal.filter(doc=>doc.getFlag('myz-sector-manager','sector')?.version===1).filter(doc=>canonicalCoordinate(doc.getFlag('myz-sector-manager','sector').code));
      const scenes=Array.from(game.scenes.values()).sort((a,b)=>a.name.localeCompare(b.name));
      root.innerHTML=`<style>
        .myz-zone-configuration .window-content{min-height:0;overflow-y:auto}.zm-config label{display:flex;flex-direction:column;gap:4px;margin-bottom:8px;min-width:0}.zm-config input,.zm-config select{width:100%;min-width:0;box-sizing:border-box}.zm-config input[type=checkbox]{width:auto}
        .zm-config .zm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.zm-config .zm-buttons{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.zm-config button{height:auto;white-space:normal}.zm-config fieldset{margin:12px 0;padding:10px;min-width:0}.zm-config .zm-group{border-top:1px solid #888;padding-top:10px;margin-top:10px}.zm-config p{margin:6px 0}.zm-config .zm-actor{border:1px dashed #888;padding:8px}.zm-config .content-link{white-space:normal}.zm-config .zm-check{display:flex;flex-direction:row;align-items:center}
      </style><p>Optional single-Scene integration. Sector records remain in their existing Journals. All controls are GM-only.</p>
      <label>Designated Zone Scene<select name="sceneId">${option('','Not configured',this.draft.sceneId)}${scenes.map(scene=>option(scene.id,scene.name,this.draft.sceneId)).join('')}</select></label>
      ${this.draft.sceneId&&!this.scene?'<p role="alert">The designated Scene is missing. Select a replacement or disconnect the map. Last-known positions are retained until then.</p>':''}
      <fieldset><legend>Reconfigure Grid</legend><p>Origin is the reference sector’s top-left corner in Scene canvas pixels (including Scene padding), independent of pan/zoom. Columns count horizontal squares; Rows count vertical squares. Letter/number orientation is configured separately; existing map coordinates are preserved.</p>
      <div class="zm-grid"><label>Reference sector<input name="reference" value="${escapeHTML(grid.reference)}" placeholder="A1"></label><label>Dimension units<select name="unit">${option('pixels','Scene pixels',this.unit)}${option('cells','Foundry grid cells',this.unit)}</select></label>
      ${number('Origin X','originX',grid.originX)}${number('Origin Y','originY',grid.originY)}
      ${number('Sector width','width',grid.width/(size.width||1),'min="0.001"')}${number('Sector height','height',grid.height/(size.height||1),'min="0.001"')}
      ${number('Columns (horizontal squares)','columns',counts.columns,'min="1" max="1000"')}${number('Rows (vertical squares)','rows',counts.rows,'min="1" max="1000"')}
      <label>Lettered columns run<select name="columnAxis">${option('x','Horizontally',grid.columnAxis)}${option('y','Vertically (swap axes)',grid.columnAxis)}</select></label>
      <label>Columns increase<select name="columnDirection">${option(1,'Right / down',grid.columnDirection)}${option(-1,'Left / up',grid.columnDirection)}</select></label><label>Rows increase<select name="rowDirection">${option(1,'Down / right',grid.rowDirection)}${option(-1,'Up / left',grid.rowDirection)}</select></label></div>
      <div class="zm-buttons"><button type="button" data-view-scene>View selected Scene</button><button type="button" data-calibrate-grid>Calibrate Grid</button><button type="button" data-pick-origin>Pick reference corner on canvas</button></div><p>Move this dialog aside and click once on the selected Scene; Escape cancels. Three-click calibration previews an axis-aligned rectangle; Confirm applies it to this form. Configuration is saved only with Save. Viewing another Scene never rescales this grid.</p></fieldset>
      <fieldset><legend>GM overlay</legend>${['enabled','boundaries','labels','status'].map(key=>`<label class="zm-check"><input type="checkbox" name="overlay.${key}" ${this.draft.overlay[key]?'checked':''}> ${escapeHTML({enabled:'Show overlay',boundaries:'Sector boundaries',labels:'Coordinate labels (up to 2,000)',status:'Exploration-status icons'}[key])}</label>`).join('')}<p>The overlay appears only on the displayed Zone Scene and supports background-square hover and left-click navigation while enabled. Right-clicks, drags and token gestures retain normal canvas behavior. “Select on map” is a separate one-shot tool. The overlay shortcut is editable in Foundry’s Configure Controls.</p></fieldset>
      <fieldset><legend>Fixed Ark location</legend><label>Choose an existing sector<select name="ark-record">${option('','Enter coordinate below / not designated','')}${sectors.map(doc=>{const code=canonicalCoordinate(doc.getFlag('myz-sector-manager','sector').code);return option(code,`${code} · ${doc.name}`,this.draft.arkCoordinate);}).join('')}</select></label><label>Ark sector coordinate<input name="arkCoordinate" value="${escapeHTML(this.draft.arkCoordinate||'')}" placeholder="A1, B7, AA12"></label><button type="button" data-clear-ark>Clear Ark location</button><p>No Ark token, Actor, or sector record is required. The fixed coordinate is authoritative; any old Ark token reference is retained for compatibility.</p>${number('Kilometers per sector (estimated travel distance)','kmPerSector',this.draft.kmPerSector??1.6,'min="0.001"')}</fieldset>
      <fieldset><legend>Expedition groups</legend>${this.draft.groups.map(group=>`<div class="zm-group" data-group="${escapeHTML(group.id)}"><label>Display name<input name="group-name" value="${escapeHTML(group.name)}"></label><label>Existing Zone Scene token<select name="group-token">${this.tokenOptions(group.tokenId)}</select></label><div class="zm-actor"><input type="hidden" name="group-actor" value="${escapeHTML(group.actorUuid||'')}"><span data-actor-link>Drop an optional Actor here</span><button type="button" data-clear-actor>Clear Actor</button></div><button type="button" data-remove-group>Remove group from tracking</button></div>`).join('')}<button type="button" data-add-group>Add expedition group</button></fieldset>
      <p>Token centers determine sectors. Off-map or missing tokens retain last-known coordinates. Tracking never explores sectors, consumes resources, advances time, or triggers events.</p>
      <div class="zm-buttons"><button type="button" data-save-zone>Save Zone configuration</button><button type="button" data-disconnect-zone>Disconnect Zone map</button><button type="button" data-cancel-zone>Cancel</button></div>`;
      for(const group of root.querySelectorAll('[data-group]'))await this.renderActor(group);
      return root;
    }
    _replaceHTML(result,content){content.replaceChildren(result);}
    readForm(){
      const root=this.element, grid=this.draft.grid, scale=this.unit==='cells'?sceneCellSize(this.scene):{width:1,height:1};
      for(const key of ['originX','originY','width','height','columnDirection','rowDirection'])grid[key]=Number(root.querySelector(`[name="${key}"]`).value)*(key==='width'?scale.width||1:key==='height'?scale.height||1:1);
      Object.assign(grid,storedGridCounts(Number(root.querySelector('[name="columns"]').value),Number(root.querySelector('[name="rows"]').value),root.querySelector('[name="columnAxis"]').value));
      if(this.scene)this.draft.calibration={sceneWidth:this.scene.width,sceneHeight:this.scene.height,cellWidth:sceneCellSize(this.scene).width,cellHeight:sceneCellSize(this.scene).height};
      grid.reference=root.querySelector('[name="reference"]').value;grid.columnAxis=root.querySelector('[name="columnAxis"]').value;
      for(const key of ['enabled','boundaries','labels','status'])this.draft.overlay[key]=root.querySelector(`[name="overlay.${key}"]`).checked;
      this.draft.arkCoordinate=root.querySelector('[name="arkCoordinate"]').value.trim();
      this.draft.kmPerSector=Number(root.querySelector('[name="kmPerSector"]').value);
      for(const row of root.querySelectorAll('[data-group]')){
        const index=this.draft.groups.findIndex(group=>group.id===row.dataset.group);
        const old=this.draft.groups[index],tokenId=row.querySelector('[name="group-token"]').value;
        this.draft.groups[index]={...this.assignToken(old,tokenId),id:old.id,name:row.querySelector('[name="group-name"]').value.trim()||'Expedition group',actorUuid:row.querySelector('[name="group-actor"]').value};
      }
    }
    assignToken(old,tokenId){return old?.tokenId===tokenId&&old?.sceneId===this.draft.sceneId?{...old}:{sceneId:this.draft.sceneId,tokenId,lastKnown:null};}
    async renderActor(row){
      const uuid=row.querySelector('[name="group-actor"]').value,target=row.querySelector('[data-actor-link]'),request=row.actorRequest=(row.actorRequest||0)+1;
      const current=()=>row.actorRequest===request&&row.querySelector('[name="group-actor"]').value===uuid&&this.actorReferenceRoot?.contains(row);
      if(!uuid){target.textContent='Drop an optional Actor here';return;}
      referenceState(target,'resolving');try{const doc=await requireDocument(uuid,'Actor',globalThis);if(!current())return;referenceState(target,'valid');target.replaceChildren(documentLink(doc,{env:globalThis,current}));}catch(error){if(current())referenceState(target,error.state||'unavailable',{uuid,types:'Actor'});}
    }
    async _onRender(context,options){
      await super._onRender(context,options);
      const root=this.element;
      const run=handler=>async event=>{try{await handler(event);}catch(error){ui.notifications.error(`Zone Map: ${error.message}`);}};
      root.querySelector('[name="sceneId"]').addEventListener('change',run(async event=>{
        const next=event.target.value;
        if(next===this.draft.sceneId)return;
        this.runtime.calibrator.cancel();this.readForm();this.draft.sceneId=next;this.draft.groups=[];await this.render();
      }));
      root.querySelector('[name="unit"]').addEventListener('change',event=>{this.readForm();this.unit=event.target.value;this.render();});
      root.querySelector('[data-view-scene]').addEventListener('click',run(async()=>{if(!this.scene)throw new Error('Choose an available Scene first.');await this.scene.view();}));
      root.querySelector('[name="ark-record"]').addEventListener('change',event=>{root.querySelector('[name="arkCoordinate"]').value=event.target.value;});
      root.querySelector('[data-clear-ark]').addEventListener('click',()=>{root.querySelector('[name="arkCoordinate"]').value='';root.querySelector('[name="ark-record"]').value='';});
      root.querySelector('[data-calibrate-grid]').addEventListener('click',run(async()=>{
        this.readForm();
        const visibility=root.style.visibility;root.style.visibility='hidden';
        try{
          const grid=await this.runtime.calibrator.start(this.draft.sceneId,this.draft.grid);
          if(grid&&this.rendered){this.draft.grid=grid;this.unit='pixels';await this.render();}
        }finally{root.style.visibility=visibility;}
      }));
      root.querySelector('[data-pick-origin]').addEventListener('click',run(()=>{
        this.runtime.overlay.pick(point=>{root.querySelector('[name="originX"]').value=Math.round(point.x*1000)/1000;root.querySelector('[name="originY"]').value=Math.round(point.y*1000)/1000;},{sceneId:this.draft.sceneId});
      }));
      root.querySelector('[data-add-group]').addEventListener('click',()=>{this.readForm();this.draft.groups.push({id:foundry.utils.randomID(),name:'Expedition group',tokenId:'',sceneId:this.draft.sceneId,actorUuid:'',lastKnown:null});this.render();});
      for(const row of root.querySelectorAll('[data-group]')){
        row.querySelector('[data-remove-group]').addEventListener('click',()=>{this.readForm();this.draft.groups=this.draft.groups.filter(group=>group.id!==row.dataset.group);this.render();});
        row.querySelector('[data-clear-actor]').addEventListener('click',()=>{row.querySelector('[name="group-actor"]').value='';this.renderActor(row);});
        row.querySelector('.zm-actor').addEventListener('dragover',event=>event.preventDefault());
        row.querySelector('.zm-actor').addEventListener('drop',run(async event=>{
          event.preventDefault();event.stopPropagation();
          const data=parseDocumentDrop(event,globalThis),actor=await requireDocument(data.uuid,'Actor',globalThis);
          if(actor?.documentName!=='Actor')throw new Error('Drop an Actor document.');
          if(!this.element.contains(row))return;
          row.querySelector('[name="group-actor"]').value=actor.uuid;await this.renderActor(row);
        }));
      }
      root.querySelector('[data-cancel-zone]').addEventListener('click',()=>this.close());
      root.querySelector('[data-save-zone]').addEventListener('click',run(async()=>{
        this.readForm();
        const old=this.runtime.store.config.sceneId;
        if(old&&old!==this.draft.sceneId&&!await foundry.applications.api.DialogV2.confirm({window:{title:'Replace Zone Scene?'},content:'The previous expedition assignments will be removed. The fixed Ark coordinate is retained; review it for the new map. Existing sector Journals are preserved. Continue?'}))return;
        await this.runtime.store.save(this.draft);await this.close();
      }));
      root.querySelector('[data-disconnect-zone]').addEventListener('click',run(async()=>{
        if(!await foundry.applications.api.DialogV2.confirm({window:{title:'Disconnect Zone map?'},content:'Remove map and token assignments? Existing sector Journals are preserved.'}))return;
        await this.runtime.store.save({...this.runtime.store.config,sceneId:'',grid:null,arkCoordinate:null,groups:[]});await this.close();
      }));
    }
    async _onClose(options){this.actorReferenceRoot=null;this.runtime.calibrator.cancel();this.runtime.overlay.cancelPick?.();await super._onClose(options);}
  };
}
