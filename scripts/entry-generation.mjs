import {LEGACY_EVENT_UUIDS} from './document-references.mjs';
import {locationDescription} from './location-text.mjs';
import {ENVIRONMENTS,resolveGenerationTable,rollTable,rollThreat,resolveNamedDocument,mapEnvironment,boundedRoll} from './sector-randomizer.mjs';
import {canonicalCoordinate} from './zone/grid.mjs';
import {normalizeLoot} from './loot.mjs';
export const ENCOUNTER_STATUSES=['Active','Resolved','Defeated','Hidden'];
export const ENCOUNTER_TYPES=['Humanoid','Monster','Encounter'];
export const EVENT_TABLES=LEGACY_EVENT_UUIDS;
export function normalizeEncounter(entry={}){
  const status=ENCOUNTER_STATUSES.find(value=>value.toLowerCase()===String(entry.status||'Active').toLowerCase());
  const type=ENCOUNTER_TYPES.find(value=>value.toLowerCase()===String(entry.type||'').toLowerCase())||({humanoid:'Humanoid',monster:'Monster',encounter:'Encounter'}[entry.generated?.threatCategory])||'Encounter';
  return {...entry,...(!status&&entry.status?{legacyStatus:entry.legacyStatus??entry.status}:{}),...(!ENCOUNTER_TYPES.includes(entry.type)&&entry.type?{legacyType:entry.legacyType??entry.type}:{}),status:status||'Active',type};
}
export function locationRuinKind(sector){
  const terrain=String(sector.terrain||'').trim();if(!terrain)return null;
  if(/,\s*(?:ruin|threat|artifact)\s*:/i.test(terrain))return mapEnvironment({text:terrain,mapping:{}},{requireAllFlags:false}).ruins;
  const stored=sector.randomization?.environment;
  if(stored&&stored.name?.toLowerCase()===terrain.toLowerCase())return mapEnvironment({text:terrain,mapping:{environment:stored}}).ruins;
  const known=Object.keys(ENVIRONMENTS).find(name=>name.toLowerCase()===terrain.toLowerCase());
  return known?mapEnvironment({text:known,mapping:{}}).ruins:null;
}
const empty=()=>({title:'',status:'Active',details:'',uuid:''});
async function requireDocument(result,expected,env){
  const resolved=await resolveNamedDocument(result,expected,env);
  if(!resolved.uuid||resolved.referenceWarning||!(resolved.documentType===expected||(expected==='JournalEntry'&&resolved.documentType==='JournalEntryPage')))throw new Error(`Generation needs a resolvable ${expected}: ${resolved.referenceWarning||result.text}`);
  return resolved;
}
const one=result=>{if(result.entries.length!==1)throw new Error('Entry generation requires exactly one final table result.');return result.entries[0];};
function entry(result,extra={}){return {...empty(),title:result.documentTitle||result.text,details:result.text,uuid:result.uuid||'',...extra,generation:{method:'add-entry',sources:result.sources}};}
export async function generateEntry(kind,sector,{env=globalThis,arkCoordinate=null,event=false}={}){
  if(sector?.sectorType==='special'&&kind!=='history')throw new Error('Special Zone Sector content is manually authored.');
  if(!env.game.user.isGM)throw new Error('GM access required for entry generation.');
  const table=key=>resolveGenerationTable(`generation.${key}`,key,env);
  if(kind==='encounters'){
    const threatType=await table('threatType');
    const selected=await boundedRoll(async()=>{const values=await rollThreat({threatType},env,{excludePhenomena:true});if(!values.length)return null;if(values.length!==1)throw new Error('Encounter generation requires exactly one threat identity.');return values[0];},'Encounters (Phenomena excluded)');
    const expected=selected.category==='encounter'?'JournalEntry':'Actor';
    return entry(await requireDocument(selected.result,expected,env),{type:{humanoid:'Humanoid',monster:'Monster',encounter:'Encounter'}[selected.category]});
  }
  if(kind==='loot'){
    const result=one(await rollTable(await table('scrap'),env));
    if(result.documentType&&result.documentType!=='Item')throw new Error('Scrap references must be Item documents.');
    const structured=result.mapping?.loot??{};if(typeof structured!=='object'||Array.isArray(structured))throw new Error('Scrap loot mapping must be an object.');for(const key of ['title','details','type'])if(structured[key]!==undefined&&typeof structured[key]!=='string')throw new Error(`Scrap ${key} must be text.`);let text=result.text;const labeled=text.match(/(?:^|,\s*)Quantity\s*:\s*([^,]+)\s*$/i);if(labeled)text=text.slice(0,labeled.index).trim();
    const rawQuantity=structured.quantity??result.quantity??labeled?.[1];const quantity=rawQuantity===undefined?1:Number(rawQuantity);if(!Number.isFinite(quantity)||quantity<0)throw new Error('Scrap result has an invalid quantity.');
    return normalizeLoot(entry({...result,text},{...Object.fromEntries(['title','details','type'].filter(key=>structured[key]!==undefined).map(key=>[key,structured[key]])),quantity,type:result.itemType||structured.type||'scrap',typeSource:result.itemType?'reference':'default',collected:false}));
  }
  if(kind==='effects')return entry(await requireDocument(one(await rollTable(await table('phenomenon'),env)),'JournalEntry',env),{category:'Phenomenon',duration:''});
  if(kind==='history'&&event){
    const ark=canonicalCoordinate(arkCoordinate),code=canonicalCoordinate(sector.code);
    const result=one(await rollTable(await resolveGenerationTable(`events.${ark&&ark===code?'ark':'zone'}`,'History Event',env),env));
    return entry(await requireDocument(result,'JournalEntry',env));
  }
  if(kind==='locations'){
    const ruins=locationRuinKind(sector);if(!ruins)return empty();
    const result=await locationDescription(one(await rollTable(await table(ruins==='industrial'?'ruinsB':'ruinsA'),env,[],{allowMissing:true})),env);
    return entry(result,{details:result.details,...(result.referenceWarning?{referenceWarning:result.referenceWarning}:{})});
  }
  return empty();
}
