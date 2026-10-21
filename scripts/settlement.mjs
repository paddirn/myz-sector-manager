import {normalizeFaction} from './settlement-factions.mjs';
import {normalizeShop} from './settlement-shop.mjs';
// Versioned, JSON-safe authored content. Common name/coordinates/terrain stay on the sector.
export const SETTLEMENT_TABS=Object.freeze(['Overview','Projects','Inhabitants','Factions','Events','Threads','Shop']);
export const SETTLEMENT_COLLECTIONS=Object.freeze({Projects:'settlement.projects',Inhabitants:'settlement.inhabitants',Factions:'settlement.factions',Events:'settlement.events',Threads:'settlement.threads',Shop:'settlement.shop.groups'});
export const SETTLEMENT_ACCENT='#47aeb3';
export const settlementAccent=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value:SETTLEMENT_ACCENT;
export const DISPOSITIONS=['Unknown','Friendly','Neutral','Unfriendly','Hostile'];
export const SETTLEMENT_TYPES=['Ark','Village','Town','Trading Post','Outpost','Fortress','Industrial Facility','Mobile Settlement','Other'];
export const PROJECT_STATUSES=['Planned','In Progress','Completed','Abandoned'];
// shops is the read-only legacy recovery archive; active inventory lives in shop.groups.
const listKeys=['projects','inhabitants','factions','events','threads','shops'];
const identity=()=>globalThis.foundry?.utils?.randomID?.()||globalThis.crypto.randomUUID();
export function settlementDefaults(){return {version:1,type:'Other',disposition:'Unknown',population:'',leadership:'',description:'',image:'',notes:'',history:'',situation:'',defenses:'',resources:'',economy:'',arkUuid:'',...Object.fromEntries(listKeys.map(key=>[key,[]]))};}
export function normalizeSettlement(raw={}){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid Settlement data. Record was not changed.');
  if(raw.version!==undefined&&raw.version!==1)throw new Error('Unsupported Settlement data version. Record was not changed.');
  const result={...settlementDefaults(),...raw};
  const ids=new Set();
  const normalizeEntry=entry=>{
    if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new Error('Invalid Settlement entry. Record was not changed.');
    let id=entry.id;if(typeof id!=='string'||!id||ids.has(id))id=identity();ids.add(id);return {...entry,id};
  };
  for(const key of listKeys){
    if(!Array.isArray(result[key]))throw new Error(`Invalid Settlement ${key} list. Record was not changed.`);
    result[key]=result[key].map(entry=>{
      const next=normalizeEntry(entry);
      if(key==='shops'){
        if(next.inventory!==undefined&&!Array.isArray(next.inventory))throw new Error('Invalid Settlement inventory. Record was not changed.');
        next.inventory=(next.inventory||[]).map(normalizeEntry);
      }
      return key==='factions'?normalizeFaction(next):next;
    });
  }
  result.shop=normalizeShop(raw.shop,result.shops);
  return result;
}
export function newSettlementEntry(key){
  const entry={id:identity(),title:'',details:'',notes:''};
  if(key==='projects')Object.assign(entry,{uuid:'',status:'Planned',progress:'',completedAt:'',referenceName:''});
  if(key==='inhabitants')Object.assign(entry,{role:'',disposition:'Unknown',factionId:'',portrait:'',uuid:''});
  if(key==='factions')Object.assign(entry,{info:'',infoVersion:1,members:[],membersVersion:1});
  if(key==='events')Object.assign(entry,{status:'Planned',trigger:'',outcomes:'',related:''});
  if(key==='threads')Object.assign(entry,{status:'Open',npcs:'',factions:'',clues:'',developments:'',resolution:''});
  return entry;
}
export function requireProject(doc,systemId='mutant-year-zero'){
  if(systemId!=='mutant-year-zero'||doc?.documentName!=='Item'||doc.type!=='project')throw new Error('Choose a Mutant Year Zero Ark Project Item (Item type “project”), from Items or a Compendium.');
  return doc;
}
// Read through the official MYZ v14 MYZProjectDataModel; never copy system data to an assignment.
export function projectInformation(doc){
  const system=requireProject(doc).system||{};
  return [['Description',system.description],['Development requirements',system.DEV_Requirement],['Other requirements / resources',system.other_requirements],['Skills',system.skills],['Work points',system.work_points],['Development benefits',system.DEV_Bonus],['Special',system.special],['Comment',system.comment],...['food','culture','technology','warfare'].map(key=>[key[0].toUpperCase()+key.slice(1),system[key]])].filter(([,value])=>value!==undefined&&value!==null&&value!=='');
}
export function assignProject(entry,doc,systemId){
  requireProject(doc,systemId);return {...entry,uuid:doc.uuid,referenceName:doc.name,referencePack:doc.pack||'',referenceType:'project'};
}
