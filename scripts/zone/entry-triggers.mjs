import {locateToken} from './grid.mjs';
const MODULE='myz-sector-manager',FLAG='entryTriggers';
// Legacy macroEnabled was the checkbox value; it now selects once/repeat, never enablement.
export const macroRunOnce=trigger=>Boolean(trigger.macroRunOnce??trigger.macroEnabled??false);
// Independent of Effects UI; callers can supply another trigger list later.
export class SectorEntryTriggers {
 constructor(store,env=globalThis,{beforeMacros=null,afterTravel=null}={}){this.afterTravel=afterTravel;this.beforeMacros=beforeMacros;this.store=store;this.env=env;this.positions=new Map();this.pending=new Set();this.queue=Promise.resolve();this.executing=new Set();}
 prime(){this.positions.clear();this.pending.clear();for(const track of this.store.config.groups){const token=this.store.scene?.tokens.get(track.tokenId);if(token)this.positions.set(token.uuid||token.id,locateToken(track,this.store.scene,this.store.config.grid).coordinate);}}
 updated(token,changes){
  if(!['x','y'].some(key=>key in changes))return Promise.resolve();
  if(['pending','paused'].includes(token.movement?.state)){this.pending.add(token.uuid||token.id);return Promise.resolve();}
  this.pending.delete(token.uuid||token.id);return this.moved(token,changes);
 }
 stopped(token){if(!this.pending.delete(token.uuid||token.id))return Promise.resolve();return this.moved(token,{x:token.x,y:token.y});}
 moved(token,changes){
  const trackNow=this.store.config.groups.find(group=>group.tokenId===token.id&&group.sceneId===token.parent?.id);
  if(!trackNow||!['x','y'].some(key=>key in changes))return Promise.resolve();
  const positionKey=token.uuid||token.id,from=this.positions.get(positionKey);
  this.positions.set(positionKey,locateToken(trackNow,this.store.scene,this.store.config.grid).coordinate);
  if(!this.store.authoritative||!from||!['x','y'].some(key=>key in changes))return Promise.resolve();
  const identity=token.uuid||`Scene.${token.parent?.id}.Token.${token.id}`;
  if(this.executing.has(identity))return Promise.resolve(); // Macro-induced moves never recurse.
  const track=this.store.config.groups.find(group=>group.tokenId===token.id&&group.sceneId===token.parent?.id);
  if(!track)return Promise.resolve();
  const to=locateToken(track,this.store.scene,this.store.config.grid).coordinate;
  if(!to||to===from)return Promise.resolve();
  const records=this.store.sectorRecords(to),gridAtEntry=JSON.stringify(this.store.config.grid);
  const task=this.queue.then(async()=>{
   if(!this.store.authoritative||gridAtEntry!==JSON.stringify(this.store.config.grid)||!this.store.config.groups.some(group=>group.id===track.id&&group.sceneId===track.sceneId&&group.tokenId===token.id))return;
   try{
    const normal=records.filter(journal=>{const sector=journal.getFlag(MODULE,'sector');return sector?.sectorType!=='special'&&!sector?.initialSavePending;});
    const context={journal:normal[0]||null,token,group:track,coordinate:to,entryId:this.env.foundry?.utils?.randomID?.()||`${Date.now()}-${Math.random()}`};
    if(normal.length&&this.beforeMacros)await this.beforeMacros(context);
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
