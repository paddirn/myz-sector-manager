import {collectionActions} from './ui/actions.mjs';
import {avatarMarkup,portraitFields} from './ui/inhabitant-portraits.mjs';
import {entryCard} from './ui/entry.mjs';
import {selectOptions} from './ui/options.mjs';
import {projectRequirement,projectReady,projectProgress,nextProjectProgress,writeArkProjectStatus} from './settlement-projects.mjs';
import {hydrateArk} from './settlement-ark.mjs';
import {sortEditorEntries} from './entry-order.mjs';
import {renderFaction,hydrateFactions,bindFactions} from './settlement-factions-ui.mjs';
import {renderShop,hydrateShop,bindShop} from './settlement-shop-ui.mjs';
import {SETTLEMENT_COLLECTIONS,SETTLEMENT_TYPES,DISPOSITIONS,PROJECT_STATUSES,newSettlementEntry,requireProject,projectInformation,assignProject} from './settlement.mjs';
import {sectorCollection} from './sector-types.mjs';
import {imagePath} from './sector-images.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

// Uses the existing editor shell, field helpers, card identities, collapse controls and references.
export function renderSettlement(host,{field,area,select,reference,terrainField}){
  const d=host.data,s=d.settlement;
  const text=(label,key,value,rows=5)=>area(label,key,value,rows);
  const choice=(label,key,value,options)=>select(label,key,value,options);
  const ref=(type,key,uuid)=>{const html=reference(`settlement.${type}`,0,uuid,key);return type==='ark'?html.replace('type="hidden"','type="text" aria-label="Linked Ark Actor UUID"'):html;};
  const image=(label,key,value)=>`${field(label,key,value)}<button type="button" data-settlement-image="${key}">Choose ${esc(label)}</button><div class="sm-image-preview" data-settlement-preview="${key}" data-image-path="${esc(value)}"></div>`;
  if(host.tab==='Overview')return `<div class="sm-overview-grid"><label class="sm-field"><span>Settlement Name</span><input data-sector-name value="${esc(d.nameOverride?d.customName:'')}" placeholder="Name this settlement"></label>${s.arkUuid?`<label class="sm-field"><span>Coordinates</span><input data-ark-coordinates readonly disabled value="Loading…"></label><input type="hidden" name="code" value="${esc(d.code)}">`:field('Coordinates','code',d.code)}${choice('Settlement Type','settlement.type',s.type,SETTLEMENT_TYPES)}${choice('Disposition Toward the Party','settlement.disposition',s.disposition,DISPOSITIONS)}${s.arkUuid?'<label class="sm-field"><span>Population (linked Ark)</span><input data-ark-population readonly disabled value="Loading…"></label>':field('Population','settlement.population',s.population)}${field('Leadership','settlement.leadership',s.leadership)}${terrainField(d)}</div><section><h3>Linked Ark Sheet</h3>${ref('ark','settlement.arkUuid',s.arkUuid)}<div data-ark-information></div><p data-ark-placement-warning role="status"></p></section>${host.overviewSection('Description','settlement.description',s.description)}${image('Settlement Image','settlement.image',s.image)}${text('GM Notes','settlement.notes',s.notes)}<details><summary>Additional overview information (optional)</summary>${[['History / Background','history'],['Current Situation','situation'],['Defenses / Security','defenses'],['Resources and Shortages','resources'],['Trade and Economy','economy']].map(([label,key])=>text(label,`settlement.${key}`,s[key],3)).join('')}</details>`;
  if(host.tab==='Shop')return renderShop(host);
  const key=SETTLEMENT_COLLECTIONS[host.tab],entries=sectorCollection(d,key),state=host.entryState(key),kind=key.split('.')[1];
  const fields=(item,p,i)=>{
    if(kind==='projects')return `${item.arkSource?`<p>Ark-linked Project${item.arkSource.missing?' (source unavailable)':''}</p>`:ref('projects',`${p}.uuid`,item.uuid)}<div data-project-view="${i}"></div><div class="sm-project-controls" data-project-controls="${i}"><label>Project Status<select data-project-status="${i}">${selectOptions(item.status,PROJECT_STATUSES)}</select></label><label>Work Points<span><button type="button" data-project-step="-1" data-project-number="${i}" aria-label="Decrease Work Points">−</button><input type="number" min="0" step="1" data-project-points="${i}" aria-label="Current Work Points" value="${projectProgress(item)}"><button type="button" data-project-step="1" data-project-number="${i}" aria-label="Increase Work Points">+</button> / <output data-project-total="${i}">Unavailable</output></span><small data-project-diagnostic="${i}" role="status" hidden></small></label><strong class="sm-project-ready" data-project-ready="${i}" role="status" hidden>! Ready to Complete !</strong></div>${item.progress?`<p>Legacy/source requirement (retained): ${esc(item.progress)}</p>`:''}${field('Date / Session Completed',`${p}.completedAt`,item.completedAt)}${text('Settlement Project Notes',`${p}.notes`,item.notes)}`;
    const common=`${field(kind==='inhabitants'?'Name':kind==='factions'?'Faction Name':`${host.tab==='Threads'?'Thread':'Event'} Title`,`${p}.title`,item.title)}${text('Description',`${p}.details`,item.details)}${kind==='inhabitants'?'<div class="sm-inhabitant-description" data-inhabitant-preview></div>':''}`;
    let body='';
    if(kind==='inhabitants'){
      const factions=[['','None'],...s.factions.map(f=>[f.id,f.title||'Unnamed faction'])];
      if(item.factionId&&!s.factions.some(f=>f.id===item.factionId))factions.push([item.factionId,'Missing faction (association preserved)']);
      body=`${field('Role / Occupation',`${p}.role`,item.role)}${choice('Disposition Toward the Party',`${p}.disposition`,item.disposition,DISPOSITIONS)}<label class="sm-field"><span>Associated Faction</span><select name="${p}.factionId">${factions.map(([id,title])=>`<option value="${esc(id)}" ${id===item.factionId?'selected':''}>${esc(title)}</option>`).join('')}</select></label>${portraitFields(`${p}.portrait`,item.portrait)}${ref('inhabitants',`${p}.uuid`,item.uuid)}`;
    }
    if(kind==='events')body=choice('Status',`${p}.status`,item.status||'Planned',['Planned','Active','Resolved','Cancelled'])+[['Trigger / Conditions','trigger'],['Consequences / Outcomes','outcomes'],['Related NPCs or Factions','related']].map(([label,key])=>text(label,`${p}.${key}`,item[key],3)).join('');
    if(kind==='threads')body=choice('Status',`${p}.status`,item.status||'Open',['Open','In Progress','Resolved','Abandoned'])+[['Important NPCs','npcs'],['Associated Factions','factions'],['Clues / Discoveries','clues'],['Possible Developments','developments'],['Resolution / Outcome','resolution']].map(([label,key])=>text(label,`${p}.${key}`,item[key],3)).join('');
    return common+body+text('GM Notes',`${p}.notes`,item.notes);
  };
  return `<div class="sm-section-header"><p>${kind==='projects'?'Drop an MYZ Ark Project Item from Items or a Compendium on the blank area, or add a Project and drop onto its reference. Changes save with Save Sector.':'Descriptive GM records; nothing executes or transfers automatically.'}</p>${collectionActions({key,count:entries.length})}</div>`+entries.map((item,i)=>{
    const id=state.entries[i].id,collapsed=state.collapsed.has(id),p=`${key}.${i}`;
    if(kind==='factions')return renderFaction(host,item,p,id,collapsed);
    return entryCard({id,collection:key,collapsed,headerContent:kind==='inhabitants'?avatarMarkup():'',title:item.title||item.referenceName||`New ${host.tab.slice(0,-1)}`,cardAttributes:kind==='projects'?{'data-project-index':i}:{},remove:!(kind==='projects'&&item.arkSource),removeLabel:`Remove ${item.title||host.tab}`,body:fields(item,p,i)});
  }).join('')+(!entries.length?`<p class="sm-empty">No ${esc(host.tab.toLowerCase()==='shop'?'shops':host.tab.toLowerCase())} have been added to this settlement.</p>`:'');
}

