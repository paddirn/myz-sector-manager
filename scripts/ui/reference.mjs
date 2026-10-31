import {escapeEntryText as esc} from './entry.mjs';
import {openDocument,requireDocument} from './documents.mjs';
export const documentLabel=types=>types.replaceAll('|',' or ').replaceAll('JournalEntryPage','Journal Entry Page').replaceAll('JournalEntry','Journal Entry');
export function referenceField({name,uuid='',types='',label='Reference'}){
 return `<div class="sm-reference" data-reference data-type="${esc(types)}" data-reference-state="${uuid?'resolving':'empty'}"><input type="hidden" name="${esc(name)}" value="${esc(uuid)}"><span class="sm-reference-label">${esc(label)}${types?` · Drop ${esc(documentLabel(types))}`:' · Drop a document'}</span><div class="sm-reference-row"><span data-reference-link role="status">${uuid?'Loading reference…':'Drop a document here'}</span><button type="button" data-reference-attach title="Attach or replace reference" aria-label="Attach or replace reference"><i class="fa-solid fa-link" aria-hidden="true"></i></button><button type="button" data-reference-clear title="Remove reference" aria-label="Remove reference" ${uuid?'':'disabled'}><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div></div>`;
}
export function referenceState(target,state,{uuid='',types=''}={}){
 if(!target)return;target.dataset.referenceState=state;target.setAttribute('aria-busy',String(state==='resolving'));target.classList.toggle('sm-reference-missing',!['empty','valid','resolving'].includes(state));
 const prefix={empty:'Drop a document here',resolving:'Loading reference…',missing:'Missing reference',inaccessible:'Reference inaccessible',invalid:'Invalid reference',unavailable:'Reference unavailable'}[state];
 if(prefix)target.textContent=['empty','resolving'].includes(state)?prefix:`${prefix}${types?` · ${documentLabel(types)}`:''} (${uuid}). Saved reference retained; replace or clear it.`;
}
const icons={Actor:'fa-user',Item:'fa-suitcase',JournalEntry:'fa-book-open',JournalEntryPage:'fa-file-lines',Scene:'fa-map',Macro:'fa-code'};
export function documentLink(doc,{env=globalThis,onOpen,current=()=>true}={}){
 const link=env.document.createElement('a');link.className='content-link';link.dataset.uuid=doc.uuid;link.tabIndex=0;link.setAttribute('role','link');link.draggable=true;
 const icon=env.document.createElement('i');icon.className=`fa-solid ${icons[doc.documentName]||'fa-file'}`;icon.setAttribute('aria-hidden','true');link.append(icon,env.document.createTextNode(doc.name||doc.documentName||'Document'));
 const open=event=>{event.preventDefault();event.stopPropagation();if(!current())return;Promise.resolve().then(()=>onOpen?onOpen(event):requireDocument(doc.uuid,doc.documentName,env).then(doc=>current()?openDocument(doc,event,env):undefined)).catch(()=>env.ui?.notifications?.error('Reference could not be opened. Check access or replace it.'));};
 link.addEventListener('click',open);link.addEventListener('keydown',event=>{if(event.key==='Enter')open(event);});link.addEventListener('dragstart',event=>{event.stopPropagation();if(current())event.dataTransfer?.setData('text/plain',JSON.stringify({type:doc.documentName,uuid:doc.uuid}));});return link;
}
export async function promptReference(uuid,types,env=globalThis){
 return env.foundry.applications.api.DialogV2.wait({window:{title:'Attach or Replace Reference'},position:{width:420},content:`<p>Choose ${esc(documentLabel(types)||'a document')}. Paste a Foundry document UUID, or Cancel and drag it onto the reference field.</p><label>Document UUID<input name="referenceUuid" type="text" value="${esc(uuid)}"></label>`,buttons:[{action:'cancel',label:'Cancel',default:true,callback:()=>null},{action:'attach',label:'Attach',callback:(event,button,dialog)=>dialog.element.querySelector('[name="referenceUuid"]').value.trim()}],close:()=>null,rejectClose:false});
}
export function bindReferenceUpdates(host,env=globalThis){
 if(host.referenceHooks)return;
 const refresh=(doc,name)=>{if(!host.rendered||!env.game.user.isGM||host.referenceClosed)return;for(const zone of host.element?.querySelectorAll('[data-reference]')||[]){const uuid=zone.querySelector('input')?.value;if(doc.uuid===null||uuid===doc.uuid||doc.documentName==='JournalEntry'&&uuid?.startsWith(doc.uuid+'.'))void host.renderReference(zone);}void host.refreshReferenceSections?.(doc,name);};
 host.referenceHooks=[];for(const type of ['Actor','Item','JournalEntry','JournalEntryPage','Scene','Macro'])for(const action of ['create','update','delete']){const name=action+type,id=env.Hooks?.on(name,doc=>refresh(doc,name));host.referenceHooks.push([name,id]);}
 const id=env.Hooks?.on('updateUser',()=>refresh({uuid:null}));host.referenceHooks.push(['updateUser',id]);
}
export function unbindReferenceUpdates(host,env=globalThis){for(const [name,id] of host.referenceHooks||[])env.Hooks?.off?.(name,id);host.referenceHooks=null;}
