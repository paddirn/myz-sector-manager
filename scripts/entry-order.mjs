export const isNotCompleted=project=>String(project?.status||'').trim().toLowerCase()==='not completed';
export function projectDisplayCompare(a,b,labelA,labelB,indexA,indexB){
 const bucket=p=>isNotCompleted(p)?0:String(p?.status||'').trim().toLowerCase()==='completed'?2:1;
 return bucket(a)-bucket(b)||(isNotCompleted(a)&&isNotCompleted(b)?indexA-indexB:String(labelA).localeCompare(String(labelB),undefined,{sensitivity:'base'})||indexA-indexB);
}
import {inhabitantCollection} from './inhabitants.mjs';
// Move existing cards, never stored entries: field paths, IDs, progress and references stay paired.
export function sortEditorEntries(host,root=host.element){
 const projects=host.data.sectorType==='settlement'&&host.tab==='Projects';
 if(!projects&&!inhabitantCollection(host.data,host.tab))return;
 const content=root.querySelector('.sm-content');if(!content)return;
 const cards=Array.from(content.children).filter(el=>el.matches('[data-entry]'));
 const label=card=>projects?card.dataset.sortName||card.querySelector('[data-entry-title]')?.textContent||'':card.querySelector('[name$=".title"]')?.value||'';
 const project=card=>host.data.settlement.projects[Number(card.dataset.projectIndex)];
 if(projects)for(const card of cards)card.classList.toggle('sm-project-incomplete',isNotCompleted(project(card)));
 const sorted=[...cards].sort((a,b)=>projects?projectDisplayCompare(project(a),project(b),label(a),label(b),Number(a.dataset.projectIndex),Number(b.dataset.projectIndex)):label(a).localeCompare(label(b),undefined,{sensitivity:'base'}));
 if(sorted.every((card,i)=>card===cards[i]))return;
 const active=content.ownerDocument.activeElement,focused=content.contains(active),start=focused?active.selectionStart:null,end=focused?active.selectionEnd:null;
 for(const card of sorted)content.append(card);
 if(focused){active.focus({preventScroll:true});if(typeof start==='number'&&typeof active.setSelectionRange==='function')active.setSelectionRange(start,end);}
}
