import {MODULE,REFERENCE_SETTING,REFERENCE_DEFINITIONS,emptyReferenceConfiguration,referenceConfiguration,referenceSelection,validateReference,validateAllReferences,saveReferenceConfiguration,exportReferenceConfiguration,importReferenceConfiguration,ensureReferenceMigration} from './document-references.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const statuses=rows=>Object.entries(rows.reduce((counts,row)=>({...counts,[row.status]:(counts[row.status]||0)+1}),{})).map(([status,count])=>`${count} ${status}`).join(' · ');
export function createDocumentReferencesClass(ApplicationV2,env=globalThis){
 return class DocumentReferences extends ApplicationV2 {
  static DEFAULT_OPTIONS={id:'myz-document-references',window:{title:'MYZ Sector Manager — Document References',resizable:true},position:{width:860,height:760},classes:['myz-document-references']};
  constructor(...args){super(...args);this.draft=structuredClone(referenceConfiguration(env));this.baseline=JSON.stringify(referenceConfiguration(env));this.dirty=false;this.query='';this.results=new Map();this.expanded=new Set(REFERENCE_DEFINITIONS.map(def=>def.category));}
  get isGM(){return Boolean(env.game.user.isGM);}
  markDirty(){this.dirty=true;const label=this.element?.querySelector('[data-unsaved]');if(label)label.textContent='Unsaved changes';}
  async _renderHTML(){
   if(!this.isGM)throw new Error('GM access only.');
   const root=env.document.createElement('div');root.className='dr-root';
   const checked=await validateAllReferences(env,this.draft);this.results=new Map(checked.map(row=>[row.key,row]));
   const migration=this.draft.migration||{version:0,outcomes:[]},review=(migration.outcomes||[]).filter(row=>!['Migrated','Preserved override'].includes(row.status));
   root.innerHTML=`<style>
    .myz-document-references .window-content{min-height:0;overflow:auto}.dr-root{min-width:0}.dr-root *{box-sizing:border-box}.dr-root input,.dr-root select{min-width:0;max-width:100%}.dr-root button{width:auto;height:auto;white-space:normal}.dr-toolbar,.dr-controls{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.dr-root details{border:1px solid #888;padding:8px;margin:8px 0}.dr-root summary{cursor:pointer;font-weight:bold;text-align:left}.dr-row{border-top:1px solid #888;padding:12px 0;overflow-wrap:anywhere}.dr-row input{width:100%}.dr-row label{display:block}.dr-root [hidden]{display:none!important}.dr-status{padding:5px 0}.dr-health{padding:8px;border:1px solid #888}.dr-root small{display:block}.dr-root textarea{width:100%;min-height:120px}.dr-preview{white-space:pre-wrap;overflow-wrap:anywhere;max-height:40vh;overflow:auto}
   </style><p>World-scoped resources. No bundled defaults are currently included. Assign your own world or compendium RollTables; sector-specific references stay in sector records.</p>
   <div class="dr-health" aria-live="polite"><strong>Document Reference Health</strong><p data-health>${escape(statuses(checked))}</p></div>
   <p>Migration version ${Number(migration.version)||0}: ${review.length} unresolved/review candidates. Unverified legacy IDs are not activated automatically.</p>
   <button type="button" data-dr="retry-migration" ${migration.version>=1?'hidden':''}>Retry initial migration</button>
   <label>Search by label, category, UUID or document name<input type="search" data-search value="${escape(this.query)}"></label>
   <div class="dr-toolbar"><button type="button" data-dr="validate-all">Validate All</button><button type="button" data-dr="reset-all">Reset All to Defaults</button><button type="button" data-dr="export">Export Configuration</button><button type="button" data-dr="import">Import Configuration</button><button type="button" data-dr="diagnostics">Copy Diagnostics</button></div>
   <input type="file" accept="application/json,.json" data-import-file hidden>
   ${[...new Set(REFERENCE_DEFINITIONS.map(def=>def.category))].map(category=>`<details data-category="${escape(category)}" ${this.expanded.has(category)?'open':''}><summary>${escape(category)}</summary>${REFERENCE_DEFINITIONS.filter(def=>def.category===category).map(def=>this.row(def)).join('')}</details>`).join('')}
   <p data-unsaved role="status">${this.dirty?'Unsaved changes':'Changes saved'}</p><p>Default means use a bundled default, if available. Disabled explicitly prevents fallback. Manual edits and imports are saved only with Save.</p><div class="dr-controls"><button type="button" data-dr="save">Save</button><button type="button" data-dr="cancel">Cancel</button></div>`;
   return root;
  }
  row(def){
   const selection=referenceSelection(def.key,env,this.draft),result=this.results.get(def.key),candidate=this.draft.migration?.outcomes?.find(row=>row.key===def.key&&row.uuid&&!['Migrated','Preserved override'].includes(row.status));
   return `<section class="dr-row" data-key="${escape(def.key)}"><strong>${escape(def.label)}</strong> · ${def.documentType} · ${def.required?'Required':'Optional'}<small>${escape(def.description)}</small><small>Bundled default: ${def.defaultUuid?escape(def.defaultUuid):'Unavailable'}</small>
    <label>Reference mode<select data-mode>${[['default','Use bundled default'],['custom','World override'],['disabled','Disabled (no fallback)']].map(([value,label])=>`<option value="${value}" ${selection.mode===value?'selected':''}>${label}</option>`).join('')}</select></label>
    <label>Full UUID (or drop a RollTable)<input data-uuid value="${escape(selection.uuid||'')}" aria-label="${escape(def.label)} UUID"></label>
    <div class="dr-status" role="status" data-status>${escape(this.resultLabel(result))}</div>
    ${this.draft.references[def.key]?.name?`<small>Original document name: ${escape(this.draft.references[def.key].name)}</small>`:''}
    ${candidate?`<small>Legacy candidate: ${escape(candidate.uuid)} · ${escape(candidate.name||'Unknown name')} · ${escape(candidate.status)}. Verify its identity before assigning.</small><button type="button" data-dr="legacy">Review/assign legacy candidate</button>`:''}
    <div class="dr-controls"><button type="button" data-dr="open">Open document</button><button type="button" data-dr="disable">Clear / Disable</button><button type="button" data-dr="restore">Restore Default</button><button type="button" data-dr="validate">Validate</button></div></section>`;
  }
  resultLabel(result){return `${result.status}${result.name?` · ${result.name}`:''}${result.error?` · ${result.error}`:''}`;}
  _replaceHTML(result,content){content.replaceChildren(result);}
  async _onRender(context,options){
   await super._onRender(context,options);const root=this.element;
   root.querySelector('[data-search]').addEventListener('input',event=>{this.query=event.target.value;this.filter();});
   root.querySelectorAll('[data-category]').forEach(details=>details.addEventListener('toggle',()=>{if(details.open)this.expanded.add(details.dataset.category);else this.expanded.delete(details.dataset.category);}));
   root.querySelectorAll('[data-key]').forEach(row=>{
    const key=row.dataset.key;
    row.querySelector('[data-uuid]').addEventListener('input',event=>{const uuid=event.target.value.trim();this.draft.references[key]=uuid?{mode:'custom',uuid}:{mode:'disabled'};row.querySelector('[data-mode]').value=uuid?'custom':'disabled';this.markDirty();this.results.delete(key);row.querySelector('[data-status]').textContent='Not validated';this.refreshHealth();});
    row.querySelector('[data-uuid]').addEventListener('change',()=>this.check(key));
    row.querySelector('[data-mode]').addEventListener('change',event=>{const mode=event.target.value;this.draft.references[key]=mode==='custom'?{mode,uuid:row.querySelector('[data-uuid]').value.trim()}:{mode};this.markDirty();void this.render();});
    row.addEventListener('dragover',event=>{event.preventDefault();event.dataTransfer.dropEffect='copy';});
    row.addEventListener('drop',event=>{event.preventDefault();event.stopPropagation();void this.drop(event,key);});
   });
   root.querySelectorAll('[data-dr]').forEach(button=>button.addEventListener('click',()=>{void this.action(button.dataset.dr,button.closest('[data-key]')?.dataset.key).catch(error=>this.error(error));}));
   root.querySelector('[data-import-file]').addEventListener('change',event=>{const file=event.target.files?.[0];if(file)void this.importFile(file).catch(error=>this.error(error));event.target.value='';});
   this.filter();
  }
  filter(){const query=this.query.trim().toLowerCase();for(const row of this.element.querySelectorAll('[data-key]')){const def=REFERENCE_DEFINITIONS.find(def=>def.key===row.dataset.key),result=this.results.get(def.key);row.hidden=![def.label,def.category,referenceSelection(def.key,env,this.draft).uuid,result?.name,this.draft.references[def.key]?.name].join(' ').toLowerCase().includes(query);}for(const group of this.element.querySelectorAll('[data-category]'))group.hidden=!Array.from(group.querySelectorAll('[data-key]')).some(row=>!row.hidden);}
  refreshHealth(){this.element.querySelector('[data-health]').textContent=statuses([...this.results.values()])+` · ${REFERENCE_DEFINITIONS.length-this.results.size} Not validated`;}
  async check(key){
   const signature=JSON.stringify(this.draft.references[key]),result=await validateReference(key,env,this.draft);
   if(signature!==JSON.stringify(this.draft.references[key])||!this.rendered)return result;
   this.results.set(key,result);const row=Array.from(this.element.querySelectorAll('[data-key]')).find(row=>row.dataset.key===key);if(row)row.querySelector('[data-status]').textContent=this.resultLabel(result);this.refreshHealth();this.filter();return result;
  }
  async drop(event,key){
   try{
    if(!this.isGM)throw new Error('GM access only.');
    const payload=env.foundry.applications.ux.TextEditor.implementation.getDragEventData(event);if(!payload.uuid)throw new Error('Drop a Foundry document with a UUID.');
    const before=JSON.stringify(this.draft),candidate={...this.draft,references:{...this.draft.references,[key]:{mode:'custom',uuid:payload.uuid}}};
    const result=await validateReference(key,env,candidate);if(!result.document)throw new Error(this.resultLabel(result));
    if(before!==JSON.stringify(this.draft)||!this.rendered)throw new Error('Configuration changed during drop; try again.');
    this.draft.references[key]={mode:'custom',uuid:result.document.uuid||payload.uuid};this.markDirty();await this.render();
   }catch(error){this.error(error);}
  }
  error(error){env.ui.notifications.error(`Document References: ${error.message}`);}
  async confirm(title,content){return env.foundry.applications.api.DialogV2.confirm({window:{title},content});}
  async importFile(file){
   if(file.size>200000)throw new Error('Import file exceeds 200 KB.');
   const choice=await env.foundry.applications.api.DialogV2.wait({window:{title:'Import Document References'},content:'<p>Merge replaces only imported keys. Replace resets all omitted keys to bundled defaults. Both change this draft only; use Save to persist.</p><select name="importMode"><option value="merge">Merge</option><option value="replace">Replace</option></select>',buttons:[{action:'cancel',label:'Cancel',callback:()=>null},{action:'preview',label:'Preview',callback:(e,b,dialog)=>dialog.element.querySelector('[name="importMode"]').value}],close:()=>null,rejectClose:false});
   if(!choice)return;
   const before=JSON.stringify(this.draft),next=importReferenceConfiguration(await file.text(),this.draft,choice),results=await validateAllReferences(env,next);
   const changed=REFERENCE_DEFINITIONS.filter(def=>JSON.stringify(this.draft.references[def.key])!==JSON.stringify(next.references[def.key]));
   const report=changed.map(def=>{const row=results.find(row=>row.key===def.key);return `${def.label}: ${row.mode} · ${row.uuid||'No UUID'} · ${next.references[def.key]?.name||row.name||'Unknown name'} · ${row.status}${row.error?' — '+row.error:''}`;}).join('\n');
   if(!await this.confirm('Apply import to draft?',`<p>${changed.length} reference changes. Missing references retain their original UUID/name for replacement; unavailable defaults are not substituted.</p><pre class="dr-preview">${escape(report||'No changes')}</pre>`))return;
   if(before!==JSON.stringify(this.draft)||!this.rendered)throw new Error('Configuration changed during import; try again.');
   this.draft=next;this.markDirty();await this.render();
  }
  async action(action,key){
   if(!this.isGM)throw new Error('GM access only.');
   if(action==='save'){this.draft=await saveReferenceConfiguration(this.draft,env,this.baseline);this.baseline=JSON.stringify(this.draft);this.dirty=false;await this.close();}
   else if(action==='cancel')await this.close();
   else if(action==='disable'||action==='restore'){this.draft.references[key]={mode:action==='disable'?'disabled':'default'};this.markDirty();await this.render();}
   else if(action==='validate')await this.check(key);
   else if(action==='validate-all'){const signature=JSON.stringify(this.draft),results=await validateAllReferences(env,this.draft);if(signature!==JSON.stringify(this.draft))throw new Error('Draft changed during validation; retry.');this.results=new Map(results.map(row=>[row.key,row]));for(const row of this.element.querySelectorAll('[data-key]'))row.querySelector('[data-status]').textContent=this.resultLabel(this.results.get(row.dataset.key));this.refreshHealth();this.filter();}
   else if(action==='open'){const result=await validateReference(key,env,this.draft);if(!result.document)throw new Error(this.resultLabel(result));await result.document.sheet.render(true);}
   else if(action==='reset-all'){if(await this.confirm('Reset all references to defaults?','Only this draft changes. No bundled resources are currently supplied; generation will require assignment again. Sector data is retained.')){this.draft.references={};this.markDirty();await this.render();}}
   else if(action==='legacy'){const candidate=this.draft.migration?.outcomes?.find(row=>row.key===key);if(!candidate)throw new Error('No legacy candidate.');if(await this.confirm('Assign legacy candidate? ',`<p>Verify ${escape(candidate.name||'unknown document')} (${escape(candidate.uuid)}) is the correct resource. This is an explicit world override in this draft.</p>`)){const next={...this.draft,references:{...this.draft.references,[key]:{mode:'custom',uuid:candidate.uuid}}};const before=JSON.stringify(this.draft),result=await validateReference(key,env,next);if(!result.document)throw new Error(this.resultLabel(result));if(before!==JSON.stringify(this.draft)||!this.rendered)throw new Error('Draft changed during legacy validation; retry.');this.draft=next;this.markDirty();await this.render();}}
   else if(action==='retry-migration'){if(this.dirty)throw new Error('Save or discard edits before retrying migration.');await ensureReferenceMigration(env);this.draft=structuredClone(referenceConfiguration(env));this.baseline=JSON.stringify(this.draft);await this.render();}
   else if(action==='export'){const data=JSON.stringify(exportReferenceConfiguration(this.draft,env),null,2);const url=env.URL.createObjectURL(new env.Blob([data],{type:'application/json'}));const link=env.document.createElement('a');link.href=url;link.download='myz-sector-manager-document-references.json';link.click();env.setTimeout(()=>env.URL.revokeObjectURL(url),1000);}
   else if(action==='import')this.element.querySelector('[data-import-file]').click();
   else if(action==='diagnostics'){const rows=await validateAllReferences(env,this.draft);const data=JSON.stringify({module:MODULE,moduleVersion:env.game.modules?.get(MODULE)?.version||'unknown',foundryVersion:env.game.version||'unknown',formatVersion:1,migrationVersion:this.draft.migration?.version||0,references:rows.map(({key,status,error,uuid})=>({key,status,error,uuid}))},null,2);try{await env.navigator.clipboard.writeText(data);env.ui.notifications.info('Document References diagnostics copied.');}catch{await this.confirm('Copy Document References diagnostics',`<p>Clipboard unavailable. Select and copy this text.</p><textarea readonly>${escape(data)}</textarea>`);}}
  }
  async close(options={}){if(this.dirty&&!await this.confirm('Discard unsaved Document References changes?','Close without saving this draft?'))return this;this.dirty=false;return super.close(options);}
 };
}
export function registerDocumentReferences(env=globalThis){
 env.game.settings.register(MODULE,REFERENCE_SETTING,{scope:'world',config:false,type:Object,default:emptyReferenceConfiguration(),restricted:true});
 const type=createDocumentReferencesClass(env.foundry.applications.api.ApplicationV2,env);
 env.game.settings.registerMenu(MODULE,'documentReferencesMenu',{name:'Document References',label:'Configure Document References',hint:'Configure and validate generation RollTables, migrate legacy mappings, and import/export world configuration.',icon:'fas fa-book',type,restricted:true});
 return type;
}
