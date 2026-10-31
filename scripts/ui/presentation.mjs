import {escapeEntryText as esc} from './entry.mjs';
const collections={locations:['locations','Add Location'],encounters:['inhabitants','Add Inhabitant'],loot:['gear or artifacts','Add Item'],effects:['effects','Add Effect'],history:['history entries','Add Entry or Add Event'],'special.locations':['locations','Add Location'],'special.inhabitants':['inhabitants','Add Inhabitant'],'special.gear':['gear or artifacts','Add Item'],'special.events':['events','Add Event'],'special.images':['images','Add Image'],'settlement.projects':['projects','Add Project'],'settlement.inhabitants':['inhabitants','Add Inhabitant'],'settlement.factions':['factions','Add Faction'],'settlement.events':['events','Add Event'],'settlement.threads':['threads','Add Thread'],'settlement.shop':['shop inventory','Add Group']};
export function emptyState(message,guidance='',classes=''){return `<div class="sm-empty${classes?` ${esc(classes)}`:''}" data-empty-state><p>${esc(message)}</p>${guidance?`<small>${esc(guidance)}</small>`:''}</div>`;}
export function collectionEmpty(key,{canAdd=true,linkedArk=false,classes=''}={}){
 const [noun,action]=collections[key]||['entries','Add Entry'],available=key==='settlement.projects'||key==='settlement.shop';
 const message=`No ${noun} ${available?'available':'added'}.`;
 const guidance=linkedArk&&key==='settlement.projects'?'Linked Ark projects appear here when available.':canAdd?key==='settlement.shop'?'Add a group or drop an Item into a compatible group.':`Use ${action} to get started.`:'';
 return emptyState(message,guidance,classes);
}
