import {entryCard} from './ui/entry.mjs';
import {addFactionMember,resolveFactionActor} from './settlement-factions.mjs';
import {imagePath} from './sector-images.mjs';
import {escapeHTML as esc} from './travel/model.mjs';
const states=host=>{host.factionStates??=new Map();if(!host.factionStates.has(host.sectorId))host.factionStates.set(host.sectorId,new Set());return host.factionStates.get(host.sectorId);};
export function renderFaction(host,item,p,id,collapsed){
 const closed=states(host).has(item.id);
 return entryCard({id,collection:'settlement.factions',collapsed,cardAttributes:{'data-faction-id':item.id},titleControl:`<input class="sm-faction-name" aria-label="Faction name" name="${p}.title" value="${esc(item.title)}">`,removeLabel:'Delete faction',body:`<details data-faction-members="${esc(item.id)}" ${closed?'':'open'}><summary>Members</summary><div class="sm-faction-gallery" data-faction-drop="${esc(item.id)}" tabindex="0" aria-label="Drop Actor members here">${item.members.map(member=>`<figure class="sm-faction-member" data-faction-member="${esc(member.id)}"><a href="#" data-member-link="${esc(member.id)}"><span data-member-image role="img" aria-label="Missing Actor">?</span><span data-member-name>Missing Actor</span></a><button type="button" data-member-remove="${esc(member.id)}" aria-label="Remove member">Remove</button></figure>`).join('')}<p class="sm-faction-drop-hint">Drop Actors here</p></div></details><section class="sm-faction-info"><label class="sm-field"><span>Faction Info</span><textarea name="${p}.info" rows="10">${esc(item.info)}</textarea></label></section>`});
}
export async function hydrateFactions(host,root,env=globalThis){
 const draft=host.draft;
 await Promise.all(Array.from(root.querySelectorAll('[data-faction-id]'),async card=>{
  const faction=host.data.settlement.factions.find(f=>f.id===card.dataset.factionId);if(!faction)return;
  await Promise.all(faction.members.map(async member=>{
   const figure=Array.from(card.querySelectorAll('[data-faction-member]')).find(el=>el.dataset.factionMember===member.id);if(!figure)return;
   try{
    const actor=await env.fromUuid(member.uuid);if(host.draft!==draft)return;if(actor?.documentName!=='Actor')throw new Error('Actor unavailable');
    const link=figure.querySelector('[data-member-link]'),name=figure.querySelector('[data-member-name]'),image=figure.querySelector('[data-member-image]');name.textContent=actor.name;link.title=actor.name;link.dataset.uuid=actor.uuid;link.classList.add('content-link');
    const src=imagePath(actor.img);if(src){const img=document.createElement('img');img.src=src;img.alt=actor.name;img.addEventListener('error',()=>{img.replaceWith(image);},{once:true});image.replaceWith(img);}
    link.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(!env.game.user.isGM)return;Promise.resolve().then(()=>actor._onClickDocumentLink(event)).catch(error=>env.ui.notifications.error(`Faction Actor: ${error.message}`));});
   }catch(error){figure.title=`${member.uuid}: ${error.message}. Reference retained.`;figure.querySelector('[data-member-link]').addEventListener('click',event=>event.preventDefault());}
  }));
 }));
}
export function bindFactions(host,env=globalThis){
 const report=task=>Promise.resolve(task).catch(error=>env.ui.notifications.error(`Faction: ${error.message}`));
 for(const details of host.element.querySelectorAll('[data-faction-members]'))details.addEventListener('toggle',()=>{const state=states(host);if(details.open)state.delete(details.dataset.factionMembers);else state.add(details.dataset.factionMembers);});
 for(const card of host.element.querySelectorAll('[data-faction-id]')){
  const faction=()=>host.data.settlement.factions.find(f=>f.id===card.dataset.factionId),area=card.querySelector('[data-faction-drop]');
  for(const button of card.querySelectorAll('[data-member-remove]'))button.addEventListener('click',()=>report((async()=>{if(!env.game.user.isGM)return;host.capture();const item=faction();if(!item)return;item.members=item.members.filter(member=>member.id!==button.dataset.memberRemove);host.markDirty();await host.render();})()));
  area.addEventListener('dragover',event=>{event.preventDefault();event.stopPropagation();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';});
  area.addEventListener('drop',event=>{event.preventDefault();event.stopPropagation();if(!env.game.user.isGM||host.droppingFaction)return;host.droppingFaction=true;void report((async()=>{
   try{host.capture();const draft=host.draft,item=faction(),signature=JSON.stringify(draft),payload=env.foundry.applications.ux.TextEditor.implementation.getDragEventData(event),actor=await resolveFactionActor(payload,env);
    if(host.draft!==draft||JSON.stringify(draft)!==signature||!host.rendered||!host.element.contains(area))throw new Error('Faction edits changed. Drop again.');
    const result=addFactionMember(item,actor);if(result.duplicate){env.ui.notifications.info('This Actor is already a member of this faction.');return;}host.markDirty();await host.render();
   }finally{host.droppingFaction=false;}
  })());});
 }
}
