export const CONSUMABLES=Object.freeze({cleanGrub:'Clean Grub',rotGrub:'Rot Grub',cleanWater:'Clean Water',rotWater:'Rot Water',bullets:'Bullets',booze:'Booze',components:'Components'});
// Meaningful content, independent of presentation and schema defaults.
const text=value=>typeof value==='string'&&value.trim().length>0;
const entryContent=entry=>['title','details','uuid','duration'].some(key=>text(entry?.[key]))||Number(entry?.quantity)>0;
export function tabHasContent(data,tab){
  if(tab==='Overview')return ['terrain','description','notes','mood'].some(key=>text(data[key]))||Number(data.rot)>0||Boolean(data.rot&&Number.isNaN(Number(data.rot)))||Boolean(data.status&&data.status!=='Unexplored')||Boolean(data.randomization?.threatLevel);
  if(tab==='Find the Path')return Object.values(data.pathStunts||{}).some(value=>value===true);
  const key={Locations:'locations',Encounters:'encounters',Loot:'loot',Effects:'effects',Secrets:'secrets',History:'history'}[tab];
  return Boolean(data[key]?.some(entryContent))||(tab==='Loot'&&Object.values(data.supplies||{}).some(supply=>Number(supply?.quantity)>0));
}
