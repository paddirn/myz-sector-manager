import {isAuthored} from '../sector-types.mjs';
import {resolveConfiguredDocument,referenceSelection,warnReferenceOnce} from '../document-references.mjs';
import {rollThreat,rollTable,boundedRoll} from '../sector-randomizer.mjs';
import {journalBodyText,locationDescription} from '../location-text.mjs';
import {sectorName} from '../journal-organization.mjs';
import {positionToCoordinate,tokenCenter,canonicalCoordinate} from '../zone/grid.mjs';
import {MODULE,STATE_FLAG,travelConfiguration,partyRoster,travelStateDefaults,pruneTravelState,exploredSector} from './model.mjs';
import {detectEncounter} from './stalkers.mjs';
import {showTravelReport} from './report.mjs';
export class TravelEvents {
 constructor(store,env=globalThis,{roll=null,report=null,encounter=null,detection=null}={}){this.store=store;this.env=env;this.queue=Promise.resolve();this.roll=roll||async function(sides){return Number((await new env.Roll(`1d${sides}`).evaluate()).total);};this.report=report||((event)=>showTravelReport(event,this,env));this.encounter=encounter||(()=>this.rollEncounter());this.detection=detection||((group,config)=>detectEncounter({roster:partyRoster(env),group,groups:this.store.config.groups,mode:config.stalkerMode,enabled:config.autoFindPath,env}));}
 get state(){const saved=this.store.document?.getFlag(MODULE,STATE_FLAG)||travelStateDefaults();if(saved.version!==1)throw new Error('Unsupported saved Travel Events state; original data retained.');const next={...travelStateDefaults(),...saved};if(!['history','processed','diagnostics'].every(key=>Array.isArray(next[key])))throw new Error('Invalid saved Travel Events state; no changes made.');return structuredClone(next);}
 assertAuthority(){if(!this.store.authoritative)throw new Error('Only the active GM may process Travel Events.');}
 enqueue(task){const next=this.queue.then(task);this.queue=next.catch(error=>{this.env.console?.error('MYZ Travel Events',error);if(this.store.isGM)this.env.ui?.notifications?.warn(`Travel Events: ${error.message}`);});return next;}
 async saveState(state,config=travelConfiguration(this.env)){this.assertAuthority();const document=await this.store.ensureDocument();this.assertAuthority();await document.setFlag(MODULE,STATE_FLAG,pruneTravelState(state,config.historyLimit));}
 async chance(sides){this.assertAuthority();const result=await this.roll(sides);if(!Number.isSafeInteger(result)||result<1||result>sides)throw new Error(`Invalid private 1d${sides} result.`);return result===1;}
 async rollWeather(){
  this.assertAuthority();const key='travelEvents.weatherTable',table=await resolveConfiguredDocument(key,this.env);
  const draw=await rollTable(table,this.env,[],{assertAuthority:()=>this.assertAuthority(),configurationKey:key});
  if(draw.entries.length!==1)throw new Error(`${key}: RollTable ${table.name} (${table.uuid}) needs one final weather result, received ${draw.entries.length}.`);
  const row=draw.entries[0],structured=row.weather;
  // Text and Journal names are supported; Actors/Items/Scenes are configuration errors.
  if(row.documentType&&!['JournalEntry','JournalEntryPage'].includes(row.documentType))throw new Error(`${key}: RollTable ${table.name} (${table.uuid}), result "${row.name}": expected weather text or a Journal name, received ${row.documentType}.`);
  const rawCondition=structured?.condition??row.name,rawDescription=structured?.description??row.description;
  if(typeof rawCondition!=='string'||typeof rawDescription!=='string')throw new Error(`${key}: weather condition/description must be text.`);
  const condition=journalBodyText(rawCondition,this.env),description=journalBodyText(rawDescription,this.env);
  if(!condition||condition.length>4000)throw new Error(`${key}: weather label is empty or exceeds 4000 characters; put narrative text in Description.`);
  return {condition,description,tableUuid:table.uuid||referenceSelection(key,this.env).uuid,sources:row.sources,uuid:row.uuid||''};
 }
 async rollEncounter(){
  this.assertAuthority();const threatType=await resolveConfiguredDocument('generation.threatType',this.env);
  const selected=await boundedRoll(async()=>{const results=await rollThreat({threatType},this.env,{excludePhenomena:true,assertAuthority:()=>this.assertAuthority()});if(!results.length)return null;if(results.length!==1)throw new Error('Travel encounters need one final identity.');return results[0];},'Travel Encounter (Phenomena excluded)');
  const result=selected.result;if(!result.text?.trim()&&!result.documentTitle)throw new Error('Empty encounter result.');
  let details=result.description||result.text;
  if(result.uuid&&['JournalEntry','JournalEntryPage'].includes(result.documentType)){const snapshot=await locationDescription(result,this.env);details=[result.description,snapshot.details].filter((value,index,all)=>value&&all.indexOf(value)===index).join("\n\n")||details;}
  else if(result.uuid&&result.documentType==='Actor'){try{const actor=await this.env.fromUuid(result.uuid);if(typeof actor?.system?.description==='string')details=[result.description,journalBodyText(actor.system.description,this.env)].filter((value,index,all)=>value&&all.indexOf(value)===index).join("\n\n")||details;}catch{}}
  return {title:result.name||result.documentTitle||result.text,details,uuid:result.uuid||'',documentType:result.documentType,category:selected.category,sources:result.sources};
 }
 diagnostic(state,error){const message=error?.message||String(error);state.diagnostics.push({timestamp:Date.now(),message,...(error?.stack?{stack:error.stack}:{})});if(error instanceof Error)this.env.console?.error('MYZ Travel Events',error);if(this.env.game.user.isGM)warnReferenceOnce(`Travel Events: ${message}`,this.env);}
 onEntry(context){return this.enqueue(()=>this.process(context));}
 async process({journal,token,group,entryId,coordinate=null,test=false,persist=!test,force=null}){
  this.assertAuthority();const config=travelConfiguration(this.env),sector=journal?.getFlag(MODULE,'sector');
  if(!sector||sector.version!==1||isAuthored(sector)||sector.initialSavePending||(!test&&(!config.enabled||!config.normalEntry)))return null;
  if(coordinate&&canonicalCoordinate(sector.code)!==coordinate)return null;
  if(!group||!this.store.config.groups.some(g=>g.id===group.id&&g.tokenId===token?.id&&g.sceneId===token.parent?.id))throw new Error('Select a registered expedition token.');
  const state=this.state,weatherBeforeTimestamp=state.weatherChangedAt||state.weather?.timestamp||null,weatherBeforeRevision=state.weatherRevision||0,id=entryId||this.env.foundry.utils.randomID();
  if(persist&&state.processed.some(entry=>entry.id===id))return null;
  if(state.history.filter(event=>event.pending).length>=1000)throw new Error('Pending travel report capacity reached; review pending events before more checks.');
  if(persist){state.processed.push({id,status:'processing',timestamp:Date.now(),sectorId:journal.id,tokenUuid:token.uuid||`${group.sceneId}.${token.id}`});await this.saveState(state,config);}
  const event={id,test,timestamp:Date.now(),sectorId:journal.id,code:sector.code,sectorName:sectorName(sector,journal.name),terrain:sector.terrain||'',expeditionId:group.id,expeditionName:group.name||'Party',tokenUuid:token.uuid||`${group.sceneId}.${token.id}`,weatherChange:null,encounter:null,detection:null,errors:[]};
  try{
   const weatherDue=force==='weather'||(!force&&(!state.weather||await this.chance(config.weatherChance)));
   if(weatherDue){try{const next=await this.rollWeather();const previous=state.weather;if(!previous||next.condition.trim().replace(/\s+/g,' ').toLowerCase()!==previous.condition.trim().replace(/\s+/g,' ').toLowerCase()){
    state.weather={...next,previous:previous?.condition||null,timestamp:Date.now()};state.weatherChangedAt=state.weather.timestamp;state.weatherRevision=(state.weatherRevision||0)+1;if(previous)event.weatherChange={...state.weather};
   }}catch(error){event.errors.push(error.message);this.diagnostic(state,error);}}
  }catch(error){event.errors.push(error.message);this.diagnostic(state,error);}
  try{
   const denominator=config.reduceExplored&&exploredSector(sector)?config.exploredChance:config.encounterChance;
   const encounterDue=force==='encounter'||(!force&&await this.chance(denominator));
   if(encounterDue){try{this.assertAuthority();event.encounter=await this.encounter();this.assertAuthority();event.detection=await this.detection(group,config);}catch(error){event.errors.push(error.message);this.diagnostic(state,error);}}
  }catch(error){event.errors.push(error.message);this.diagnostic(state,error);}
  const meaningful=Boolean(event.weatherChange||event.encounter);
  if(persist&&!this.store.authoritative){if(this.env.game.user.isGM&&this.store.document){const key=this.env.foundry.utils.randomID();await this.store.document.setFlag(MODULE,`pendingTravelReports.${key}`,{event:{...event,pending:meaningful},meaningful,weather:state.weather,weatherBeforeTimestamp,weatherChangedAt:state.weatherChangedAt,weatherBeforeRevision,weatherRevision:state.weatherRevision});}return {event,meaningful,weather:state.weather,pending:true};}
  if(persist){const progress=state.processed.find(entry=>entry.id===id);progress.status='completed';if(meaningful){event.pending=config.showDialog;if(config.recordHistory||event.pending)state.history.push(event);}await this.saveState(state,config);}
  // Initial weather, unchanged weather, failed chances and configuration errors alone never open a report.
  if(meaningful&&config.showDialog&&this.store.authoritative){const shown=await this.report(event);if(persist&&shown&&this.store.authoritative)await this.acknowledge(id,config);}
  return {event,meaningful,weather:state.weather};
 }
 async acknowledge(id,config=travelConfiguration(this.env)){
  const state=this.state;const event=state.history.find(event=>event.id===id);if(!event)return;event.pending=false;await this.saveState(state,config);
 }
 review(id){return this.enqueue(async()=>{this.assertAuthority();const event=this.state.history.find(event=>event.id===id);if(!event)throw new Error('Travel event no longer available.');const shown=await this.report(event);if(shown&&this.store.authoritative)await this.acknowledge(id);});}
 setWeather(condition,description=''){return this.enqueue(async()=>{this.assertAuthority();if(typeof condition!=='string'||condition.length>4000||typeof description!=='string')throw new Error('Invalid manual weather.');const state=this.state;state.weatherRevision=(state.weatherRevision||0)+1;state.weatherChangedAt=Date.now();state.weather=condition.trim()?{condition:condition.trim(),description,previous:state.weather?.condition||null,tableUuid:referenceSelection('travelEvents.weatherTable',this.env).uuid,timestamp:Date.now()}:null;await this.saveState(state);});}
 test(context,{kind='check',persist=false}={}){return this.enqueue(async()=>{this.assertAuthority();if(kind==='findPath')return this.detection(context.group,travelConfiguration(this.env));return this.process({...context,test:true,persist,force:kind==='weather'?'weather':kind==='encounter'?'encounter':null});});}
 async mergeHandoverReports(){
  this.assertAuthority();const document=this.store.document;if(!document)return;
  const pending=document.getFlag(MODULE,'pendingTravelReports')||{};
  for(const [key,item] of Object.entries(pending)){
   if(!/^[A-Za-z0-9_-]+$/.test(key)||!item?.event?.id)continue;
   const state=this.state,event=item.event;
   if(item.weather&&(state.weatherRevision||0)===item.weatherBeforeRevision){state.weather=item.weather;state.weatherChangedAt=item.weatherChangedAt||item.weather.timestamp;state.weatherRevision=item.weatherRevision||state.weatherRevision+1;}
   if(item.meaningful&&!state.history.some(row=>row.id===event.id))state.history.push({...event,pending:true});
   const progress=state.processed.find(row=>row.id===event.id);if(progress)progress.status='interrupted';
   state.diagnostics.push({timestamp:Date.now(),message:`Recovered ${event.code} results after GM handover; any uncompleted checks were not rerolled.`});await this.saveState(state);
   this.assertAuthority();await document.update({[`flags.${MODULE}.pendingTravelReports.-=${key}`]:null});
  }
 }
 recoverPendingMoves(){return this.enqueue(async()=>{
  if(!this.store.authoritative)return;
  await this.mergeHandoverReports();
  for(const group of this.store.config.groups){const token=this.store.scene?.tokens.get(group.tokenId);if(!token)continue;const saved=token.getFlag?.(MODULE,'pendingTravelEntries');if(!saved?.entries?.length)continue;if(saved.version!==1||!Array.isArray(saved.entries)||saved.entries.length>50){const invalid=this.state;this.diagnostic(invalid,`Invalid pending movement data for ${group.name}; no entries processed.`);await this.saveState(invalid);continue;}
   for(const pending of saved.entries.slice(0,50)){
    const valid=point=>point&&['x','y','width','height'].every(key=>Number.isFinite(point[key]))&&point.width>0&&point.height>0&&point.width<=100&&point.height<=100;
    if(typeof pending.id!=='string'||pending.id.length>200||!valid(pending.from)||!valid(pending.to))continue;
    const from=positionToCoordinate(tokenCenter(pending.from,this.store.scene),this.store.config.grid),to=positionToCoordinate(tokenCenter(pending.to,this.store.scene),this.store.config.grid);if(!from||!to||from===to)continue;
    const journal=this.store.sectorRecords(to).find(doc=>!isAuthored(doc.getFlag(MODULE,'sector')));if(journal)await this.process({journal,token,group,entryId:pending.id,coordinate:to});
   }
   if(this.store.authoritative){const latest=token.getFlag(MODULE,'pendingTravelEntries')||{entries:[]},ids=new Set(saved.entries.map(entry=>entry.id));await token.setFlag(MODULE,'pendingTravelEntries',{...latest,entries:(Array.isArray(latest.entries)?latest.entries:[]).filter(entry=>!ids.has(entry.id)),overflow:0});if(saved.overflow){const state=this.state;this.diagnostic(state,`${saved.overflow} additional offline movement updates exceeded the 50-entry recovery buffer for ${group.name}.`);await this.saveState(state);}}
  }
 });}
}
