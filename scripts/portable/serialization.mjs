import {SECTOR_SCHEMA,PORTABLE_SCHEMA} from './schema.mjs';
import {sectorThreatLevel} from '../sector-fields.mjs';
import {normalizeSectorType} from '../sector-types.mjs';
import {sectorNaming} from '../journal-organization.mjs';
import {imagePath} from '../sector-images.mjs';
export const FORMAT='myz-sector-manager',FORMAT_VERSION=1,SCHEMA_VERSION=1,MAX_BYTES=5*1024*1024;
const forbidden=new Set(['__proto__','prototype','constructor']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
export function assertJSON(value,depth=0,budget={nodes:0}){
 if(depth>40||++budget.nodes>100000)throw new Error('JSON exceeds the nesting (40) or value-count (100,000) limit.');
 if(value===null||typeof value==='boolean'||typeof value==='string'||typeof value==='number'&&Number.isFinite(value))return;
 if(!plain(value)&&!Array.isArray(value))throw new Error('Only plain JSON values are supported; live Documents and runtime objects are not portable.');
 for(const [key,child] of Object.entries(value)){if(forbidden.has(key))throw new Error(`Unsafe JSON key: ${key}`);assertJSON(child,depth+1,budget);}
}
function project(value,schema,path,unknown){
 const at=path.join('.')||'file';
 if(schema.anyOf){for(const branch of schema.anyOf){try{const pending=[];const next=project(value,branch,path,pending);unknown.push(...pending);return next;}catch{/* Try the next explicitly supported representation. */}}throw new Error(`${at}: unsupported value type.`);}
 if(Object.hasOwn(schema,'const')&&value!==schema.const)throw new Error(`${at}: expected ${schema.const}.`);
 if(schema.enum&&!schema.enum.includes(value))throw new Error(`${at}: expected ${schema.enum.join(', ')}.`);
 if(schema.type==='object'){
  if(!plain(value))throw new Error(`${at}: expected an object.`);
  for(const key of schema.required||[])if(!Object.hasOwn(value,key))throw new Error(`${at}.${key}: required field is missing.`);
  const result={};for(const [key,child] of Object.entries(value)){if(Object.hasOwn(schema.properties,key))result[key]=project(child,schema.properties[key],[...path,key],unknown);else unknown.push({path:[...path,key],value:structuredClone(child)});}return result;
 }
 if(schema.type==='array'){
  if(!Array.isArray(value)||value.length>schema.maxItems)throw new Error(`${at}: expected an array of at most ${schema.maxItems} entries.`);
  return value.map((child,index)=>project(child,schema.items,[...path,index],unknown));
 }
 if(schema.type==='string'&&(typeof value!=='string'||value.length>(schema.maxLength??Infinity)||schema.pattern&&!new RegExp(schema.pattern).test(value)))throw new Error(`${at}: invalid text or UUID.`);
 if(schema.format==='image-path'&&value&&!imagePath(value))throw new Error(`${at}: unsupported image path.`);
 if(schema.type==='boolean'&&typeof value!=='boolean')throw new Error(`${at}: expected true or false.`);
 if(['integer','number'].includes(schema.type)&&(!Number.isFinite(value)||schema.type==='integer'&&!Number.isSafeInteger(value)||value<(schema.minimum??-Infinity)||value>(schema.maximum??Infinity)))throw new Error(`${at}: invalid ${schema.type}.`);
 if(schema.type==='null'&&value!==null)throw new Error(`${at}: expected null.`);
 return structuredClone(value);
}
// Registry keys are the source version. Add v1 -> v2 here when schema v2 is introduced.
export const schemaMigrations=new Map();
export function migrateSchema(file,target=SCHEMA_VERSION,registry=schemaMigrations){
 const next=structuredClone(file),warnings=[];
 if(!Number.isSafeInteger(next.schemaVersion)||next.schemaVersion<1||next.schemaVersion>target)throw new Error('Unsupported or newer sector schema version.');
 while(next.schemaVersion<target){const version=next.schemaVersion,migrate=registry.get(version);if(!migrate)throw new Error(`No supported migration from schema ${version}.`);next.sector=migrate(structuredClone(next.sector));next.schemaVersion++;warnings.push(`Migrated schema ${version} → ${next.schemaVersion}.`);}
 return {file:next,warnings};
}
function checkIdentities(value){
 if(!value||typeof value!=='object')return;
 if(Array.isArray(value)){const ids=new Set();for(const entry of value){if(entry&&typeof entry==='object'&&entry.id!==undefined){if(typeof entry.id!=='string'||!/^[A-Za-z0-9_-]+$/.test(entry.id)||ids.has(entry.id))throw new Error('Entry IDs must be safe, nonempty and unique within each collection.');ids.add(entry.id);}checkIdentities(entry);}return;}
 for(const [key,child] of Object.entries(value))if(!['generated','generation','randomization','actorImport'].includes(key))checkIdentities(child);
}
function materialize(content){
 const data=structuredClone(content),used=new Set();let sequence=0;
 const identify=entry=>{if(!entry.id){let id;do{id=`import-entry-${++sequence}`;}while(used.has(id));entry.id=id;}used.add(entry.id);return entry;};
 const gather=value=>{if(!value||typeof value!=='object')return;if(value.id)used.add(value.id);for(const child of Object.values(value))if(child&&typeof child==='object')gather(child);};gather(data);
 for(const key of ['locations','encounters','effects','loot','secrets','history'])for(const entry of data[key]||[])identify(entry);
 for(const key of ['images','locations','inhabitants','gear','events'])for(const entry of data.special?.[key]||[])identify(entry);
 if(data.settlement){
  const settlement=data.settlement,settlementIds=new Set();
  for(const key of ['projects','inhabitants','factions','events','threads','shops'])for(const entry of settlement[key]||[]){if(entry.id&&settlementIds.has(entry.id))throw new Error('Settlement entry IDs must be unique across its collections.');if(entry.id)settlementIds.add(entry.id);}
  for(const key of ['projects','inhabitants','factions','events','threads','shops'])for(const entry of settlement[key]||[])identify(entry);
  for(const shop of settlement.shops||[])for(const entry of shop.inventory||[]){if(entry.id&&settlementIds.has(entry.id))throw new Error('Settlement archive entry IDs must be unique.');if(entry.id)settlementIds.add(entry.id);identify(entry);}
  for(const faction of settlement.factions||[]){
   if(faction.infoVersion===1)faction.info??='';
   const seen=new Set(),members=[];for(const raw of [...(faction.members||[]),...(!faction.membersVersion?[...(faction.actorUuids||[]),...(faction.actors||[])]:[])]){const member=typeof raw==='string'?{uuid:raw}:{...raw};member.uuid||=member.actorUuid;if(seen.has(member.uuid))continue;seen.add(member.uuid);members.push(identify(member));}faction.members=members;faction.membersVersion=1;
  }
  // Retain the old archive and perform the existing reference-only migration deterministically.
  if(!settlement.shop){const seen=new Set();let unlinked=0,duplicates=0;const groups=(settlement.shops||[]).map(shop=>{const entries=[];for(const item of shop.inventory||[]){if(!item.uuid){unlinked++;continue;}if(seen.has(item.uuid)){duplicates++;continue;}seen.add(item.uuid);entries.push(identify({uuid:item.uuid,legacyEntryId:item.id||''}));}return identify({name:shop.title||'Recovered inventory',type:'general',entries});});settlement.shop={version:1,groups,...(settlement.shops?.length?{migration:{version:1,source:'settlement.shops',unlinked,duplicates}}:{})};}
  settlement.shop.version??=1;settlement.shop.groups??=[];
  for(const group of settlement.shop.groups||[]){identify(group);group.entries??=[];for(const entry of group.entries){identify(entry);if(!entry.uuid)throw new Error('Shop inventory entries require a nonempty Item or Vehicle Actor UUID.');}}
 }
 return normalizeSectorType({version:1,nameOverride:false,customName:'',threatLevel:sectorThreatLevel(data),terrain:'',rot:0,status:'Unexplored',description:'',notes:'',locations:[],encounters:[],loot:[],effects:[],secrets:[],history:[],supplies:{},pathStunts:{},...data});
}
export function validatePortable(input){
 assertJSON(input);if(!plain(input)||input.format!==FORMAT)throw new Error('Unsupported sector format. Use a versioned MYZ Sector Manager export; unversioned files are not recognized.');
 if(input.formatVersion!==FORMAT_VERSION)throw new Error('Unsupported or newer file format version.');
 const migrated=migrateSchema(input),unknown=[],file=project(migrated.file,PORTABLE_SCHEMA,[],unknown);
 if(!file.sector?.sectorType)throw new Error('sector.sectorType is required.');
 checkIdentities(file.sector);materialize(file.sector);
 const extensions={unknown:[...(file.extensions?.unknown||[]),...unknown]};
 if(extensions.unknown.length>2000)throw new Error('At most 2,000 unknown extension fields are supported.');
 if(new TextEncoder().encode(JSON.stringify({...file,extensions})).length>MAX_BYTES)throw new Error('Sector JSON must be at most 5 MiB.');
 return {file:{...file,extensions},warnings:[...migrated.warnings,...(file.sector.settlement?.factions?.some(f=>!f.infoVersion)?['Legacy Faction Info will be migrated once; original fields are retained.']:[]),...(extensions.unknown.length?[`${extensions.unknown.length} unknown field(s) preserved in extensions, not applied to the active model.`]:[])]};
}
export function parsePortable(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw new Error('Sector JSON must be at most 5 MiB.');
 let value;try{value=JSON.parse(text);}catch{throw new Error('Invalid JSON file.');}return validatePortable(value);
}
export function serializeSector(record,{moduleVersion,sourceName=''}={}){
 if(record?.version!==1||record.initialSavePending)throw new Error('Select a saved sector before exporting.');
 if(!/^\d+\.\d+\.\d+$/.test(moduleVersion||''))throw new Error('The installed module version is unavailable.');
 assertJSON(record);const content=sectorNaming(structuredClone(record),sourceName),source={coordinates:String(content.code||''),name:sourceName};
 const extensions=content.portableExtensions||{unknown:[]};
 for(const key of ['code','sceneId','placement','initialSavePending','journalName','portableExtensions'])delete content[key];
 content.sectorType??='normal';
 const file={format:FORMAT,formatVersion:FORMAT_VERSION,schemaVersion:SCHEMA_VERSION,exportedBy:{module:FORMAT,version:moduleVersion},source,sector:content,extensions};
 const checked=validatePortable(file).file;checked.sector=materialize(checked.sector);return validatePortable(checked).file;
}
export function deserializeSector(file,{code,sceneId}={}){
 const result=validatePortable(file),content=structuredClone(result.file.sector);
 // Defaults are the current persisted model's defaults; no narrative is invented.
 const sector=materialize(content);
 Object.assign(sector,{code,sceneId,placement:{version:1,sceneId},portableExtensions:result.file.extensions});
 return sector;
}
export function exportFilename(record,name=''){
 const label=String(record.customName||name||record.code||record.sectorType||'sector').normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[.\s]+$/g,'').trim().slice(0,100)||'sector';return `myz-sector-${label}.json`;
}
export function referenceEntries(file){
 const found=[];const walk=(value,path=[])=>{if(!value||typeof value!=='object')return;for(const [key,child] of Object.entries(value)){if(typeof child==='string'&&child&&/(?:uuid|Uuid|UUID)$/.test(key))found.push({uuid:child,path:[...path,key].join('.')});else if(Array.isArray(child)&&/(?:uuid|Uuid|UUID)s$/.test(key)){for(const [index,uuid] of child.entries())if(typeof uuid==='string'&&uuid)found.push({uuid,path:[...path,key,index].join('.')});}else if(child&&typeof child==='object')walk(child,[...path,key]);}};walk(file.sector,['sector']);return found;
}
export async function inspectReferences(file,env=globalThis){
 const cache=new Map(),references=[];for(const item of referenceEntries(file)){if(!/^[A-Za-z0-9_.-]{1,512}$/.test(item.uuid))throw new Error(`${item.path}: invalid UUID.`);if(!cache.has(item.uuid))cache.set(item.uuid,Promise.resolve().then(()=>env.fromUuid(item.uuid)).then(doc=>doc?{resolved:true,name:doc.name,type:doc.documentName}:{resolved:false}).catch(error=>({resolved:false,error:error.message})));references.push({...item,...await cache.get(item.uuid)});}return references;
}
export function sectorCounts(sector){
 const result={};for(const key of ['locations','encounters','effects','loot','history','secrets'])if(sector[key])result[key]=sector[key].length;
 for(const key of ['images','locations','inhabitants','gear','events'])if(sector.special?.[key])result[`special.${key}`]=sector.special[key].length;
 for(const key of ['projects','inhabitants','factions','events','threads'])if(sector.settlement?.[key])result[`settlement.${key}`]=sector.settlement[key].length;
 if(sector.settlement?.shop){result['Shop groups']=sector.settlement.shop.groups?.length||0;result['Shop Items']=sector.settlement.shop.groups?.reduce((sum,g)=>sum+(g.entries?.length||0),0)||0;}
 return result;
}
