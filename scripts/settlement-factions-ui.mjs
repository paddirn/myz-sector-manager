import {emptyState} from './ui/presentation.mjs';
import {beginDrop,dropTarget} from './ui/drop.mjs';
import {requireDocument,currentReferenceNode,parseDocumentDrop} from './ui/documents.mjs';
import {documentLink,referenceState} from './ui/reference.mjs';
import {imagePreview} from './ui/images.mjs';
import {entryCard} from './ui/entry.mjs';
import {addFactionMember,resolveFactionActor} from './settlement-factions.mjs';
import {imagePath} from './sector-images.mjs';
import {escapeHTML as esc} from './travel/model.mjs';
const states=host=>{host.factionStates??=new Map();if(!host.factionStates.has(host.sectorId))host.factionStates.set(host.sectorId,new Set());return host.factionStates.get(host.sectorId);};
export function renderFaction(host,item,p,id,collapsed){
 const closed=states(host).has(item.id);
 return entryCard({id,collection:'settlement.factions',collapsed,cardAttributes:{'data-faction-id':item.id},titleControl:`<input class="sm-faction-name" aria-label="Faction name" name="${p}.title" value="${esc(item.title)}">`,removeLabel:'Remove faction',body:`<details data-faction-members="${esc(item.id)}" ${closed?'':'open'}><summary>Members</summary><div class="sm-faction-gallery" data-faction-drop="${esc(item.id)}" tabindex="0" aria-label="Drop Actor members here">${item.members.map(member=>`<figure class="sm-faction-member" data-faction-member="${esc(member.id)}"><a href="#" data-member-link="${esc(member.id)}"><span data-member-image role="img" aria-label="Missing Actor">?</span><span data-member-name>Missing Actor</span></a><button type="button" class="sm-entry-remove" data-member-remove="${esc(member.id)}" aria-label="Remove member">Remove</button></figure>`).join('')}${item.members.length?'<p class="sm-faction-drop-hint">Drop Actors here</p>':emptyState('No members added.','Drop Actor documents here.')}</div></details><section class="sm-faction-info"><label class="sm-field"><span>Faction Info</span><textarea name="${p}.info" rows="10">${esc(item.info)}</textarea></label></section>`});
}
export async function hydrateFactions(host,root,env=globalThis){
 const draft=host.draft,generation=host.factionRenderGeneration=(host.factionRenderGeneration||0)+1;
 await Promise.all(Array.from(root.querySelectorAll('[data-faction-id]'),async card=>{
  const faction=host.data.settlement.factions.find(f=>f.id===card.dataset.factionId);if(!faction)return;
  await Promise.all(faction.members.map(async member=>{
   const figure=Array.from(card.querySelectorAll('[data-faction-member]')).find(el=>el.dataset.factionMember===member.id);if(!figure)return;
   const uuid=member.uuid,current=()=>host.draft===draft&&member.uuid===uuid&&host.factionRenderGeneration===generation&&currentReferenceNode(host,figure);
   try{
    const actor=await requireDocument(uuid,'Actor',env);if(!current())return;
    figure.querySelector('[data-member-warning]')?.remove();const old=figure.querySelector('[data-member-link]'),name=figure.querySelector('[data-member-name]'),image=figure.querySelector('[data-member-image]');
    const link=documentLink(actor,{env,current});link.dataset.memberLink=member.id;name.textContent=actor.name;link.replaceChildren(image,name);old.replaceWith(link);
    imagePreview(image,imagePath(actor.img),actor.name,'No portrait',{env,current});
   }catch(error){if(!current())return;figure.title='Actor reference missing, inaccessible or invalid. Saved reference retained.';const link=figure.querySelector('[data-member-link]'),name=figure.querySelector('[data-member-name]'),image=figure.querySelector('[data-member-image]');if(name)name.textContent='Missing Actor';if(image)imagePreview(image,null,'Actor portrait','No portrait',{env,current});let warning=figure.querySelector('[data-member-warning]');if(!warning){warning=env.document.createElement('small');warning.dataset.memberWarning='';figure.append(warning);}referenceState(warning,error.state||'unavailable',{uuid,types:'Actor'});link.setAttribute('aria-disabled','true');link.addEventListener('click',event=>event.preventDefault());}

  }));
 }));
}
export function bindFactions(host,env=globalThis){
 const report=task=>Promise.resolve(task).catch(error=>env.ui.notifications.error(`Faction: ${error.message}`));
 for(const details of host.element.querySelectorAll('[data-faction-members]'))details.addEventListener('toggle',()=>{const state=states(host);if(details.open)state.delete(details.dataset.factionMembers);else state.add(details.dataset.factionMembers);});
 for(const card of host.element.querySelectorAll('[data-faction-id]')){
  const faction=()=>host.data.settlement.factions.find(f=>f.id===card.dataset.factionId),area=card.querySelector('[data-faction-drop]');
  for(const button of card.querySelectorAll('[data-member-remove]'))button.addEventListener('click',()=>report((async()=>{if(!env.game.user.isGM)return;host.capture();const item=faction(),member=item?.members.find(member=>member.id===button.dataset.memberRemove),draft=host.draft;if(!member)return;const name=button.closest('[data-faction-member]').querySelector('[data-member-name]').textContent||member.uuid;if(!await host.confirmEntryRemoval({kind:'Faction Member',name,valid:()=>host.draft===draft&&faction()===item&&item.members.includes(member)}))return;item.members=item.members.filter(record=>record!==member);host.markDirty();await host.render();Array.from(host.element.querySelectorAll('[data-faction-drop]')).find(el=>el.dataset.factionDrop===item.id)?.focus({preventScroll:true});})()));
  area.addEventListener('dragover',event=>{event.preventDefault();event.stopPropagation();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';});
  area.addEventListener('drop',event=>{event.preventDefault();event.stopPropagation();if(!env.game.user.isGM||host.droppingFaction)return;host.droppingFaction=true;const finish=beginDrop(host,area);void report((async()=>{
   try{host.capture();const draft=host.draft,item=faction(),signature=JSON.stringify(draft),payload=parseDocumentDrop(event,env),actor=await resolveFactionActor(payload,env);
    if(host.referenceClosed||host.draft!==draft||JSON.stringify(draft)!==signature||!host.rendered||!host.element.contains(area))throw new Error('Faction edits changed. Drop again.');
    const result=addFactionMember(item,actor);if(result.duplicate){env.ui.notifications.info('This Actor is already a member of this faction.');finish('completed');return;}host.markDirty();await host.render();finish('completed');
   }catch(error){finish('failed');throw error;}finally{host.droppingFaction=false;}
  })());});
 }
}
