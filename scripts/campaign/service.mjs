import {CampaignCombatTracker} from './combat-service.mjs';
import {MODULE} from '../zone/store.mjs';
import {locateToken} from '../zone/grid.mjs';
import {ensureJournalFolders} from '../journal-organization.mjs';
import {emptyLog,validateLog,activeSession,applyCommand,expireLog,exportLog,DURATIONS} from './model.mjs';
export const LOG_SETTING='campaignLogJournalId',LOG_FLAG='campaignLog',COMMAND_FLAG='campaignLogCommand';
// Commands are private embedded Journal pages, never public sockets/User flags.
// Every GM submits an independent page; only activeGM reduces commands into state.
export class CampaignLogService {
 constructor(zone,env=globalThis){this.zone=zone;this.env=env;this.listeners=new Set();this.queue=Promise.resolve();this.hooks=[];this.pendingMovement=new Set();this.combats=new CampaignCombatTracker(this);}
 get isGM(){return Boolean(this.env.game.user?.isGM);}
 get authoritative(){return this.isGM&&this.env.game.users.activeGM?.id===this.env.game.user.id;}
 get document(){const id=this.isGM&&this.env.game.settings.get(MODULE,LOG_SETTING);return id?this.env.game.journal.get(id):null;}
 get state(){if(!this.isGM)throw Error('GM access only.');const doc=this.document,log=doc?doc.getFlag(MODULE,LOG_FLAG):this.emptyState||(this.emptyState=emptyLog());if(log!==this.checkedState){validateLog(log);this.checkedState=log;}return log;}
 register(){
 const settings=this.env.game.settings;
 settings.register(MODULE,LOG_SETTING,{scope:'world',config:false,type:String,default:'',restricted:true,onChange:()=>{this.checkedState=null;this.emit();void this.drain().catch(()=>{});}});
 settings.register(MODULE,'campaignSessionDuration',{name:'Default Campaign Session Duration',hint:'Sets the default recording duration for new Campaign Log sessions.',scope:'world',config:true,type:Number,choices:DURATIONS,default:150,restricted:true});
 }
 subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
 emit(kind='state'){for(const fn of this.listeners){try{fn(kind);}catch(error){this.report(error);}}}
 report(error){this.env.ui?.notifications?.error(`Campaign Log: ${error.message}`);}
 enqueue(task){const result=this.queue.then(task);this.queue=result.catch(error=>this.report(error));return result;}
 async ensureDocument(){
 if(!this.authoritative)return;
 const existing=this.env.game.settings.get(MODULE,LOG_SETTING);
 if(existing&&!this.document)throw Error('Campaign Log Journal is missing. Restore it from backup; a replacement will not be created automatically.');
 if(this.document)return this.document;
 const candidates=this.env.game.journal.filter?.(doc=>doc.getFlag(MODULE,LOG_FLAG))||[];
 if(candidates.length>1)throw Error('Multiple Campaign Log Journals found; restore the correct Journal ID before recording.');
 if(candidates.length===1){validateLog(candidates[0].getFlag(MODULE,LOG_FLAG));await this.env.game.settings.set(MODULE,LOG_SETTING,candidates[0].id);return candidates[0];}
 const folders=await ensureJournalFolders(this.env);if(!this.authoritative)return;
 const doc=await this.env.JournalEntry.create({name:'Campaign Log',folder:folders.root.id,ownership:{default:0},pages:[],flags:{[MODULE]:{[LOG_FLAG]:emptyLog()}}});
 if(!this.authoritative)throw Error('Active GM changed while creating Campaign Log; retry after checking the Configuration folder.');
 await this.env.game.settings.set(MODULE,LOG_SETTING,doc.id);return doc;
 }
 location(groupId){
 const store=this.zone.store,group=store.config.groups.find(g=>g.id===groupId);
 if(!group)return null;
 const found=locateToken(group,store.scene,store.config.grid);
 if(found.status!=='located')return null;
 return {groupId:group.id,sceneId:group.sceneId,tokenId:group.tokenId,coordinate:found.coordinate,journalId:store.sectorRecords(found.coordinate)[0]?.id||null};
 }
 toggle(){
 if(!this.isGM){const error=Error('GM access only.');this.report(error);return Promise.reject(error);}
 if(this.togglePending)return this.togglePending;
 this.togglePending=this.performToggle().catch(error=>{this.report(error);throw error;}).finally(()=>{this.togglePending=null;});return this.togglePending;
 }
 async performToggle(){
 const current=activeSession(this.state),active=current&&Date.parse(current.expiresAt)>Date.now()?current:null;
 const groups=this.zone.store.config.groups,prior=this.state.sessions.at(-1)?.party;
 let group=groups.length===1?groups[0]:groups.find(g=>g.id===prior?.groupId&&g.sceneId===prior.sceneId&&g.tokenId===prior.tokenId);
 if(!active&&!group){const named=groups.filter(g=>/^party$/i.test(g.name?.trim()||''));if(named.length===1)group=named[0];}
 if(!active&&!group)throw Error(groups.length?'Multiple Party/Expedition groups are configured. Start one session from Campaign Log to choose the group for future macros.':'Configure a Party/Expedition token in Zone Map / Tracking before starting a Campaign Log session.');
 const log=await this.request({action:'toggle',expectedActiveId:active?.id||null,groupId:group?.id,durationMinutes:this.env.game.settings.get(MODULE,'campaignSessionDuration')});
 const session=active?log.sessions.find(s=>s.id===active.id):activeSession(log);
 if(!session)throw Error('Recording changed while the toggle completed; check Campaign Log status.');
 if(active)this.env.ui.notifications.info(`Campaign Log: Session ${session.number} ended. Recording stopped.`);
 else{const minutes=session.durationMinutes,hours=Math.floor(minutes/60),remaining=minutes%60,label=[hours?`${hours} ${hours===1?'hour':'hours'}`:'',remaining?`${remaining} ${remaining===1?'minute':'minutes'}`:''].filter(Boolean).join(' ');this.env.ui.notifications.info(`Campaign Log: Session ${session.number} started. Recording for ${label}.`);}
 return log;
 }
 async request(command){
 if(!this.isGM)throw Error('GM access only.');
 if(['move','expire','travelEvent'].includes(command.action))throw Error('Movement and expiration are internal commands.');
 if(!this.document)throw Error('Campaign Log is unavailable. Ensure an active GM is connected and its Journal has not been deleted.');
 const doc=this.document;
 // Foundry enforces GM-only Journal access on the server. No player-controlled transport.
 const [page]=await doc.createEmbeddedDocuments('JournalEntryPage',[{name:'Campaign Log command',type:'text',text:{content:''},flags:{[MODULE]:{[COMMAND_FLAG]:{userId:this.env.game.user.id,command:structuredClone(command)}}}}]);
 const receipt=()=>doc.getFlag(MODULE,LOG_FLAG)?.receipts?.find(r=>r.id===page.id);
 if(this.authoritative)await this.drain().catch(error=>{if(!receipt())throw error;});
 const outcome=receipt()||await new Promise((resolve,reject)=>{
 let timer;const check=()=>{const found=receipt();if(found){clearTimeout(timer);unsubscribe();resolve(found);}};
 const unsubscribe=this.subscribe(check);timer=setTimeout(()=>{unsubscribe();reject(Error('The active GM has not acknowledged this command. It remains queued; check the log before retrying.'));},20000);check();
 });
 if(outcome.error)throw Error(outcome.error);return this.state;
 }
 drain(){
 if(!this.authoritative)return Promise.resolve();
 return this.enqueue(async()=>{
 if(!this.authoritative)return;await this.ensureDocument();if(!this.authoritative)return;
 await this.expire();
 const doc=this.document;if(!doc)return;
 const pages=Array.from(doc.pages||[]).filter(p=>p.getFlag(MODULE,COMMAND_FLAG)).sort((a,b)=>(a._stats?.createdTime||0)-(b._stats?.createdTime||0)||a.id.localeCompare(b.id));
 for(const page of pages){
 if(!this.authoritative)return;
 let state=structuredClone(this.state);
 if(!state.receipts.some(r=>r.id===page.id)){
 const envelope=page.getFlag(MODULE,COMMAND_FLAG);let error;
 try{
 const user=this.env.game.users.get(envelope.userId);
 if(!user?.isGM)throw Error('GM access only.');
 if(['move','expire','travelEvent'].includes(envelope.command?.action))throw Error('Internal commands cannot be submitted.');
 ({log:state}=applyCommand(state,envelope.command,{now:Date.now(),id:()=>this.env.foundry.utils.randomID(),location:id=>this.location(id)}));
 }catch(e){error=e.message;}
 state.receipts.push(error?{id:page.id,error}:{id:page.id,ok:true});
 // Retain all pending receipts; trim only acknowledged, removed commands.
 const pageIds=new Set(Array.from(doc.pages||[]).map(p=>p.id)),stale=state.receipts.filter(r=>!pageIds.has(r.id)),discard=new Set(stale.slice(0,Math.max(0,stale.length-256)).map(r=>r.id));state.receipts=state.receipts.filter(r=>!discard.has(r.id));
 if(!this.authoritative)return;await doc.setFlag(MODULE,LOG_FLAG,state);if(envelope.command.action==='deleteSession'&&!activeSession(state))this.pendingMovement.clear();this.emit();
 }
 if(this.authoritative)await doc.deleteEmbeddedDocuments('JournalEntryPage',[page.id]);
 }
 });
 }
 async expire(now=Date.now()){
 if(!this.authoritative||!this.document)return false;
 const active=activeSession(this.state);if(!active||Date.parse(active.expiresAt)>now)return false;
 const next=structuredClone(this.state);expireLog(next,now);validateLog(next);
 if(!this.authoritative)return false;await this.document.setFlag(MODULE,LOG_FLAG,next);this.emit();this.env.ui.notifications.info('Campaign Log: Session recording finished.');return true;
 }
 movement(token,changes={},stopped=false){
 if(!this.authoritative||!['x','y'].some(k=>k in changes)&&!stopped)return Promise.resolve();
 const s=activeSession(this.state);if(!s||token.id!==s.party.tokenId||token.parent?.id!==s.party.sceneId)return Promise.resolve();
 const identity=token.uuid||`${token.parent?.id}.${token.id}`;
 if(stopped&&!this.pendingMovement.has(identity))return Promise.resolve();
 if(!stopped&&['pending','paused'].includes(token.movement?.state)){this.pendingMovement.add(identity);return Promise.resolve();}
 this.pendingMovement.delete(identity);
 const current=this.location(s.party.groupId),now=Date.now(),sid=s.id;
 if(!current||current.sceneId!==s.party.sceneId||current.tokenId!==s.party.tokenId){if(this.lastInvalid!==identity){this.env.ui.notifications.warn('Campaign Log: Party position is outside the managed Zone or unavailable. The current visit remains open; no location was invented.');this.lastInvalid=identity;}return this.enqueue(()=>this.expire(now));}
 this.lastInvalid=null;
 return this.recordPosition(current,now,sid);
 }
 recordPosition(current,now,sid){return this.enqueue(async()=>{
 if(!this.authoritative)return null;await this.expire(now);const session=activeSession(this.state);if(session?.id!==sid||current.sceneId!==session.party.sceneId||current.tokenId!==session.party.tokenId||current.groupId!==session.party.groupId)return null;
 if(session.visits.at(-1).coordinate!==current.coordinate){const {log}=applyCommand(this.state,{action:'move',location:current},{now,id:()=>this.env.foundry.utils.randomID()});if(!this.authoritative)return null;await this.document.setFlag(MODULE,LOG_FLAG,log);this.emit();}
 const visit=activeSession(this.state)?.visits.at(-1);return visit?{sessionId:sid,visitId:visit.id}:null;
 });}
 captureTravelEntry(context){
 if(!this.authoritative)return Promise.resolve(null);const session=activeSession(this.state);if(!session)return Promise.resolve(null);
 return this.recordPosition({groupId:context.group.id,sceneId:context.group.sceneId,tokenId:context.token.id,coordinate:context.coordinate,journalId:context.journal?.id||null},context.entryAt??Date.now(),session.id);
 }
 recordTravelEvent(event){return this.enqueue(async()=>{
 if(!this.authoritative||event.test||(!event.weatherChange&&!event.encounter))return false;
 await this.expire();const session=activeSession(this.state);if(!session)return false;
 const binding=event.campaignVisit;if(!binding||binding.sessionId!==session.id){if(event.expeditionId===session.party.groupId)this.env.ui.notifications.warn('Campaign Log: Travel Event has no matching recorded destination visit; no note was attached.');return false;}
 const visit=session.visits.find(v=>v.id===binding.visitId);if(!visit){this.env.ui.notifications.warn('Campaign Log: Travel Event destination visit is unavailable; no note was attached.');return false;}
 const {log}=applyCommand(this.state,{action:'travelEvent',sessionId:session.id,visitId:visit.id,event},{now:Date.now(),id:()=>this.env.foundry.utils.randomID()});
 if(session.visits.some(v=>v.travelEventIds?.includes(event.id)))return false;
 if(this.authoritative){await this.document.setFlag(MODULE,LOG_FLAG,log);this.emit();return true;}return false;
 });}

