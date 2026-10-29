import {partyResultCard} from './party-skill-results.mjs';
import {PARTY_SKILLS,partyRecipients,resolvePartySkill,partySkillPool} from './party-skills.mjs';
import {escapeHTML as esc} from './travel/model.mjs';
function summaryDice(target){
 try{return partyResultCard({name:target.name,portrait:target.portrait,robot:target.robot,result:target.result});}
 catch(error){return `<p>Dice display unavailable: ${esc(error.message)}</p>`;}
}
export function summaryContent(request,env=globalThis){
 if(!env.game.user.isGM)throw new Error('GM summary only.');
 const now=Date.now();return `<div style="overflow-x:auto"><table><thead><tr><th>Character</th><th>Skill</th><th>Modifier</th><th>Successes</th><th>Status</th></tr></thead><tbody>${request.targets.map(t=>{const user=env.game.users.get?.(t.userId)||Array.from(env.game.users).find(u=>u.id===t.userId),status=t.state==='pending'?(request.expires<=now?'Expired':!user?.active?'Disconnected':'Pending'):t.state==='rolling'?'Pending (evaluating)':t.state==='submitted'?'Completed':t.state[0].toUpperCase()+t.state.slice(1);return `<tr><td>${esc(t.name)}</td><td>${esc(t.skill)}</td><td>${request.modifier}</td><td>${t.result?esc(t.result.successes):'—'}</td><td>${esc(status)}</td></tr>${t.result||t.error?`<tr><td colspan="5">${t.error?`<p>Failed: ${esc(t.error)}</p>`:''}${t.result?`<details><summary>Full dice details: ${esc(t.name)}</summary>${summaryDice(t)}${t.result.messageUuid?`<a class="content-link" data-uuid="${esc(t.result.messageUuid)}">Open GM chat result</a>`:''}</details>`:''}</td></tr>`:''}`;}).join('')}</tbody></table></div>`;
}
export function openPartySummary(service,request,env=globalThis){
 if(!env.game.user.isGM)throw new Error('GM summary only.');
 const existing=service.summaryDialog;if(existing&&!existing.partyClosed){existing.partyRefresh();existing.bringToFront?.();return existing;}
 const content=()=>Array.from(service.requests.values()).map(r=>`<section data-party-request="${esc(r.id)}"><h3>${esc(PARTY_SKILLS.find(s=>s.key===r.key)?.label||r.key)} · Modifier ${r.modifier}</h3>${summaryContent(r,env)}</section>`).join('')||'<p>No requests.</p>';
 const dialog=new env.foundry.applications.api.DialogV2({classes:['myz-party-summary'],window:{title:'Blind Party Skill Roll Summary',resizable:true},position:{width:700},content:`<div data-party-summary style="max-height:65vh;overflow:auto">${content()}</div>`,buttons:[{action:'close',label:'Close'}]});
 service.summaryDialog=dialog;
 const refresh=()=>{const target=dialog.element?.querySelector('[data-party-summary]');if(!target)return;const open=new Set(Array.from(target.querySelectorAll('details[open]'),d=>d.closest('[data-party-request]')?.dataset.partyRequest+':'+d.querySelector('summary')?.textContent));target.innerHTML=content();for(const details of target.querySelectorAll('details'))if(open.has(details.closest('[data-party-request]')?.dataset.partyRequest+':'+details.querySelector('summary')?.textContent))details.open=true;};
 dialog.partyRefresh=refresh;const unsubscribe=service.subscribe(refresh);
 // render/close callbacks belong to DialogV2.wait; constructed v14 apps emit events.
 dialog.addEventListener('render',refresh);
 dialog.addEventListener('close',()=>{unsubscribe();dialog.partyClosed=true;if(service.summaryDialog===dialog)service.summaryDialog=null;});
 dialog.render({force:true});return dialog;
}
export async function openPartySkillRequest(service,env=globalThis){
 if(!env.game.user.isGM||!service.isGM())throw new Error('Only the active GM can request party skill rolls.');
 const recipients=await partyRecipients(env),skillOptions=PARTY_SKILLS.map(s=>`<option value="${s.key}">${esc(s.label)}${s.robotLabel&&s.robotLabel!==s.label?' / '+esc(s.robotLabel):!s.robotKey?' (Robot unsupported)':''}</option>`).join('');
 const content=`<style>.myz-party-skills{max-width:calc(100vw - 24px)}.myz-party-skills .window-content{overflow:auto}.myz-party-skills table{width:100%}.myz-party-skills select{max-width:100%}.myz-party-skills td{overflow-wrap:anywhere}</style><label>Basic skill<select data-party-skill>${skillOptions}</select></label><label>Skill modifier<input type="number" data-party-modifier value="0" min="-100" max="100" step="1"></label><p>Review one roster character per connected player. Ambiguous choices require selection. No roll happens until that player clicks Roll.</p><div style="max-height:50vh;overflow:auto"><table><thead><tr><th>Include</th><th>Player</th><th>Character</th><th>Skill / availability</th></tr></thead><tbody>${recipients.map((r,i)=>`<tr data-party-recipient="${i}"><td><input type="checkbox" data-party-include ${r.user.active&&r.actors.length?'checked':''} ${!r.user.active||!r.actors.length?'disabled':''} aria-label="Include ${esc(r.user.name)}"></td><td>${esc(r.user.name)}</td><td><select data-party-actor ${!r.user.active||!r.actors.length?'disabled':''}><option value="">${r.actors.length>1?'Choose a character':'Unavailable'}</option>${r.actors.map(a=>`<option value="${esc(a.uuid)}" ${a.uuid===r.preferred?'selected':''}>${esc(a.name)}</option>`).join('')}</select></td><td data-party-availability></td></tr>`).join('')}</tbody></table></div><p data-party-validation role="status"></p>`;
 const selected=await env.foundry.applications.api.DialogV2.wait({classes:['myz-party-skills'],position:{width:760},window:{title:'Request Party Skill Roll',resizable:true},content,buttons:[{action:'cancel',label:'Cancel',default:true,callback:()=>null},{action:'request',label:'Request Blind Rolls',callback:(event,button,dialog)=>{const root=dialog.element,key=root.querySelector('[data-party-skill]').value,raw=root.querySelector('[data-party-modifier]').value,modifier=raw.trim()===''?NaN:Number(raw),selections=[];for(const row of root.querySelectorAll('[data-party-recipient]'))if(row.querySelector('[data-party-include]').checked)selections.push({userId:recipients[Number(row.dataset.partyRecipient)].user.id,actorUuid:row.querySelector('[data-party-actor]').value});return {key,modifier,selections};}}],render:(event,dialog)=>{
  const root=dialog.element,update=()=>{const key=root.querySelector('[data-party-skill]').value,raw=root.querySelector('[data-party-modifier]').value,modifier=raw.trim()===''?NaN:Number(raw);let valid=Number.isSafeInteger(modifier)&&Math.abs(modifier)<=100,count=0;
   for(const row of root.querySelectorAll('[data-party-recipient]')){const recipient=recipients[Number(row.dataset.partyRecipient)],checkbox=row.querySelector('[data-party-include]'),actor=recipient.actors.find(a=>a.uuid===row.querySelector('[data-party-actor]').value),status=row.querySelector('[data-party-availability]');
    if(!recipient.user.active){status.textContent='Unavailable — disconnected';checkbox.disabled=true;checkbox.checked=false;continue;}
    if(!actor){status.textContent=recipient.actors.length?'Choose an authorized roster character':'Unavailable — no eligible roster character';if(checkbox.checked)valid=false;continue;}
    try{const skill=resolvePartySkill(actor,key);partySkillPool(actor,key,Number.isSafeInteger(modifier)?modifier:0);status.textContent=skill.label;checkbox.disabled=false;if(checkbox.checked)count++;}catch(error){status.textContent=`Unsupported: ${error.message}`;checkbox.disabled=true;checkbox.checked=false;}
   }
   const button=root.querySelector('[data-action="request"]');if(button)button.disabled=!valid||!count;root.querySelector('[data-party-validation]').textContent=!valid?'Review character choices and the integer modifier.':!count?'Select at least one supported connected character.':'';
  };for(const input of root.querySelectorAll('input,select'))input.addEventListener('change',update);root.querySelector('[data-party-modifier]').addEventListener('input',update);update();},close:()=>null,rejectClose:false});
 if(!selected)return null;
 const request=await service.create(selected.key,selected.modifier,selected.selections);return openPartySummary(service,request,env);
}
