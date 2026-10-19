import {terrainDescription} from './terrain-descriptions.mjs';
import {locationDescription} from './location-text.mjs';
import {cleanThreatRecord,threatDeletion} from './sector-fields.mjs';
import {normalizeLoot,itemLootType} from './loot.mjs';
import {storedTravel} from './travel-time.mjs';
import {sectorNaming,sectorName} from './journal-organization.mjs';
import {CONSUMABLES} from './sector-content.mjs';
// Table-driven generation: no Journal writes, chat messages, or drawn-result mutation.
export const RANDOMIZATION_METHODS = [{id:'core',label:'Core Rulebook Tables',generate:generateSector}];
export const TABLE_UUIDS = Object.freeze({
  environment:'RollTable.UEm95WiZocwvFGSU',ruinsA:'RollTable.QxY3EmhqXMdKa3sC',ruinsB:'RollTable.n1CEYKphbiBZLDUb',
  rot:'RollTable.rp2JNLkCDatudc88',threatLevel:'RollTable.3FWOT8OJaXc7bfrC',threatType:'RollTable.Kk8jRbrOk3NejHUB',
  humanoid:'RollTable.5ZVTmWwi5wyi52rd',encounter:'RollTable.Sh3Srm3KHyGgR7uh',monster:'RollTable.tsNy12fCcREgIDLk',phenomenon:'RollTable.jIRwumcfuFBGU8Zp',
  artifact:'RollTable.aarjzrm2IwJYczhi',mood:'RollTable.8aGJhfpHDBv52W1K',scrap:'RollTable.sWLvZ6qZikXt2k6l'
});
// Rulebook p. 156 eligibility, independent of the environment's display text.
const WILDERNESS=['Thick Woods','Scrublands','Marshlands','Dead Woods','Ash Desert','Huge Crater','Glasified Field'];
const NORMAL_RUINS=['Overgrown Ruins','Crumbling Ruins','Decayed Ruins','Unscathed Ruins'];
export const ENVIRONMENTS=Object.freeze(Object.fromEntries([
  ...WILDERNESS.map(name=>[name,{ruins:null,threats:true,artifacts:false}]),
  ...NORMAL_RUINS.map(name=>[name,{ruins:'normal',threats:true,artifacts:true}]),
  ['Derelict Industries',{ruins:'industrial',threats:true,artifacts:true}],
  ['Settlement',{ruins:null,threats:false,artifacts:false,manual:true}]
]));
export const DEFAULT_GENERATION_OPTIONS=Object.freeze({threatMode:'core',dangerousLevel:9});
export function plainText(value,env=globalThis){
  const html=String(value??'').replace(/<br\s*\/?>(?=.)|<\/(?:td|th|p|div|li)>/gi,'$& ');
  if(env.document){const template=env.document.createElement('template');template.innerHTML=html;template.content.querySelectorAll('script,style').forEach(node=>node.remove());return template.content.textContent.trim();}
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
}
export async function resolveGenerationTable(uuid,purpose,env=globalThis){
  if(!env.game.user.isGM)throw new Error('GM access required for entry generation.');
  let table;try{table=await env.fromUuid(uuid);}catch(error){throw new Error(`Cannot resolve ${purpose} table ${uuid}: ${error.message}`);}
  if(table?.documentName!=='RollTable'||typeof table.roll!=='function'||(table.testUserPermission&&!table.testUserPermission(env.game.user,'OBSERVER')))throw new Error(`Missing or inaccessible ${purpose} RollTable: ${uuid}`);
  return table;
}
export async function resolveTables(env=globalThis){
  if(!env.game.user.isGM)throw new Error('Only a GM can randomize sectors.');
  const tables={};
  for(const [purpose,uuid] of Object.entries(TABLE_UUIDS)){
    const table=await resolveGenerationTable(uuid,purpose,env);
    tables[purpose]=table;
  }
  return tables;
}
export async function rollTable(table,env=globalThis,stack=[],{resolveNested=true,allowMissing=false,acceptDraw=null}={}){
  if(stack.length>=8||stack.includes(table.uuid))throw new Error(`Recursive RollTable cycle/depth at ${table.name} (${table.uuid}).`);
  const output=await table.roll({recursive:false});
  if(!output?.results?.length)throw new Error(`RollTable ${table.name} (${table.uuid}) returned no usable results.`);
  if(acceptDraw&&!acceptDraw(output))return {rejected:true};
  const mapped=[];
  for(const result of output.results){
    const description=result.description||result.text||'';
    const inline=[...String(description).matchAll(/@UUID\[([^\]]+)\](?:\{([^}]+)\})?/g)];
    let uuid=result.documentUuid||(inline.length===1?inline[0][1]:'');
    if(!uuid&&typeof result.getDocument!=='function'&&result.documentCollection&&result.documentId)uuid=result.documentCollection.includes('.')?`Compendium.${result.documentCollection}.${result.documentId}`:`${result.documentCollection}.${result.documentId}`;
    let document,referenceWarning;
    try{
      if(uuid){document=await env.fromUuid(uuid);if(!document)throw new Error(`Reference ${uuid} is missing.`);}
      if(!document&&typeof result.getDocument==='function'&&(result.documentId||(result.type!==undefined&&!['text',0].includes(result.type)))){document=await result.getDocument();if(!document)throw new Error('Result document is missing.');}
    }catch(error){if(!allowMissing)throw new Error(`Result reference from ${table.name} is missing or unavailable: ${error.message}`);referenceWarning=`Journal could not be resolved: ${error.message}`;}
    const source={tableUuid:table.uuid,tableName:table.name,originTableUuid:result.parent?.documentName==='RollTable'?result.parent.uuid:table.uuid,resultId:result.id||result._id||'',documentUuid:document?.uuid||uuid,range:Array.isArray(result.range)?[...result.range]:null,rollTotal:Number.isFinite(output.roll?.total)?output.roll.total:null};
    if(document?.documentName==='RollTable'&&resolveNested){
      const nested=await rollTable(document,env,[...stack,table.uuid],{allowMissing});mapped.push(...nested.entries.map(entry=>({...entry,sources:[source,...entry.sources]})));continue;
    }
    const label=String(description).replace(/@UUID\[([^\]]+)\](?:\{([^}]+)\})?/g,(match,uuid,label)=>label||document?.name||uuid);
    const text=plainText(label||document?.name||(allowMissing?uuid:''),env);
    if(!text)throw new Error(`RollTable ${table.name} (${table.uuid}) returned an empty result.`);
    mapped.push({text,referenceWarning,documentTitle:document?.name||'',uuid:document?.uuid||uuid,documentType:document?.documentName||null,itemType:itemLootType(document),quantity:result.flags?.['myz-sector-manager']?.randomization?.quantity??result.quantity,sources:[source],mapping:result.flags?.['myz-sector-manager']?.randomization||{}});
  }
  return {entries:mapped,text:mapped.map(result=>result.text).join('; '),uuid:mapped.length===1?mapped[0].uuid:'',documentType:mapped.length===1?mapped[0].documentType:null,sources:mapped.flatMap(result=>result.sources),mapping:mapped.length===1?mapped[0].mapping:{},documentTitle:mapped.length===1?mapped[0].documentTitle:'',itemType:mapped.length===1?mapped[0].itemType:null,quantity:mapped.length===1?mapped[0].quantity:undefined};
}
function classifiedText(result,label,keys){
  if(!result.text.includes(',')){
    const text=result.text.trim();for(const key of keys){const prefix=new RegExp(`^${key}\\s*:\\s*(.+)$`,'i');const match=text.match(prefix);if(match)return match[1].trim();}
    return text;
  }
  const {name,fields}=compoundText(result.text,label);
  const values=keys.filter(key=>fields[key]!==undefined).map(key=>fields[key]);
  if(values.length>1&&new Set(values.map(value=>value.toLowerCase())).size>1)throw new Error(`Conflicting ${label} fields in result: ${result.text}`);
  return values[0]||name||(()=>{throw new Error(`Malformed ${label} result: missing classification.`);})();
}
export function mapRot(result){
  if([0,1,2,3].includes(result.mapping.rot))return result.mapping.rot;
  const text=classifiedText(result,'Rot Level',['rot level','rot','level']).toLowerCase();
  const labels=[/rot oasis|no rot/,/weak rot/,/rot[- ]heavy/,/rot hotspot/];
  const matches=labels.flatMap((pattern,index)=>pattern.test(text)?[index]:[]);
  if(matches.length===1)return matches[0];
  const numeric=text.match(/^\s*([0-3])(?:\s*[-—:.]|\s*$)/);
  if(numeric)return Number(numeric[1]);
  throw new Error(`Unrecognized Rot Level result: ${result.text}. Use a level 0–3 or a known Rot label.`);
}
const threatCategory=level=>level<5?'fringe':level<9?'central':'dangerous';
function numericLevel(value){if(!Number.isInteger(value)||value<0||value>1000)throw new Error('Numeric Threat Level must be a whole number from 0 to 1000.');return value;}
export function mapThreatLevel(result){
  const explicit=result.mapping.threatLevel;
  if(typeof explicit==='number'){const level=numericLevel(explicit);return {category:threatCategory(level),level};}
  const text=String(explicit??classifiedText(result,'Threat Level',['threat level','level'])).trim().replace(/[–—]/g,'-');
  const rangeCategory={'1-4':'fringe','5-8':'central','9+':'dangerous'}[text.replace(/\s/g,'')];
  if(rangeCategory)return {category:rangeCategory,level:null};
  const number=text.match(/^(?:threat level\s*[:=]?\s*)?(\d+)$/i);
  if(number){const level=numericLevel(Number(number[1]));return {category:threatCategory(level),level};}
  for(const [category,pattern] of [
    ['fringe',/^(?:1\s*-\s*4\s*[:.-]?\s*)?fringe(?: zone)?(?: sectors?)?(?:\s*\(?1\s*-\s*4\)?)?$/i],
    ['central',/^(?:5\s*-\s*8\s*[:.-]?\s*)?central(?: zone)?(?: sectors?)?(?:\s*\(?5\s*-\s*8\)?)?$/i],
    ['dangerous',/^(?:9\+\s*[:.-]?\s*)?(?:dangerous|unusually dangerous)(?: areas?)?(?:\s*\(?9\+\)?)?$/i]
  ])if(pattern.test(text))return {category,level:null};
  throw new Error(`Unrecognized Threat Level result: ${result.text}. Expected a numeric level, Fringe (1–4), Central (5–8), or Unusually Dangerous (9+).`);
}
export async function selectThreatLevel(result,dice,options=DEFAULT_GENERATION_OPTIONS){
  const mapped=mapThreatLevel(result);
  if(mapped.level!==null)return {...mapped,selection:'numeric table result'};
  if(mapped.category==='dangerous')return {...mapped,level:numericLevel(options.dangerousLevel),selection:'GM-configured 9+ level'};
  return {...mapped,level:await dice('1d4')+(mapped.category==='central'?4:0),selection:'uniform selection within category (module policy, not a rulebook roll)'};
}
function compoundText(text,label,nameFirst=false){
  const parts=String(text).split(',').map(part=>part.trim());
  if(parts.some(part=>!part))throw new Error(`Malformed ${label} result: empty comma-separated value.`);
  let name='';const fields={};
  for(const [index,part] of parts.entries()){
    if(index===0&&nameFirst){name=part;continue;}
    const match=part.match(/^([^:]+):\s*(.+)$/);
    if(!match){if(index===0&&!part.includes(':')){name=part;continue;}throw new Error(`Malformed ${label} result: expected a labeled value, got "${part}".`);}
    const key=match[1].trim().toLowerCase().replace(/\s+/g,' '),value=match[2].trim();
    if(Object.hasOwn(fields,key))throw new Error(`Malformed ${label} result: duplicate ${key} field.`);
    fields[key]=value;
  }
  return {name,fields};
}
function yesNo(value,label){
  if(!/^(yes|no)$/i.test(value??''))throw new Error(`Malformed Environment result: ${label} must be Yes or No.`);
  return /^yes$/i.test(value);
}
const knownEnvironment=name=>Object.entries(ENVIRONMENTS).find(([key])=>key.toLowerCase()===name.toLowerCase());
const ruinKind=(enabled,known)=>enabled?(known?.ruins||'normal'):null;
export function mapEnvironment(result,{requireAllFlags=true}={}){
  const text=result.text.replace(/[–—]/g,'-').replace(/\s+/g,' ').trim();
  const mapping=result.mapping?.environment;
  if(text.includes(',')){
    const {name,fields}=compoundText(text,'Environment',true);
    if(!name)throw new Error('Malformed Environment result: environment name must precede Ruin, Threat, and Artifact fields.');
    if(Object.keys(fields).some(key=>!['ruin','threat','artifact'].includes(key)))throw new Error('Malformed Environment result: expected only Ruin, Threat, and Artifact fields.');
    const ruin=yesNo(fields.ruin,'Ruin'),threats=yesNo(fields.threat??(requireAllFlags?undefined:'No'),'Threat'),artifacts=yesNo(fields.artifact??(requireAllFlags?undefined:'No'),'Artifact');
    const known=knownEnvironment(name)?.[1];
    const parsed={name,ruins:ruinKind(ruin,known),threats,artifacts};
    if(mapping&&(mapping.ruins!==parsed.ruins||mapping.threats!==threats||mapping.artifacts!==artifacts))throw new Error('Conflicting explicit Environment text and structured eligibility fields.');
    return parsed;
  }
  if(mapping){
    if(![null,'normal','industrial'].includes(mapping.ruins)||typeof mapping.threats!=='boolean'||typeof mapping.artifacts!=='boolean')throw new Error('Environment mapping needs separate ruins (null/normal/industrial), threats, and artifacts eligibility values.');
    return {name:text,...mapping,manual:mapping.manual===true};
  }
  for(const [name,eligibility] of Object.entries(ENVIRONMENTS)){
    const pattern=new RegExp(`^(?:\\d{1,2}(?:-\\d{1,2})?\\s+)?${name}(?:\\s+(Yes|No|-)(?:\\s*[,|]\\s*|\\s+)(Yes|No|-)(?:\\s*[,|]\\s*|\\s+)(Yes|No|-))?$`,'i');
    const match=text.match(pattern);if(!match)continue;
    if(match[1])return {name,ruins:ruinKind(/^yes$/i.test(match[1]),eligibility),threats:/^yes$/i.test(match[2]),artifacts:/^yes$/i.test(match[3])};
    return {name,...eligibility};
  }
  throw new Error(`Unrecognized Environment result: ${result.text}. Expected an environment name followed by Ruin:Yes/No, Threat:Yes/No, Artifact:Yes/No, a known name alone, or structured eligibility.`);
}
export function mapThreatType(result){
  if(result.mapping.threatType!==undefined){
    if(['humanoid','encounter','monster','phenomenon'].includes(result.mapping.threatType))return result.mapping.threatType;
    throw new Error(`Invalid Threat Type mapping: ${result.mapping.threatType}`);
  }
  const text=classifiedText(result,'Threat Type',['threat type','type']).replace(/[–—]/g,'-').trim();
  const matches=[['encounter',/^(?:2\s*[:.-]?\s*)?d66 encounters?$/i],['humanoid',/^(?:1(?:-2)?\s*[:.-]?\s*)?humanoids?(?: threats?)?$/i],['monster',/^(?:3-5\s*[:.-]?\s*)?monsters?(?: threats?)?$/i],['phenomenon',/^(?:6\s*[:.-]?\s*)?phenomen(?:on|a)(?: threats?)?$/i]].filter(([,pattern])=>pattern.test(text));
  if(matches.length!==1)throw new Error(`Unrecognized Threat Type result: ${result.text}. Expected Humanoid, D66 Encounters, Monster, or Phenomena.`);
  return matches[0][0];
}
const generatedEntry=(result,kind,quantity)=>({title:result.documentType==='JournalEntryPage'?(result.documentTitle||result.text):result.text,status:'Active',details:result.text,uuid:({locations:['Scene','JournalEntry','JournalEntryPage'],encounters:['Actor','JournalEntry','JournalEntryPage'],effects:['Actor','JournalEntry','JournalEntryPage'],loot:['Item']}[kind]||[]).includes(result.documentType)?result.uuid:'',...(quantity===undefined?{}:{quantity}),...(kind==='effects'?{category:'Phenomenon',duration:''}:{}),generated:{method:'core',sources:result.sources}});
// Preserve category before resolving its nested table; final names never classify threats.
export async function rollThreat(tables,env=globalThis,{excludePhenomena=false}={}){
  const selection=await rollTable(tables.threatType,env,[],{resolveNested:false,acceptDraw:excludePhenomena?draw=>{if(draw.results.length!==1)throw new Error('Manual Threat Type requires one result.');const raw=draw.results[0],origin=raw.parent?.uuid,category=['humanoid','encounter','monster','phenomenon'].find(key=>TABLE_UUIDS[key]===origin);if(category)return category!=='phenomenon';if(raw.documentUuid===TABLE_UUIDS.phenomenon)return false;const range=raw.range;return !((draw.roll?.total===6&&(!range||(range[0]<=6&&range[1]>=6)))||(range?.[0]===6&&range?.[1]===6));}:null});
  if(selection.rejected)return [];
  if(excludePhenomena&&selection.entries.length!==1)throw new Error('Manual Threat Type generation requires exactly one top-level result.');
  const threats=[];
  const categoryFor=uuid=>['humanoid','encounter','monster','phenomenon'].find(key=>TABLE_UUIDS[key]===uuid);
  for(const selected of selection.entries){
    let category,result;
    if(selected.documentType==='RollTable'){
      category=categoryFor(selected.uuid);
      if(!category)throw new Error(`Threat Type references an unconfigured category RollTable: ${selected.uuid}`);
      if(excludePhenomena&&category==='phenomenon')return [];
      result=await rollTable(tables[category]||await resolveGenerationTable(TABLE_UUIDS[category],category,env),env,[tables.threatType.uuid]);
    }else{
      // Some APIs/modules recurse despite the requested option. Embedded result parents
      // identify the originating category, so reuse those final results without rerolling.
      const origins=selected.sources.map(source=>categoryFor(source.originTableUuid)).filter(Boolean);
      const categories=[...new Set(origins)];
      if(categories.length>1)throw new Error('Threat result has conflicting originating categories.');
      if(categories.length){category=categories[0];result={entries:[selected]};}
      else if(selected.documentType)throw new Error(`Final ${selected.documentType} result "${selected.documentTitle||selected.text}" has no originating Threat category. Preserve its parent RollTable or disable recursive resolution.`);
      else{category=mapThreatType(selected);if(excludePhenomena&&category==='phenomenon')return [];result=await rollTable(tables[category]||await resolveGenerationTable(TABLE_UUIDS[category],category,env),env,[tables.threatType.uuid]);}
    }
    if(excludePhenomena&&category==='phenomenon')return [];
    for(const leaf of result.entries){
      const expected=['humanoid','monster'].includes(category)?'Actor':'JournalEntry';
      if(expected==='JournalEntry'&&!leaf.uuid)(env.console||console).warn(`Journal result has no document metadata: ${leaf.text}; preserving text without a reference.`);
      if(leaf.documentType&&leaf.documentType!==expected&&!(expected==='JournalEntry'&&leaf.documentType==='JournalEntryPage'))throw new Error(`${category} threat result must reference ${expected}, received ${leaf.documentType} (${leaf.uuid}).`);
      threats.push({category,result:{...leaf,sources:leaf===selected?leaf.sources:[...selected.sources,...leaf.sources]}});
    }
  }
  return threats;
}
const collectionValues=collection=>Array.from(collection?.values?collection.values():collection||[]);
export const resolveRuinJournal=(result,env=globalThis)=>resolveNamedDocument(result,'JournalEntry',env);
export async function resolveNamedDocument(result,documentName,env=globalThis){
  const label=documentName==='Actor'?'Actor':'Journal';
  if((result.documentType===documentName||(documentName==='JournalEntry'&&result.documentType==='JournalEntryPage'))&&result.uuid)return result;
  if(result.referenceWarning)return result; // Never replace a broken explicit reference with a guessed match.
  if(result.uuid)return {...result,referenceWarning:`${label} could not be resolved for ${result.text}: result references ${result.documentType||'an unsupported document'}.`};
  if(documentName==='JournalEntry'){
    const referenceWarning=`Journal could not be resolved for ${result.text}: missing document metadata; name lookup is disabled.`;
    (env.console||console).warn(referenceWarning);
    return {...result,referenceWarning};
  }
  const matches=new Map();let incomplete=false;
  for(const document of collectionValues(documentName==='Actor'?env.game.actors:env.game.journal))if(document.name===result.text.trim()&&document.uuid&&document.visible!==false)matches.set(document.uuid,document);
  for(const pack of env.game.packs?.values?env.game.packs.values():env.game.packs||[]){
    if((pack.documentName||pack.metadata?.type)!==documentName||pack.visible===false)continue;
    try{
      const index=await pack.getIndex({fields:['name']});
      for(const row of index)if(row.name===result.text.trim()){
        const document=await pack.getDocument(row._id||row.id);
        if(!document?.uuid){incomplete=true;continue;}
        matches.set(document.uuid,document);
      }
    }catch{incomplete=true;}
  }
  if(!incomplete&&matches.size===1){const document=[...matches.values()][0];return {...result,uuid:document.uuid,documentType:documentName,documentTitle:document.name};}
  return {...result,referenceWarning:`${label} could not be resolved for ${result.text}: ${incomplete?'some document collections could not be searched':matches.size?'multiple exact matches':'no exact match'}.`};
}
export const MAX_GENERATION_ATTEMPTS=30;
export function artifactAllowed(draw){
  if(draw.results.length!==1)throw new Error('Artifact selection must contain exactly one table result.');
  const result=draw.results[0],range=result.range||result._source?.range;
  if(range&&!(Array.isArray(range)&&range.length===2&&range.every(Number.isInteger)&&range[0]>=111&&range[1]<=666&&range[0]<=range[1]))throw new Error('Artifact TableResult range is not a D666 range (111–666).');
  const total=draw.roll?.total;
  if(Number.isInteger(total)&&total>=111&&total<=666){if(range&&(total<range[0]||total>range[1]))throw new Error('Artifact D666 roll total does not match the selected result range.');return total<643;}
  if(Array.isArray(range)&&range.length===2&&range.every(Number.isInteger)&&range[0]>=111&&range[1]<=666&&range[0]<=range[1]){
    if(range[1]<643)return true;if(range[0]>=643)return false;
    throw new Error('Artifact range crosses 643; the actual D666 roll is required to filter it.');
  }
  throw new Error('Cannot determine artifact D666 value: provide the actual roll total or selected TableResult range.');
}
export async function boundedRoll(operation,label,maxAttempts=MAX_GENERATION_ATTEMPTS){
  for(let attempt=0;attempt<maxAttempts;attempt++){const result=await operation();if(result&&!result.rejected)return result;}
  throw new Error(`${label}: no eligible result after ${maxAttempts} attempts; check the RollTable.`);
}
export const rollArtifact=(table,env=globalThis)=>boundedRoll(()=>rollTable(table,env,[],{acceptDraw:artifactAllowed}),'Artifacts (excluded D666 643–666)');
export async function rollBasePool(level,env=globalThis){
  if(level===0)return [];
  const pool=await new env.Roll(`${level}d6`).evaluate();
  return (pool.dice||[]).flatMap(die=>die.results.filter(result=>result.active!==false&&!result.discarded).map(result=>result.result));
}
export async function generateSector(existing,{env=globalThis,options=DEFAULT_GENERATION_OPTIONS,rollBaseDice=level=>rollBasePool(level,env),roll=async formula=>Number((await new env.Roll(formula).evaluate()).total)}={}){
  if(existing?.sectorType==='special')throw new Error('Special Zone Sectors are manually authored and cannot be randomized.');
  options={...DEFAULT_GENERATION_OPTIONS,...options};
  if(!['core','individual-d3'].includes(options.threatMode))throw new Error('Unknown threat generation mode.');
  numericLevel(options.dangerousLevel);if(options.dangerousLevel<9)throw new Error('Unusually Dangerous category must use a numeric Threat Level of at least 9.');
  const tables=await resolveTables(env);
  const dice=async formula=>{const value=await roll(formula),sides=Number(formula.slice(2));if(!Number.isInteger(value)||value<1||value>sides)throw new Error(`Invalid ${formula} roll result: ${value}`);return value;};
  const chance=async value=>(await dice('1d10000'))<=value*10000;
  const take=key=>rollTable(tables[key],env);
  const environment=await take('environment'),eligibility=mapEnvironment(environment);
  if(eligibility.manual)throw new Error('Settlement requires GM-authored details, not normal random sector generation (Core Rulebook p. 156). No changes were saved.');
  const description=await terrainDescription(eligibility.name,env);
  const rot=await take('rot'),threatLevel=await take('threatLevel'),mood=await take('mood');
  const threat=await selectThreatLevel(threatLevel,dice,options);
  // One pool, one per-face result for each Base Die. Never reroll it for artifacts.
  const baseDice=threat.level===0?[]:await rollBaseDice(threat.level);
  if(!Array.isArray(baseDice)||baseDice.length!==threat.level||baseDice.some(face=>!Number.isInteger(face)||face<1||face>6))throw new Error('Base Dice pool must return one face (1–6) per numeric Threat Level.');
  const ones=baseDice.filter(face=>face===1).length,sixes=baseDice.filter(face=>face===6).length;
  const severity=eligibility.threats?ones:0,artifactCount=eligibility.artifacts?sixes:0;
  const output=structuredClone(existing);
  for(const key of ['locations','encounters','effects','loot'])output[key]=(output[key]||[]).filter(entry=>entry.generated?.method!=='core'||(key==='loot'&&(Boolean(entry.resource)||entry.title==='COMPONENTS')));
  output.threatLevel=threat.level;output.terrain=eligibility.name;output.rot=mapRot(rot);output.mood=mood.text;
  if(description!==null)output.description=description;
  const add=(key,result,quantity,defaultType='scrap')=>{const raw=generatedEntry(result,key,quantity),entry=key==='loot'?normalizeLoot({...raw,type:result.itemType||defaultType,typeSource:result.itemType?'reference':'default'}):raw;output[key].push(entry);return entry;};
  if(eligibility.ruins){
    const ruins=await rollTable(tables[eligibility.ruins==='normal'?'ruinsA':'ruinsB'],env,[],{allowMissing:true});
    for(const result of ruins.entries){const resolved=await locationDescription(await resolveRuinJournal(result,env),env);const entry=add('locations',resolved);entry.details=resolved.details;entry.uuid=resolved.uuid||'';if(resolved.referenceWarning)entry.referenceWarning=resolved.referenceWarning;}
  }
  let threatCount=0;
  if(severity){
    const rolls=options.threatMode==='individual-d3'?await dice('1d3'):1;
    for(let i=0;i<rolls;i++){
      const identities=await rollThreat(tables,env);
      if(identities.length!==1)throw new Error('Each Threat Type/subtype roll must yield exactly one threat result; multiple final results are ambiguous. No sector changes were saved.');
      for(const {category,result} of identities){
        threatCount++;
        const entry=add(category==='phenomenon'?'effects':'encounters',result);entry.title=result.documentTitle||result.text;if(category!=='phenomenon')entry.type=category==='humanoid'?'Humanoid':category==='monster'?'Monster':'Encounter';entry.generated.threatCategory=category;entry.generated.threatSeverity=severity;entry.generated.threatMode=options.threatMode;
        entry.details+=`\nThreat roll severity: ${severity} Base ${severity===1?'Die':'Dice'} showing 1.${options.threatMode==='individual-d3'?' Individual threats: 1d3 house rule.':''}`;
      }
    }
  }
  for(let i=0;i<artifactCount;i++)add('loot',await rollArtifact(tables.artifact,env),undefined,'artifact');
  output.supplies??={};
  for(const key of Object.keys(CONSUMABLES))output.supplies[key]={...output.supplies[key],quantity:0,collected:output.supplies[key]?.collected??false};
  for(const [clean,contaminated] of [['cleanGrub','rotGrub'],['cleanWater','rotWater']]){
    if(!await chance(.5))continue;
    const quantity=await dice('1d6');
    output.supplies[await chance(.25)?clean:contaminated].quantity=quantity;
  }
  if(await chance(.5))output.supplies.bullets.quantity=await dice('1d6');
  if(await chance(.25))output.supplies.booze.quantity=await dice('1d3');
  if(await chance(.25))output.supplies.components.quantity=await dice('1d3');
  if(await chance(.5))add('loot',await take('scrap'),await dice('1d6'));
  output.randomization={method:'core',threatLevel:threat.category,levelSelection:threat.selection,environment:eligibility,baseDice,rolledOnes:ones,rolledSixes:sixes,threatSeverity:severity,threatCount,artifactCount,threatMode:options.threatMode,sources:[...environment.sources,...rot.sources,...threatLevel.sources,...mood.sources]};
  output.loot=output.loot.map(normalizeLoot);
  return output;
}

export async function saveGeneratedSector(journal,expected,next,env=globalThis){
  if(expected?.sectorType==='special'||next?.sectorType==='special')throw new Error('Special Zone Sectors cannot receive randomized content.');
  if(!env.game.user.isGM)throw new Error('Only a GM can randomize sectors.');
  if(JSON.stringify(journal.getFlag('myz-sector-manager','sector'))!==JSON.stringify(expected))throw new Error('This sector changed while generation was running. Nothing was saved; review it and try again.');
  if(expected?.initialSavePending===true)throw new Error('Save this sector before randomizing.');
  // One Document flag update commits the complete generation; no preceding field writes.
  const stored=({...sectorNaming(expected,journal.name),...cleanThreatRecord(next)});delete stored.journalName;if(stored.travel)stored.travel=storedTravel(stored.travel);
  const name=sectorName(stored);
  if((name&&name!==journal.name)||Object.keys(threatDeletion(expected)).length)await journal.update({...((name&&name!==journal.name)?{name}:{}),'flags.myz-sector-manager.sector':stored,...threatDeletion(expected)});
  else await journal.setFlag('myz-sector-manager','sector',stored);
}
