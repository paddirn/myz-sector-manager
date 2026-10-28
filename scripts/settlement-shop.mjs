import {normalizeTrading} from './settlement-trading.mjs';
// The single Shop stores references only. Legacy merchant data stays in settlement.shops as a recovery archive.
const id=()=>globalThis.foundry?.utils?.randomID?.()||globalThis.crypto.randomUUID();
export const SHOP_GROUP_TYPES=Object.freeze({general:'General',weapons:'Weapons',armor:'Armor',vehicles:'Vehicles',services:'Services'});
const column=(key,label,width)=>Object.freeze({key,label,width});
export const SHOP_COLUMN_SETS=Object.freeze({
 general:[column('link','Item',24),column('cost','Cost',13),column('requirement','Req.',18),column('weight','Weight',12),column('comment','Comment',33)],
 weapons:[column('link','Item',24),column('cost','Cost',10),column('damage','Damage',11),column('range','Range',10),column('bonus','Bonus',10),column('weight','Weight',11),column('comment','Comment',24)],
 armor:[column('link','Item',25),column('cost','Cost',10),column('rating','Rating',10),column('rot','Rot Prot.',12),column('weight','Weight',10),column('comment','Comment',33)],
 vehicles:[column('link','Vehicle',25),column('cost','Cost',12),column('bonus','Gear Bonus',16),column('armor','Armor',14),column('resilience','Resilience',17),column('occupants','Occupants',16)],
 services:[column('link','Item',30),column('cost','Cost',15),column('requirement','Req.',20),column('comment','Comment',35)]
});
export const groupType=group=>Object.hasOwn(SHOP_GROUP_TYPES,String(group?.type||'').toLowerCase())?String(group.type).toLowerCase():'general';
export const shopColumns=group=>SHOP_COLUMN_SETS[groupType(group)];
export const SHOP_COLUMNS=Object.freeze(SHOP_COLUMN_SETS.general.map(c=>c.label));
export const newShopGroup=(name='General Gear',type='general')=>({id:id(),name,type,entries:[]});
export function normalizeShop(raw,legacy=[]){
  if(raw!==undefined&&(!raw||raw.version!==1||!Array.isArray(raw.groups)))throw new Error('Invalid Settlement Shop data. Record was not changed.');
  if(!Array.isArray(legacy))throw new Error('Invalid legacy Settlement Shops. Record was not changed.');
  let next=raw;
  if(next===undefined){
    const seen=new Set();let unlinked=0,duplicates=0;
    const groups=legacy.map((shop,index)=>{
      if(!shop||!Array.isArray(shop.inventory||[]))throw new Error('Invalid legacy Settlement inventory. Record was not changed.');
      const group=newShopGroup(String(shop.title||`Recovered inventory ${index+1}`));
      for(const item of shop.inventory||[]){
        if(!item?.uuid){unlinked++;continue;}if(seen.has(item.uuid)){duplicates++;continue;}seen.add(item.uuid);
        group.entries.push({id:id(),uuid:item.uuid,legacyEntryId:item.id||''});
      }
      return group;
    });
    next={version:1,groups:groups.length?groups:[newShopGroup()],...(legacy.length?{migration:{version:1,source:'settlement.shops',unlinked,duplicates}}:{})};
  }
  const ids=new Set(),uuids=new Set();
  const stable=entry=>{if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new Error('Invalid Settlement Shop entry. Record was not changed.');let key=entry.id;if(typeof key!=='string'||!/^[A-Za-z0-9_-]+$/.test(key)||ids.has(key))key=id();ids.add(key);return {...entry,id:key};};
  const groups=next.groups.map(rawGroup=>{
    const group={...stable(rawGroup),type:rawGroup.type??'general'};if(!Array.isArray(group.entries))throw new Error('Invalid Settlement Shop group. Record was not changed.');
    group.entries=group.entries.map(rawEntry=>{
      const entry=stable(rawEntry);if(typeof entry.uuid!=='string'||!entry.uuid)throw new Error('Invalid Settlement Shop UUID. Record was not changed.');
      if(uuids.has(entry.uuid))throw new Error('Duplicate Settlement Shop UUID. Record was not changed.');uuids.add(entry.uuid);return entry;
    });return group;
  });
  if(next.playerAccess!==undefined&&typeof next.playerAccess!=='boolean')throw new Error('Player Shop access must be boolean.');
  return {...next,groups,playerAccess:next.playerAccess??false,trading:normalizeTrading(next.trading)};
}
export function requireShopItem(doc){
  if(doc?.documentName!=='Item')throw new Error('Shop inventory requires a Foundry Item document from Items or a Compendium.');
  return doc;
}
// Resolve through the configured v14 Item class (world, embedded and Compendium sources).
export async function resolveShopDrop(payload,env=globalThis){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||(!payload.uuid&&!['Item','Actor'].includes(payload.type)))throw new Error('Invalid or unsupported drag data. Drop a Foundry Item document.');
  if(payload.type==='Actor'||payload.type!=='Item'&&/(?:^|[.])Actor[.][^.]+$/.test(payload.uuid||'')){
    const ActorClass=env.CONFIG?.Actor?.documentClass||env.Actor?.implementation||env.Actor;
    const doc=typeof ActorClass?.fromDropData==='function'?await ActorClass.fromDropData(payload):await env.fromUuid?.(payload.uuid);return requireVehicle(doc,env);
  }
  if(payload.type&&payload.type!=='Item')throw new Error('Shop inventory requires a Foundry Item document.');
  const ItemClass=env.CONFIG?.Item?.documentClass||env.Item?.implementation||env.Item;
  let doc;
  try{
    if(typeof ItemClass?.fromDropData==='function')doc=await ItemClass.fromDropData(payload);
    else if(payload.uuid)doc=await env.fromUuid(payload.uuid);
    else throw new Error('The Foundry Item drop resolver is unavailable.');
  }catch(error){throw new Error(`Unable to resolve dropped Item${payload.uuid?` (${payload.uuid})`:''}. Check the source document and Compendium access: ${error.message}`);}
  if(!doc)throw new Error(`Dropped Item${payload.uuid?` (${payload.uuid})`:''} is missing or inaccessible. Check the source document and Compendium access.`);
  requireShopItem(doc);
  if(!doc.uuid)throw new Error('The dropped Item has no stable UUID; save it before adding it to the Shop.');
  return doc;
}
const scalar=value=>typeof value==='string'||typeof value==='number'&&Number.isFinite(value)?value:'';
const pair=value=>value&&typeof value==='object'?(scalar(value.value)!==''?`${scalar(value.value)}${scalar(value.max)!==''?' / '+scalar(value.max):''}`:''):scalar(value);
const RANGE_KEYS={range_arm:'MYZ.RANGE_ARM',range_near:'MYZ.RANGE_NEAR',range_short:'MYZ.RANGE_SHORT',range_long:'MYZ.RANGE_LONG',range_distant:'MYZ.RANGE_DISTANT'};
// Official v14 MYZ schema/templates supply these paths. Missing extension fields remain empty.
export function shopItemFields(doc,env=globalThis){
  const {system={},type}=requireShopItem(doc),range=scalar(system.range),key=env.CONFIG?.MYZ?.RANGES?.[range]||RANGE_KEYS[range],localized=key?env.game?.i18n?.localize?.(key):null;
  return {cost:scalar(system.cost),requirement:scalar(type==='project'?system.DEV_Requirement:['artifact','weapon','armor'].includes(type)?system.dev_requirement:system.requirement),weight:scalar(system.weight),comment:scalar(system.comment),damage:scalar(system.damage),range:localized&&localized!==key?localized:range,bonus:pair(system.bonus),rating:pair(system.rating),rot:pair(system.rot),passengers:scalar(system.passengers??system.crew?.passengers)};
}
export const TRAVEL_TYPES=Object.freeze(['Land','Water']);
export const vehiclePassengers=(entry,doc)=>entry?.passengers!==undefined?String(entry.passengers):String(shopItemFields(doc).passengers??'');
export const vehicleTravelType=(entry,doc)=>TRAVEL_TYPES.includes(entry?.travelType)?entry.travelType:TRAVEL_TYPES.includes(doc?.system?.travelType)?doc.system.travelType:'Land';
export function initializeVehicleTravel(entry,doc){if(entry.travelType===undefined)entry.travelType=vehicleTravelType(entry,doc);return entry;}
export async function resolveShopItem(uuid,env=globalThis){
  if(typeof uuid!=='string'||!/^[A-Za-z0-9_.-]+$/.test(uuid))throw new Error('Invalid Item UUID');
  const doc=await env.fromUuid(uuid);if(doc?.documentName==='Actor'){requireVehicle(doc,env);return {doc,fields:vehicleFields(doc)};}requireShopItem(doc);return {doc,fields:shopItemFields(doc,env)};
}
export function putShopItem(shop,doc,groupId,{replaceId=null}={}){
  if(doc?.documentName==='Actor')requireVehicle(doc);else requireShopItem(doc);if(!doc.uuid)throw new Error('The Item needs a stable UUID.');
  let group=shop.groups.find(g=>g.id===groupId)||shop.groups[0];if(!group){if(doc.documentName==='Actor')throw new Error('Add a Vehicle Shop group before dropping a Vehicle Actor.');group=newShopGroup();shop.groups.push(group);}
  if(groupType(group)==='vehicles')requireVehicle(doc);else if(doc.documentName==='Actor')throw new Error('Vehicle Actors require a Vehicle Shop group.');
  const previous=shop.groups.flatMap(g=>g.entries.map(entry=>({group:g,entry}))).find(row=>row.entry.uuid===doc.uuid);
  const replacement=replaceId?group.entries.find(entry=>entry.id===replaceId):null;
  if(replaceId&&!replacement)throw new Error('Selected Shop reference changed. Nothing was replaced.');
  if(previous){
    // One UUID per Settlement: a cross-group drop moves the existing record, retaining its ID.
    if(previous.group===group){return {entry:previous.entry,group,duplicate:true};}
    previous.group.entries.splice(previous.group.entries.indexOf(previous.entry),1);
    if(replacement)group.entries.splice(group.entries.indexOf(replacement),1);
    group.entries.push(previous.entry);return {entry:previous.entry,group,moved:true};
  }
  if(replacement){replacement.uuid=doc.uuid;return {entry:replacement,group,replaced:true};}
  const entry={id:id(),uuid:doc.uuid};group.entries.push(entry);return {entry,group};
}
export function moveShopEntry(shop,entryId,targetId,doc){
  const target=shop.groups.find(g=>g.id===targetId),source=shop.groups.find(g=>g.entries.some(entry=>entry.id===entryId));
  if(!source||!target)throw new Error('Select an existing Shop entry and destination group.');
  const entry=source.entries.find(e=>e.id===entryId);if(doc?.documentName==='Actor'&&groupType(target)!=='vehicles')throw new Error('Vehicle Actors require a Vehicle Shop group.');if(source!==target){source.entries.splice(source.entries.indexOf(entry),1);target.entries.push(entry);}return entry;
}
export function reorderById(list,key,offset){const index=list.findIndex(entry=>entry.id===key),destination=index+offset;if(index<0||destination<0||destination>=list.length)return false;const [entry]=list.splice(index,1);list.splice(destination,0,entry);return true;}

