import {sceneCellSize} from './grid.mjs';
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
      const root=document.createElement('div');root.className='zm-config';
      const grid=this.draft.grid, size=this.unit==='cells'?sceneCellSize(this.scene):{width:1,height:1};
      const scenes=Array.from(game.scenes.values()).sort((a,b)=>a.name.localeCompare(b.name));
      root.innerHTML=`<style>
        .myz-zone-configuration .window-content{min-height:0;overflow-y:auto}.zm-config label{display:flex;flex-direction:column;gap:4px;margin-bottom:8px;min-width:0}.zm-config input,.zm-config select{width:100%;min-width:0;box-sizing:border-box}.zm-config input[type=checkbox]{width:auto}
        .zm-config .zm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.zm-config .zm-buttons{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.zm-config button{height:auto;white-space:normal}.zm-config fieldset{margin:12px 0;padding:10px;min-width:0}.zm-config .zm-group{border-top:1px solid #888;padding-top:10px;margin-top:10px}.zm-config p{margin:6px 0}.zm-config .zm-actor{border:1px dashed #888;padding:8px}.zm-config .content-link{white-space:normal}.zm-config .zm-check{display:flex;flex-direction:row;align-items:center}
      </style><p>Optional single-Scene integration. Sector records remain in their existing Journals. All controls are GM-only.</p>
      <label>Designated Zone Scene<select name="sceneId">${option('','Not configured',this.draft.sceneId)}${scenes.map(scene=>option(scene.id,scene.name,this.draft.sceneId)).join('')}</select></label>
      ${this.draft.sceneId&&!this.scene?'<p role="alert">The designated Scene is missing. Select a replacement or disconnect the map. Last-known positions are retained until then.</p>':''}
      <fieldset><legend>Reconfigure Grid</legend><p>Origin is the reference sector’s top-left corner in Scene canvas pixels (including Scene padding), independent of pan/zoom. Grid bounds run from A1 through the configured column/row counts.</p>
      <div class="zm-grid"><label>Reference sector<input name="reference" value="${escapeHTML(grid.reference)}" placeholder="A1"></label><label>Dimension units<select name="unit">${option('pixels','Scene pixels',this.unit)}${option('cells','Foundry grid cells',this.unit)}</select></label>
      ${number('Origin X','originX',grid.originX)}${number('Origin Y','originY',grid.originY)}
      ${number('Sector width','width',grid.width/(size.width||1),'min="0.001"')}${number('Sector height','height',grid.height/(size.height||1),'min="0.001"')}
      ${number('Columns (A=1, AA=27)','columns',grid.columns,'min="1" max="1000"')}${number('Rows (1-based)','rows',grid.rows,'min="1" max="1000"')}
      <label>Lettered columns run<select name="columnAxis">${option('x','Horizontally',grid.columnAxis)}${option('y','Vertically (swap axes)',grid.columnAxis)}</select></label>
      <label>Columns increase<select name="columnDirection">${option(1,'Right / down',grid.columnDirection)}${option(-1,'Left / up',grid.columnDirection)}</select></label><label>Rows increase<select name="rowDirection">${option(1,'Down / right',grid.rowDirection)}${option(-1,'Up / left',grid.rowDirection)}</select></label></div>
      <div class="zm-buttons"><button type="button" data-view-scene>View selected Scene</button><button type="button" data-pick-origin>Pick reference corner on canvas</button></div><p>Move this dialog aside and click once on the selected Scene; Escape cancels. Configuration is saved only with Save. Viewing another Scene never rescales this grid.</p></fieldset>
      <fieldset><legend>GM overlay</legend>${['enabled','boundaries','labels','status'].map(key=>`<label class="zm-check"><input type="checkbox" name="overlay.${key}" ${this.draft.overlay[key]?'checked':''}> ${escapeHTML({enabled:'Show overlay',boundaries:'Sector boundaries',labels:'Coordinate labels (up to 2,000)',status:'Subtle exploration-status highlights'}[key])}</label>`).join('')}<p>The overlay appears only on the displayed Zone Scene and never handles normal canvas clicks. “Select on map” is a separate one-shot tool.</p></fieldset>
      <fieldset><legend>Ark</legend><label>Existing Zone Scene token<select name="ark">${this.tokenOptions(this.draft.ark?.tokenId||'')}</select></label></fieldset>
      <fieldset><legend>Expedition groups</legend>${this.draft.groups.map(group=>`<div class="zm-group" data-group="${escapeHTML(group.id)}"><label>Display name<input name="group-name" value="${escapeHTML(group.name)}"></label><label>Existing Zone Scene token<select name="group-token">${this.tokenOptions(group.tokenId)}</select></label><div class="zm-actor"><input type="hidden" name="group-actor" value="${escapeHTML(group.actorUuid||'')}"><span data-actor-link>Drop an optional Actor here</span><button type="button" data-clear-actor>Clear Actor</button></div><button type="button" data-remove-group>Remove group from tracking</button></div>`).join('')}<button type="button" data-add-group>Add expedition group</button></fieldset>
      <p>Token centers determine sectors. Off-map or missing tokens retain last-known coordinates. Tracking never explores sectors, consumes resources, advances time, or triggers events.</p>
      <div class="zm-buttons"><button type="button" data-save-zone>Save Zone configuration</button><button type="button" data-disconnect-zone>Disconnect Zone map</button><button type="button" data-cancel-zone>Cancel</button></div>`;
      for(const group of root.querySelectorAll('[data-group]'))await this.renderActor(group);
      return root;
    }
    _replaceHTML(result,content){content.replaceChildren(result);}
    readForm(){
      const root=this.element, grid=this.draft.grid, scale=this.unit==='cells'?sceneCellSize(this.scene):{width:1,height:1};
      for(const key of ['originX','originY','width','height','columns','rows','columnDirection','rowDirection'])grid[key]=Number(root.querySelector(`[name="${key}"]`).value)*(key==='width'?scale.width||1:key==='height'?scale.height||1:1);
      if(this.scene)this.draft.calibration={sceneWidth:this.scene.width,sceneHeight:this.scene.height,cellWidth:sceneCellSize(this.scene).width,cellHeight:sceneCellSize(this.scene).height};
      grid.reference=root.querySelector('[name="reference"]').value;grid.columnAxis=root.querySelector('[name="columnAxis"]').value;
      for(const key of ['enabled','boundaries','labels','status'])this.draft.overlay[key]=root.querySelector(`[name="overlay.${key}"]`).checked;
      const tokenId=root.querySelector('[name="ark"]').value;
      this.draft.ark=tokenId?this.assignToken(this.draft.ark,tokenId):null;
      for(const row of root.querySelectorAll('[data-group]')){
        const index=this.draft.groups.findIndex(group=>group.id===row.dataset.group);
        const old=this.draft.groups[index],tokenId=row.querySelector('[name="group-token"]').value;
        this.draft.groups[index]={...this.assignToken(old,tokenId),id:old.id,name:row.querySelector('[name="group-name"]').value.trim()||'Expedition group',actorUuid:row.querySelector('[name="group-actor"]').value};
      }
    }
    assignToken(old,tokenId){return old?.tokenId===tokenId&&old?.sceneId===this.draft.sceneId?{...old}:{sceneId:this.draft.sceneId,tokenId,lastKnown:null};}
    async renderActor(row){
      const uuid=row.querySelector('[name="group-actor"]').value,target=row.querySelector('[data-actor-link]');
      if(!uuid){target.textContent='Drop an optional Actor here';return;}
      try{
        if(!/^[A-Za-z0-9_.-]+$/.test(uuid))throw new Error('Invalid UUID');
        const doc=await fromUuid(uuid);
        if(!doc||doc.documentName!=='Actor')throw new Error('Actor missing');
        const html=await foundry.applications.ux.TextEditor.implementation.enrichHTML(`@UUID[${uuid}]`,{documents:true,links:false,rolls:false,embeds:false,custom:false});
        if(row.querySelector('[name="group-actor"]').value!==uuid)return;
        target.innerHTML=html;
        const link=target.querySelector('a.content-link');
        if(link){link.tabIndex=0;link.addEventListener('click',async event=>{event.preventDefault();event.stopPropagation();try{const current=await fromUuid(uuid);if(!current)throw new Error('Actor no longer exists.');await current._onClickDocumentLink(event);}catch(error){ui.notifications.warn(error.message);}});link.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();link.click();}});}
      }catch{if(row.querySelector('[name="group-actor"]').value===uuid)target.textContent=`Actor unavailable (${uuid})`;}
    }
    async _onRender(context,options){
      await super._onRender(context,options);
      const root=this.element;
      const run=handler=>async event=>{try{await handler(event);}catch(error){ui.notifications.error(`Zone Map: ${error.message}`);}};
      root.querySelector('[name="sceneId"]').addEventListener('change',run(async event=>{
        const next=event.target.value;
        if(next===this.draft.sceneId)return;
        this.readForm();this.draft.sceneId=next;this.draft.ark=null;this.draft.groups=[];await this.render();
      }));
      root.querySelector('[name="unit"]').addEventListener('change',event=>{this.readForm();this.unit=event.target.value;this.render();});
      root.querySelector('[data-view-scene]').addEventListener('click',run(async()=>{if(!this.scene)throw new Error('Choose an available Scene first.');await this.scene.view();}));
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
          const data=foundry.applications.ux.TextEditor.implementation.getDragEventData(event),actor=await fromUuid(data.uuid);
          if(actor?.documentName!=='Actor')throw new Error('Drop an Actor document.');
          if(!this.element.contains(row))return;
          row.querySelector('[name="group-actor"]').value=actor.uuid;await this.renderActor(row);
        }));
      }
      root.querySelector('[data-cancel-zone]').addEventListener('click',()=>this.close());
      root.querySelector('[data-save-zone]').addEventListener('click',run(async()=>{
        this.readForm();
        const old=this.runtime.store.config.sceneId;
        if(old&&old!==this.draft.sceneId&&!await foundry.applications.api.DialogV2.confirm({window:{title:'Replace Zone Scene?'},content:'The previous Ark and expedition assignments will be removed. Existing sector Journals are preserved. Continue?'}))return;
        await this.runtime.store.save(this.draft);await this.close();
      }));
      root.querySelector('[data-disconnect-zone]').addEventListener('click',run(async()=>{
        if(!await foundry.applications.api.DialogV2.confirm({window:{title:'Disconnect Zone map?'},content:'Remove map and token assignments? Existing sector Journals are preserved.'}))return;
        await this.runtime.store.save({...this.runtime.store.config,sceneId:'',grid:null,ark:null,groups:[]});await this.close();
      }));
    }
    async _onClose(options){this.runtime.overlay.cancelPick?.();await super._onClose(options);}
  };
}
