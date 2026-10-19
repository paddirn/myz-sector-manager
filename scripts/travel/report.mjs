import {escapeHTML as esc} from './model.mjs';
export function travelReportHTML(event){
 const detection=event.detection,weather=event.weatherChange,encounter=event.encounter;
 return `<div style="max-height:60vh;overflow:auto;overflow-wrap:anywhere"><p><strong>${event.test?'TEST — ':''}${esc(event.code)} · ${esc(event.sectorName)} · ${esc(event.expeditionName)}</strong></p><p>Terrain: ${esc(event.terrain)}</p>${weather?`<h3>Weather Change</h3><p>Previous: ${esc(weather.previous)}<br>Current: ${esc(weather.condition)}</p><p style="white-space:pre-wrap">${esc(weather.description||'')}</p>`:''}${encounter?`<h3>Random Encounter</h3><strong>${esc(encounter.title)}</strong><p style="white-space:pre-wrap">${esc(encounter.details)}</p>${encounter.uuid?`<small>Reference: ${esc(encounter.uuid)}</small>`:''}<h3>Stalker Checks (hidden, unpushed)</h3>${detection?.rolls?.map(roll=>`<p>${esc(roll.name)}: ${roll.successes} ${roll.successes===1?'success':'successes'}<br><small>${esc(roll.formula)} · ${esc(roll.dice.map(die=>`${die.diceType}: ${die.value}`).join(', '))}</small></p>`).join('')||'<p>No automatic roll.</p>'}${detection?.issues?.map(issue=>`<p>${esc(issue)}</p>`).join('')||''}<h3>Suggested awareness — house rule</h3><p>${esc(detection?.recommendation||'GM determination required.')}</p><p>No combat, tokens, trauma, pushes, exploration changes or mechanical weather effects are applied.</p>`:''}${event.errors?.length?`<p>Diagnostics: ${esc(event.errors.join('; '))}</p>`:''}</div>`;
}
export async function showTravelReport(event,service,env=globalThis){
 if(!service.store.authoritative)return false;
 let timeout,dialog,timedOut=false;
 const buttons=[{action:'close',label:'Close',default:true,callback:()=>true}];
 if(event.encounter?.uuid)buttons.unshift({action:'open',label:'Open Reference & Close',callback:async()=>{try{const document=await env.fromUuid(event.encounter.uuid);if(!['Actor','JournalEntry','JournalEntryPage'].includes(document?.documentName))throw new Error('Encounter reference unavailable.');await document._onClickDocumentLink(new Event('click'));}catch(error){env.ui.notifications.warn(error.message);}return true;}});
 const timers=env.setTimeout?env:globalThis;
 try{return await Promise.race([
  env.foundry.applications.api.DialogV2.wait({window:{title:`${event.test?'TEST — ':''}Zone Travel Event — ${event.code}`,resizable:true},position:{width:500},content:travelReportHTML(event),buttons,render:(event,instance)=>{dialog=instance;service.activeDialog=instance;},close:()=>true,rejectClose:false}),
  new Promise(resolve=>{timeout=timers.setTimeout(()=>{timedOut=true;void dialog?.close();resolve(false);},300000);})
 ])&&!timedOut;}finally{timers.clearTimeout(timeout);if(service.activeDialog===dialog)service.activeDialog=null;}
}
