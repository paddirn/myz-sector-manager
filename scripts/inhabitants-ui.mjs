import {beginDrop,dropTarget} from './ui/drop.mjs';
import {requireDocument,parseDocumentDrop} from './ui/documents.mjs';
import {sortEditorEntries} from './entry-order.mjs';
import {inhabitantCollection,requireInhabitantActor,importInhabitant,safeNarrative} from './inhabitants.mjs';
import {sectorCollection} from './sector-types.mjs';
export async function selectInhabitant(host,key,entry,env=globalThis){
  const {ui}=env;
  const state=host.entryState(key),record=state.entries.find(record=>record.item===entry);if(!record)return;state.collapsed.delete(record.id);await host.render();const card=host.element.querySelector(`[data-entry="${record.id}"]`);host.scrollKeeper?.releaseFor(card);card?.scrollIntoView?.({block:'nearest'});card?.querySelector('[data-entry-toggle]')?.focus?.({preventScroll:true});ui.notifications.info('This Actor is already an Inhabitant here; selected the existing entry.');
}
export function hydrateInhabitants(host,root,env=globalThis){
  const key=inhabitantCollection(host.data,host.tab);if(!key)return;
  for(const target of root.querySelectorAll('[data-inhabitant-preview]')){
    const card=target.closest('[data-entry]'),control=card.querySelector('textarea[name$=".details"]'),entry=sectorCollection(host.data,key)[Number(control.name.split('.').at(-2))];
    const update=()=>{target.hidden=entry?.detailsFormat!=='html';if(!target.hidden)target.innerHTML=safeNarrative(control.value,env);};update();control.addEventListener('input',update);
  }
  host.portraits?.hydrate(root);
}
// Called only on an explicit Actor drop, never during render/reference resolution.
export async function linkInhabitant(host,zone,doc,env=globalThis,current=()=>true){
  const key=inhabitantCollection(host.data,host.tab);if(!key||doc.documentName!=='Actor')return true;
  host.capture();const input=zone.querySelector('input'),entry=host.referenceEntry(zone);if(!entry)return true;
  const duplicate=sectorCollection(host.data,key).find(item=>item!==entry&&item.uuid===doc.uuid);if(duplicate&&entry.uuid!==doc.uuid){await selectInhabitant(host,key,duplicate,env);return false;}
  const draft=host.draft,signature=JSON.stringify(draft),next=await importInhabitant(entry,doc,env);
  if(!current()||host.referenceClosed||host.draft!==draft||JSON.stringify(draft)!==signature||!host.element.contains(zone))throw new Error('Sector edits changed while importing Actor Info. Drop again.');
  Object.assign(entry,next);input.value=doc.uuid;
  const card=zone.closest('[data-entry]');for(const name of ['title','details','portrait']){const control=card?.querySelector(`[name$=".${name}"]`);if(control)control.value=entry[name]||'';}
  const title=card?.querySelector('[data-entry-title]');if(title)title.textContent=entry.title||'Inhabitant';hydrateInhabitants(host,host.element,env);sortEditorEntries(host);return true;
}
export async function dropInhabitant(host,event,key=inhabitantCollection(host.data,host.tab),env=globalThis){
  const {game,foundry,ui}=env;
  if(!game.user.isGM||!key||host.droppingInhabitant)return;
  host.handledActorDrops??=new WeakSet();if(host.handledActorDrops.has(event))return;host.handledActorDrops.add(event);host.droppingInhabitant=true;const finish=beginDrop(host,dropTarget(event,host));
  try{
    const journal=host.journal,saved=journal?.getFlag('myz-sector-manager','sector');if(!journal?.id||journal.isTemporary||saved?.initialSavePending)throw new Error('Save this sector before dropping Actors to create Inhabitants.');
    host.capture();const draft=host.draft,id=host.sectorId,signature=JSON.stringify(draft),wasDirty=host.dirty,baseline=JSON.stringify(sectorCollection(saved,key));
    const payload=parseDocumentDrop(event,env),doc=requireInhabitantActor(payload.uuid?await requireDocument(payload.uuid,'',env):null);
    const next=await importInhabitant({id:foundry.utils.randomID(),title:'',details:'',...(key==='encounters'?{status:'Active',type:'Encounter'}:{})},doc,env);
    if(host.referenceClosed||host.draft!==draft||host.sectorId!==id||host.rendered===false||JSON.stringify(draft)!==signature)throw new Error('Sector selection or edits changed. Nothing was added; drop again.');
    const duplicate=sectorCollection(draft,key).find(entry=>entry.uuid===doc.uuid);if(duplicate){await selectInhabitant(host,key,duplicate,env);finish('completed');return;}
    sectorCollection(draft,key).push(next);host.entryState(key);host.markDirty();const after=JSON.stringify(draft);await host.persistInhabitants(key,journal,baseline);
    if(host.draft===draft&&host.sectorId===id){if(JSON.stringify(draft)===after)host.dirty=wasDirty;await host.render();}
    finish('completed');
  }catch(error){finish('failed');ui.notifications.error(`Inhabitants: ${error.message}`);}finally{host.droppingInhabitant=false;}
}
export function bindInhabitantDrops(host){
  const key=inhabitantCollection(host.data,host.tab);if(!key)return;const content=host.element.querySelector('.sm-content');
  const blank=event=>!event.target.closest('[data-entry],input,textarea,select,button,a');
  content.addEventListener('dragover',event=>{if(blank(event)){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';content.classList.add('sm-drop-hover');}});
  content.addEventListener('dragleave',event=>{if(!content.contains(event.relatedTarget))content.classList.remove('sm-drop-hover');});
  content.addEventListener('drop',event=>{content.classList.remove('sm-drop-hover');if(!blank(event))return;event.preventDefault();event.stopPropagation();void dropInhabitant(host,event,key);});
}
