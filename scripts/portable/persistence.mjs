import {deserializeSector,validatePortable,sectorCounts} from './serialization.mjs';
import {canonicalCoordinate,coordinateToBounds} from '../zone/grid.mjs';
import {sectorName,ensureJournalFolders} from '../journal-organization.mjs';
const MODULE='myz-sector-manager';
export function captureDestination(runtime,env=globalThis){
 if(!env.game.user.isGM)throw new Error('GM access only.');
 const {store}=runtime,scene=store.scene,selection=runtime.selection,code=canonicalCoordinate(selection?.code);
 if(!scene||!store.config.grid||selection?.sceneId!==scene.id||!code||!coordinateToBounds(code,store.config.grid))throw new Error('Select a valid square on the configured Zone grid before importing.');
 const matches=store.sectorRecords(code);if(matches.length>1)throw new Error('Multiple sectors occupy this square. Resolve the duplicate records before importing.');
 const journal=matches[0]||null;
 return {sceneId:scene.id,sceneName:scene.name,code,selectionRevision:runtime.selectionRevision,viewedScene:env.canvas?.scene?.id||null,grid:JSON.stringify(store.config.grid),journalId:journal?.id||null,baseline:journal?JSON.stringify(journal.getFlag(MODULE,'sector')):null};
}
export function assertDestination(snapshot,runtime,env=globalThis){
 const now=captureDestination(runtime,env);
 for(const key of ['sceneId','code','selectionRevision','viewedScene','grid','journalId','baseline'])if(now[key]!==snapshot[key])throw new Error('Destination Scene, selection, grid or sector changed. Restart Import Sector; nothing was replaced.');return now;
}
// Foundry deletion operators remove obsolete properties in the same atomic update.
// Arrays replace as arrays; recursive objects receive explicit removals for every stale leaf.
export function replacementData(prior,next){
 const result=structuredClone(next);
 for(const [key,value] of Object.entries(prior||{})){
  if(!Object.hasOwn(next,key))result[`-=${key}`]=null;
  else if(value&&typeof value==='object'&&!Array.isArray(value)&&next[key]&&typeof next[key]==='object'&&!Array.isArray(next[key]))result[key]=replacementData(value,next[key]);
 }
 return result;
}
export async function persistImportedSector(file,destination,runtime,{replace=false,env=globalThis}={}){
 if(!env.game.user.isGM)throw new Error('GM access only.');
 const checked=validatePortable(file).file,sector=deserializeSector(checked,destination);sectorCounts(sector);
 assertDestination(destination,runtime,env);
 if(destination.journalId){
  if(!replace)throw new Error('Replace Existing Sector requires explicit confirmation.');
  const journal=env.game.journal.get(destination.journalId);if(!journal)throw new Error('Destination sector disappeared. Restart import.');
  const previous=structuredClone(journal.getFlag(MODULE,'sector')),triggers=structuredClone(journal.getFlag(MODULE,'entryTriggers')??null);
  assertDestination(destination,runtime,env);
  await journal.update({name:sectorName(sector),[`flags.${MODULE}.sector`]:replacementData(previous,sector),[`flags.${MODULE}.lastSectorImport`]:replacementData(journal.getFlag(MODULE,'lastSectorImport')||{},{version:1,sector:previous,entryTriggers:triggers,replacedAt:Date.now()}),[`flags.${MODULE}.-=entryTriggers`]:null});
  return {journal,sector};
 }
 const folders=await ensureJournalFolders(env);assertDestination(destination,runtime,env);
 const journal=await env.JournalEntry.create({name:sectorName(sector),folder:folders.sectors.id,ownership:{default:0},pages:[{name:'Sector Record',type:'text',text:{content:'<p>Sector record managed by MYZ Sector Manager.</p>'}}],flags:{[MODULE]:{sector}}});
 return {journal,sector};
}
