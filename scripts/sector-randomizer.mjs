// Table-driven generation: no Journal writes, chat messages, or drawn-result mutation.
export const RANDOMIZATION_METHODS = [{id:'core',label:'Core Rulebook Tables',generate:generateSector}];
export const TABLE_UUIDS = Object.freeze({
  environment:'RollTable.UEm95WiZocwvFGSU',ruinsA:'RollTable.QxY3EmhqXMdKa3sC',ruinsB:'RollTable.n1CEYKphbiBZLDUb',
  rot:'RollTable.rp2JNLkCDatudc88',threatLevel:'RollTable.3FWOT8OJaXc7bfrC',threatType:'RollTable.Kk8jRbrOk3NejHUB',
  humanoid:'RollTable.5ZVTmWwi5wyi52rd',monster:'RollTable.tsNy12fCcREgIDLk',phenomenon:'RollTable.jIRwumcfuFBGU8Zp',
  artifact:'RollTable.aarjzrm2IwJYczhi',mood:'RollTable.8aGJhfpHDBv52W1K',scrap:'RollTable.sWLvZ6qZikXt2k6l'
});
// House-rule defaults, NOT official percentages. May be overridden through the world setting.
export const DEFAULT_PROBABILITIES = Object.freeze({threats:{fringe:1/3,central:1/2,dangerous:2/3},artifacts:null});
export function plainText(value,env=globalThis){
  const html=String(value??'');
  if(env.document){const template=env.document.createElement('template');template.innerHTML=html;template.content.querySelectorAll('script,style').forEach(node=>node.remove());return template.content.textContent.trim();}
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
}
function probability(value,label){if(!Number.isFinite(value)||value<0||value>1)throw new Error(`${label} must be a probability from 0 to 1.`);return value;}
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
export function mapThreatLevel(result){
  if(['fringe','central','dangerous'].includes(result.mapping.threatLevel))return result.mapping.threatLevel;
  const text=result.text.toLowerCase();const matches=[['fringe',/fringe/],['central',/central/],['dangerous',/unusually dangerous/]].filter(([,pattern])=>pattern.test(text));
  if(matches.length!==1)throw new Error(`Unrecognized Threat Level result: ${result.text}. Expected Fringe Zone, Central Zone, or Unusually Dangerous.`);
  return matches[0][0];
}
export function mapThreatType(result){
  if(['humanoid','monster','phenomenon'].includes(result.mapping.threatType))return result.mapping.threatType;
  const matches=[['humanoid',/humanoid/i],['monster',/monster/i],['phenomenon',/phenomen/i]].filter(([,pattern])=>pattern.test(result.text));
  if(matches.length!==1)throw new Error(`Unrecognized Threat Type result: ${result.text}. Expected Humanoid, Monster, or Phenomena.`);
  return matches[0][0];
}
export function hasRuins(result){
  if(typeof result.mapping.hasRuins==='boolean')return result.mapping.hasRuins;
  return !/no ruins|without ruins/i.test(result.text)&&/ruins|industries/i.test(result.text);
}
const generatedEntry=(result,kind,quantity)=>({title:result.text,status:'Active',details:result.text,uuid:result.documentType===({locations:'Scene',encounters:'Actor',effects:'Actor',loot:'Item'}[kind])?result.uuid:'',...(quantity===undefined?{}:{quantity}),...(kind==='effects'?{category:'Phenomenon',duration:''}:{}),generated:{method:'core',sources:result.sources}});
export async function generateSector(existing,{env=globalThis,probabilities=DEFAULT_PROBABILITIES,roll=async formula=>Number((await new env.Roll(formula).evaluate()).total)}={}){
  if(typeof probabilities==='string'){try{probabilities=JSON.parse(probabilities);}catch{throw new Error('Sector generation probabilities must be valid JSON.');}}
  if(!probabilities||typeof probabilities!=='object')throw new Error('Sector generation probabilities must contain threats and artifacts maps.');
  const tables=await resolveTables(env);
  const dice=async formula=>{const value=await roll(formula),sides=Number(formula.slice(2));if(!Number.isInteger(value)||value<1||value>sides)throw new Error(`Invalid ${formula} roll result: ${value}`);return value;};
  const chance=async value=>(await dice('1d10000'))<=probability(value,'Generation chance')*10000;
  for(const category of ['fringe','central','dangerous']){probability(probabilities.threats?.[category],`${category} threat chance`);probability(probabilities.artifacts?.[category],`${category} artifact chance (Core Rulebook p. 158 rule required)`);}
  const take=key=>rollTable(tables[key],env);
  const environment=await take('environment'),rot=await take('rot'),threatLevel=await take('threatLevel'),mood=await take('mood');
  const category=mapThreatLevel(threatLevel);
  const output=structuredClone(existing);
  for(const key of ['locations','encounters','effects','loot'])output[key]=(output[key]||[]).filter(entry=>entry.generated?.method!=='core');
  output.terrain=environment.text;output.rot=mapRot(rot);output.mood=mood.text;
  const add=(key,result,quantity)=>output[key].push(generatedEntry(result,key,quantity));
  if(hasRuins(environment))add('locations',await take((await dice('1d2'))===1?'ruinsA':'ruinsB'));
  const threatChance=threatLevel.mapping.threatChance??probabilities.threats[category];
  if(await chance(threatChance)){
    const count=await dice('1d3');if(!Number.isInteger(count)||count<1||count>3)throw new Error('Threat count roll must be 1–3.');
    for(let i=0;i<count;i++){const typeResult=await take('threatType'),type=mapThreatType(typeResult),result=await take(type);result.sources=[...typeResult.sources,...result.sources];add(type==='phenomenon'?'effects':'encounters',result);}
  }
  if(await chance(threatLevel.mapping.artifactChance??probabilities.artifacts[category]))add('loot',await take('artifact'));
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
  output.randomization={method:'core',threatLevel:category,probabilities:structuredClone(probabilities),sources:[...environment.sources,...rot.sources,...threatLevel.sources,...mood.sources]};
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
