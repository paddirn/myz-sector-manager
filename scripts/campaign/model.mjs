import {canonicalCoordinate} from '../zone/grid.mjs';
export const CAMPAIGN_VERSION=1;
export const DURATIONS=Object.fromEntries(Array.from({length:12},(_,i)=>[(i+1)*30,`${Math.floor((i+1)/2)}h ${(i+1)%2?30:0}m`]));
export const emptyLog=()=>({version:CAMPAIGN_VERSION,nextSessionNumber:1,sessions:[],receipts:[]});
export const activeSession=log=>log.sessions.find(session=>session.status==='active');
export function timestamp(value){if(typeof value!=='number'&&(typeof value!=='string'||!/[Tt].*(?:[Zz]|[+-]\d{2}:?\d{2})$/.test(value)))throw Error('Enter a valid ISO real-world timestamp with a timezone.');const ms=typeof value==='number'?value:Date.parse(value);if(!Number.isFinite(ms))throw Error('Enter a valid real-world timestamp.');return new Date(ms).toISOString();}
export function duration(value){const n=Number(value);if(!Number.isInteger(n)||n<30||n>360||n%30)throw Error('Choose a duration from 30 to 360 minutes in 30-minute increments.');return n;}
const text=(value,max)=>{if(typeof value!=='string'||value.length>max)throw Error(`Text must contain at most ${max} characters.`);return value;};
export function validateLog(log){
 if(log?.version!==1||!Array.isArray(log.sessions)||!Number.isSafeInteger(log.nextSessionNumber)||log.nextSessionNumber<1||!Array.isArray(log.receipts))throw Error('Unsupported or invalid Campaign Log data; recording is disabled. Saved data has not been changed.');
 if(log.sessions.filter(s=>s.status==='active').length>1)throw Error('Campaign Log has multiple active sessions; saved data has not been changed.');
 const ids=new Set(),numbers=new Set();
 const unique=id=>{if(typeof id!=='string'||!id||ids.has(id))throw Error('Campaign Log contains invalid or duplicate IDs.');ids.add(id);};
 for(const s of log.sessions){unique(s.id);if(!Number.isSafeInteger(s.number)||s.number<1||numbers.has(s.number)||s.number>=log.nextSessionNumber)throw Error('Invalid session numbering.');numbers.add(s.number);duration(s.durationMinutes);timestamp(s.startAt);timestamp(s.expiresAt);if(!['active','completed'].includes(s.status)||!Array.isArray(s.visits)||!s.visits.length)throw Error('Invalid session state or missing initial visit.');if(s.status==='completed')timestamp(s.endAt);else if(s.endAt!==null)throw Error('Active sessions cannot have an end timestamp.');
 if(!s.party?.sceneId||!s.party.tokenId||!s.party.groupId)throw Error('Missing session Party identity.');
 for(const v of s.visits){unique(v.id);if(v.sessionId!==s.id||!canonicalCoordinate(v.coordinate)||!v.sceneId||!Array.isArray(v.notes))throw Error('Invalid sector visit.');timestamp(v.arrivalAt);if(v.departureAt!==null)timestamp(v.departureAt);for(const n of v.notes){unique(n.id);if(n.visitId!==v.id)throw Error('Invalid note relationship.');timestamp(n.createdAt);if(n.modifiedAt)timestamp(n.modifiedAt);text(n.text,20000);}}
 if(timelineWarnings(s).length)throw Error(timelineWarnings(s).join(' '));
 }
 return log;
}
export function timelineWarnings(session){
 const warnings=[],start=Date.parse(session.startAt),end=session.endAt?Date.parse(session.endAt):Date.parse(session.expiresAt);
 if(end<start)warnings.push('Session end must not precede its start.');
 let previous=-Infinity,previousDeparture=-Infinity,open=0;
 for(const v of session.visits){const a=Date.parse(v.arrivalAt),d=v.departureAt===null?null:Date.parse(v.departureAt);
 if(a<start)warnings.push(`${v.coordinate}: visit begins before the session.`);
 if(a>end||d!==null&&d>end)warnings.push(`${v.coordinate}: visit ends after the session.`);
 if(d!==null&&d<a)warnings.push(`${v.coordinate}: departure precedes arrival.`);
 if(a<previous||a<previousDeparture)warnings.push(`${v.coordinate}: visit order overlaps an earlier visit.`);
 previous=a;previousDeparture=d??a;if(d===null)open++;
 }
 if(open>1||session.status==='active'&&(open!==1||session.visits.at(-1)?.departureAt!==null)||session.status==='completed'&&open)warnings.push('A recording needs exactly one open final visit; completed sessions cannot have open visits.');
 return [...new Set(warnings)];
}
export function finishSession(session,at){session.visits.at(-1).departureAt=at;session.endAt=at;session.status='completed';}
export function expireLog(log,now){const s=activeSession(log);if(!s||Date.parse(s.expiresAt)>now)return false;finishSession(s,s.expiresAt);return true;}
export function applyCommand(saved,command,{now=Date.now(),id=()=>globalThis.crypto.randomUUID(),location=()=>null}={}){
 validateLog(saved);const log=structuredClone(saved),expired=expireLog(log,now),at=timestamp(now);
 const {action}=command;let s=log.sessions.find(s=>s.id===command.sessionId),v=s?.visits.find(v=>v.id===command.visitId);
 const session=()=>{if(!s)throw Error('The selected session no longer exists.');return s;};
 const visit=()=>{session();if(!v)throw Error('The selected visit no longer exists.');return v;};
 switch(action){
 case 'start':{
 if(activeSession(log))throw Error('A Campaign Log session is already recording.');
 const where=location(command.groupId);if(!where?.coordinate)throw Error('Locate a designated Party/Expedition token inside the managed Zone before starting.');
 const minutes=duration(command.durationMinutes),sid=id();s={id:sid,number:log.nextSessionNumber++,title:text(command.title??'',200),startAt:at,endAt:null,durationMinutes:minutes,expiresAt:timestamp(now+minutes*60000),status:'active',party:{groupId:where.groupId,sceneId:where.sceneId,tokenId:where.tokenId},visits:[]};
 s.visits.push(newVisit(s,where,at,id));log.sessions.push(s);break;}
 case 'end':session();if(s.status!=='active')throw Error('This session has already ended.');finishSession(s,at);break;
 case 'extend':session();if(s.status!=='active')throw Error('Expired or completed sessions cannot be extended.');if(![30,60].includes(command.minutes))throw Error('Extend by 30 or 60 minutes.');s.expiresAt=timestamp(Date.parse(s.expiresAt)+command.minutes*60000);break;
 case 'move':{
 s=activeSession(log);if(!s)break;
 const w=command.location;if(!w||w.sceneId!==s.party.sceneId||w.tokenId!==s.party.tokenId||w.groupId!==s.party.groupId||!canonicalCoordinate(w.coordinate))break;
 if(s.visits.at(-1).coordinate===w.coordinate)break;
 s.visits.at(-1).departureAt=at;s.visits.push(newVisit(s,w,at,id));break;}
 case 'expire':break;
 case 'title':session().title=text(command.title,200);break;
 case 'editSession':session();if(s.status==='active')throw Error('End recording before correcting session timestamps.');s.startAt=timestamp(command.startAt);s.endAt=timestamp(command.endAt);break;
 case 'editVisit':visit();if(s.status==='active')throw Error('End recording before correcting visits.');if(!canonicalCoordinate(command.coordinate))throw Error('Use sector coordinates such as F5.');v.coordinate=canonicalCoordinate(command.coordinate);v.journalId=command.journalId||null;v.arrivalAt=timestamp(command.arrivalAt);v.departureAt=timestamp(command.departureAt);break;
 case 'deleteVisit':visit();if(s.status==='active')throw Error('End recording before deleting visits.');if(s.visits.length===1)throw Error('Keep at least one visit in a session.');s.visits=s.visits.filter(x=>x!==v);break;
 case 'addNote':visit();v.notes.push({id:id(),visitId:v.id,createdAt:at,modifiedAt:null,text:text(command.text,20000)});break;
 case 'editNote':case 'deleteNote':{
 visit();const note=v.notes.find(n=>n.id===command.noteId);if(!note)throw Error('The selected note no longer exists.');if(action==='editNote'){note.text=text(command.text,20000);note.modifiedAt=at;}else v.notes=v.notes.filter(n=>n!==note);break;}
 default:throw Error('Unknown Campaign Log command.');
 }
 validateLog(log);return {log,expired};
}
function newVisit(s,where,at,id){return {id:id(),sessionId:s.id,coordinate:canonicalCoordinate(where.coordinate),sceneId:where.sceneId,journalId:where.journalId||null,arrivalAt:at,departureAt:null,notes:[]};}
export function exportLog(log,world,now=Date.now()){
 validateLog(log);return {format:'myz-campaign-log',version:1,exportedAt:timestamp(now),world:{id:String(world?.id||''),title:String(world?.title||'')},sessions:structuredClone(log.sessions)};
}
export function countdown(log,now=Date.now()){const s=activeSession(log);if(!s)return 'Not recording';const seconds=Math.max(0,Math.ceil((Date.parse(s.expiresAt)-now)/1000));return `${[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(v=>String(v).padStart(2,'0')).join(':')} remaining`;}
