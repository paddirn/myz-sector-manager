import {projectBucket,projectHeading,projectProgress} from './settlement-projects.mjs';
export const isNotCompleted=project=>String(project?.status||'').trim().toLowerCase()==='not completed';
export function projectDisplayCompare(a,b,labelA,labelB,indexA,indexB){
 const order=['Not completed','Not started','Completed','Not Available'],bucketA=projectBucket(a),bucketB=projectBucket(b);
 return order.indexOf(bucketA)-order.indexOf(bucketB)||(bucketA==='Not completed'?projectProgress(b)-projectProgress(a):0)||String(labelA).localeCompare(String(labelB),undefined,{sensitivity:'base'})||indexA-indexB;
}
import {inhabitantCollection} from './inhabitants.mjs';
// Move existing cards, never stored entries: field paths, IDs, progress and references stay paired.
export function sortEditorEntries(host,root=host.element){
 const view=root?.matches?.('.sm-root')?root:root?.querySelector?.('.sm-root');
 const preserve=view?.isConnected&&host.scrollKeeper;
 if(preserve)host.scrollKeeper.capture(view);
 try{return sortEntries(host,root);}finally{if(preserve)host.scrollKeeper.restore(view);}
}
function sortEntries(host,root){
 const projects=host.data.sectorType==='settlement'&&host.tab==='Projects';
 if(!projects&&!inhabitantCollection(host.data,host.tab))return;
 const content=root.querySelector('.sm-content');if(!content)return;
 const cards=projects?Array.from(content.querySelectorAll('[data-project-index]')):Array.from(content.children).filter(el=>el.matches('[data-entry]'));
 const label=card=>projects?card.dataset.sortName||card.querySelector('[data-entry-title]')?.textContent||'':card.querySelector('[name$=".title"]')?.value||'';
 const project=card=>host.data.settlement.projects[Number(card.dataset.projectIndex)];
 if(projects){
  const active=content.ownerDocument.activeElement,restoreFocus=content.contains(active);
  host.projectGroupStates??=new Map();let states=host.projectGroupStates.get(host.sectorId);if(!states){states={};host.projectGroupStates.set(host.sectorId,states);}
  for(const key of ['Not completed','Not started','Completed','Not Available']){
   let section=Array.from(content.querySelectorAll('[data-project-group]')).find(s=>s.dataset.projectGroup===key);
   if(!section){section=content.ownerDocument.createElement('details');section.dataset.projectGroup=key;section.className='sm-project-status-group';section.open=states[key]!==false;const heading=content.ownerDocument.createElement('summary');heading.textContent=key;const grid=content.ownerDocument.createElement('div');grid.className='sm-project-group-grid';section.append(heading,grid);heading.addEventListener('click',event=>{event.preventDefault();section.open=!section.open;states[key]=section.open;});section.addEventListener('toggle',()=>{if(section.isConnected)states[key]=section.open;});content.append(section);}
   const matching=cards.filter(card=>projectBucket(project(card))===key).sort((a,b)=>projectDisplayCompare(project(a),project(b),label(a),label(b),Number(a.dataset.projectIndex),Number(b.dataset.projectIndex)));
   const grid=section.lastElementChild;
   for(const card of matching){const entry=project(card);card.classList.toggle('sm-project-incomplete',key==='Not completed');card.classList.toggle('sm-project-not-started',key==='Not started');card.classList.toggle('sm-project-completed',key==='Completed');card.classList.toggle('sm-project-unavailable',key==='Not Available');const title=card.querySelector('[data-entry-title]');if(title)title.textContent=projectHeading({...entry,title:card.dataset.sortName||entry.title},host.projectTotals?.get(entry.id)??null);}
   if(matching.some((card,i)=>grid.children[i]!==card)||grid.children.length!==matching.length)for(const card of matching)grid.append(card);
  }
  if(restoreFocus&&active.isConnected&&content.ownerDocument.activeElement!==active)active.focus({preventScroll:true});
  return;
 }
 const sorted=[...cards].sort((a,b)=>projects?projectDisplayCompare(project(a),project(b),label(a),label(b),Number(a.dataset.projectIndex),Number(b.dataset.projectIndex)):label(a).localeCompare(label(b),undefined,{sensitivity:'base'}));
 if(sorted.every((card,i)=>card===cards[i]))return;
 const active=content.ownerDocument.activeElement,focused=content.contains(active),start=focused?active.selectionStart:null,end=focused?active.selectionEnd:null;
 for(const card of sorted)content.append(card);
 if(focused){active.focus({preventScroll:true});if(typeof start==='number'&&typeof active.setSelectionRange==='function')active.setSelectionRange(start,end);}
}
