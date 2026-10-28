import {partyRoster,escapeHTML as esc} from './travel/model.mjs';
import {resolveShopItem,shopColumns,shopDisplayFields,vehiclePassengers,vehicleTravelType} from './settlement-shop.mjs';
import {imagePath} from './sector-images.mjs';

export function bulletCost(value){
 const text=String(value??'').trim(),match=/^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(text);
 if(!match)return null;const min=Number(match[1]),max=Number(match[2]??match[1]);
 return Number.isSafeInteger(min)&&Number.isSafeInteger(max)&&max>=min&&Number.isSafeInteger(max-min+1)?{min,max}:null;
}
export async function rollBulletCost(cost,env=globalThis){
 if(!cost||!Number.isSafeInteger(cost.min)||!Number.isSafeInteger(cost.max)||cost.min<0||cost.max<cost.min)throw new Error('An integer Bullet cost or range is required.');
 if(cost.min===cost.max)return cost.min;
 const total=Number((await new env.Roll(`1d${cost.max-cost.min+1} + ${cost.min-1}`).evaluate()).total);
 if(!Number.isSafeInteger(total)||total<cost.min||total>cost.max)throw new Error('The price roll returned an invalid result.');return total;
}
export async function purchaseMembers(env=globalThis){
 const unique=[...new Set(partyRoster(env).members.map(member=>member.actorUuid))],members=[];
 // Roster enabled/eligibility flags govern automatic Stalker checks, not shopping.
 for(const uuid of unique){try{const actor=await env.fromUuid(uuid);if(actor?.documentName==='Actor'&&(!actor.testUserPermission||actor.testUserPermission(env.game.user,'OBSERVER')))members.push(actor);}catch{/* Missing references remain in the roster for repair. */}}
 return members.sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base'}));
}
export function purchaseContent(doc,fields,group,entry,members){
 fields=shopDisplayFields(group,entry,doc,fields);const image=imagePath(doc.img),cost=bulletCost(doc.system?.cost);
 return `<style>.myz-shop-purchase{max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px)}.myz-shop-purchase .window-content{overflow:auto;min-width:0}.sm-purchase{overflow-wrap:anywhere}.sm-purchase img{width:100px;height:100px;object-fit:contain}.sm-purchase dd{white-space:pre-wrap}.sm-purchase select{width:100%;min-width:0}</style><section class="sm-purchase"><h3>${esc(doc.name)}</h3>${image?`<img src="${esc(image)}" alt="${esc(doc.name)}">`:''}<dl>${shopColumns(group).filter(c=>c.key!=='link').map(c=>{const value=c.key==='travel'?vehicleTravelType(entry,doc):c.key==='passengers'?vehiclePassengers(entry,doc):fields[c.key];return value!==''&&value!==undefined?`<dt>${esc(c.label)}</dt><dd>${esc(value)}</dd>`:'';}).join('')}</dl><label>Purchasing Party member<select name="purchaser" ${members.length?'':'disabled'}><option value="">Choose a Party member</option>${members.map(actor=>`<option value="${esc(actor.uuid)}">${esc(actor.name)}</option>`).join('')}</select></label>${!members.length?'<p>No accessible Party members. Configure or repair the existing Party Roster in module settings.</p>':''}${!cost?`<p>Original Cost: ${esc(doc.system?.cost??'(missing)')}. An integer Bullet cost or range is required; Buy is unavailable.</p>`:''}<p>Informational announcement only. No resources or inventory are changed.</p></section>`;
}
export async function buyShopItem(host,group,entry,env=globalThis){
 if(!env.game.user.isGM||host.buyingShop)return;host.buyingShop=true;
 try{
  const draft=host.draft,sectorId=host.sectorId,uuid=entry.uuid,{doc,fields}=await resolveShopItem(uuid,env),members=await purchaseMembers(env),cost=bulletCost(doc.system?.cost),costText=String(doc.system?.cost??'');
  const valid=()=>env.game.user.isGM&&host.rendered&&host.draft===draft&&host.sectorId===sectorId&&draft.settlement.shop.groups.includes(group)&&group.entries.includes(entry)&&entry.uuid===uuid;
  if(!valid())throw new Error('Shop selection changed. Open Buy again.');
  const actorUuid=await env.foundry.applications.api.DialogV2.wait({classes:['myz-shop-purchase'],position:{width:440},window:{title:'Buy Shop Item'},content:purchaseContent(doc,fields,group,entry,members),buttons:[{action:'cancel',label:'Cancel',default:true,callback:()=>null},{action:'buy',label:'Buy',disabled:!cost||!members.length,callback:(event,button,dialog)=>{const uuid=dialog.element.querySelector('[name="purchaser"]').value;if(!members.some(actor=>actor.uuid===uuid))throw new Error('Choose a valid Party member before buying.');return uuid;}}],render:(event,dialog)=>{const select=dialog.element.querySelector('[name="purchaser"]'),button=dialog.element.querySelector('[data-action="buy"]');const update=()=>{if(button)button.disabled=!cost||!members.some(actor=>actor.uuid===select?.value);};select?.addEventListener('change',update);update();},close:()=>null,rejectClose:false});
  if(!actorUuid)return;
  if(!valid())throw new Error('Shop selection changed. No purchase announced.');
  const actor=(await purchaseMembers(env)).find(actor=>actor.uuid===actorUuid),fresh=(await resolveShopItem(uuid,env)).doc;
  if(!actor)throw new Error('The Party member is missing, inaccessible or no longer in the roster.');
  if(!valid()||String(fresh.system?.cost??'')!==costText)throw new Error('Shop or Item cost changed. Open Buy again.');
  const price=await rollBulletCost(cost,env);if(!valid())throw new Error('Shop changed during the price roll. No purchase announced.');
  await env.ChatMessage.create({content:`<p><strong>${esc(actor.name)} purchased ${esc(fresh.name)} for ${price} ${price===1?'Bullet':'Bullets'}.</strong></p><p>An equal amount of clean Grub, clean Water, Booze (doses), or Scrap may be bartered instead.</p>`,whisper:[],blind:false});
 }finally{host.buyingShop=false;}
}
