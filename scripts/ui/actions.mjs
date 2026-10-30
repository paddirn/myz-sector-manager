import {escapeEntryText as esc} from './entry.mjs';
const labels={locations:'Location',encounters:'Inhabitant',loot:'Item',effects:'Effect',history:'Entry','special.locations':'Location','special.inhabitants':'Inhabitant','special.gear':'Item','special.events':'Event','special.images':'Image','settlement.projects':'Project','settlement.inhabitants':'Inhabitant','settlement.factions':'Faction','settlement.events':'Event','settlement.threads':'Thread','settlement.shop':'Shop Item'};
export const entryLabel=key=>labels[key]||'Entry';
export function bulkControls({scope='entries',expand='data-expand-all',collapse='data-collapse-all'}={}){
 return `<button type="button" class="sm-collection-action" ${expand} title="Expand all ${esc(scope)}">Expand All</button><button type="button" class="sm-collection-action" ${collapse} title="Collapse all ${esc(scope)}">Collapse All</button>`;
}
export function collectionActions({key,count=0,disabled=false,history=false}){
 return `<div class="sm-entry-controls" role="group" aria-label="${esc(entryLabel(key))} collection controls">${count>1?bulkControls():''}<button type="button" class="sm-collection-action" data-action="add" data-collection="${esc(key)}" ${disabled?'disabled':''}>+ Add ${esc(entryLabel(key))}</button>${history?`<button type="button" class="sm-collection-action" data-action="add-event" data-collection="history" ${disabled?'disabled':''}>+ Add Event</button>`:''}</div>`;
}
function focusReturn(host){const active=host.element?.ownerDocument?.activeElement;return ()=>{if(active?.isConnected)active.focus({preventScroll:true});};}
// Presentation and consent only: callers retain mutation, identity and persistence.
export async function confirmEntryRemoval(host,{kind='Entry',name='Untitled',valid=()=>true},env=globalThis){
 if(host.pendingRemoval||host.unsavedPrompt||host.busy)return false;host.pendingRemoval=true;const restore=focusReturn(host);
 try{return Boolean(await env.foundry.applications.api.DialogV2.confirm({window:{title:`Remove ${kind}?`},content:`<p>Remove <strong>${esc(name)}</strong> from this sector’s ${esc(kind)} collection?</p><p>Referenced Foundry documents are not deleted. Existing save rules still apply.</p>`,yes:{label:'Remove'},no:{label:'Cancel'},defaultYes:false,rejectClose:false}))&&valid();}
 finally{host.pendingRemoval=false;restore();}
}
export async function unsavedChangesGuard(host,env=globalThis){
 if(host.unsavedPrompt||host.pendingRemoval||host.busy)return false;
 host.unsavedPrompt=true;const restore=focusReturn(host),draft=host.draft,id=host.sectorId;
 try{
  await Promise.allSettled([host.autosaveWrite,host.projectWrite]);
  if(host.draft!==draft||host.sectorId!==id)return false;
  if(!host.dirty)return true;
  const choice=await env.foundry.applications.api.DialogV2.wait({window:{title:'Unsaved Changes'},content:'<p>You have unsaved changes in this sector. What would you like to do?</p><p>Discard affects only the draft. Collection saves and native Ark Project writes already completed will remain.</p>',buttons:[{action:'save',label:'Save Changes',callback:()=> 'save'},{action:'discard',label:'Discard Changes',callback:()=> 'discard'},{action:'cancel',label:'Cancel',default:true,callback:()=> 'cancel'}],close:()=> 'cancel',rejectClose:false});
  if(host.draft!==draft||host.sectorId!==id)return false;
  if(choice==='discard')return true;
  if(choice==='save')return await host.action('save')===true&&!host.dirty;
  return false;
 }finally{host.unsavedPrompt=false;restore();}
}
