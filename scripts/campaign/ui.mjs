import {activeSession,countdown,DURATIONS} from './model.mjs';
import {MODULE} from '../zone/store.mjs';
import {canonicalCoordinate} from '../zone/grid.mjs';
import {escapeHTML as esc} from '../zone/config.mjs';
const date=value=>value?new Date(value).toLocaleString():'Present';
const options=value=>Object.entries(DURATIONS).map(([n,label])=>`<option value="${n}" ${Number(n)===Number(value)?'selected':''}>${label}</option>`).join('');
const isoInput=value=>new Date(value).toISOString();
export const logButton=recording=>`<button type="button" data-action="campaign-log" ${recording?'class="sm-log-recording"':''} aria-label="${recording?'Log (recording)':'Log'}" title="${recording?'Campaign Log recording active':'Open Campaign Log'}">${recording?'<span aria-hidden="true">● </span>':''}Log</button>`;
export function campaignContent(service,view){
 const log=service.state,active=activeSession(log),selected=log.sessions.flatMap(s=>s.visits.map(v=>({s,v}))).find(x=>x.v.id===view.selectedVisit);
 const groups=service.zone.store.config.groups;
 return `<style>
 .myz-campaign-log{max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);min-width:0}
 .myz-campaign-log .window-content{overflow:auto;min-height:0;min-width:0}.myz-campaign-log button{width:auto;height:auto}.myz-campaign-log label{display:block}.myz-campaign-log input,.myz-campaign-log select{max-width:100%;min-width:0}
 .cl-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}.cl-layout{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:16px}.cl-history,.cl-detail{min-width:0;overflow-wrap:anywhere}.cl-history details{margin:8px 0;padding:6px;border:1px solid #888;border-radius:4px}.cl-history summary{cursor:pointer}.cl-history table{width:100%;font-size:.9em}.cl-table-scroll{overflow:auto}.cl-history th,.cl-history td{padding:4px}.cl-history tr[aria-selected=true]{outline:2px solid var(--color-warm-2,#ba8132);outline-offset:-2px}.cl-history [data-select-visit]{width:100%;text-align:left}.cl-detail article{border-bottom:1px solid #888;padding:8px 0}.cl-note-text{white-space:pre-wrap;overflow-wrap:anywhere}.cl-status{font-weight:bold;font-variant-numeric:tabular-nums}.cl-current{font-weight:bold}.cl-help{font-size:.9em;opacity:.85}
 @media(max-width:650px){.cl-layout{grid-template-columns:1fr}}
 .myz-campaign-editor{max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px)}.myz-campaign-editor .window-content{overflow:auto}.myz-campaign-editor textarea,.myz-campaign-editor input{width:100%;max-width:100%}
 </style><section><div class="cl-toolbar"><strong class="cl-status" data-countdown role="status">${esc(countdown(log))}</strong>${active?`<button type="button" data-command="end" data-session="${esc(active.id)}">End Session</button><button type="button" data-command="extend" data-session="${esc(active.id)}" data-minutes="30">+30 minutes</button><button type="button" data-command="extend" data-session="${esc(active.id)}" data-minutes="60">+60 minutes</button>`:`<label>Party / Expedition<select data-party>${groups.map(g=>`<option value="${esc(g.id)}">${esc(g.name||g.id)}</option>`).join('')}</select></label><label>Duration<select data-duration>${options(service.env.game.settings.get(MODULE,'campaignSessionDuration'))}</select></label><button type="button" data-start ${groups.length?'':'disabled'}>Start Session</button>`}<button type="button" data-export>Export Log</button></div><p class="cl-help">Real-world time only. Closing this window does not stop recording.</p><div class="cl-layout"><div class="cl-history">${log.sessions.toReversed().map(s=>`<details data-session-panel="${esc(s.id)}" ${view.collapsed.has(s.id)?'':'open'}><summary>Session ${s.number}${s.title?`: ${esc(s.title)}`:''} · ${s.status==='active'?'Recording':'Completed'}</summary><p>${esc(date(s.startAt))} – ${esc(date(s.endAt))}</p><button type="button" data-title="${esc(s.id)}">Edit title</button> <button type="button" data-session-time="${esc(s.id)}" ${s.status==='active'?'disabled title="End recording before editing timestamps"':''}>Edit timestamps</button><div class="cl-table-scroll"><table><thead><tr><th>Sector</th><th>Arrived</th><th>Departed</th><th>Notes</th></tr></thead><tbody>${s.visits.map(v=>`<tr data-visit-row="${esc(v.id)}" aria-selected="${v.id===view.selectedVisit}"><td><button type="button" data-select-visit="${esc(v.id)}">${esc(v.coordinate)}${v.departureAt===null?' ● Current':''}</button></td><td>${esc(date(v.arrivalAt))}</td><td>${esc(date(v.departureAt))}</td><td>${v.notes.length}</td></tr>`).join('')}</tbody></table></div></details>`).join('')||'<p>No sessions recorded. Configure the Party token in Zone Map / Tracking, then start a session.</p>'}</div><div class="cl-detail">${selected?visitContent(selected.s,selected.v):'<p>Select a sector visit to view or add notes.</p>'}</div></div></section>`;
}
function visitContent(s,v){return `<h3>Session ${s.number} · <button type="button" data-navigate="${esc(v.id)}" aria-label="Open sector ${esc(v.coordinate)}">Sector ${esc(v.coordinate)}</button></h3><p>${esc(date(v.arrivalAt))} – ${esc(date(v.departureAt))}</p><button type="button" data-note-add="${esc(v.id)}">+ Entry</button> <button type="button" data-visit-edit="${esc(v.id)}" ${s.status==='active'?'disabled':''}>Correct visit</button> <button type="button" data-visit-delete="${esc(v.id)}" ${s.status==='active'?'disabled':''}>Delete visit</button>${v.notes.map(n=>`<article><small>Created ${esc(date(n.createdAt))}${n.modifiedAt?` · Edited ${esc(date(n.modifiedAt))}`:''}</small><p class="cl-note-text">${esc(n.text)}</p><button type="button" data-note-edit="${esc(n.id)}">Edit note</button> <button type="button" data-note-delete="${esc(n.id)}">Delete note</button></article>`).join('')||'<p>No notes for this visit.</p>'}`;}
export function createCampaignLogClass(ApplicationV2,service,env=globalThis){
 return class CampaignLog extends ApplicationV2 {
 static DEFAULT_OPTIONS={id:'myz-campaign-log',window:{title:'Campaign Log',resizable:true},position:{width:960,height:700},classes:['myz-campaign-log']};
 constructor(){super();this.collapsed=new Set(service.state.sessions.slice(0,-1).map(s=>s.id));this.selectedVisit=activeSession(service.state)?.visits.at(-1)?.id||service.state.sessions.at(-1)?.visits.at(-1)?.id;}
 async _renderHTML(){if(!service.isGM)throw Error('GM access only.');const root=env.document.createElement('div');root.innerHTML=campaignContent(service,this);return root;}
 _replaceHTML(result,content){content.replaceChildren(result);}
 async _onRender(context,options){
 await super._onRender(context,options);
 if(!this.unsubscribe)this.unsubscribe=service.subscribe(kind=>{if(!service.isGM){void this.close();return;}if(kind==='tick'){const el=this.element?.querySelector('[data-countdown]');if(el)el.textContent=countdown(service.state);return;}this.refresh();});
 const root=this.element,run=fn=>async event=>{const button=event.currentTarget;button.disabled=true;try{await fn(button);}catch(error){service.report(error);}finally{if(button.isConnected)button.disabled=false;}};
 const bind=(selector,fn)=>root.querySelectorAll(selector).forEach(b=>b.addEventListener('click',run(fn)));
 root.querySelectorAll('[data-session-panel]').forEach(d=>d.addEventListener('toggle',()=>{d.open?this.collapsed.delete(d.dataset.sessionPanel):this.collapsed.add(d.dataset.sessionPanel);}));
 bind('[data-select-visit]',b=>{this.selectedVisit=b.dataset.selectVisit;return this.render();});
 bind('[data-start]',()=>service.request({action:'start',groupId:root.querySelector('[data-party]').value,durationMinutes:Number(root.querySelector('[data-duration]').value)}).then(log=>{this.selectedVisit=activeSession(log)?.visits.at(-1)?.id;this.refresh();}));
 bind('[data-command]',b=>service.request({action:b.dataset.command,sessionId:b.dataset.session,minutes:Number(b.dataset.minutes)}));
 bind('[data-export]',()=>{const file=JSON.stringify(service.export(),null,2),name=`myz-campaign-log-${new Date().toISOString().slice(0,10)}.json`;if(typeof env.saveDataToFile==='function')env.saveDataToFile(file,'application/json',name);else{const url=env.URL.createObjectURL(new env.Blob([file],{type:'application/json'})),link=env.document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>env.URL.revokeObjectURL(url),1000);}});
 bind('[data-title]',async b=>{const s=service.state.sessions.find(s=>s.id===b.dataset.title),value=await this.edit('Session title',`<label>Title<input name="title" maxlength="200" value="${esc(s.title)}"></label>`,['title']);if(value)await service.request({action:'title',sessionId:s.id,...value});});
 bind('[data-session-time]',async b=>{const s=service.state.sessions.find(s=>s.id===b.dataset.sessionTime),value=await this.edit('Correct session timestamps',`<p>Use ISO timestamps with a timezone (for example 2026-10-30T19:00:00-04:00). Visits must remain within the session.</p><label>Start<input name="startAt" value="${esc(isoInput(s.startAt))}"></label><label>End<input name="endAt" value="${esc(isoInput(s.endAt))}"></label>`,['startAt','endAt']);if(value)await service.request({action:'editSession',sessionId:s.id,...value});});
 bind('[data-note-add],[data-note-edit],[data-note-delete],[data-visit-edit],[data-visit-delete],[data-navigate]',b=>this.visitAction(b));
 }
 refresh(){if(this.refreshQueued||!this.rendered)return;this.refreshQueued=true;queueMicrotask(async()=>{this.refreshQueued=false;if(!this.rendered)return;const scroller=this.element?.querySelector('.window-content'),scroll=scroller?.scrollTop;try{await this.render();const el=this.element?.querySelector('.window-content');if(el)el.scrollTop=scroll||0;}catch(error){service.report(error);}});}
 async _onClose(options){this.unsubscribe?.();this.unsubscribe=null;await super._onClose?.(options);}
 async edit(title,content,fields){return env.foundry.applications.api.DialogV2.wait({classes:['myz-campaign-editor'],window:{title},position:{width:460},content,buttons:[{action:'cancel',label:'Cancel',default:true,callback:()=>null},{action:'save',label:'Save',callback:(e,b,d)=>Object.fromEntries(fields.map(key=>[key,d.element.querySelector(`[name="${key}"]`).value]))}],close:()=>null,rejectClose:false});}
 async visitAction(button){
 const pair=service.state.sessions.flatMap(s=>s.visits.map(v=>({s,v}))).find(x=>x.v.id===this.selectedVisit);if(!pair)throw Error('Select a visit first.');const {s,v}=pair,base={sessionId:s.id,visitId:v.id},D=env.foundry.applications.api.DialogV2;
 if(button.hasAttribute('data-navigate')){
 const doc=v.journalId&&env.game.journal.get(v.journalId),sector=doc?.getFlag(MODULE,'sector');
 const matches=env.game.journal.filter(j=>{const data=j.getFlag(MODULE,'sector');return data?.version===1&&canonicalCoordinate(data.code)===v.coordinate&&(!data.sceneId||data.sceneId===v.sceneId);});
 const target=sector?.version===1?doc:matches.length===1?matches[0]:null;
 if(!target)throw Error('This historical sector is missing or ambiguous. No sector record was created.');await env.game.myzSectorManager.open(target.id);return;
 }
 if(button.hasAttribute('data-note-add')||button.hasAttribute('data-note-edit')){
 const note=v.notes.find(n=>n.id===button.dataset.noteEdit),value=await this.edit(note?'Edit note':'+ Entry',`<label>Note<textarea name="text" rows="8" maxlength="20000">${esc(note?.text||'')}</textarea></label>`,['text']);if(value)await service.request({...base,action:note?'editNote':'addNote',noteId:note?.id,...value});return;
 }
 if(button.hasAttribute('data-note-delete')||button.hasAttribute('data-visit-delete')){
 const note=button.hasAttribute('data-note-delete');if(!await D.confirm({window:{title:note?'Delete note?':'Delete visit?'},content:note?'<p>Permanently delete this note?</p>':'<p>Permanently delete this visit and its notes? Remaining timestamps will not be rewritten.</p>'}))return;
 await service.request({...base,action:note?'deleteNote':'deleteVisit',noteId:button.dataset.noteDelete});return;
 }
 const value=await this.edit('Correct visit',`<p>Use ISO timestamps with a timezone. End recording before correcting visits.</p><label>Sector<input name="coordinate" value="${esc(v.coordinate)}"></label><label>Arrival<input name="arrivalAt" value="${esc(isoInput(v.arrivalAt))}"></label><label>Departure<input name="departureAt" value="${esc(isoInput(v.departureAt))}"></label>`,['coordinate','arrivalAt','departureAt']);
 if(value){const matches=env.game.journal.filter(j=>{const d=j.getFlag(MODULE,'sector');return d?.version===1&&canonicalCoordinate(d.code)===canonicalCoordinate(value.coordinate)&&(!d.sceneId||d.sceneId===v.sceneId);});await service.request({...base,action:'editVisit',...value,journalId:matches.length===1?matches[0].id:null});}
 }
 };
}
export async function openCampaignLog(service,env=globalThis){
 if(!service.isGM){env.ui.notifications.warn('GM access only.');return;}
 if(service.window?.rendered){service.window.bringToFront();return service.window;}
 // Reuse an opening instance too, preventing double clicks from opening duplicates.
 if(service.opening)return service.opening;
 service.opening=(async()=>{const C=createCampaignLogClass(env.foundry.applications.api.ApplicationV2,service,env);service.window=new C();await service.window.render(true);return service.window;})();
 try{return await service.opening;}finally{service.opening=null;}
}
