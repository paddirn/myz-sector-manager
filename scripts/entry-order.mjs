import {inhabitantCollection} from './inhabitants.mjs';
// Move existing cards, never stored entries: field paths, IDs, progress and references stay paired.
export function sortEditorEntries(host,root=host.element){
 const projects=host.data.sectorType==='settlement'&&host.tab==='Projects';
 if(!projects&&!inhabitantCollection(host.data,host.tab))return;
 const content=root.querySelector('.sm-content');if(!content)return;
 const cards=Array.from(content.children).filter(el=>el.matches('[data-entry]'));
 const label=card=>projects?card.dataset.sortName||card.querySelector('[data-entry-title]')?.textContent||'':card.querySelector('[name$=".title"]')?.value||'';
 const sorted=[...cards].sort((a,b)=>label(a).localeCompare(label(b),undefined,{sensitivity:'base'}));
 if(sorted.every((card,i)=>card===cards[i]))return;
 const active=content.ownerDocument.activeElement,focused=content.contains(active),start=focused?active.selectionStart:null,end=focused?active.selectionEnd:null;
 for(const card of sorted)content.append(card);
 if(focused){active.focus({preventScroll:true});if(typeof start==='number'&&typeof active.setSelectionRange==='function')active.setSelectionRange(start,end);}
}
