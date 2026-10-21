import {journalBodyText} from './location-text.mjs';
import {imagePath} from './sector-images.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const tags=new Set(['p','br','strong','b','em','i','u','s','ul','ol','li','blockquote','h1','h2','h3','h4','h5','h6','pre','code','table','thead','tbody','tr','th','td','hr']);
const omit='script,style,iframe,object,embed,svg,math,template,img,video,audio,link,meta';
export function safeNarrative(value,env=globalThis){
  const source=String(value??'');if(!/<[a-z!/][^>]*>/i.test(source))return source.trim()?`<p>${esc(source).replace(/\n/g,'<br>')}</p>`:'';
  if(env.document?.createElement){
    const template=env.document.createElement('template');template.innerHTML=source;template.content.querySelectorAll(omit).forEach(node=>node.remove());
    for(const node of [...template.content.querySelectorAll('*')]){if(!tags.has(node.localName)){node.replaceWith(...node.childNodes);continue;}for(const attribute of [...node.attributes])node.removeAttribute(attribute.name);}
    return journalBodyText(template.innerHTML,env)?template.innerHTML:'';
  }
  // Test/server fallback emits only known tag names, never source attributes or unknown markup.
  const cleaned=source.replace(/<(script|style|iframe|object|svg|math|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  const html=(cleaned.match(/<[^>]*>|[^<]+|</g)||[]).map(token=>{const match=token.match(/^<\s*(\/?)\s*([a-z][\w-]*)\b[^>]*>$/i);if(match)return tags.has(match[2].toLowerCase())?`<${match[1]}${match[2].toLowerCase()}>`:'';return (/^\s/.test(token)?' ':'')+esc(journalBodyText(token,{}))+(/\s$/.test(token)?' ':'');}).join('');
  return journalBodyText(html,{})?html:'';
}
export const inhabitantCollection=(data,tab)=>data?.sectorType==='settlement'?(tab==='Inhabitants'?'settlement.inhabitants':null):data?.sectorType==='special'?(tab==='Inhabitants'?'special.inhabitants':null):tab==='Encounters'?'encounters':null;
export function requireInhabitantActor(doc){if(doc?.documentName!=='Actor')throw new Error('Drop an Actor from the Actors directory or a Compendium.');return doc;}
// Inspected official MYZ v14 character-info.hbs and info.hbs. NPC/non-character Info shows description only.
export async function actorInfo(doc,env=globalThis){
  requireInhabitantActor(doc);const system=doc.system||{},character=['mutant','animal','robot','human'].includes(doc.type),sections=[];
  const add=(heading,value,html=false)=>{const content=html?safeNarrative(value,env):safeNarrative(String(value??''),env);if(content)sections.push(`<h3>${esc(heading)}</h3>${content}`);};
  if(character){
    const party=(system.party||[]).filter(entry=>typeof entry?.value==='string'&&entry.value.trim()).map(entry=>`${entry.value}${entry.isBuddy?' (Buddy)':''}`).join('\n');
    add('Relationships',party);add('Hate',system.hate);add('Protect',system.protect);add('Dream',system.dream);add('My Home',system.myHome);
  }
  add('Description',system.description,true);if(character)add('Notes',system.notes,true);
  const source=sections.join('\n');
  const editor=env.foundry?.applications?.ux?.TextEditor?.implementation;
  const enriched=editor?.enrichHTML&&source?await editor.enrichHTML(source,{secrets:true,documents:false,links:false,rolls:false,embeds:false,custom:false}):source;
  return safeNarrative(enriched,env);
}
export async function importInhabitant(entry,doc,env=globalThis){
  requireInhabitantActor(doc);const next={...entry,uuid:doc.uuid};
  if(!entry.titleOverride&&(!entry.title||entry.title===entry.referenceTitle)){next.title=doc.name;next.referenceTitle=doc.name;}
  if(!entry.portrait)next.portrait=imagePath(doc.img)||'';
  if(!entry.actorImport&&!String(entry.details||'').trim())Object.assign(next,{details:await actorInfo(doc,env),detailsFormat:'html',actorImport:{version:1,uuid:doc.uuid}});
  return next;
}