 start(){
 if(!this.isGM||this.hooks.length)return;
 this.combats.start();
 const on=(name,fn)=>this.hooks.push([name,this.env.Hooks.on(name,fn)]);
 let authority=this.env.game.users.activeGM?.id,wasGM=this.isGM;
 const recover=()=>{queueMicrotask(()=>{const next=this.env.game.users.activeGM?.id;if(next===authority&&wasGM===this.isGM)return;authority=next;wasGM=this.isGM;this.emit();if(this.isGM)void this.drain().catch(()=>{});});};
 on('createJournalEntryPage',page=>{if(page.parent?.id===this.document?.id)void this.drain().catch(()=>{});});
 on('updateJournalEntry',doc=>{if(doc.id===this.document?.id){this.checkedState=null;this.emit();}});
 on('deleteJournalEntry',doc=>{if(doc.id===this.env.game.settings.get(MODULE,LOG_SETTING)){this.emit();this.report(Error('Campaign Log Journal was deleted. Restore it from backup.'));}});
 on('updateUser',recover);on('userConnected',recover);
 on('updateToken',(token,changes)=>{void this.movement(token,changes).catch(error=>this.report(error));});
 on('moveToken',token=>{void this.movement(token,{x:token.x,y:token.y}).catch(error=>this.report(error));});
 on('stopToken',token=>{void this.movement(token,{},true).catch(error=>this.report(error));});
 this.timer=setInterval(()=>{if(!this.isGM)return;this.emit('tick');if(this.authoritative&&this.document){try{const s=activeSession(this.state);if(s&&Date.parse(s.expiresAt)<=Date.now())void this.enqueue(()=>this.expire()).catch(()=>{});}catch(error){if(!this.invalidReported){this.invalidReported=true;this.report(error);}}}},1000);this.timer.unref?.();
 void this.drain().catch(()=>{});
 }
 stop(){this.combats.stop();clearInterval(this.timer);for(const [name,id] of this.hooks)this.env.Hooks.off(name,id);this.hooks=[];}
 export(){if(!this.isGM)throw Error('GM access only.');return exportLog(this.state,this.env.game.world);}
}
