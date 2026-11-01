import {isBlankDestination} from './eligibility.mjs';
import {validateReference} from '../document-references.mjs';
import {isAuthored,sectorOnScene} from '../sector-types.mjs';
import {validateGrid,canonicalCoordinate,locateToken} from '../zone/grid.mjs';
import {travelConfiguration,MODULE} from './model.mjs';
// Explains the exact version/type/initial-save exclusions used by the existing test selector.
export function sectorInventory(env,sceneId=null){
 if(!env.game.user.isGM)throw Error('GM access only.');
 const counts={normalReady:0,normalPending:0,special:0,settlement:0,unsupported:0,otherScene:0},records=[];
 for(const journal of Array.from(env.game.journal.values?.()||env.game.journal)){
  const data=journal.getFlag(MODULE,'sector');if(!data)continue;
  const reason=data.version!==1?'unsupported':sceneId&&!sectorOnScene(data,sceneId)?'otherScene':data.sectorType==='special'?'special':data.sectorType==='settlement'?'settlement':data.initialSavePending?'normalPending':'normalReady';
  counts[reason]++;if(records.length<200)records.push({id:journal.id,name:journal.name,code:data.code||null,type:data.sectorType||'normal',version:data.version,initialSavePending:data.initialSavePending??false,eligible:reason==='normalReady',reason});
 }
 return {counts,records,truncated:Object.values(counts).reduce((sum,n)=>sum+n,0)>records.length};
}
export async function inspectTravelSetup(store,env,context={}){
 if(!store.isGM||!env.game.user.isGM)throw Error('GM access only.');
 const configuration=travelConfiguration(env),issues=[],scene=store.scene,groups=store.config.groups;
 if(!configuration.enabled)issues.push('Automatic Travel Events are disabled.');
 if(!configuration.normalEntry)issues.push('Saved Normal sector checks are disabled; blank-sector checks are independent.');
 if(!configuration.blankEntry)issues.push('Blank Zone sector checks are disabled.');
 if(!configuration.showDialog)issues.push('GM-only event dialogs are disabled; generated events may only appear in history.');
 if(!configuration.recordHistory&&!configuration.showDialog)issues.push('Both event history and dialogs are off; successful events have no normal visible report.');
 if(!store.authoritative)issues.push('This client is not the active GM; automatic checks run on the elected active GM.');
 if(!scene)issues.push('The designated Zone Scene is missing or unconfigured.');
 try{validateGrid(store.config.grid);}catch(error){issues.push(`Zone grid: ${error.message}`);}
 const assignments=groups.map(g=>{const token=scene?.tokens.get(g.tokenId);let coordinate=null;try{coordinate=locateToken(g,scene,store.config.grid).coordinate;}catch{}const records=coordinate?store.sectorRecords(coordinate):[];return {id:g.id,name:g.name||'Party',sceneId:g.sceneId,tokenId:g.tokenId,available:Boolean(scene&&g.sceneId===scene.id&&token),movementState:token?.movement?.state||null,coordinate,currentBlank:isBlankDestination(store,env,coordinate),destinationRecords:records.map(j=>{const s=j.getFlag(MODULE,'sector');return {id:j.id,type:s?.sectorType||'normal',initialSavePending:Boolean(s?.initialSavePending)};})};});
 if(!assignments.length)issues.push('No Party/Expedition token is assigned in Zone Configure / Tracking.');
 for(const g of assignments)if(!g.available)issues.push(`Party/Expedition assignment "${g.name}" has no available token on the Zone Scene.`);
 const sectors=Array.from(env.game.journal.values?.()||env.game.journal).filter(j=>{const s=j.getFlag(MODULE,'sector');return s?.version===1&&!isAuthored(s)&&!s.initialSavePending&&sectorOnScene(s,scene?.id)&&canonicalCoordinate(s.code);});
 if(!sectors.length&&!configuration.blankEntry)issues.push('No saved Normal sectors are eligible, and blank-sector checks are disabled. Special/Settlement and initially unsaved records do not roll.');
 const sources=[];
 for(const key of ['travelEvents.weatherTable','generation.threatType','generation.humanoid','generation.monster','generation.encounter']){
  const result=await validateReference(key,env);const {document,...safe}=result;sources.push(safe);
  if(!document)issues.push(`${result.label}: ${result.status}${result.error?` — ${result.error}`:''}${key==='travelEvents.weatherTable'?' (weather only)':key==='generation.threatType'?' (needed for encounters)':' (needed if selected by Threat Type)'}.`);
 }
 if(!store.isGM||!env.game.user.isGM)throw Error('GM access changed while inspecting Travel Events.');
 const selected=context.journal?.getFlag(MODULE,'sector'),selection=context.blank?{kind:'blank',coordinate:context.coordinate,groupId:context.group?.id||null,automaticEnabled:configuration.enabled&&configuration.blankEntry,eligible:isBlankDestination(store,env,context.coordinate)}:context.journal?{sectorId:context.journal.id,coordinate:selected?.code||null,eligible:Boolean(selected?.version===1&&!isAuthored(selected)&&!selected.initialSavePending&&sectorOnScene(selected,scene?.id)),groupId:context.group?.id||null}:null;
 return {sectorInventory:sectorInventory(env,scene?.id||null),configuration,authority:{userId:env.game.user.id,activeGMId:env.game.users.activeGM?.id||null,authoritative:store.authoritative},issues,assignments,eligibleNormalSectors:sectors.length,selection,sources,clockRequired:false,campaignSessionRequired:false,worldTime:env.game.time?.worldTime??null,note:'Checks follow completed Normal or enabled blank destination entries, not travel duration. Initial/unchanged weather and failed chances are silent. Show GM-Only Event Dialog must be enabled for automatic popups. This check does not roll tables, move tokens or change settings.'};
}
