export const LOOT_TYPES=Object.freeze(['scrap','armor','artifact','chassis','gear','weapon']);
export const lootCollected=entry=>typeof entry?.collected==='boolean'?entry.collected:['Collected','Depleted'].includes(entry?.status);
export function lootQuantity(value){const n=Number(value);return value===null||(typeof value==='string'&&!value.trim())||!Number.isFinite(n)||n<0?1:n;}
export function itemLootType(document){const type=String(document?.type??'').trim().toLowerCase();return document?.documentName==='Item'&&LOOT_TYPES.includes(type)&&type!=='scrap'?type:null;}
export function normalizeLoot(entry={}){
  const type=String(entry.type??'').trim().toLowerCase();
  return {...entry,...(entry.type!==undefined&&!LOOT_TYPES.includes(type)?{legacyType:entry.legacyType??entry.type}:{}),quantity:entry.quantity===undefined?1:lootQuantity(entry.quantity),type:LOOT_TYPES.includes(type)?type:'scrap',typeSource:entry.typeSource||(entry.type===undefined?'legacy':'manual'),collected:lootCollected(entry)};
}
export function lootTitle(entry={},fallback='Untitled Entry'){
  const item=normalizeLoot(entry);return `${entry.title||fallback}${item.quantity>1?` x ${item.quantity}`:''} (${item.type})`;
}