export async function renderProject(host,target,entry){
  const uuid=entry?.uuid,draft=host.draft,request=target.projectRequest=(target.projectRequest||0)+1;
  const current=()=>host.draft===draft&&entry.uuid===uuid&&target.projectRequest===request;
  const retainedControls=target.closest('[data-entry]')?.querySelector('[data-project-controls]');if(retainedControls&&target.contains(retainedControls))target.after(retainedControls);
  const card=target.closest('[data-entry]');if(card)card.dataset.sortName=entry?.referenceName||entry?.title||'Unnamed project';
  host.projectTotals??=new Map();host.projectTotals.set(entry.id,null);const totalOutput=target.closest('[data-entry]')?.querySelector('[data-project-total]');if(totalOutput)totalOutput.textContent='Unavailable';
  if(entry.arkSource?.missing){target.textContent=`Source unavailable; saved snapshot retained: ${entry.title||''} — ${entry.details||''}`;return;}
  if(!uuid){target.textContent='Drop an Ark Project Item onto the reference field.';sortEditorEntries(host,target.closest('.sm-content')?.parentElement||host.element);return;}
  try{
    const doc=requireProject(await fromUuid(uuid),game.system?.id||'mutant-year-zero');if(!current())return;host.projectTotals??=new Map();const requirement=projectRequirement(doc);host.projectTotals.set(entry.id,requirement.total);host.projectDiagnostics??=new Map();host.projectDiagnostics.set(entry.id,requirement.diagnostic);const total=target.closest('[data-entry]').querySelector('[data-project-total]');if(total)total.textContent=String(host.projectTotals.get(entry.id)??'Unavailable');
    const card=target.closest('[data-entry]');if(card){card.dataset.sortName=doc.name;const heading=card.querySelector('[data-entry-title]');if(heading)heading.textContent=doc.name;}
    const existingControls=target.closest('[data-entry]').querySelector('[data-project-controls]');if(existingControls)target.after(existingControls);target.replaceChildren();const title=document.createElement('h4');title.textContent=doc.name;target.append(title);
    const controls=target.closest('[data-entry]').querySelector('[data-project-controls]');if(controls)target.append(controls);
    if(entry.arkSource){const open=document.createElement('button');open.type='button';open.textContent='Open Ark Project';open.addEventListener('click',()=>doc.sheet.render(true));target.append(open);}
    const image=document.createElement('div');image.className='sm-project-image';host.showImage(image,imagePath(doc.img),doc.name,'No project illustration');target.append(image);
    // Escape source HTML as text; the native sheet remains the authoritative rich-text view.
    const details=document.createElement('dl');for(const [label,value] of projectInformation(doc)){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;const parsed=new DOMParser().parseFromString(String(value),'text/html');dd.textContent=parsed.body.textContent;details.append(dt,dd);}target.append(details);
  }catch(error){if(current()){target.textContent=`Project reference unavailable (${uuid}): ${error.message}. Assignment and progress retained.`;target.classList.add('sm-reference-missing');}}
  sortEditorEntries(host,target.closest('.sm-content')?.parentElement||host.element);
}

