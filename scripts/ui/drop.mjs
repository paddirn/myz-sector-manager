import {parseDocumentDrop,requireDocument,currentReferenceNode} from './documents.mjs';
const messages={idle:'',candidate:'Drop a document to validate it',valid:'Valid document drop',invalid:'This document is not accepted here',pending:'Attaching document…',completed:'Document drop completed',failed:'Drop failed; saved data retained'};
export function dropState(node,state){if(!node?.dataset)return;node.dataset.dropState=state;node.setAttribute?.('aria-description',messages[state]||'');node.setAttribute?.('aria-busy',String(state==='pending'));}
export function beginDrop(host,node){
 if(host.referenceClosed||!node?.dataset)return ()=>{};
 const draft=host.draft,sector=host.sectorId,tab=host.tab;dropState(node,'pending');
 const field=node?.matches?.('[data-reference]')?node.querySelector('input')?.name:null,member=node?.dataset?.factionDrop,group=node?.dataset?.shopGroup;
 return state=>{if(host.referenceClosed||host.draft!==draft||host.sectorId!==sector||host.tab!==tab)return;let target=node;if(!node?.isConnected&&host.element?.querySelectorAll){const selector=field?'[data-reference]':member?'[data-faction-drop]':group?'[data-shop-group]':'.sm-content';target=Array.from(host.element.querySelectorAll(selector)).find(el=>field?el.querySelector('input')?.name===field:member?el.dataset.factionDrop===member:group?el.dataset.shopGroup===group:true);}dropState(target,state);};
}
export function dropTarget(event,host){
 const nested=event.target?.closest?.('[data-reference],[data-faction-drop],[data-shop-group]');if(nested)return nested;
 const content=event.target?.closest?.('.sm-content');if(!content||event.target.closest('input,textarea,select,button,a,[data-entry]'))return null;
 if(host.tab==='Shop'||host.tab==='Projects'||['Encounters','Inhabitants','Gear & Artifacts','Images'].includes(host.tab))return content;return null;
}
export function dropTypes(host,node){
 if(node.matches('[data-reference]'))return node.dataset.type;
 if(node.matches('[data-faction-drop]'))return 'Actor';
 if(host.tab==='Shop'){const group=host.data.settlement.shop.groups.find(g=>g.id===node.dataset.shopGroup);return group?.type==='vehicles'?'Actor':group?'Item':'Item|Actor';}
 return {Projects:'Item',Encounters:'Actor',Inhabitants:'Actor','Gear & Artifacts':'Item',Images:'JournalEntryPage'}[host.tab]||'';
}
export function bindDropFeedback(host,env=globalThis){
 host.dropFeedbackCleanup?.();const root=host.element,tokens=new WeakMap();let generation=0;
 const over=event=>{const node=dropTarget(event,host);if(!node||!env.game.user.isGM)return;event.preventDefault();const token={generation};tokens.set(node,token);let payload;try{payload=parseDocumentDrop(event,env);}catch{dropState(node,'candidate');return;}const types=dropTypes(host,node);
  if(payload.type&&types&&!types.split('|').includes(payload.type)){dropState(node,'invalid');if(event.dataTransfer)event.dataTransfer.dropEffect='none';event.stopPropagation();return;}
  dropState(node,payload.type?'valid':'candidate');if(event.dataTransfer)event.dataTransfer.dropEffect='copy';
  if(payload.uuid)void requireDocument(payload.uuid,types,env).then(doc=>{if(tokens.get(node)!==token||token.generation!==generation||!currentReferenceNode(host,node))return;host.validateDropPreview?.(node,doc);dropState(node,'valid');},()=>{if(tokens.get(node)===token&&token.generation===generation&&currentReferenceNode(host,node))dropState(node,'invalid');}).catch(()=>{if(tokens.get(node)===token&&token.generation===generation&&currentReferenceNode(host,node))dropState(node,'invalid');});
 };
 const leave=event=>{const node=dropTarget(event,host);if(node&&!node.contains(event.relatedTarget)){tokens.delete(node);if(node.dataset.dropState!=='pending')dropState(node,'idle');}};
 const cancelHover=()=>{generation++;for(const node of root.querySelectorAll('.sm-drop-hover'))node.classList.remove('sm-drop-hover');for(const node of root.querySelectorAll('[data-drop-state]'))if(['valid','invalid','candidate'].includes(node.dataset.dropState))dropState(node,'idle');};
 const owner=root.ownerDocument;owner?.addEventListener('dragend',cancelHover,true);root.addEventListener('drop',cancelHover,true);
 root.addEventListener('dragover',over,true);root.addEventListener('dragleave',leave,true);host.dropFeedbackCleanup=()=>{owner?.removeEventListener('dragend',cancelHover,true);root.removeEventListener('drop',cancelHover,true);root.removeEventListener('dragover',over,true);root.removeEventListener('dragleave',leave,true);};
}
