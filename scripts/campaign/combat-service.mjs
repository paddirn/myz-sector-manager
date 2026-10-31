import {activeSession,validateLog} from './model.mjs';
import {combatIdentity,combatStarted,documents,encounterSnapshot,participantSnapshot,mergeParticipants,combatNoteText,COMBAT_NOTE_LIMIT} from './combat.mjs';
import {sectorName} from '../journal-organization.mjs';
const MODULE='myz-sector-manager',FLAG='campaignLog';
// Shares CampaignLogService's authoritative GM, private Journal and serialized queue.
export class CampaignCombatTracker {
 constructor(service){this.service=service;this.env=service.env;this.hooks=[];this.started=new Map();}
 report(error,context){this.env.console?.error('MYZ Campaign Log combat recording',error,context);if(this.service.isGM)this.env.ui?.notifications?.error('Campaign Log: Combat recording failed. Combat is unaffected; check the log before retrying. Technical details are in the console.');}
 schedule(task,context){return this.service.enqueue(async()=>{try{await task();}catch(error){this.report(error,context);}});}
 start(){
  if(!this.service.isGM||this.hooks.length)return;
  // Existing started combats without a saved binding are intentionally not adopted.
  for(const combat of documents(this.env.game.combats))this.started.set(combatIdentity(combat),Boolean(combatStarted(combat)));
  const on=(name,fn)=>this.hooks.push([name,this.env.Hooks.on(name,(...args)=>{try{fn(...args);}catch(error){this.report(error);}})]);
  on('createCombat',combat=>{this.started.set(combatIdentity(combat),Boolean(combatStarted(combat)));if(combatStarted(combat))void this.begin(combat);});
  on('updateCombat',(combat,changes)=>{
   const key=combatIdentity(combat),prior=this.started.get(key);if(combatStarted(combat)){this.started.set(key,true);if(prior===false){void this.begin(combat);return;}}
   // Turns and resets never finalize, and do not scan or persist the roster.
   if(Object.hasOwn(changes,'name'))void this.observe(combat);
  });
  for(const hook of ['createCombatant','updateCombatant','preDeleteCombatant','deleteCombatant'])on(hook,(participant,changes={})=>{
   if(hook==='updateCombatant'&&!['name','defeated','actorId','tokenId'].some(key=>Object.hasOwn(changes,key)))return;
   if(participant.parent)void this.observe(participant.parent,[participantSnapshot(participant)]);
  });
  // preDelete runs on the requester: capture synchronously, never await or veto deletion.
  on('preDeleteCombat',combat=>{void this.observe(combat);});
  // The confirmed document deletion is the normal End Combat/direct-delete completion.
  on('deleteCombat',(combat,options,userId)=>{
   if(userId&&this.env.game.users.get?.(userId)?.isGM===false)return;
   void this.finalize(combat);this.started.delete(combatIdentity(combat));
  });
 }
 stop(){for(const [name,id] of this.hooks)this.env.Hooks.off(name,id);this.hooks=[];this.started.clear();}
 begin(combat){
  if(!this.service.authoritative)return Promise.resolve();
  const now=Date.now(),session=activeSession(this.service.state);
  if(!session||Date.parse(session.expiresAt)<=now)return Promise.resolve();
  const snap=encounterSnapshot(combat,this.env);if(!snap.combatUuid)return Promise.resolve();
  const current=this.service.location(session.party.groupId),visit=session.visits.find(v=>v.departureAt===null&&v.sceneId===snap.sceneId&&current?.sceneId===snap.sceneId&&current.coordinate===v.coordinate);
  const sector=visit?.journalId?this.env.game.journal.get(visit.journalId)?.getFlag(MODULE,'sector'):null;
  const record={...snap,participants:mergeParticipants([],snap.participants),sessionId:session.id,visitId:visit?.id||null,coordinate:visit?.coordinate||null,sectorName:sector?sectorName(sector):'',startedAt:new Date(now).toISOString(),state:'tracking'};
  return this.schedule(async()=>{
   if(!this.service.authoritative)return;const current=activeSession(this.service.state);
   if(current?.id!==record.sessionId||Date.parse(current.expiresAt)<=Date.now())return;
   const log=structuredClone(this.service.state);log.combatEncounters??=[];if(log.combatEncounters.some(r=>r.combatUuid===record.combatUuid))return;
   log.combatEncounters.push(record);await this.save(log);
  },record);
 }
 observe(combat,participants){
  if(!this.service.authoritative)return Promise.resolve();
  const snapshot=encounterSnapshot(combat,this.env,!participants);
  const roster=participants||snapshot.participants;
  return this.schedule(async()=>{
   if(!this.service.authoritative)return;const log=structuredClone(this.service.state),record=log.combatEncounters?.find(r=>r.combatUuid===snapshot.combatUuid&&r.state==='tracking');if(!record)return;
   const before=JSON.stringify(record);record.participants=mergeParticipants(record.participants,roster);record.name=snapshot.name==='Unnamed encounter'?record.name:snapshot.name;
   if(JSON.stringify(record)!==before)await this.save(log);
  },snapshot);
 }
 finalize(combat){
  if(!this.service.authoritative)return Promise.resolve();
  // Copy while the deleted document still exists; queued work never dereferences it.
  const snapshot=encounterSnapshot(combat,this.env),completedAt=new Date().toISOString();
  return this.schedule(async()=>{
   if(!this.service.authoritative)return;
   const log=structuredClone(this.service.state),record=log.combatEncounters?.find(r=>r.combatUuid===snapshot.combatUuid);if(!record||record.state!=='tracking')return;
   record.participants=mergeParticipants(record.participants,snapshot.participants);if(snapshot.name!=='Unnamed encounter')record.name=snapshot.name;
   const prior=log.sessions.flatMap(s=>[...(s.notes||[]),...s.visits.flatMap(v=>v.notes)]).find(n=>n.combatUuid===record.combatUuid);
   const session=activeSession(log);
   if(prior){record.state='completed';record.noteId=prior.id;}
   else if(session?.id!==record.sessionId||Date.parse(session.expiresAt)<=Date.now())record.state='discarded';
   else{
    const visit=session.visits.find(v=>v.id===record.visitId),text=combatNoteText(record,completedAt);if(text.length>COMBAT_NOTE_LIMIT)throw Error('Combat summary exceeds the supported note size; snapshot retained.');
    const note={id:this.env.foundry.utils.randomID(),visitId:visit?.id||null,createdAt:completedAt,modifiedAt:null,text,category:'Combat Encounter',combatUuid:record.combatUuid};
    if(visit)visit.notes.push(note);else{session.notes??=[];session.notes.push(note);}
    record.state='completed';record.noteId=note.id;
   }
   record.completedAt=completedAt;await this.save(log);
  },snapshot);
 }
 async save(log){validateLog(log);if(!this.service.authoritative)return;await this.service.document.setFlag(MODULE,FLAG,log);this.service.emit();}
}