// Official MYZ 14.0.4 MYZVehicleDataModel and vehicle-header/vehicle-occupants templates.
export function requireVehicle(doc,env=globalThis){
 if((env.game?.system?.id&&env.game.system.id!=='mutant-year-zero')||doc?.documentName!=='Actor'||doc.type!=='vehicle')throw new Error('Vehicle groups require an official MYZ Vehicle Actor (type vehicle). Legacy Item references are retained for repair.');
 if(doc.testUserPermission&&env.game?.user&&!doc.testUserPermission(env.game.user,'OBSERVER'))throw new Error('Vehicle Actor is inaccessible.');return doc;
}
const currentMax=value=>value&&typeof value==='object'?`${scalar(value.current)} / ${scalar(value.max)}`:'';
export function vehicleFields(doc){
 const s=requireVehicle(doc).system||{};
 return {cost:scalar(s.cost),bonus:currentMax(s.movementBonus),armor:currentMax(s.vehicleArmor),resilience:currentMax(s.resilience),occupants:scalar(s.occupantsCount),weight:'',comment:''};
}
export function shopDisplayFields(group,entry,doc,fields){
 return groupType(group)==='vehicles'?(doc.documentName==='Actor'?vehicleFields(doc):{cost:fields.cost,bonus:'—',armor:'—',resilience:'—',occupants:'—'}):fields;
}
