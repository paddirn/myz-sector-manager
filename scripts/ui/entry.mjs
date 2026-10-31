// Presentation only. Slots contain markup produced by module renderers; record
// text and attribute values go through escapeEntryText. No IDs/state are created
// here, and no data, persistence, or initial-collapse policy belongs here.
export const escapeEntryText=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const attributes=values=>Object.entries(values).map(([name,value])=>{if(!/^(?:data|aria)-[a-z0-9-]+$/.test(name))throw Error('Unsupported entry attribute.');return ` ${name}="${escapeEntryText(value)}"`;}).join('');
export function entryHeader({id,title='',collection,collapsed=false,headerContent='',summary='',titleControl='',remove=true,removeLabel=`Remove ${title||'entry'}`,removeTitle='',image=false}){
 const esc=escapeEntryText,bodyId=`${id}${image?'-image-body':'-body'}`,arrow=`<span ${image?'data-image-chevron':'data-chevron'} aria-hidden="true">${collapsed?'▶':'▼'}</span>`;
 const content=titleControl?arrow:`${headerContent}<strong data-entry-title>${esc(title)}</strong>${summary?`<small data-entry-summary>${esc(summary)}</small>`:''}${arrow}`;
 return `<div class="${image?'sm-image-heading':'sm-entry-head'}" data-entry-header="${esc(id)}"><button type="button" class="sm-entry-toggle ${titleControl?'sm-faction-toggle':'sm-special-toggle'}" ${image?'data-image-toggle':'data-entry-toggle'} ${titleControl?'aria-label="Toggle faction" ':''}aria-expanded="${!collapsed}" aria-controls="${esc(bodyId)}">${content}</button>${titleControl}${remove?`<button type="button" class="sm-entry-remove" data-remove="${esc(collection)}:${esc(id)}" ${removeTitle?`title="${esc(removeTitle)}" `:''}aria-label="${esc(removeLabel)}">✕</button>`:''}</div>`;
}
export function entryCard(options){
 const {id,collapsed=false,classes='',cardAttributes={},body='',image=false}=options;
 return `<article class="sm-entry ${collapsed?'is-collapsed':''}${classes?` ${escapeEntryText(classes)}`:''}" data-entry="${escapeEntryText(id)}"${attributes(cardAttributes)}>${entryHeader(options)}<div ${image?'data-image-body': 'class="sm-entry-body"'} id="${escapeEntryText(id)}${image?'-image-body':'-body'}" ${collapsed?'hidden':''}>${body}</div></article>`;
}
export function updateEntryCollapse(card,collapsed,{image=false,document=card?.ownerDocument}={}){
 if(!card)return;
 const button=card.querySelector(image?'[data-image-toggle]':'[data-entry-toggle]'),body=card.querySelector(image?'[data-image-body]':'.sm-entry-body');if(!button||!body)return;
 card.classList.toggle('is-collapsed',collapsed);button.setAttribute('aria-expanded',String(!collapsed));card.querySelector(image?'[data-image-chevron]':'[data-chevron]').textContent=collapsed?'▶':'▼';
 if(collapsed&&body.contains(document?.activeElement))button.focus({preventScroll:true});body.hidden=collapsed;
}
const bindings=new WeakMap();
export function unbindEntryCollapse(root){const previous=bindings.get(root);if(previous){root.removeEventListener('click',previous);bindings.delete(root);}}
export function bindEntryCollapse(root,toggle){
 unbindEntryCollapse(root);
 const listener=event=>{
  const target=event.target,header=target.closest?.('[data-entry-header]');if(!header||!root.contains(header))return;
  if(target.closest('input,textarea,select,a,[contenteditable], [data-entry-action]'))return;
  const button=target.closest('button');if(button&&!button.matches('[data-entry-toggle],[data-image-toggle]'))return;
  const card=header.closest('[data-entry]');if(card)toggle(card.dataset.entry,Boolean(header.querySelector('[data-image-toggle]')));
 };
 root.addEventListener('click',listener);bindings.set(root,listener);return ()=>unbindEntryCollapse(root);
}
