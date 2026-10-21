import {SETTLEMENT_COLLECTIONS} from './settlement.mjs';
export const CONSUMABLES=Object.freeze({cleanGrub:'Clean Grub',rotGrub:'Rot Grub',cleanWater:'Clean Water',rotWater:'Rot Water',bullets:'Bullets',booze:'Booze',components:'Components'});
// Meaningful content, independent of presentation and schema defaults.
const text=value=>typeof value==='string'&&value.trim().length>0;
const entryContent=entry=>['title','details','uuid','duration'].some(key=>text(entry?.[key]))||Number(entry?.quantity)>0;
export function tabHasContent(data,tab){
  if(data.sectorType==='settlement'){if(tab==='Shop')return Boolean(data.settlement?.shop?.groups?.some(group=>group.entries.length));if(tab==='Overview')return ['description','image','notes','history','situation','defenses','resources','economy','population','leadership','arkUuid'].some(key=>text(data.settlement?.[key]));const key=SETTLEMENT_COLLECTIONS[tab]?.split('.')[1];return Boolean(data.settlement?.[key]?.length);}
  if(tab==='The Situation')return text(data.special?.situation);
  const specialKey={Inhabitants:'inhabitants','Gear & Artifacts':'gear',Events:'events',Images:'images'}[tab];if(specialKey)return Boolean(data.special?.[specialKey]?.some(entryContent));
  if(tab==='Overview'&&data.sectorType==='special'&&['sceneUuid','source','overview','situation','overlayImage'].some(key=>text(data.special?.[key])))return true;
  if(tab==='Overview')return ['terrain','description','notes','mood'].some(key=>text(data[key]))||Number(data.rot)>0||Boolean(data.rot&&Number.isNaN(Number(data.rot)))||Boolean(data.status&&data.status!=='Unexplored')||Boolean(data.randomization?.threatLevel);
  if(tab==='Find the Path')return Object.values(data.pathStunts||{}).some(value=>value===true);
  if(tab==='Locations'&&data.sectorType==='special')return Boolean(data.special?.locations?.some(entryContent));
  const key={Locations:'locations',Encounters:'encounters',Loot:'loot',Effects:'effects',Secrets:'secrets',History:'history'}[tab];
  return Boolean(data[key]?.some(entryContent))||(tab==='Loot'&&Object.values(data.supplies||{}).some(supply=>Number(supply?.quantity)>0));
}
