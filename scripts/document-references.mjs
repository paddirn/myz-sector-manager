import {resolveDocument} from './ui/documents.mjs';
import {resultFields,resultReference} from './rolltable-results.mjs';
export const MODULE='myz-sector-manager',REFERENCE_SETTING='documentReferences',FORMAT_VERSION=1;
const generation=[
 ['environment','Sector Environment','Environment Generation','UEm95WiZocwvFGSU',['Environment']],
 ['ruinsA','Normal Ruins','Ruins & Locations','QxY3EmhqXMdKa3sC',['Ruins Normal','Ruins A']],
 ['ruinsB','Industrial Ruins','Ruins & Locations','n1CEYKphbiBZLDUb',['Ruins Industry','Ruins Industrial','Ruins B']],
 ['rot','Rot Level','Environment Generation','rp2JNLkCDatudc88',['Rot']],
 ['threatLevel','Threat Level','Threats & Encounters','3FWOT8OJaXc7bfrC',[]],
 ['threatType','Threat Type','Threats & Encounters','Kk8jRbrOk3NejHUB',[]],
 ['humanoid','Humanoid Threats','Threats & Encounters','5ZVTmWwi5wyi52rd',['Humanoids','Humanoid']],
 ['encounter','D66 Encounters','Threats & Encounters','Sh3Srm3KHyGgR7uh',['Encounters','Encounter']],
 ['monster','Monster Threats','Threats & Encounters','tsNy12fCcREgIDLk',['Monsters','Monster']],
 ['phenomenon','Phenomena','Threats & Encounters','jIRwumcfuFBGU8Zp',['Phenomenon']],
 ['artifact','Artifacts','Artifacts & Equipment','aarjzrm2IwJYczhi',['Artifact']],
 ['mood','Sector Mood','Environment Generation','8aGJhfpHDBv52W1K',['Mood']],
 ['scrap','Scrap','Artifacts & Equipment','sWLvZ6qZikXt2k6l',['Scraps']]
];
const terrains=[['Ash Desert','FMb1CJATTxsXLKNy'],['Crumbling Ruins','iOuf5HBkPTJRtai7'],['Dead Woods','DDIlg70LYjP70uGk'],['Decayed Ruins','cB0RcJZRY9SCZMIs'],['Derelict Industries','PlKYSGrma1BD3ZOw'],['Glasified Field','AFvYlL3SKE7TJlyy'],['Huge Crater','yJ2ZT69torV7PyQn'],['Marshlands','udnDBnBSFQz5NrJl'],['Overgrown Ruins','LJR12IhuWO5QidLz'],['Scrublands','6y7FfEQgbSGMO9Rk'],['Settlement','QmXrOSRquBrSMKgo'],['Thick Woods','5esCJTuBkL01hsE4'],['Unscathed Ruins','bf0HSWkE02OfTqK9']];
const slug=name=>name[0].toLowerCase()+name.slice(1).replace(/\s+(.)/g,(_,letter)=>letter.toUpperCase());
const definition=(key,label,category,id,required,aliases=[],extra={})=>Object.freeze({key,label,category,documentType:'RollTable',defaultUuid:null,legacyUuid:`RollTable.${id}`,required,description:`${label} RollTable. ${required?'Needed for generation.':'Optional; existing Description is retained if unavailable.'}`,aliases:[label,...aliases],...extra});
// Only this registry contains module-level document IDs. Legacy IDs are migration candidates, never defaults.
export const REFERENCE_DEFINITIONS=Object.freeze([
 ...generation.map(([key,label,category,id,aliases])=>definition(`generation.${key}`,label,category,id,true,aliases)),
 definition('events.zone','Zone Events','Events & History','24wtBybpf1ObKbcG',false,['Zone Event','Zone']),
 definition('events.ark','Ark Events','Events & History','c5Saikp36mQWGqL1',false,['Ark Event','Ark']),
 Object.freeze({key:'travelEvents.weatherTable',label:'Weather Conditions',category:'Travel Events',documentType:'RollTable',defaultUuid:null,legacyUuid:null,required:false,description:'Optional global Zone weather table; text results. Configure your own world or compendium table.',aliases:[]}),
 ...terrains.map(([name,id])=>definition(`terrainDescriptions.${slug(name)}`,name,'Terrain Descriptions',id,false,[`${name} Description`,`${name} Descriptions`],{terrain:name}))
]);
export const REFERENCE_BY_KEY=new Map(REFERENCE_DEFINITIONS.map(def=>[def.key,def]));
// Compatibility exports for existing integrations/tests; runtime consumers resolve by registry key.
export const LEGACY_GENERATION_UUIDS=Object.freeze(Object.fromEntries(REFERENCE_DEFINITIONS.filter(d=>d.key.startsWith('generation.')).map(d=>[d.key.slice(11),d.legacyUuid])));
export const LEGACY_EVENT_UUIDS=Object.freeze(Object.fromEntries(REFERENCE_DEFINITIONS.filter(d=>d.key.startsWith('events.')).map(d=>[d.key.slice(7),d.legacyUuid])));
export const LEGACY_TERRAIN_UUIDS=Object.freeze(Object.fromEntries(REFERENCE_DEFINITIONS.filter(d=>d.terrain).map(d=>[d.terrain,d.legacyUuid])));
export const emptyReferenceConfiguration=()=>({formatVersion:1,references:{},migration:{version:0,outcomes:[]}});
export function referenceConfiguration(env=globalThis){
 const saved=env.game?.settings?.get?.(MODULE,REFERENCE_SETTING);
 if(!saved)return emptyReferenceConfiguration();
 if(saved.formatVersion!==FORMAT_VERSION)throw new Error('Unsupported saved Document References format; original settings retained.');
 return saved;
}
export function referenceSelection(key,env=globalThis,configuration=referenceConfiguration(env)){
 const definition=REFERENCE_BY_KEY.get(key);if(!definition)throw new Error(`Unknown document reference: ${key}`);
 const override=Object.hasOwn(configuration.references||{},key)?configuration.references[key]:{mode:'default'};
 return {definition,mode:override.mode,uuid:override.mode==='custom'?override.uuid:override.mode==='disabled'?null:definition.defaultUuid};
}
export const configuredUuid=(key,env=globalThis)=>referenceSelection(key,env).uuid;
export async function validateReference(key,env=globalThis,configuration=referenceConfiguration(env)){
 const selection=referenceSelection(key,env,configuration),{definition,mode,uuid}=selection;
 const result={key,label:definition.label,mode,uuid:uuid||null,name:'',status:mode==='disabled'?'Disabled':'Unconfigured',error:'',document:null};
 if(!uuid){if(mode!=='disabled')result.error='No bundled default is available; assign a world or compendium document.';return result;}
 if(typeof uuid!=='string'||uuid.length>512||!/^[A-Za-z0-9_.-]+$/.test(uuid)){return {...result,status:'Missing',error:'Invalid document UUID.'};}
 try{
  const resolved=await resolveDocument(uuid,'',env);if(resolved.state!=='valid')return {...result,status:resolved.state==='missing'||resolved.state==='invalid'?'Missing':'Inaccessible',error:resolved.message};const document=resolved.doc;
  result.name=String(document.name||'');
  if(document.documentName!==definition.documentType)return {...result,status:'Wrong Document Type',error:`Expected ${definition.documentType}, got ${document.documentName}.`};
  if(document.testUserPermission&&!document.testUserPermission(env.game?.user,'OBSERVER'))return {...result,status:'Inaccessible',error:'Observer access is required.'};
  if(typeof document.roll!=='function')return {...result,status:'Wrong Document Type',error:'RollTable has no supported roll method.'};
  return {...result,status:mode==='default'?'Default in Use':'Valid',document};
 }catch(error){return {...result,status:'Inaccessible',error:error.message};}
}
export async function resolveConfiguredDocument(key,env=globalThis){
 if(!env.game?.user?.isGM)throw new Error('GM access required for document references.');
 const result=await validateReference(key,env);
 if(!result.document)throw new Error(`${result.label} [${key}]: ${result.status}${result.uuid?` (${result.uuid})`:''}. ${result.error}`);
 return result.document;
}
export const validateAllReferences=(env=globalThis,configuration=referenceConfiguration(env))=>Promise.all(REFERENCE_DEFINITIONS.map(def=>validateReference(def.key,env,configuration)));
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
function safeObject(value,path='configuration'){
 if(Array.isArray(value)){for(const item of value)safeObject(item,path);return;}
 if(!value||typeof value!=='object')return;
 if(!plain(value))throw new Error(`${path}: expected plain JSON objects.`);
 for(const [key,item] of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(key))throw new Error(`Unsafe key: ${key}`);safeObject(item,`${path}.${key}`);}
}
export function validateReferenceOverrides(references){
 if(!plain(references))throw new Error('references must be an object.');safeObject(references);
 const clean={};
 for(const [key,value] of Object.entries(references)){
  const def=REFERENCE_BY_KEY.get(key);if(!def)throw new Error(`Unknown reference key: ${key}`);
  if(!plain(value)||!['default','custom','disabled'].includes(value.mode))throw new Error(`${key}: mode must be default, custom or disabled.`);
  if(value.documentType!==undefined&&value.documentType!==def.documentType)throw new Error(`${key}: incompatible documentType.`);
  for(const prop of Object.keys(value))if(!['mode','uuid','documentType','name'].includes(prop))throw new Error(`${key}: unknown property ${prop}`);
  if(value.name!==undefined&&(typeof value.name!=='string'||value.name.length>512))throw new Error(`${key}: invalid name.`);
  if(value.mode==='custom'&&(typeof value.uuid!=='string'||value.uuid.length>512||!/^[A-Za-z0-9_.-]+$/.test(value.uuid)))throw new Error(`${key}: custom mode needs a valid UUID.`);
  if(value.mode!=='custom'&&value.uuid!=null&&value.uuid!=='')throw new Error(`${key}: only custom mode can specify a UUID.`);
  clean[key]={mode:value.mode,...(value.mode==='custom'?{uuid:value.uuid}:{}),...(value.name?{name:value.name}:{})};
 }
 return clean;
}
export function exportReferenceConfiguration(configuration,env=globalThis){
 return {formatVersion:FORMAT_VERSION,module:MODULE,moduleVersion:env.game?.modules?.get(MODULE)?.version||'unknown',exportedAt:new Date().toISOString(),references:Object.fromEntries(REFERENCE_DEFINITIONS.map(def=>[def.key,{...(configuration.references[def.key]||{mode:'default'}),documentType:def.documentType}]))};
}
export function importReferenceConfiguration(text,current,mode='merge'){
 if(typeof text!=='string'||text.length>200000)throw new Error('Configuration must be a JSON file smaller than 200 KB.');
 const input=JSON.parse(text);safeObject(input);
 if(!plain(input)||input.formatVersion!==FORMAT_VERSION||input.module!==MODULE)throw new Error('Unsupported configuration format, version or module.');
 for(const key of Object.keys(input))if(!['formatVersion','module','moduleVersion','exportedAt','references'].includes(key))throw new Error(`Unknown configuration property: ${key}`);
 if(!['merge','replace'].includes(mode))throw new Error('Choose merge or replace.');
 const references=validateReferenceOverrides(input.references);
 return {...structuredClone(current),references:mode==='merge'?{...current.references,...references}:references};
}
export async function saveReferenceConfiguration(next,env=globalThis,expected=null){
 if(!env.game.user.isGM)throw new Error('Only a GM can save Document References.');
 if(expected!==null&&JSON.stringify(referenceConfiguration(env))!==expected)throw new Error('Document References changed in another window/client. Reopen and review before saving.');
 const clean={...structuredClone(next),formatVersion:FORMAT_VERSION,references:validateReferenceOverrides(next.references)};
 await env.game.settings.set(MODULE,REFERENCE_SETTING,clean);return clean;
}
const normalizeName=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function legacyIdentity(def,doc){
 if(!def.aliases.some(alias=>normalizeName(alias)===normalizeName(doc.name)))return false;
 const results=Array.from(doc.results?.values?.()||doc.results||[]).sort((a,b)=>(a.range?.[0]||0)-(b.range?.[0]||0));
 if(!results.length)return false;
 if(def.terrain)return doc.formula==='1d6'&&results.length===6&&results.every((row,i)=>row.weight===1&&row.range?.[0]===i+1&&row.range?.[1]===i+1&&String(resultFields(row).name||resultFields(row).description).trim());
 // Recognizable name + usable table rows; ambiguity is left for explicit GM review.
 return Boolean(doc.formula)&&results.every(row=>Array.isArray(row.range)&&row.range.length===2&&row.range.every(Number.isFinite)&&(String(resultFields(row).name||resultFields(row).description).trim()||resultReference(row)));
}
const migrationPromises=new WeakMap();
export async function migrateReferenceConfiguration(env=globalThis){
 if(!env.game.user.isGM||env.game.users.activeGM?.id!==env.game.user.id)return null;
 const original=referenceConfiguration(env);if(original.migration?.version>=1)return original;
 const next=structuredClone(original),outcomes=[];next.references??={};
 for(const def of REFERENCE_DEFINITIONS){
  if(Object.hasOwn(next.references,def.key)){outcomes.push({key:def.key,status:'Preserved override'});continue;}
  if(!def.legacyUuid){outcomes.push({key:def.key,status:'Unconfigured',uuid:null,error:'No legacy or bundled resource is available.'});continue;}
  const probe={references:{[def.key]:{mode:'custom',uuid:def.legacyUuid}}};
  const result=await validateReference(def.key,env,probe);
  if(result.document&&legacyIdentity(def,result.document)){next.references[def.key]={mode:'custom',uuid:def.legacyUuid};outcomes.push({key:def.key,status:'Migrated',uuid:def.legacyUuid,name:result.name});}
  else outcomes.push({key:def.key,status:result.document?'Review legacy identity':result.status,uuid:def.legacyUuid,name:result.name,error:result.error});
 }
 // Preserve any settings written while document resolution was pending.
 if(JSON.stringify(referenceConfiguration(env))!==JSON.stringify(original))throw new Error('Document References changed during migration; no migration changes saved. Reopen settings to retry.');
 next.migration={version:1,completedAt:new Date().toISOString(),outcomes};
 await saveReferenceConfiguration(next,env,JSON.stringify(original));
 const unresolved=outcomes.filter(row=>!['Migrated','Preserved override'].includes(row.status));
 if(unresolved.length)env.ui?.notifications?.warn(`Document References: ${unresolved.length} resources need setup/review. Open Module Settings → Document References. Existing sector records are unchanged.`);
 env.console?.info('MYZ Document References migration',outcomes);return next;
}
export function ensureReferenceMigration(env=globalThis){
 if(!migrationPromises.has(env))migrationPromises.set(env,migrateReferenceConfiguration(env).finally(()=>migrationPromises.delete(env)));return migrationPromises.get(env);
}

const warningMessages=new WeakMap();
export function warnReferenceOnce(message,env=globalThis){let seen=warningMessages.get(env);if(!seen){seen=new Set();warningMessages.set(env,seen);}if(seen.has(message))return;seen.add(message);if(seen.size>100)seen.delete(seen.values().next().value);env.console?.warn(message);env.ui?.notifications?.warn(message);}
