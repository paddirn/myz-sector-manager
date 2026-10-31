import {imagePreview,pickImage} from './images.mjs';
import {escapeEntryText as esc} from './entry.mjs';
import {imagePath} from '../sector-images.mjs';
import {safeImageSource} from '../zone/presentation.mjs';
import {inhabitantCollection} from '../inhabitants.mjs';
const silhouette='<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true" fill="currentColor"><circle cx="12" cy="7" r="4"/><path d="M3 22v-3a9 9 0 0 1 18 0v3z"/></svg>';
export const avatarMarkup=()=>`<span class="sm-inhabitant-avatar" data-inhabitant-avatar role="img" aria-label="No portrait available">${silhouette}</span>`;
export function portraitFields(path,value){return `<section class="sm-inhabitant-portrait-editor"><label class="sm-field"><span>Saved Portrait (fallback)</span><input name="${esc(path)}" value="${esc(value||'')}" data-inhabitant-portrait-path></label><button type="button" data-inhabitant-portrait-pick>Choose Portrait</button><div class="sm-inhabitant-portrait-preview" data-inhabitant-portrait-preview role="img" aria-label="No portrait available">${silhouette}</div><small data-inhabitant-portrait-source role="status">No portrait available.</small><small>A linked Actor portrait takes precedence. The saved portrait remains editable as its fallback; Actor images and descriptions are not changed.</small></section>`;}
function normalizedPath(value){try{return new URL(value,'https://foundry.invalid/').pathname.replace(/^\//,'').toLowerCase();}catch{return String(value).split(/[?#]/)[0].replace(/^\//,'').toLowerCase();}}
export function placeholderImage(value,env=globalThis){const defaults=['icons/svg/mystery-man.svg','icons/svg/unknown.svg',env.CONST?.DEFAULT_TOKEN].filter(Boolean).map(normalizedPath);return Boolean(value)&&defaults.includes(normalizedPath(value));}
export function portraitSources(entry,actor,env=globalThis){const result=[],linked=actor?.documentName==='Actor'&&actor.testUserPermission?.(env.game?.user,'OBSERVER')!==false?safeImageSource(actor.img):null,saved=imagePath(entry?.portrait);if(linked&&!placeholderImage(linked,env))result.push({src:linked,kind:'Actor portrait'});if(saved&&!placeholderImage(saved,env)&&!result.some(r=>r.src===saved))result.push({src:saved,kind:'Saved portrait'});return result;}
export class InhabitantPortraits {
 constructor(host,env=globalThis){this.host=host;this.env=env;this.cards=new WeakMap();this.hooks=[];this.liveActors=new Map();}
 unavailable(uuid){this.liveActors.delete(uuid);}
 prepare(root){this.root=root;}
 entry(card){const key=inhabitantCollection(this.host.data,this.host.tab);if(!key||!card)return null;return this.host.entryState(key).entries.find(r=>r.id===card.dataset.entry)?.item;}
 reference(zone,actor){const card=zone.closest?.('[data-entry]');if(!card?.querySelector('[data-inhabitant-avatar]'))return;const entry=this.entry(card);if(!entry)return;this.paint(card,entry,this.liveActors.has(entry.uuid)?this.liveActors.get(entry.uuid):actor);}
 paint(card,entry,actor){
  const draft=this.host.draft,uuid=entry.uuid,request={actor,entry,draft,uuid,index:0},candidates=portraitSources(entry,actor,this.env);this.cards.set(card,request);
  const current=()=>this.cards.get(card)===request&&this.host.draft===draft&&entry.uuid===uuid&&this.root?.contains(card);
  const draw=()=>{if(!current())return;const candidate=candidates[request.index],targets=[card.querySelector('[data-inhabitant-avatar]'),card.querySelector('[data-inhabitant-portrait-preview]')].filter(Boolean);
   for(const target of targets){target.replaceChildren();if(!candidate){target.setAttribute('role','img');target.setAttribute('aria-label','No portrait available');target.innerHTML=silhouette;continue;}target.removeAttribute('role');target.removeAttribute('aria-label');const index=request.index;imagePreview(target,candidate.src,`${entry.title||'Inhabitant'} portrait`,'No portrait available',{env:this.env,current,onError:()=>{if(current()&&request.index===index){request.index++;draw();}}});}
   const status=card.querySelector('[data-inhabitant-portrait-source]');if(status)status.textContent=candidate?`${candidate.kind} displayed.${candidate.kind==='Actor portrait'?' Saved portrait is retained as a fallback.':''}`:'No portrait available; showing the default silhouette.';
  };draw();
 }
 hydrate(root){for(const card of root.querySelectorAll('[data-entry]')){const entry=this.entry(card);if(entry&&!this.cards.has(card))this.paint(card,entry,null);}}
 bind(root){
  this.unbind?.();this.root=root;const input=event=>{if(!event.target.matches('[data-inhabitant-portrait-path]'))return;const card=event.target.closest('[data-entry]'),entry=this.entry(card);if(entry)this.paint(card,entry,this.cards.get(card)?.actor);};
  const pick=async event=>{const button=event.target.closest('[data-inhabitant-portrait-pick]');if(!button)return;event.preventDefault();if(!this.env.game.user.isGM)return;const card=button.closest('[data-entry]'),entry=this.entry(card),draft=this.host.draft;if(!entry)return;
   try{await pickImage({path:entry.portrait||'',current:()=>this.host.draft===draft&&card.isConnected&&this.entry(card)===entry,onSelect:path=>{const control=card.querySelector('[data-inhabitant-portrait-path]');control.value=path;this.host.capture();this.host.markDirty();this.paint(card,entry,this.cards.get(card)?.actor);}},this.env);}catch{this.env.ui.notifications.error('Inhabitant portrait picker could not be opened.');}
  };
  root.addEventListener('input',input);root.addEventListener('click',pick);this.unbind=()=>{root.removeEventListener('input',input);root.removeEventListener('click',pick);};
  if(!this.hooks.length&&!this.host.referenceHooks?.length){for(const name of ['updateActor','deleteActor']){const id=this.env.Hooks?.on(name,(actor)=>{if(!this.host.rendered||!this.env.game.user.isGM)return;this.liveActors.set(actor.uuid,name==='deleteActor'?null:actor);for(const card of this.root?.querySelectorAll('[data-entry]')||[]){const entry=this.entry(card);if(entry?.uuid===actor.uuid){this.paint(card,entry,name==='deleteActor'?null:actor);if(name==='deleteActor'){const zone=card.querySelector('[data-reference]');if(zone)void this.host.renderReference(zone);}}}});this.hooks.push([name,id]);}}
 }
 stop(){this.unbind?.();this.unbind=null;for(const [name,id] of this.hooks)this.env.Hooks?.off(name,id);this.hooks=[];this.liveActors.clear();this.root=null;}
}
