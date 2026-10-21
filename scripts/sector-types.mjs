import {SETTLEMENT_TABS,normalizeSettlement} from './settlement.mjs';
import {normalizeLoot} from './loot.mjs';
import {sectorName} from './journal-organization.mjs';
import {canonicalCoordinate} from './zone/grid.mjs';
export const NORMAL_TABS=['Overview','Locations','Encounters','Loot','Effects','Find the Path','History'];
export const SPECIAL_TABS=['Overview','Locations','Inhabitants','Gear & Artifacts','Events','Images','Find the Path','History'];
export const isSpecial=data=>data?.sectorType==='special';
export const isSettlement=data=>data?.sectorType==='settlement';
export const sectorOnScene=(data,sceneId)=>!isSettlement(data)||!data.sceneId||data.sceneId===sceneId;
export const isAuthored=data=>isSpecial(data)||isSettlement(data);
export const sectorTabs=data=>isSettlement(data)?SETTLEMENT_TABS:isSpecial(data)?SPECIAL_TABS:NORMAL_TABS;
export const sectorCollection=(data,key)=>key.split('.').reduce((value,part)=>value?.[part],data)||[];
export const specialQuantity=value=>Number.isSafeInteger(Number(value))&&Number(value)>=1?Number(value):1;
export function normalizeSpecialGear(entry={}){
  const normalized=normalizeLoot(entry);
  // Special gear has no collection state; retain any unknown/legacy properties.
  return {...entry,quantity:specialQuantity(entry.quantity),type:normalized.type,typeSource:normalized.typeSource};
}
export function normalizeSectorType(data){
  const special=data.special||{};
  return {...data,sectorType:isSettlement(data)?'settlement':isSpecial(data)?'special':'normal',...((isSettlement(data)||data.settlement)?{settlement:normalizeSettlement(data.settlement)}:{}),special:{overlayImage:'',images:[],locations:[],sceneUuid:'',source:'',overview:'',situation:'',inhabitants:[],gear:[],events:[],...special,gear:(special.gear||[]).map(normalizeSpecialGear)}};
}
export function sectorTitle(data,title=''){
  const name=sectorName(data,title).trim();
  const code=canonicalCoordinate(data?.code)||String(data?.code||'').trim();
  return code&&name&&!name.toLowerCase().startsWith(`${code} - `.toLowerCase())?`${code} - ${name}`:name;
}

// Labels are independent of tab IDs and the Normal storage keys.
export const tabLabel=tab=>({Encounters:'Inhabitants',Loot:'Gear & Artifacts'}[tab]||tab);
