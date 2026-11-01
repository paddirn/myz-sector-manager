import {travelDebug} from '../travel/debug.mjs';
import {isAuthored} from '../sector-types.mjs';
import {locateToken} from './grid.mjs';
const MODULE='myz-sector-manager',FLAG='entryTriggers';
// Legacy macroEnabled was the checkbox value; it now selects once/repeat, never enablement.
export const macroRunOnce=trigger=>Boolean(trigger.macroRunOnce??trigger.macroEnabled??false);
// Independent of Effects UI; callers can supply another trigger list later.
export class SectorEntryTriggers {
 constructor(store,env=globalThis,{beforeMacros=null,afterTravel=null,onDestination=null}={}){this.onDestination=onDestination;this.afterTravel=afterTravel;this.beforeMacros=beforeMacros;this.store=store;this.env=env;this.positions=new Map();this.pending=new Set();this.suppressed=new Set();this.queue=Promise.resolve();this.executing=new Set();}
 prime(){this.positions.clear();this.pending.clear();this.suppressed.clear();for(const track of this.store.config.groups){const token=this.store.scene?.tokens.get(track.tokenId);if(token)this.positions.set(token.uuid||token.id,locateToken(track,this.store.scene,this.store.config.grid).coordinate);}}
 updated(token,changes,options={}){
  if(!['x','y'].some(key=>key in changes))return Promise.resolve();
  const key=token.uuid||token.id,track=this.store.config.groups.find(g=>g.tokenId===token.id&&g.sceneId===token.parent?.id);
  const automated=options.myzPatrol?'patrol':options.myzWandering?'wandering':null;
  if(!track){travelDebug(this.env,'movement-skipped',{tokenId:token.id,sceneId:token.parent?.id,reason:automated?`${automated} movement is not Party travel`:'Token is not a designated Party/Expedition'});return Promise.resolve();}
  travelDebug(this.env,'movement-detected',{tokenId:token.id,sceneId:token.parent?.id,state:token.movement?.state||'direct',origin:automated||'native/manual'});
  if(automated)this.suppressed.add(key);
  if(['pending','paused'].includes(token.movement?.state)){this.pending.add(key);travelDebug(this.env,'movement-waiting',{tokenId:token.id,reason:'Waiting for completed movement; passed-through sectors do not roll'});return Promise.resolve();}
  this.pending.delete(key);
  if(this.suppressed.delete(key)){this.positions.set(key,locateToken(track,this.store.scene,this.store.config.grid).coordinate);travelDebug(this.env,'movement-skipped',{tokenId:token.id,reason:'Automated patrol/wandering movement; baseline synchronized'});return Promise.resolve();}
  return this.moved(token,changes);
 }
 stopped(token){const key=token.uuid||token.id;if(!this.pending.delete(key))return Promise.resolve();if(this.suppressed.delete(key)){const track=this.store.config.groups.find(g=>g.tokenId===token.id&&g.sceneId===token.parent?.id);if(track)this.positions.set(key,locateToken(track,this.store.scene,this.store.config.grid).coordinate);travelDebug(this.env,'movement-skipped',{tokenId:token.id,reason:'Automated patrol/wandering movement completed; no Party event'});return Promise.resolve();}return this.moved(token,{x:token.x,y:token.y});}
 moved(token,changes){
  const trackNow=this.store.config.groups.find(group=>group.tokenId===token.id&&group.sceneId===token.parent?.id);
  if(!trackNow||!['x','y'].some(key=>key in changes))return Promise.resolve();
  const positionKey=token.uuid||token.id,from=this.positions.get(positionKey);
  this.positions.set(positionKey,locateToken(trackNow,this.store.scene,this.store.config.grid).coordinate);
  const trace={tokenId:token.id,sceneId:token.parent?.id,from,to:this.positions.get(positionKey)};
  if(!this.store.authoritative||!from){travelDebug(this.env,'movement-skipped',{...trace,reason:!this.store.authoritative?'Not the active GM':'No origin baseline; initialization is not entry'});return Promise.resolve();}
  const identity=token.uuid||`Scene.${token.parent?.id}.Token.${token.id}`;
  if(this.executing.has(identity)){travelDebug(this.env,'movement-skipped',{...trace,reason:'Macro-induced movement is suppressed'});return Promise.resolve();} // Macro-induced moves never recurse.
  const track=this.store.config.groups.find(group=>group.tokenId===token.id&&group.sceneId===token.parent?.id);
  if(!track)return Promise.resolve();
  const to=locateToken(track,this.store.scene,this.store.config.grid).coordinate;
  if(!to||to===from){travelDebug(this.env,'movement-skipped',{...trace,reason:!to?'Destination outside Zone grid':'Same sector or duplicate movement hook'});return Promise.resolve();}
  travelDebug(this.env,'entry-detected',{...trace});
  const records=this.store.sectorRecords(to),gridAtEntry=JSON.stringify(this.store.config.grid);
  const entryContext={journal:records.find(j=>!isAuthored(j.getFlag(MODULE,'sector')))||null,token,group:track,coordinate:to,fromCoordinate:from,entryAt:Date.now(),entryId:this.env.foundry?.utils?.randomID?.()||`${Date.now()}-${Math.random()}`};
  let captured;try{captured=Promise.resolve(this.onDestination?.(entryContext)).catch(error=>{this.report(error);return null;});}catch(error){this.report(error);captured=Promise.resolve(null);}
  const task=this.queue.then(async()=>{
   if(!this.store.authoritative||gridAtEntry!==JSON.stringify(this.store.config.grid)||!this.store.config.groups.some(group=>group.id===track.id&&group.sceneId===track.sceneId&&group.tokenId===token.id)){travelDebug(this.env,'check-skipped',{...trace,reason:'Active GM, grid or Party assignment changed while entry was queued'});return;}
   try{
    const normal=records.filter(journal=>{const sector=journal.getFlag(MODULE,'sector');return !isAuthored(sector)&&!sector?.initialSavePending;});
    const context={...entryContext,journal:normal[0]||null,blank:records.length===0,campaignVisit:await captured};
    if(!normal.length&&records.length)travelDebug(this.env,'check-skipped',{...trace,reason:records.length?'Destination has only Special/Settlement or initially unsaved sectors':'No existing saved Normal sector at destination'});
    if((normal.length||context.blank)&&this.beforeMacros)await this.beforeMacros(context);
    if(this.afterTravel){try{await this.afterTravel(context);}catch(error){this.env.console?.error('MYZ sector-entry wandering',error);}}
    for(const journal of normal){this.executing.add(identity);await this.run(journal,identity,journal.getFlag(MODULE,'sector').effects||[],token);}
   }
   finally{this.executing.delete(identity);}
  });
  this.queue=task.catch(error=>this.report(error));return this.queue;
 }
 report(error){this.env.console?.error('MYZ sector-entry Macro',error);this.env.ui?.notifications?.error(`Sector-entry Macro: ${error.message}`);}
 async run(journal,tokenUuid,triggers,token){
  for(const trigger of triggers){
   if(!this.store.authoritative)return;
   if(trigger.macroDisabled===true||!trigger.macroUuid||!trigger.triggerId)continue;
   const state=structuredClone(journal.getFlag(MODULE,FLAG)||{records:[]});
   const history=state.records||[];
   const previous=history.findIndex(record=>record.tokenUuid===tokenUuid&&record.triggerId===trigger.triggerId);
   if(macroRunOnce(trigger)&&previous!==-1)continue;
   // Persist the latest attempt before execution. Once mode consumes it; repeat mode ignores it on a new entry.
   const record={triggerId:trigger.triggerId,tokenUuid,macroUuid:trigger.macroUuid,status:'running',runOnce:macroRunOnce(trigger),timestamp:Date.now()};
   if(previous===-1)history.push(record);else history[previous]=record;state.records=history;await journal.setFlag(MODULE,FLAG,state);
   try{
    const macro=await this.env.fromUuid(trigger.macroUuid);
    if(macro?.documentName!=='Macro')throw new Error(`Macro ${trigger.macroUuid} is missing or unavailable`);
    if(!this.store.authoritative)throw new Error('Active GM authority changed before Macro execution');
    if(macro.canExecute===false)throw new Error(`Permission denied for Macro ${macro.name}`);
    await macro.execute({token:token.object||token,sector:journal});record.status='completed';
   }catch(error){record.status='failed';record.error=error.message;this.report(error);}
   const latest=structuredClone(journal.getFlag(MODULE,FLAG)||{records:[]});latest.records=latest.records.map(value=>value.tokenUuid===tokenUuid&&value.triggerId===trigger.triggerId?record:value);await journal.setFlag(MODULE,FLAG,latest);
  }
 }
 async reset(journal,triggerId=null){
  if(!this.store.authoritative)throw new Error('Only the active GM can reset Macro execution state.');
  await this.queue;
  if(!this.store.authoritative)throw new Error('Active GM authority changed while waiting to reset.');
  const state=structuredClone(journal.getFlag(MODULE,FLAG)||{records:[]});
  state.records=(state.records||[]).filter(record=>triggerId&&record.triggerId!==triggerId);
  await journal.setFlag(MODULE,FLAG,state);
 }
}
