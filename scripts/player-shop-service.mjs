import {normalizeShop,resolveShopItem,shopColumns,groupType} from './settlement-shop.mjs';
import {normalizeTrading,characterResources,tradeUpdate,RESOURCES} from './settlement-trading.mjs';
import {bulletCost} from './shop-purchases.mjs';
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
 for(const group of shop.groups){const entries=[];for(const entry of group.entries){try{const {doc,fields}=await resolveShopItem(entry.uuid,env);entries.push({id:entry.id,name:doc.name,description:await publicText(doc.system?.description,env),cost:fields.cost,fields:Object.fromEntries(shopColumns(group).filter(c=>c.key!=='link').map(c=>[c.label,String(fields[c.key]??'')])),stock:null});}catch{entries.push({id:entry.id,name:'Unavailable Item',unavailable:true});}}groups.push({id:group.id,name:String(group.name??''),type:groupType(group),entries});}
 const snapshot={id,name:String(sector.customName||sector.name||sector.code||'Settlement'),groups,trading:publishedTrading(shop.trading)};
 const bytes=new TextEncoder().encode(JSON.stringify(snapshot)),digest=await env.crypto.subtle.digest('SHA-256',bytes);
 if(JSON.stringify(shopSettlement(id,env).shop)!==saved)throw new Error('Shop changed while loading. Refresh and review again.');
 snapshot.revision=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');return snapshot;
}
// Requests travel through the requester's User document, rather than unauthenticated
// module socket payloads. Foundry's User update permissions identify the requester.
// All writes are serialized by the elected active GM, with durable Actor receipts.
export class PlayerShopService {
 constructor(env=globalThis){this.env=env;this.queue=Promise.resolve();this.pending=new Map();this.results=new Map();this.inflight=new Set();}
 authoritative(){return this.env.game.user.isGM&&activeShopGM(this.env)?.id===this.env.game.user.id;}
 start(){
  const {env}=this;
  env.Hooks.on('updateUser',(user,changes)=>{
   if(changes.flags?.[SHOP_MODULE]?.shopRequest&&this.authoritative())this.enqueue(user);
   if(user.id===env.game.user.id&&changes.flags?.[SHOP_MODULE]?.shopResponse){const response=user.getFlag(SHOP_MODULE,'shopResponse'),pending=this.pending.get(response?.id);if(pending){this.pending.delete(response.id);clearTimeout(pending.timer);response.ok?pending.resolve(response.data):pending.reject(new Error(response.error));}}
  });
  // Do not replay requests on reload or GM failover. A timed-out write must be
  // checked on the character; explicit retries use the SAME request ID.
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
   const timer=setTimeout(()=>{this.pending.delete(request.id);reject(new Error(`Shop request timed out. Check character resources before retrying. Request ID: ${request.id}`));},60000);
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
   const receipts=actor.getFlag?.(SHOP_MODULE,'shopReceipts')||[];
   if(!Array.isArray(receipts))throw new Error('Character trade history is invalid; ask the GM to repair it.');
   const previous=receipts.find(r=>r.key===key);if(previous)return previous.result;
   let result;
   if(request.action==='trade'){
    const current=shopSettlement(request.settlement,env).shop;
    if(!current.trading.enabled)throw new Error('Resource trading is disabled.');
    if(JSON.stringify(publishedTrading(current.trading))!==JSON.stringify(snapshot.trading))throw new Error('Resource rates changed. Refresh and review again.');
    const {quote,update}=tradeUpdate(actor,user,snapshot.trading,request.give,request.receive,request.quantity,env);
    if(!request.expected||!Object.keys(RESOURCES).every(key=>characterResources(actor,user,env)[key]===request.expected[key]))throw new Error('Character resources changed. Refresh and review the trade.');
    result={completed:true,message:`${user.name}: ${actor.name} traded ${quote.quantity} ${RESOURCES[quote.give].label} for ${quote.amount} ${RESOURCES[quote.receive].label} at ${snapshot.name} (rate ${quote.rate}; rounded down).`};
    const recent=receipts.filter(r=>r.timestamp>Date.now()-600000);if(recent.length>=1000)throw new Error('Too many recent trades. Wait before trying again.');
    if(!this.authoritative())throw new Error('GM authority changed; trade cancelled.');
    // One Actor update carries both resources and receipt. No cross-document CAS
    // is available; manual edits/other modules are outside this service's queue.
    await actor.update({...update,[`flags.${SHOP_MODULE}.shopReceipts`]:[...recent,{key,timestamp:Date.now(),result}]});
   }else{
    if(!Array.isArray(request.items)||!request.items.length||request.items.length>100)throw new Error('Select between 1 and 100 Items.');
    const seen=new Set(),lines=[];let total=0,reliable=true;
    for(const selected of request.items){if(seen.has(selected.id)||!Number.isSafeInteger(selected.quantity)||selected.quantity<1||selected.quantity>1000000)throw new Error('Invalid purchase quantities.');seen.add(selected.id);const item=snapshot.groups.flatMap(g=>g.entries).find(i=>i.id===selected.id&&!i.unavailable);if(!item)throw new Error('Shop Item is unavailable.');const cost=bulletCost(item.cost);if(!cost||cost.min!==cost.max)reliable=false;else{total+=cost.min*selected.quantity;if(!Number.isSafeInteger(total))throw new Error('Purchase total is too large.');}lines.push(`${selected.quantity} × ${item.name} (listed price: ${item.cost===''||item.cost===undefined?'unknown':item.cost})`);}
    result={completed:true,message:`Purchase request from ${user.name}, character ${actor.name}, at ${snapshot.name}: ${lines.join('; ')}. ${reliable?`Total: ${total} Bullets.`:'Total unavailable: price is variable or unspecified.'} No Items, stock, or resources changed.`};
   }
   if(request.action==='purchase'&&!this.authoritative())throw new Error('GM authority changed; purchase request cancelled.');
   // Cache BEFORE ChatMessage.create: a chat failure must never deduct twice.
   this.results.set(key,result);if(this.results.size>2000)this.results.delete(this.results.keys().next().value);
   try{await env.ChatMessage.create({content:`<p>${esc(result.message)}</p>`,whisper:[],blind:false});}catch{result={...result,chatWarning:'Completed, but the chat announcement failed. Do not repeat the transaction.'};this.results.set(key,result);}
   return result;
  }finally{this.inflight.delete(key);}
 }
}
