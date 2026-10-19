import {escapeHTML as esc} from './model.mjs';
export function travelReportHTML(event){
 const detection=event.detection,weather=event.weatherChange,encounter=event.encounter;
 return `<div style="max-height:60vh;overflow:auto;overflow-wrap:anywhere"><p><strong>${event.test?'TEST — ':''}${esc(event.code)} · ${esc(event.sectorName)} · ${esc(event.expeditionName)}</strong></p><p>Terrain: ${esc(event.terrain)}</p>${weather?`<h3>Weather Change</h3><p>Previous: ${esc(weather.previous)}<br>Current: ${esc(weather.condition)}</p><p style="white-space:pre-wrap">${esc(weather.description||'')}</p>`:''}${encounter?`<h3>Random Encounter</h3><strong>${esc(encounter.title)}</strong><p style="white-space:pre-wrap">${esc(encounter.details)}</p>${encounter.uuid?`<small>Reference: ${esc(encounter.uuid)}</small>`:''}<h3>Stalker Checks (hidden, unpushed)</h3>${detection?.rolls?.map(roll=>`<p>${esc(roll.name)}: ${roll.successes} ${roll.successes===1?'success':'successes'}<br><small>${esc(roll.formula)} · ${esc(roll.dice.map(die=>`${die.diceType}: ${die.value}`).join(', '))}</small></p>`).join('')||'<p>No automatic roll.</p>'}${detection?.issues?.map(issue=>`<p>${esc(issue)}</p>`).join('')||''}<h3>Suggested awareness — house rule</h3><p>${esc(detection?.recommendation||'GM determination required.')}</p><p>No combat, tokens, trauma, pushes, exploration changes or mechanical weather effects are applied.</p>`:''}${event.errors?.length?`<p>Diagnostics: ${esc(event.errors.join('; '))}</p>`:''}</div>`;
}
export async function showTravelReport(event,service,env=globalThis){
 if(!service.store.authoritative||(!event.weatherChange&&!event.encounter))return false;
 let dialog;
 const reference=event.encounter?.uuid?'<button type="button" data-travel-reference>Open Encounter Reference</button>':'';
 try{
  await env.foundry.applications.api.DialogV2.wait({
   window:{title:`${event.test?'TEST — ':''}Zone Travel Event — ${event.code}`,resizable:true},position:{width:500},
   content:travelReportHTML(event)+reference,
   buttons:[{action:'close',label:'Close',default:true,callback:()=>true}],
   render:(_event,instance)=>{
    dialog=instance;service.activeDialog=instance;
    instance.element?.querySelector('[data-travel-reference]')?.addEventListener('click',async()=>{
     if(!service.store.isGM)return;
     try{const document=await env.fromUuid(event.encounter.uuid);if(!['Actor','JournalEntry','JournalEntryPage'].includes(document?.documentName))throw new Error('Encounter reference unavailable.');await document._onClickDocumentLink(new Event('click'));}
     catch(error){env.ui.notifications.warn(error.message);}
    });
   },close:()=>true,rejectClose:false
  });
  // DialogV2.wait resolves for both Close and the window X (which may return null).
  return Boolean(service.store.isGM);
 }finally{if(service.activeDialog===dialog)service.activeDialog=null;}
}
