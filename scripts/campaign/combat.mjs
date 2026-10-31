// Plain saved snapshots only: no Documents, rolls, Actor writes or combat mechanics.
export const COMBAT_NOTE_LIMIT=1000000;
export const combatIdentity=combat=>combat?.uuid|| (combat?.id?`Combat.${combat.id}`:null);
export const combatStarted=combat=>combat?.started??Number(combat?.round)>0;
export const documents=collection=>collection?.contents||Array.from(collection?.values?.()||collection||[]);
const label=(value,fallback='')=>typeof value==='string'&&value.trim()?value:fallback;
export function participantSnapshot(combatant){
 const id=combatant?.id||combatant?.uuid;if(!id)return null;
 return {id:String(id),name:label(combatant.name, label(combatant.token?.name,label(combatant.actor?.name))),actorUuid:combatant.actor?.uuid||'',actorId:combatant.actorId||'',defeated:typeof combatant.defeated==='boolean'?combatant.defeated:null};
}
export function mergeParticipants(previous=[],observed=[]){
 const result=previous.map(p=>({...p})),indices=new Map(result.map((p,i)=>[p.id,i]));
 for(const raw of observed){if(!raw)continue;const index=indices.get(raw.id),prior=index===undefined?null:result[index];
  const next={id:raw.id,name:raw.name||prior?.name||'Unnamed combatant',actorUuid:raw.actorUuid||prior?.actorUuid||(raw.actorId?`Actor.${raw.actorId}`:''),defeated:raw.defeated??prior?.defeated??false};
  if(index===undefined){indices.set(next.id,result.length);result.push(next);}else result[index]=next;
 }return result;
}
export function encounterSnapshot(combat,env=globalThis,includeRoster=true){
 const scene=combat.scene||env.game.scenes?.get?.(combat.sceneId);
 return {combatUuid:combatIdentity(combat),combatId:String(combat.id||''),name:label(combat.name,'Unnamed encounter'),sceneId:scene?.id||combat.sceneId||null,sceneName:label(scene?.name),participants:includeRoster?documents(combat.combatants).map(participantSnapshot).filter(Boolean):[]};
}
export function combatNoteText(encounter){
 const lines=['Combat Encounter'];
 for(const defeated of [true,false]){
  const participants=encounter.participants.filter(p=>p.defeated===defeated);if(!participants.length)continue;
  const groups=new Map();for(const p of participants)groups.set(p.name,(groups.get(p.name)||0)+1);
  lines.push('',`${defeated?'Defeated':'Other Participants'} (${participants.length})`);
  for(const [name,count] of groups)lines.push(`- ${name}${defeated||count>1?` ×${count}`:''}`);
 }
 if(!encounter.participants.length)lines.push('','No combatants were observed.');
 // Completion time is already shown by the note header from the saved createdAt.
 return lines.join('\n');
}
export function validateCombatTracking(records){
 if(records===undefined)return;
 if(!Array.isArray(records))throw Error('Invalid Campaign Log combat tracking.');
 const seen=new Set();for(const r of records){
  if(!r?.combatUuid||typeof r.combatUuid!=='string'||seen.has(r.combatUuid)||!r.sessionId||!['tracking','completed','discarded'].includes(r.state)||typeof r.name!=='string'||!Number.isFinite(Date.parse(r.startedAt))||!Array.isArray(r.participants))throw Error('Invalid or duplicate Campaign Log combat encounter.');
  seen.add(r.combatUuid);const ids=new Set();for(const p of r.participants){if(!p?.id||typeof p.id!=='string'||ids.has(p.id)||typeof p.name!=='string'||typeof p.actorUuid!=='string'||typeof p.defeated!=='boolean')throw Error('Invalid saved combat participant.');ids.add(p.id);}
 }
}
