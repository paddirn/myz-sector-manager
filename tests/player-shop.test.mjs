import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PlayerShopService,shopSnapshot,shopSettlement} from '../scripts/player-shop-service.mjs';
import {RESOURCES,normalizeTrading,tradeQuote,tradeUpdate} from '../scripts/settlement-trading.mjs';
import {normalizeShop} from '../scripts/settlement-shop.mjs';
import {requireArk,arkInformation} from '../scripts/settlement-ark.mjs';
import {playerShopContent,eligibleShopCharacters} from '../scripts/player-shop-ui.mjs';
import {serializeSector,deserializeSector} from '../scripts/portable/serialization.mjs';
function fixture(){
 const gm={id:'gm',name:'GM',isGM:true,active:true},alice={id:'alice',name:'Alice',active:true},bob={id:'bob',name:'Bob',active:true};
 const users=[gm,alice,bob];users.activeGM=gm;
 const actor={documentName:'Actor',type:'mutant',uuid:'Actor.hero',name:'Hero',system:{resources:{bullets:{value:20},grub:{value:10.5},water:{value:10}}},flags:{},testUserPermission:(u,p)=>p==='OWNER'&&['alice','gm'].includes(u.id),getFlag:(m,k)=>actor.flags[k],update:async change=>{for(const [path,value] of Object.entries(change)){if(path.startsWith('system.resources.'))actor.system.resources[path.split('.')[2]].value=value;else actor.flags.shopReceipts=value;}}};
 const sector={version:1,sectorType:'settlement',customName:'Market',code:'A1',settlement:{notes:'PRIVATE',arkUuid:'Actor.secret',shop:{version:1,playerAccess:true,trading:{enabled:true,values:{bullets:3,cleanGrub:2,cleanWater:1}},groups:[{id:'g',name:'General',type:'general',entries:[{id:'i',uuid:'Item.gear'}]}]}}};
 const item={documentName:'Item',name:'Rope',system:{cost:'2',description:'Rope'}};
 const journal={getFlag:()=>sector},chat=[],env={crypto:globalThis.crypto,console,game:{system:{id:'mutant-year-zero'},user:gm,users,journal:new Map([['market',journal]]),actors:[actor]},fromUuid:async id=>id==='Actor.hero'?actor:id==='Item.gear'?item:null,ChatMessage:{create:async data=>{chat.push(data);}}};
 const service=new PlayerShopService(env),id='JournalEntry.market';
 const request=async(overrides={})=>({id:crypto.randomUUID(),timestamp:Date.now(),action:'trade',settlement:id,actor:actor.uuid,revision:(await shopSnapshot(id,env)).revision,expected:{bullets:20,cleanGrub:10.5,cleanWater:10},give:'bullets',receive:'cleanWater',quantity:2,...overrides});
 return {gm,alice,bob,sector,actor,item,env,service,request,chat,id};
}
for(const give of Object.keys(RESOURCES))for(const receive of Object.keys(RESOURCES))if(give!==receive)test(`integer exchange ${give} → ${receive} uses relative values and floors`,()=>{const rates={enabled:true,values:{bullets:3,cleanGrub:2,cleanWater:1}},q=tradeQuote(rates,give,receive,7);assert.equal(q.amount,Math.floor(7*rates.values[give]/rates.values[receive]));assert.equal(q.quantity,7);});
test('invalid quantities/rates/same resource/zero output fail; fractions on sheets survive',()=>{
 for(const quantity of [0,-1,1.5,NaN,Infinity,'2',1000001])assert.throws(()=>tradeQuote(undefined,'bullets','cleanWater',quantity));
 assert.throws(()=>tradeQuote(undefined,'bullets','bullets',1));assert.throws(()=>tradeQuote({values:{cleanWater:2}},'bullets','cleanWater',1),/at least one/);
 for(const value of [0,-1,1.1,NaN,Infinity,'1',1000001])assert.throws(()=>normalizeTrading({values:{bullets:value}}));
 const f=fixture(),{update}=tradeUpdate(f.actor,f.alice,undefined,'cleanGrub','bullets',2,f.env);assert.equal(update['system.resources.grub.value'],8.5);assert.equal(f.actor.system.resources.grub.value,10.5);
});
test('publication is opt-in and rejects missing/non-Settlement references; players cannot call snapshot directly',async()=>{
 const f=fixture();for(const id of ['Actor.hero','market','JournalEntry.missing'])assert.throws(()=>shopSettlement(id,f.env));f.sector.settlement.shop.playerAccess=false;await assert.rejects(shopSnapshot(f.id,f.env),/inaccessible/);f.sector.settlement.shop.playerAccess=true;f.sector.sectorType='normal';assert.throws(()=>shopSettlement(f.id,f.env));f.sector.sectorType='settlement';f.env.game.user=f.alice;await assert.rejects(shopSnapshot(f.id,f.env),/GM/);assert.equal(normalizeShop().playerAccess,false);assert.equal(normalizeShop().trading.enabled,false);
});
test('snapshot is an allowlist with no sector notes, UUIDs, Ark, events, or editable sector objects',async()=>{
 const f=fixture();f.sector.settlement.shop.trading.privateNotes='PRIVATE TRADING';f.sector.settlement.shop.trading.values.hidden='PRIVATE VALUE';f.sector.settlement.shop.groups[0].privateNotes='PRIVATE GROUP';const snapshot=await shopSnapshot(f.id,f.env),text=JSON.stringify(snapshot);for(const secret of ['PRIVATE','Actor.secret','arkUuid','Item.gear','notes','settlement'])assert(!text.includes(secret),secret);assert.equal(snapshot.groups[0].entries[0].name,'Rope');assert.equal(snapshot.groups[0].entries[0].stock,null);assert.equal(snapshot.revision.length,64);f.item.system.cost='3';assert.notEqual((await shopSnapshot(f.id,f.env)).revision,snapshot.revision);
});
test('successful trade writes both native paths and receipt together, posts chat, and duplicate ID changes nothing',async()=>{
 const f=fixture(),r=await f.request();let writes=0;const original=f.actor.update;f.actor.update=async change=>{writes++;assert.equal(Object.keys(change).length,3);await original(change);};const first=await f.service.execute(f.alice,r),second=await f.service.execute(f.alice,r);assert.deepEqual(first,second);assert.equal(writes,1);assert.equal(f.actor.system.resources.bullets.value,18);assert.equal(f.actor.system.resources.water.value,16);assert.equal(f.chat.length,1);
 // Simulate GM service restart: receipt, not in-memory cache, protects the retry.
 const fresh=new PlayerShopService(f.env);await fresh.execute(f.alice,r);assert.equal(writes,1);assert.equal(f.chat.length,1);
});
test('missing actors, ownership, unsupported actor type, disabled trading, stale balances/rates and insufficient supplies fail without writes',async()=>{
 for(const kind of ['missing','permission','type','disabled','stale','rates','supplies','publication','authority']){
  const f=fixture(),r=await f.request();let user=f.alice;
  if(kind==='missing')r.actor='Actor.missing';if(kind==='permission')user=f.bob;if(kind==='type')f.actor.type='ark';if(kind==='disabled')f.sector.settlement.shop.trading.enabled=false;if(kind==='stale')r.expected.bullets=19;if(kind==='rates')f.sector.settlement.shop.trading.values.bullets=2;if(kind==='supplies')r.quantity=21;if(kind==='publication')f.sector.settlement.shop.playerAccess=false;if(kind==='authority')f.env.game.users.activeGM=f.bob;
  await assert.rejects(f.service.execute(user,r));assert.equal(f.actor.system.resources.bullets.value,20,kind);assert.equal(f.chat.length,0,kind);
 }
});
test('serialized requests from concurrent users re-read shared balances; stale second trade rejected',async()=>{
 const f=fixture();f.actor.testUserPermission=()=>true;const a=await f.request(),b=await f.request();
 const tasks=[];for(const [user,request] of [[f.alice,a],[f.bob,b]]){user.getFlag=()=>request;user.setFlag=async(k,n,response)=>{tasks.push(response);};f.service.enqueue(user);}await f.service.queue;assert.equal(tasks.filter(r=>r.ok).length,1);assert.equal(f.actor.system.resources.bullets.value,18);assert.equal(f.chat.length,1);
});
test('distinct actors trade concurrently through queue without using another player resources',async()=>{
 const f=fixture(),other={...f.actor,uuid:'Actor.other',system:structuredClone(f.actor.system),flags:{}};other.testUserPermission=u=>u.id==='bob';other.getFlag=(m,k)=>other.flags[k];other.update=async change=>{for(const [path,value] of Object.entries(change)){if(path.startsWith('system.'))other.system.resources[path.split('.')[2]].value=value;else other.flags.shopReceipts=value;}};const resolve=f.env.fromUuid;f.env.fromUuid=async id=>id==='Actor.other'?other:resolve(id);
 const responses=[];for(const [user,request] of [[f.alice,await f.request()],[f.bob,await f.request({actor:other.uuid})]]){user.getFlag=()=>request;user.setFlag=async(m,k,r)=>responses.push(r);f.service.enqueue(user);}await f.service.queue;assert(responses.every(r=>r.ok));assert.equal(f.actor.system.resources.bullets.value,18);assert.equal(other.system.resources.bullets.value,18);
});
test('Actor update failure never posts success; chat failure keeps deduction and protects retries',async()=>{
 const failed=fixture();failed.actor.update=async()=>{throw Error('Write rejected');};await assert.rejects(failed.service.execute(failed.alice,await failed.request()),/Write rejected/);assert.equal(failed.chat.length,0);assert.equal(failed.actor.system.resources.bullets.value,20);
 const f=fixture(),r=await f.request();f.env.ChatMessage.create=async()=>{throw Error('Chat offline');};const result=await f.service.execute(f.alice,r);assert.match(result.chatWarning,/Completed/);await f.service.execute(f.alice,r);assert.equal(f.actor.system.resources.bullets.value,18);
});
test('purchase requests support several Items/quantities, reliable totals and variable-price caveat; never transfer',async()=>{
 const f=fixture();const request=await f.request({action:'purchase',items:[{id:'i',quantity:3}]});const result=await f.service.execute(f.alice,request);assert.match(result.message,/Alice.*Hero.*Market.*3 × Rope/);assert.match(result.message,/Total: 6 Bullets/);assert.equal(f.actor.system.resources.bullets.value,20);assert.equal(f.actor.flags.shopReceipts,undefined);
 f.item.system.cost='1–6';const variable=await f.service.execute(f.alice,await f.request({action:'purchase',items:[{id:'i',quantity:1}]}));assert.match(variable.message,/Total unavailable/);
 for(const items of [[],[{id:'i',quantity:0}],[{id:'i',quantity:1.1}],[{id:'unknown',quantity:1}],[{id:'i',quantity:1},{id:'i',quantity:1}]])await assert.rejects(f.service.execute(f.alice,await f.request({action:'purchase',items})));
});
test('API does not process arbitrary actions or invalid/replayed identities; no active GM blocks requests',async()=>{
 const f=fixture();for(const override of [{action:'update'},{id:'bad'},{timestamp:0},{actor:'Actor.hero.Item.embedded'}])await assert.rejects(f.service.execute(f.alice,await f.request(override)));f.env.game.users.activeGM=null;for(const u of f.env.game.users)u.active=false;await assert.rejects(f.service.request({action:'browse',settlement:f.id}),/active GM/);
});
test('standalone content contains Shop only, escapes text and has no editing controls; character selector enforces ownership',()=>{
 const f=fixture();assert.deepEqual(eligibleShopCharacters({...f.env,game:{...f.env.game,user:f.bob}}),[]);const html=playerShopContent({name:'<Secret>',groups:[],trading:normalizeTrading({enabled:true})},[f.actor],f.actor.uuid);assert.match(html,/&lt;Secret&gt;/);assert.match(html,/Resource Trading/);assert.doesNotMatch(html,/data-shop-add|data-remove|GM Notes|Overview|Projects|Factions|Threads|data-tab/);
});
test('Ark data uses verified MYZ paths and embedded Items; invalid references rejected',()=>{
 const f=fixture(),ark={documentName:'Actor',type:'ark',system:{population:'25',coordinates:'B3',water_source:'Well',dev_levels:{food:{value:12,max:20}},bosses:{boss1:{name:'Boss',type:'Fixer',description:'Guide'}},description:'Info'},items:[{type:'project',name:'Farm',system:{completed:true}},{type:'artifact',name:'Motor'}]};assert.equal(requireArk(ark,f.env),ark);const data=Object.fromEntries(arkInformation(ark,f.env));assert.equal(data['Water Source'],'Well');assert.equal(data['Development: food'],'12 / 20');assert.equal(data.Projects,'Farm (completed)');assert.equal(data.Artifacts,'Motor');assert.match(data.Bosses,/Boss — Fixer — Guide/);assert.throws(()=>requireArk(f.actor,f.env));assert.throws(()=>requireArk({...ark,testUserPermission:()=>false},f.env),/inaccessible/);
});
test('new shop config and existing Ark UUID round trip without changing other sector content',()=>{
 const f=fixture(),file=serializeSector(f.sector,{moduleVersion:'0.1.36'}),result=deserializeSector(file,{code:'B2',sceneId:'zone'});assert.equal(result.settlement.arkUuid,'Actor.secret');assert.equal(result.settlement.notes,'PRIVATE');assert.equal(result.settlement.shop.playerAccess,true);assert.deepEqual(result.settlement.shop.trading,f.sector.settlement.shop.trading);assert.equal(file.extensions.unknown.length,0);
});
test('User document transport identifies requesting user and returns only a Shop snapshot',async()=>{
 const f=fixture(),callbacks=[];f.env.Hooks={on:(event,fn)=>callbacks.push(fn)};f.service.start();
 const clientEnv={...f.env,game:{...f.env.game,user:f.alice}},client=new PlayerShopService(clientEnv);client.start();
 const flags={};f.alice.getFlag=(m,k)=>flags[k];f.alice.setFlag=async(m,k,value)=>{flags[k]=structuredClone(value);for(const callback of callbacks)callback(f.alice,{flags:{[m]:{[k]:value}}});};
 const snapshot=await client.request({action:'browse',settlement:f.id});assert.equal(snapshot.name,'Market');assert(!JSON.stringify(snapshot).includes('PRIVATE'));assert.equal(client.pending.size,0);
 const r=await f.request();delete r.id;delete r.timestamp;const result=await client.request(r);assert.equal(result.completed,true);assert.equal(f.actor.system.resources.bullets.value,18);assert.equal(flags.shopResponse.data.completed,true);
});
test('malformed trading objects fail rather than silently becoming defaults',()=>{for(const raw of [null,[],false,'bad',{values:[]},{values:null}])assert.throws(()=>normalizeTrading(raw));});
