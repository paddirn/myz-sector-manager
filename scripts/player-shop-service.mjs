import {normalizeShop,resolveShopItem,shopColumns,shopDisplayFields,vehiclePassengers,groupType,vehicleTravelType} from './settlement-shop.mjs';
import {normalizeTrading,characterResources,tradeRequestQuote,resourceLabel,RESOURCES} from './settlement-trading.mjs';
import {escapeHTML as esc} from './travel/model.mjs';
export const SHOP_MODULE='myz-sector-manager';
const publishedTrading=raw=>{const trading=normalizeTrading(raw);return {enabled:trading.enabled,values:Object.fromEntries(Object.keys(RESOURCES).map(key=>[key,trading.values[key]]))};};
export const activeShopGM=env=>env.game.users.activeGM||Array.from(env.game.users).filter(u=>u.active&&u.isGM).sort((a,b)=>a.id.localeCompare(b.id))[0];
export function shopSettlement(id,env=globalThis){
 if(typeof id!=='string'||!/^JournalEntry\.[A-Za-z0-9_-]+$/.test(id))throw new Error('Use a Settlement JournalEntry UUID.');
 const journal=env.game.journal.get(id.slice('JournalEntry.'.length)),sector=journal?.getFlag(SHOP_MODULE,'sector');
 if(!journal||sector?.sectorType!=='settlement'||sector.initialSavePending||sector.settlement?.shop?.playerAccess!==true)throw new Error('Settlement Shop is missing, inaccessible, unpublished, or not a Settlement. Ask the GM to enable Player Shop access and save.');
 return {journal,sector,shop:normalizeShop(sector.settlement.shop)};
}
async function publicText(value,env){
 // Never forward secret blocks, native document links or executable rich text.
 if(!env.DOMParser)return '';
 const doc=new env.DOMParser().parseFromString(String(value??''),'text/html');for(const node of doc.querySelectorAll('section.secret,.secret,script,style'))node.remove();return doc.body.textContent.slice(0,20000);
}
export async function shopSnapshot(id,env=globalThis){
 if(!env.game.user.isGM)throw new Error('Only the authoritative GM can publish Shop data.');
 const {sector,shop}=shopSettlement(id,env),saved=JSON.stringify(shop),groups=[];
 for(const group of shop.groups){const entries=[];for(const entry of group.entries){try{const {doc,fields:sourceFields}=await resolveShopItem(entry.uuid,env);const fields=shopDisplayFields(group,entry,doc,sourceFields);entries.push({id:entry.id,name:doc.name,description:await publicText(doc.system?.description,env),cost:fields.cost,weight:String(fields.weight??''),comment:await publicText(fields.comment,env),uuid:doc.uuid||entry.uuid,documentType:doc.documentName,legacyVehicle:groupType(group)==='vehicles'&&doc.documentName==='Item',fields:Object.fromEntries(await Promise.all(shopColumns(group).filter(c=>c.key!=='link').map(async c=>[c.label,['comment','requirement'].includes(c.key)?await publicText(fields[c.key],env):String(c.key==='travel'?vehicleTravelType(entry,doc):c.key==='passengers'?vehiclePassengers(entry,doc):fields[c.key]??'')]))),stock:null});}catch{entries.push({id:entry.id,name:'Unavailable Item',unavailable:true});}}groups.push({id:group.id,name:String(group.name??''),type:groupType(group),entries});}
 const snapshot={id,name:String(sector.customName||sector.name||sector.code||'Settlement'),groups,trading:publishedTrading(shop.trading)};
 const bytes=new TextEncoder().encode(JSON.stringify(snapshot)),digest=await env.crypto.subtle.digest('SHA-256',bytes);
 if(JSON.stringify(shopSettlement(id,env).shop)!==saved)throw new Error('Shop changed while loading. Refresh and review again.');
 snapshot.revision=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');return snapshot;
}
// Requests travel through the requester's User document, rather than unauthenticated
// module socket payloads. Foundry's User update permissions identify the requester.
// Chat requests are serialized by the elected active GM. Actors are never updated.
export class PlayerShopService {
 constructor(env=globalThis){this.env=env;this.queue=Promise.resolve();this.pending=new Map();this.results=new Map();this.inflight=new Set();}
 authoritative(){return this.env.game.user.isGM&&activeShopGM(this.env)?.id===this.env.game.user.id;}
 start(){
  const {env}=this;
  env.Hooks.on('updateUser',(user,changes)=>{
   if(changes.flags?.[SHOP_MODULE]?.shopRequest&&this.authoritative())this.enqueue(user);
   if(user.id===env.game.user.id&&changes.flags?.[SHOP_MODULE]?.shopResponse){const response=user.getFlag(SHOP_MODULE,'shopResponse'),pending=this.pending.get(response?.id);if(pending){this.pending.delete(response.id);clearTimeout(pending.timer);response.ok?pending.resolve(response.data):pending.reject(new Error(response.error));}}
  });
  // Do not replay chat requests automatically on reload or GM failover.
 }
 enqueue(user){
  const request=structuredClone(user.getFlag(SHOP_MODULE,'shopRequest'));if(!request)return;
  const task=this.queue.then(async()=>{if(!this.authoritative())return;let response;try{response={id:request.id,ok:true,data:await this.execute(user,request)};}catch(error){response={id:request.id,ok:false,error:error.message};}if(this.authoritative())await user.setFlag(SHOP_MODULE,'shopResponse',response);});this.queue=task.catch(error=>this.env.console?.error('MYZ Player Shop response',error));return task;
 }
 async request(payload){
  const env=this.env;if(!activeShopGM(env))throw new Error('An active GM is required for the Player Shop.');
  if(this.pending.size)throw new Error('A Shop request is still pending.');
  const request={...payload,id:payload.id||env.crypto.randomUUID(),timestamp:Date.now()};
  if(env.game.user.isGM&&this.authoritative()){const task=this.queue.then(()=>this.execute(env.game.user,request));this.queue=task.catch(()=>{});return task;}
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(request.id);reject(new Error(`Shop request timed out. Check chat before retrying. Request ID: ${request.id}`));},60000);
   this.pending.set(request.id,{resolve,reject,timer});env.game.user.setFlag(SHOP_MODULE,'shopRequest',request).catch(error=>{clearTimeout(timer);this.pending.delete(request.id);reject(error);});
  });
 }
 async execute(user,request){
  const env=this.env;if(!this.authoritative())throw new Error('Only the active GM may process Shop requests.');
  if(!Array.from(env.game.users).some(member=>member===user)||!user?.active||typeof request?.id!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(request.id)||!Number.isFinite(request.timestamp)||Math.abs(Date.now()-request.timestamp)>120000||JSON.stringify(request).length>16000)throw new Error('Invalid or expired Shop request.');
  const key=`${user.id}:${request.id}`;
  if(this.results.has(key))return this.results.get(key);
  if(this.inflight.has(key))throw new Error('This request is already being processed.');
  this.inflight.add(key);
  try{
   if(request.action==='browse')return await shopSnapshot(request.settlement,env);
   if(!['purchase','trade'].includes(request.action))throw new Error('Unsupported Shop operation.');
   const snapshot=await shopSnapshot(request.settlement,env);
   if(request.revision!==snapshot.revision)throw new Error('Shop or rates changed. Refresh the Shop and review again.');
   if(typeof request.actor!=='string'||!/^Actor\.[A-Za-z0-9_-]+$/.test(request.actor))throw new Error('Choose a world character Actor.');
   const actor=await env.fromUuid(request.actor);characterResources(actor,user,env);
   let result,documentLink='';
   if(request.action==='trade'){
    const current=shopSettlement(request.settlement,env).shop;
    if(!current.trading.enabled)throw new Error('Resource trading is disabled.');
    if(JSON.stringify(publishedTrading(current.trading))!==JSON.stringify(snapshot.trading))throw new Error('Resource rates changed. Refresh and review again.');
    const quote=tradeRequestQuote(actor,user,snapshot.trading,request.give,request.receive,request.quantity,env);
    if(!this.authoritative())throw new Error('GM authority changed; request cancelled.');
    result={completed:true,message:`${actor.name} wants to trade at ${snapshot.name}:\n\n${quote.quantity} ${resourceLabel(quote.give,quote.quantity)} for ${quote.amount} ${resourceLabel(quote.receive,quote.amount)}`};
   }else{
    if(!Array.isArray(request.items)||request.items.length!==1||request.items[0]?.quantity!==1)throw new Error('Buy requests exactly one Item at quantity 1.');
    const selected=request.items[0],item=snapshot.groups.flatMap(g=>g.entries).find(i=>i.id===selected.id&&!i.unavailable);
    if(!item)throw new Error('Shop Item is unavailable.');
    result={completed:true,message:`${actor.name} wants to buy something from the shop:\n\n${item.name} (cost ${item.cost??''})${item.weight?'\nWeight: '+item.weight:''}${item.comment?'\nComment: '+item.comment:''}`};
    const editor=env.foundry?.applications?.ux?.TextEditor?.implementation;
    documentLink=editor?.enrichHTML?await editor.enrichHTML(`@UUID[${item.uuid}]`,{async:true,secrets:false}):`<a class="content-link" data-uuid="${esc(item.uuid)}" data-type="${esc(item.documentType)}" draggable="true">${esc(item.name)}</a>`;
   }
   if(request.action==='purchase'&&!this.authoritative())throw new Error('GM authority changed; purchase request cancelled.');
   // Cache before posting to suppress duplicate submissions; no resource writes occur.
   this.results.set(key,result);if(this.results.size>2000)this.results.delete(this.results.keys().next().value);
   try{await env.ChatMessage.create({content:result.message.split('\n\n').map(text=>`<p>${esc(text).replaceAll('\n','<br>')}</p>`).join('')+documentLink,whisper:[],blind:false});}catch{result={...result,completed:false,chatWarning:'Chat posting could not be confirmed. Check chat before retrying. No resources were changed.'};this.results.set(key,result);}
   return result;
  }finally{this.inflight.delete(key);}
 }
}
