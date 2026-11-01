export const MODULE='myz-sector-manager',TRAVEL_SETTING='travelEventsConfiguration',ROSTER_SETTING='partyRoster',STATE_FLAG='travelEvents';
export const travelDefaults=()=>({version:1,enabled:true,debug:false,normalEntry:true,weatherChance:12,encounterChance:12,reduceExplored:true,exploredChance:20,autoFindPath:true,stalkerMode:'all',showDialog:true,recordHistory:true,historyLimit:200});
export const rosterDefaults=()=>({version:1,members:[]});
export const travelStateDefaults=()=>({version:1,weather:null,weatherChangedAt:null,weatherRevision:0,history:[],processed:[],diagnostics:[]});
export function validateTravelConfiguration(raw){
 const next={...travelDefaults(),...raw};if(next.version!==1)throw new Error('Unsupported Travel Events configuration.');
 for(const key of ['enabled','debug','normalEntry','reduceExplored','autoFindPath','showDialog','recordHistory'])if(typeof next[key]!=='boolean')throw new Error(`${key} must be true or false.`);
 for(const key of ['weatherChance','encounterChance','exploredChance'])if(!Number.isSafeInteger(next[key])||next[key]<1||next[key]>1000000)throw new Error(`${key} must be a whole 1-in-N denominator from 1 to 1000000.`);
 if(!['all','lead'].includes(next.stalkerMode))throw new Error('Choose all eligible Stalkers or lead Stalker only.');
 if(!Number.isSafeInteger(next.historyLimit)||next.historyLimit<10||next.historyLimit>1000)throw new Error('History retention must be 10–1000 delivered events.');return next;
}
export function validateRoster(raw){
 if(raw?.version!==1||!Array.isArray(raw.members)||raw.members.length>100)throw new Error('Party Roster must have version 1 and at most 100 members.');
 const seen=new Set();for(const member of raw.members){
  if(!member||typeof member.actorUuid!=='string'||member.actorUuid.length>512||!/^[A-Za-z0-9_.-]+$/.test(member.actorUuid))throw new Error('Each roster member needs a full Actor UUID.');
  if(typeof member.groupId!=='string'||member.groupId.length>128||typeof member.enabled!=='boolean'||typeof member.lead!=='boolean'||!['auto','include','exclude'].includes(member.eligibility))throw new Error('Invalid roster assignment, enabled state, lead state or eligibility.');
  if(member.skillUuid!==undefined&&(typeof member.skillUuid!=='string'||member.skillUuid.length>512))throw new Error('Invalid skill reference.');
  const key=JSON.stringify([member.actorUuid,member.groupId]);if(seen.has(key))throw new Error('An Actor may appear only once in each roster.');seen.add(key);
 }
 const groups=new Set(raw.members.map(member=>member.groupId));for(const group of groups)if(raw.members.filter(member=>member.groupId===group&&member.lead).length>1)throw new Error('Choose only one lead Stalker per roster.');
 return structuredClone(raw);
}
export const travelConfiguration=(env=globalThis)=>validateTravelConfiguration(env.game.settings.get(MODULE,TRAVEL_SETTING)||travelDefaults());
export const partyRoster=(env=globalThis)=>validateRoster(env.game.settings.get(MODULE,ROSTER_SETTING)||rosterDefaults());
export function expeditionRoster(roster,group,groups){
 const assigned=roster.members.filter(member=>member.groupId===group.id);
 return assigned.length?assigned:groups.length===1?roster.members.filter(member=>member.groupId===''):[];
}
export const exploredSector=sector=>['Explored','Cleared'].includes(sector?.status);
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function pruneTravelState(state,limit=200){
 const pending=state.history.filter(event=>event.pending),delivered=state.history.filter(event=>!event.pending).slice(-limit);state.history=[...pending,...delivered].sort((a,b)=>a.timestamp-b.timestamp);state.processed=state.processed.slice(-1000);state.diagnostics=state.diagnostics.slice(-50);return state;
}
