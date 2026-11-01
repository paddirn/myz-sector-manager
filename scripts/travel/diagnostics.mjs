import {validateReference} from '../document-references.mjs';
import {isAuthored,sectorOnScene} from '../sector-types.mjs';
import {validateGrid,canonicalCoordinate,locateToken} from '../zone/grid.mjs';
import {travelConfiguration,MODULE} from './model.mjs';
export async function inspectTravelSetup(store,env,context={}){
 if(!store.isGM||!env.game.user.isGM)throw Error('GM access only.');
 const configuration=travelConfiguration(env),issues=[],scene=store.scene,groups=store.config.groups;
 if(!configuration.enabled)issues.push('Automatic Travel Events are disabled.');
 if(!configuration.normalEntry)issues.push('Trigger on Normal Sector Entry is disabled.');
 if(!configuration.showDialog)issues.push('GM-only event dialogs are disabled; generated events may only appear in history.');
 if(!configuration.recordHistory&&!configuration.showDialog)issues.push('Both event history and dialogs are off; successful events have no normal visible report.');
 if(!store.authoritative)issues.push('This client is not the active GM; automatic checks run on the elected active GM.');
 if(!scene)issues.push('The designated Zone Scene is missing or unconfigured.');
 try{validateGrid(store.config.grid);}catch(error){issues.push(`Zone grid: ${error.message}`);}
 const assignments=groups.map(g=>{const token=scene?.tokens.get(g.tokenId);let coordinate=null;try{coordinate=locateToken(g,scene,store.config.grid).coordinate;}catch{}const records=coordinate?store.sectorRecords(coordinate):[];return {id:g.id,name:g.name||'Party',sceneId:g.sceneId,tokenId:g.tokenId,available:Boolean(scene&&g.sceneId===scene.id&&token),movementState:token?.movement?.state||null,coordinate,destinationRecords:records.map(j=>{const s=j.getFlag(MODULE,'sector');return {id:j.id,type:s?.sectorType||'normal',initialSavePending:Boolean(s?.initialSavePending)};})};});
 if(!assignments.length)issues.push('No Party/Expedition token is assigned in Zone Configure / Tracking.');
 for(const g of assignments)if(!g.available)issues.push(`Party/Expedition assignment "${g.name}" has no available token on the Zone Scene.`);
 const sectors=Array.from(env.game.journal.values?.()||env.game.journal).filter(j=>{const s=j.getFlag(MODULE,'sector');return s?.version===1&&!isAuthored(s)&&!s.initialSavePending&&sectorOnScene(s,scene?.id)&&canonicalCoordinate(s.code);});
 if(!sectors.length)issues.push('No saved Normal sectors are eligible on the Zone Scene. Empty, Special, Settlement and unsaved sectors do not roll.');
 const sources=[];
 for(const key of ['travelEvents.weatherTable','generation.threatType','generation.humanoid','generation.monster','generation.encounter']){
  const result=await validateReference(key,env);const {document,...safe}=result;sources.push(safe);
  if(!document)issues.push(`${result.label}: ${result.status}${result.error?` — ${result.error}`:''}${key==='travelEvents.weatherTable'?' (weather only)':key==='generation.threatType'?' (needed for encounters)':' (needed if selected by Threat Type)'}.`);
 }
 if(!store.isGM||!env.game.user.isGM)throw Error('GM access changed while inspecting Travel Events.');
 const selected=context.journal?.getFlag(MODULE,'sector'),selection=context.journal?{sectorId:context.journal.id,coordinate:selected?.code||null,eligible:Boolean(selected?.version===1&&!isAuthored(selected)&&!selected.initialSavePending&&sectorOnScene(selected,scene?.id)),groupId:context.group?.id||null}:null;
 return {configuration,authority:{userId:env.game.user.id,activeGMId:env.game.users.activeGM?.id||null,authoritative:store.authoritative},issues,assignments,eligibleNormalSectors:sectors.length,selection,sources,clockRequired:false,campaignSessionRequired:false,worldTime:env.game.time?.worldTime??null,note:'Checks follow completed destination entries, not travel duration. Initial/unchanged weather and failed chances are silent. Show GM-Only Event Dialog must be enabled for automatic popups. This check does not roll tables, move tokens or change settings.'};
}