export async function hydrateSettlement(host,root){
  if(host.tab==='Overview')await hydrateArk(host,root);
  if(host.tab==='Shop')await hydrateShop(host,root);
  if(host.tab==='Factions')await hydrateFactions(host,root);
  for(const target of root.querySelectorAll('[data-settlement-preview]'))host.showImage(target,imagePath(target.dataset.imagePath),'Settlement image','No image selected');
  await Promise.all(Array.from(root.querySelectorAll('[data-project-view]'),target=>renderProject(host,target,host.data.settlement.projects[Number(target.dataset.projectView)])));
  refreshProjectControls(host,root);

}
export function refreshProjectControls(host,root=host.element){
 for(const input of root.querySelectorAll('[data-project-points]')){
  const index=Number(input.dataset.projectPoints),entry=host.data.settlement.projects[index],current=projectProgress(entry),total=host.projectTotals?.get(entry.id)??null;
  if(root.ownerDocument.activeElement!==input)input.value=String(current);input.removeAttribute('max');
  root.querySelector(`[data-project-step="-1"][data-project-number="${index}"]`).disabled=current===0;
  root.querySelector(`[data-project-step="1"][data-project-number="${index}"]`).disabled=current>=Number.MAX_SAFE_INTEGER;
  const output=root.querySelector(`[data-project-total="${index}"]`);output.textContent=String(total??'Unavailable');output.title=total===null?'Required Work Points unavailable: no readable positive multiplier in the linked Project system.work_points field.':host.projectDiagnostics?.get(entry.id)||'';
  const diagnostic=root.querySelector(`[data-project-diagnostic="${index}"]`);diagnostic.hidden=total!==null;diagnostic.textContent=total===null?output.title:'';
  root.querySelector(`[data-project-ready="${index}"]`).hidden=!projectReady(entry,total);
 }
 sortEditorEntries(host,root);
}
export function bindSettlement(host){
  const el=host.element;
  const report=task=>Promise.resolve(task).catch(error=>ui.notifications.error(`Settlement: ${error.message}`));
  el.querySelectorAll('[data-settlement-image]').forEach(button=>button.addEventListener('click',()=>report((async()=>{
    const draft=host.draft,id=host.sectorId,path=button.dataset.settlementImage,control=el.querySelector(`[name="${path}"]`);
    const Picker=foundry.applications.apps.FilePicker.implementation;
    await new Picker({type:'image',current:control.value,callback:value=>{
      if(host.draft!==draft||host.sectorId!==id||!host.rendered)return;
      const image=imagePath(value);if(!image){ui.notifications.warn('Choose a supported image file path.');return;}
      control.value=image;host.capture();host.markDirty();const target=el.querySelector(`[data-settlement-preview="${path}"]`);host.showImage(target,image,'Settlement image');
    }}).render(true);
  })())));
  if(host.tab==='Shop'){bindShop(host);return;}
  if(host.tab==='Factions'){bindFactions(host);return;}
  if(host.tab!=='Projects')return;
  const changeProject=(index,change,render=false)=>{
   const selectedDraft=host.draft,selectedSector=host.sectorId,selectedId=host.draft.settlement.projects[index]?.id;
   const task=(host.projectWrite||Promise.resolve()).catch(()=>{}).then(async()=>{
    if(!game.user.isGM)throw new Error('Only a GM may edit Projects.');if(host.draft!==selectedDraft||host.sectorId!==selectedSector)throw new Error('Project selection changed; no update performed.');host.capture();const draft=host.draft,entry=draft.settlement.projects.find(p=>p.id===selectedId);if(!entry)throw new Error('Project selection changed.');
    const next=change(entry,host.projectTotals?.get(entry.id)??null),changed=next.status!==entry.status;
    host.projectSyncDepth=(host.projectSyncDepth||0)+1;
    try{if(changed){const written=await writeArkProjectStatus(draft.settlement,entry,next.status);if(written){host.saveNote='Native Ark Project updated; Discard cannot undo this source write';host.refreshSaveStatus?.();}}if(host.draft!==draft)throw new Error('Sector changed during Project update. Reopen to refresh the Ark.');Object.assign(entry,next);host.markDirty();if(render)await host.render();else refreshProjectControls(host);}finally{host.projectSyncDepth--;}
   });host.projectWrite=task;void report(task.catch(async error=>{if(host.draft===selectedDraft&&host.sectorId===selectedSector)await host.render();throw error;}));
  };
  for(const select of el.querySelectorAll('[data-project-status]'))select.addEventListener('change',()=>{const status=select.value;changeProject(Number(select.dataset.projectStatus),entry=>({...entry,status}),true);});
  for(const input of el.querySelectorAll('[data-project-points]')){const apply=()=>{const value=input.value===''?NaN:Number(input.value);changeProject(Number(input.dataset.projectPoints),(entry,total)=>nextProjectProgress(entry,value,total));};input.addEventListener('input',()=>{if(input.value!==''&&Number.isSafeInteger(Number(input.value))&&Number(input.value)>=0)apply();});input.addEventListener('change',apply);}
  for(const button of el.querySelectorAll('[data-project-step]'))button.addEventListener('click',()=>changeProject(Number(button.dataset.projectNumber),(entry,total)=>nextProjectProgress(entry,projectProgress(entry)+Number(button.dataset.projectStep),total)));
  const content=el.querySelector('.sm-content'),blank=event=>!event.target.closest('[data-entry],input,textarea,button,select,a');
  content.addEventListener('dragover',event=>{if(blank(event)){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';}});
  content.addEventListener('drop',event=>{
    if(!blank(event))return;event.preventDefault();event.stopPropagation();void report((async()=>{
      if(!game.user.isGM||host.droppingProject)return;host.droppingProject=true;
      try{
        host.capture();const draft=host.draft,id=host.sectorId,signature=JSON.stringify(draft),payload=foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
        const doc=requireProject(payload.uuid?await fromUuid(payload.uuid):null,game.system?.id||'mutant-year-zero');
        if(host.draft!==draft||host.sectorId!==id||!host.rendered||JSON.stringify(draft)!==signature)throw new Error('Sector selection or edits changed. Nothing was added; drop again.');
        draft.settlement.projects.push(assignProject(newSettlementEntry('projects'),doc,game.system?.id));host.markDirty();await host.render();
      }finally{host.droppingProject=false;}
    })());
  });
}
