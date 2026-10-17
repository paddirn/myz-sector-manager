// Table-driven generation: no Journal writes, chat messages, or drawn-result mutation.
export const RANDOMIZATION_METHODS = [{id:'core',label:'Core Rulebook Tables',generate:generateSector}];
export const TABLE_UUIDS = Object.freeze({
  environment:'RollTable.UEm95WiZocwvFGSU',ruinsA:'RollTable.QxY3EmhqXMdKa3sC',ruinsB:'RollTable.n1CEYKphbiBZLDUb',
  rot:'RollTable.rp2JNLkCDatudc88',threatLevel:'RollTable.3FWOT8OJaXc7bfrC',threatType:'RollTable.Kk8jRbrOk3NejHUB',
  humanoid:'RollTable.5ZVTmWwi5wyi52rd',monster:'RollTable.tsNy12fCcREgIDLk',phenomenon:'RollTable.jIRwumcfuFBGU8Zp',
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
export async function resolveTables(env=globalThis){
  if(!env.game.user.isGM)throw new Error('Only a GM can randomize sectors.');
  const tables={};
  for(const [purpose,uuid] of Object.entries(TABLE_UUIDS)){
    let table;try{table=await env.fromUuid(uuid);}catch(error){throw new Error(`Cannot resolve ${purpose} table ${uuid}: ${error.message}`);}
    if(table?.documentName!=='RollTable'||typeof table.roll!=='function'||(table.testUserPermission&&!table.testUserPermission(env.game.user,'OBSERVER')))throw new Error(`Missing or inaccessible ${purpose} RollTable: ${uuid}`);
    tables[purpose]=table;
  }
  return tables;
}
export async function rollTable(table,env=globalThis,stack=[]){
  if(stack.length>=8||stack.includes(table.uuid))throw new Error(`Recursive RollTable cycle/depth at ${table.name} (${table.uuid}).`);
  const output=await table.roll({recursive:false});
  if(!output?.results?.length)throw new Error(`RollTable ${table.name} (${table.uuid}) returned no usable results.`);
  const mapped=[];
  for(const result of output.results){
    const description=result.description||result.text||'';
    const inline=[...String(description).matchAll(/@UUID\[([^\]]+)\](?:\{([^}]+)\})?/g)];
    let uuid=result.documentUuid||(inline.length===1?inline[0][1]:'');
    if(!uuid&&result.documentCollection&&result.documentId)uuid=result.documentCollection.includes('.')?`Compendium.${result.documentCollection}.${result.documentId}`:`${result.documentCollection}.${result.documentId}`;
    let document;
    if(uuid){try{document=await env.fromUuid(uuid);}catch(error){throw new Error(`Result reference ${uuid} from ${table.name} is unavailable: ${error.message}`);}if(!document)throw new Error(`Result reference ${uuid} from ${table.name} is missing.`);}
    const source={tableUuid:table.uuid,tableName:table.name,resultId:result.id||result._id||'',documentUuid:document?.uuid||uuid};
    if(document?.documentName==='RollTable'){
      const nested=await rollTable(document,env,[...stack,table.uuid]);mapped.push({...nested,sources:[source,...nested.sources]});continue;
    }
    const label=String(description).replace(/@UUID\[([^\]]+)\](?:\{([^}]+)\})?/g,(match,uuid,label)=>label||document?.name||uuid);
    const text=plainText(label||document?.name,env);
    if(!text)throw new Error(`RollTable ${table.name} (${table.uuid}) returned an empty result.`);
    mapped.push({text,uuid:document?.uuid||uuid,documentType:document?.documentName||null,sources:[source],mapping:result.flags?.['myz-sector-manager']?.randomization||{}});
  }
  return {text:mapped.map(result=>result.text).join('; '),uuid:mapped.length===1?mapped[0].uuid:'',documentType:mapped.length===1?mapped[0].documentType:null,sources:mapped.flatMap(result=>result.sources),mapping:mapped.length===1?mapped[0].mapping:{}};
}
export function mapRot(result){
  if([0,1,2,3].includes(result.mapping.rot))return result.mapping.rot;
  const text=result.text.toLowerCase();
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
  const text=String(explicit??result.text).trim().replace(/[–—]/g,'-');
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
export function mapEnvironment(result){
  const mapping=result.mapping.environment;
  if(mapping){
    if(![null,'normal','industrial'].includes(mapping.ruins)||typeof mapping.threats!=='boolean'||typeof mapping.artifacts!=='boolean')throw new Error('Environment mapping needs separate ruins (null/normal/industrial), threats, and artifacts eligibility values.');
    const known=ENVIRONMENTS[result.text.trim()];
    if(known&&(mapping.ruins!==known.ruins||mapping.threats!==known.threats||mapping.artifacts!==known.artifacts))throw new Error(`Environment mapping for ${result.text} contradicts Core Rulebook p. 156.`);
    return {name:result.text,...mapping,manual:known?.manual||mapping.manual===true};
  }
  const text=result.text.replace(/[–—]/g,'-').replace(/\s+/g,' ').trim();
  for(const [name,eligibility] of Object.entries(ENVIRONMENTS)){
    const pattern=new RegExp(`^(?:\\d{1,2}(?:-\\d{1,2})?\\s+)?${name}(?:\\s+(Yes|No|-)(?:\\s*[,|]\\s*|\\s+)(Yes|No|-)(?:\\s*[,|]\\s*|\\s+)(Yes|No|-))?$`,'i');
    const match=text.match(pattern);if(!match)continue;
    if(match[1]){
      const actual=match.slice(1).map(value=>value.toLowerCase()==='yes');
      const expected=[Boolean(eligibility.ruins),eligibility.threats,eligibility.artifacts];
      if(actual.some((value,index)=>value!==expected[index]))throw new Error(`Environment columns for ${name} contradict Core Rulebook p. 156.`);
    }
    return {name,...eligibility};
  }
  throw new Error(`Unrecognized Environment result: ${result.text}. Use a rulebook environment or an explicit separate-column environment mapping.`);
}
export function mapThreatType(result){
  if(result.mapping.threatType!==undefined){
    if(['humanoid','monster','phenomenon'].includes(result.mapping.threatType))return result.mapping.threatType;
    throw new Error(`Invalid Threat Type mapping: ${result.mapping.threatType}`);
  }
  const text=result.text.replace(/[–—]/g,'-').trim();
  const matches=[['humanoid',/^(?:1-2\s*[:.-]?\s*)?humanoids?(?: threats?)?$/i],['monster',/^(?:3-5\s*[:.-]?\s*)?monsters?(?: threats?)?$/i],['phenomenon',/^(?:6\s*[:.-]?\s*)?phenomen(?:on|a)(?: threats?)?$/i]].filter(([,pattern])=>pattern.test(text));
  if(matches.length!==1)throw new Error(`Unrecognized Threat Type result: ${result.text}. Expected Humanoid, Monster, or Phenomena.`);
  return matches[0][0];
}
const generatedEntry=(result,kind,quantity)=>({title:result.text,status:'Active',details:result.text,uuid:result.documentType===({locations:'Scene',encounters:'Actor',effects:'Actor',loot:'Item'}[kind])?result.uuid:'',...(quantity===undefined?{}:{quantity}),...(kind==='effects'?{category:'Phenomenon',duration:''}:{}),generated:{method:'core',sources:result.sources}});
export async function rollBasePool(level,env=globalThis){
  if(level===0)return [];
  const pool=await new env.Roll(`${level}d6`).evaluate();
  return (pool.dice||[]).flatMap(die=>die.results.filter(result=>result.active!==false&&!result.discarded).map(result=>result.result));
}
export async function generateSector(existing,{env=globalThis,options=DEFAULT_GENERATION_OPTIONS,rollBaseDice=level=>rollBasePool(level,env),roll=async formula=>Number((await new env.Roll(formula).evaluate()).total)}={}){
  options={...DEFAULT_GENERATION_OPTIONS,...options};
  if(!['core','individual-d3'].includes(options.threatMode))throw new Error('Unknown threat generation mode.');
  numericLevel(options.dangerousLevel);if(options.dangerousLevel<9)throw new Error('Unusually Dangerous category must use a numeric Threat Level of at least 9.');
  const tables=await resolveTables(env);
  const dice=async formula=>{const value=await roll(formula),sides=Number(formula.slice(2));if(!Number.isInteger(value)||value<1||value>sides)throw new Error(`Invalid ${formula} roll result: ${value}`);return value;};
  const chance=async value=>(await dice('1d10000'))<=value*10000;
  const take=key=>rollTable(tables[key],env);
  const environment=await take('environment'),eligibility=mapEnvironment(environment);
  if(eligibility.manual)throw new Error('Settlement requires GM-authored details, not normal random sector generation (Core Rulebook p. 156). No changes were saved.');
  const rot=await take('rot'),threatLevel=await take('threatLevel'),mood=await take('mood');
  const threat=await selectThreatLevel(threatLevel,dice,options);
  // One pool, one per-face result for each Base Die. Never reroll it for artifacts.
  const baseDice=threat.level===0?[]:await rollBaseDice(threat.level);
  if(!Array.isArray(baseDice)||baseDice.length!==threat.level||baseDice.some(face=>!Number.isInteger(face)||face<1||face>6))throw new Error('Base Dice pool must return one face (1–6) per numeric Threat Level.');
  const ones=baseDice.filter(face=>face===1).length,sixes=baseDice.filter(face=>face===6).length;
  const severity=eligibility.threats?ones:0,artifactCount=eligibility.artifacts?sixes:0;
  const output=structuredClone(existing);
  for(const key of ['locations','encounters','effects','loot'])output[key]=(output[key]||[]).filter(entry=>entry.generated?.method!=='core');
  output.terrain=eligibility.name;output.rot=mapRot(rot);output.mood=mood.text;
  const add=(key,result,quantity)=>{const entry=generatedEntry(result,key,quantity);output[key].push(entry);return entry;};
  if(eligibility.ruins)add('locations',await take(eligibility.ruins==='normal'?'ruinsA':'ruinsB'));
  let threatCount=0;
  if(severity){
    threatCount=options.threatMode==='individual-d3'?await dice('1d3'):1;
    for(let i=0;i<threatCount;i++){
      const typeResult=await take('threatType'),type=mapThreatType(typeResult),result=await take(type);result.sources=[...typeResult.sources,...result.sources];
      const entry=add(type==='phenomenon'?'effects':'encounters',result);entry.generated.threatSeverity=severity;entry.generated.threatMode=options.threatMode;
      entry.details+=`\nThreat roll severity: ${severity} Base ${severity===1?'Die':'Dice'} showing 1.${options.threatMode==='individual-d3'?' Individual threats: 1d3 house rule.':''}`;
    }
  }
  for(let i=0;i<artifactCount;i++)add('loot',await take('artifact'));
  for(const [resource,clean,contaminated] of [['grub','Clean Grub','Rot Grub'],['water','Clean Water','Rot Water'],['bullets','Bullets','Bullets']]){
    if(!await chance(.5))continue;
    const quantity=await dice('1d6');
    const title=resource==='bullets'?clean:await chance(.25)?clean:contaminated;
    const entry=generatedEntry({text:title,sources:[],documentType:null},'loot',quantity);entry.resource=resource;entry.classification=title.startsWith('Rot ')?'rot':resource==='bullets'?null:'clean';entry.details=`${quantity} ${title}`;output.loot.push(entry);
  }
  if(await chance(.5)){
    if(await chance(.5))add('loot',await take('scrap'),await dice('1d6'));
    else add('loot',{text:'COMPONENTS',sources:[],documentType:null},await dice('1d3'));
  }
  output.randomization={method:'core',threatLevel:threat.category,numericThreatLevel:threat.level,levelSelection:threat.selection,environment:eligibility,baseDice,rolledOnes:ones,rolledSixes:sixes,threatSeverity:severity,threatCount,artifactCount,threatMode:options.threatMode,sources:[...environment.sources,...rot.sources,...threatLevel.sources,...mood.sources]};
  return output;
}

export async function saveGeneratedSector(journal,expected,next,env=globalThis){
  if(!env.game.user.isGM)throw new Error('Only a GM can randomize sectors.');
  if(JSON.stringify(journal.getFlag('myz-sector-manager','sector'))!==JSON.stringify(expected))throw new Error('This sector changed while generation was running. Nothing was saved; review it and try again.');
  // One Document flag update commits the complete generation; no preceding field writes.
  const stored=structuredClone(next);delete stored.journalName;
  const name=next.journalName?.trim();
  if(name&&name!==journal.name)await journal.update({name,'flags.myz-sector-manager.sector':stored});
  else await journal.setFlag('myz-sector-manager','sector',stored);
}
