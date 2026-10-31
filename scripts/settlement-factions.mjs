import {requireDocument,checkDocument} from './ui/documents.mjs';
const id=()=>globalThis.foundry?.utils?.randomID?.()||globalThis.crypto.randomUUID();
const legacyFields={details:'Description',description:'Description',leader:'Leader',goals:'Goals',resources:'Resources',disposition:'Relationship to Party',relationship:'Relationship to Party',allies:'Allies',rivals:'Rivals',tensions:'Current Tensions',notes:'GM Notes'};
export function normalizeFaction(raw){
 if(raw.info!==undefined&&typeof raw.info!=='string')throw new Error('Invalid Faction Info. Record was not changed.');
 const next={...raw};if(next.membersVersion!==undefined&&next.membersVersion!==1)throw new Error('Unsupported Faction Members version. Record was not changed.');if(next.infoVersion!==undefined&&next.infoVersion!==1)throw new Error('Unsupported Faction Info version. Record was not changed.');
 if(next.infoVersion!==1){
  const sections=Object.entries(legacyFields).filter(([key])=>String(raw[key]??'').trim()).map(([key,label])=>`${label}: ${raw[key]}`);
  next.info=[String(raw.info??''),...sections].filter(value=>value.trim()).join('\n\n');next.infoVersion=1;
 }
 if(typeof next.info!=='string')throw new Error('Invalid Faction Info. Record was not changed.');
 if(raw.members!==undefined&&!Array.isArray(raw.members))throw new Error('Invalid Faction Members. Record was not changed.');
 const source=[...(raw.members||[]),...(!raw.membersVersion?[...(Array.isArray(raw.actorUuids)?raw.actorUuids:[]),...(Array.isArray(raw.actors)?raw.actors:[])]:[])],seen=new Set(),ids=new Set();
 next.members=[];
 for(const value of source){
  const member=typeof value==='string'?{uuid:value}:{...value},uuid=member.uuid||member.actorUuid;
  if(typeof uuid!=='string'||!uuid.trim())throw new Error('Invalid Faction Actor reference. Record was not changed.');
  if(seen.has(uuid))continue;seen.add(uuid);member.uuid=uuid;if(typeof member.id!=='string'||!member.id||ids.has(member.id))member.id=id();ids.add(member.id);next.members.push(member);
 }
 next.membersVersion=1;return next;
}
export function addFactionMember(faction,actor){
 if(actor?.documentName!=='Actor'||!actor.uuid)throw new Error('Drop a saved Foundry Actor document.');
 const existing=faction.members.find(member=>member.uuid===actor.uuid);if(existing)return {member:existing,duplicate:true};
 const member={id:id(),uuid:actor.uuid};faction.members.push(member);return {member,duplicate:false};
}
export async function resolveFactionActor(payload,env=globalThis){
 if(!payload||typeof payload!=='object'||(payload.type&&payload.type!=='Actor')||(!payload.uuid&&payload.type!=='Actor'))throw new Error('Drop a Foundry Actor from the directory or a Compendium.');
 const ActorClass=env.CONFIG?.Actor?.documentClass||env.Actor?.implementation||env.Actor;
 const actor=ActorClass?.fromDropData?await ActorClass.fromDropData(payload):payload.uuid?await requireDocument(payload.uuid,'Actor',env):null;
 if(actor?.documentName!=='Actor'||!actor.uuid)throw new Error('The Actor is missing, inaccessible or invalid.');return checkDocument(actor,'Actor',env);
}
