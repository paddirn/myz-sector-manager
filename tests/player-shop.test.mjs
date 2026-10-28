import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PlayerShopService,shopSnapshot,shopSettlement} from '../scripts/player-shop-service.mjs';
import {RESOURCES,normalizeTrading,tradeQuote,tradeRequestQuote,tradeRatio,decimalFraction} from '../scripts/settlement-trading.mjs';
import {normalizeShop} from '../scripts/settlement-shop.mjs';
import {requireArk,arkInformation} from '../scripts/settlement-ark.mjs';
import {playerShopContent,eligibleShopCharacters} from '../scripts/player-shop-ui.mjs';
import {serializeSector,deserializeSector} from '../scripts/portable/serialization.mjs';
function fixture(){
 const gm={id:'gm',name:'GM',isGM:true,active:true},alice={id:'alice',name:'Alice',active:true},bob={id:'bob',name:'Bob',active:true};
 const users=[gm,alice,bob];users.activeGM=gm;
 const actor={documentName:'Actor',type:'mutant',uuid:'Actor.hero',name:'Hero',system:{resources:{bullets:{value:20},grub:{value:10.5},water:{value:10},booze:{value:5}}},flags:{},testUserPermission:(u,p)=>p==='OWNER'&&['alice','gm'].includes(u.id),getFlag:(m,k)=>actor.flags[k],update:async change=>{for(const [path,value] of Object.entries(change)){if(path.startsWith('system.resources.'))actor.system.resources[path.split('.')[2]].value=value;else actor.flags.shopReceipts=value;}}};
 const sector={version:1,sectorType:'settlement',customName:'Market',code:'A1',settlement:{notes:'PRIVATE',arkUuid:'Actor.secret',shop:{version:1,playerAccess:true,trading:{enabled:true,values:{bullets:3,cleanGrub:2,cleanWater:1,booze:1}},groups:[{id:'g',name:'General',type:'general',entries:[{id:'i',uuid:'Item.gear'}]}]}}};
 const item={documentName:'Item',name:'Rope',system:{cost:'2',description:'Rope'}};
 const roster={version:1,members:[{actorUuid:'Actor.hero',groupId:'',enabled:true,lead:false,eligibility:'auto',skillUuid:''}]};
 const journal={getFlag:()=>sector},chat=[],env={crypto:globalThis.crypto,console,game:{settings:{get:()=>roster},system:{id:'mutant-year-zero'},user:gm,users,journal:new Map([['market',journal]]),actors:[actor]},fromUuid:async id=>id==='Actor.hero'?actor:id==='Item.gear'?item:null,ChatMessage:{create:async data=>{chat.push(data);}}};
 const service=new PlayerShopService(env),id='JournalEntry.market';
 const request=async(overrides={})=>({id:crypto.randomUUID(),timestamp:Date.now(),action:'trade',settlement:id,actor:actor.uuid,revision:(await shopSnapshot(id,env)).revision,expected:{bullets:20,cleanGrub:10.5,cleanWater:10},give:'bullets',receive:'cleanWater',quantity:2,...overrides});
 return {roster,gm,alice,bob,sector,actor,item,env,service,request,chat,id};
}
for(const give of Object.keys(RESOURCES))for(const receive of Object.keys(RESOURCES))if(give!==receive)test(`integer exchange ${give} → ${receive} uses relative values and floors`,()=>{const rates={enabled:true,values:{bullets:3,cleanGrub:2,cleanWater:1,booze:1}},q=tradeQuote(rates,give,receive,7);assert.equal(q.amount,Math.floor(7*rates.values[give]/rates.values[receive]));assert.equal(q.quantity,7);});
test('invalid quantities/rates/same resource/zero output fail; fractions on sheets survive',()=>{
 for(const quantity of [0,-1,1.5,NaN,Infinity,'2',1000001])assert.throws(()=>tradeQuote(undefined,'bullets','cleanWater',quantity));
 assert.throws(()=>tradeQuote(undefined,'bullets','bullets',1));assert.throws(()=>tradeQuote({values:{cleanWater:2}},'bullets','cleanWater',1),/at least one/);
 for(const value of [0,-1,NaN,Infinity,'bad','0',1000001])assert.throws(()=>normalizeTrading({values:{bullets:value}}));
 const f=fixture();tradeRequestQuote(f.actor,f.alice,undefined,'cleanGrub','bullets',2,f.env);assert.equal(f.actor.system.resources.grub.value,10.5);
});
test('publication is opt-in and rejects missing/non-Settlement references; players cannot call snapshot directly',async()=>{
 const f=fixture();for(const id of ['Actor.hero','market','JournalEntry.missing'])assert.throws(()=>shopSettlement(id,f.env));f.sector.settlement.shop.playerAccess=false;await assert.rejects(shopSnapshot(f.id,f.env),/inaccessible/);f.sector.settlement.shop.playerAccess=true;f.sector.sectorType='normal';assert.throws(()=>shopSettlement(f.id,f.env));f.sector.sectorType='settlement';f.env.game.user=f.alice;await assert.rejects(shopSnapshot(f.id,f.env),/GM/);assert.equal(normalizeShop().playerAccess,false);assert.equal(normalizeShop().trading.enabled,false);
});
test('snapshot is an allowlist with no sector notes, UUIDs, Ark, events, or editable sector objects',async()=>{
 const f=fixture();f.sector.settlement.shop.trading.privateNotes='PRIVATE TRADING';f.sector.settlement.shop.trading.values.hidden='PRIVATE VALUE';f.sector.settlement.shop.groups[0].privateNotes='PRIVATE GROUP';const snapshot=await shopSnapshot(f.id,f.env),text=JSON.stringify(snapshot);for(const secret of ['PRIVATE','Actor.secret','arkUuid','Item.gear','notes','settlement'])assert(!text.includes(secret),secret);assert.equal(snapshot.groups[0].entries[0].name,'Rope');assert.equal(snapshot.groups[0].entries[0].stock,null);assert.equal(snapshot.revision.length,64);f.item.system.cost='3';assert.notEqual((await shopSnapshot(f.id,f.env)).revision,snapshot.revision);
});
test('trade requests only post concise chat, never update Actor resources/flags, and duplicate IDs do not repost',async()=>{
 const f=fixture(),r=await f.request(),before=structuredClone(f.actor.system);f.actor.update=async()=>assert.fail('Actor update forbidden');f.actor.getFlag=()=>assert.fail('Obsolete receipt access forbidden');
 const first=await f.service.execute(f.alice,r);await f.service.execute(f.alice,r);assert.equal(first.message,'Hero wants to trade at Market:\n\n2 Bullets for 6 Clean Water');assert.equal(f.chat.length,1);assert.deepEqual(f.actor.system,before);assert.deepEqual(f.actor.flags,{});
});
test('missing actors, ownership, unsupported actor type, disabled trading, stale balances/rates and insufficient supplies fail without writes',async()=>{
 for(const kind of ['missing','permission','type','disabled','rates','supplies','publication','authority']){
  const f=fixture(),r=await f.request();let user=f.alice;
  if(kind==='missing')r.actor='Actor.missing';if(kind==='permission')user=f.bob;if(kind==='type')f.actor.type='ark';if(kind==='disabled')f.sector.settlement.shop.trading.enabled=false;if(kind==='stale')r.expected.bullets=19;if(kind==='rates')f.sector.settlement.shop.trading.values.bullets=2;if(kind==='supplies')r.quantity=21;if(kind==='publication')f.sector.settlement.shop.playerAccess=false;if(kind==='authority')f.env.game.users.activeGM=f.bob;
  await assert.rejects(f.service.execute(user,r));assert.equal(f.actor.system.resources.bullets.value,20,kind);assert.equal(f.chat.length,0,kind);
 }
});
test('serialized requests from concurrent users re-read shared balances; stale second trade rejected',async()=>{
 const f=fixture();f.actor.testUserPermission=()=>true;const a=await f.request(),b=await f.request();
 const tasks=[];for(const [user,request] of [[f.alice,a],[f.bob,b]]){user.getFlag=()=>request;user.setFlag=async(k,n,response)=>{tasks.push(response);};f.service.enqueue(user);}await f.service.queue;assert.equal(tasks.filter(r=>r.ok).length,2);assert.equal(f.actor.system.resources.bullets.value,20);assert.equal(f.chat.length,2);
});
test('distinct actors trade concurrently through queue without using another player resources',async()=>{
 const f=fixture();f.roster.members.push({...f.roster.members[0],actorUuid:'Actor.other'});const other={...f.actor,uuid:'Actor.other',system:structuredClone(f.actor.system),flags:{}};other.testUserPermission=u=>u.id==='bob';other.getFlag=(m,k)=>other.flags[k];other.update=async change=>{for(const [path,value] of Object.entries(change)){if(path.startsWith('system.'))other.system.resources[path.split('.')[2]].value=value;else other.flags.shopReceipts=value;}};const resolve=f.env.fromUuid;f.env.fromUuid=async id=>id==='Actor.other'?other:resolve(id);
 const responses=[];for(const [user,request] of [[f.alice,await f.request()],[f.bob,await f.request({actor:other.uuid})]]){user.getFlag=()=>request;user.setFlag=async(m,k,r)=>responses.push(r);f.service.enqueue(user);}await f.service.queue;assert(responses.every(r=>r.ok));assert.equal(f.actor.system.resources.bullets.value,20);assert.equal(other.system.resources.bullets.value,20);
});
test('Actor updates are never attempted and chat failures report an unconfirmed request without resource changes',async()=>{
 const f=fixture(),r=await f.request();f.actor.update=async()=>assert.fail('No automatic trades');f.env.ChatMessage.create=async()=>{throw Error('Chat offline');};const result=await f.service.execute(f.alice,r);assert.equal(result.completed,false);assert.match(result.chatWarning,/No resources were changed/);await f.service.execute(f.alice,r);assert.equal(f.actor.system.resources.bullets.value,20);
});
test('single-item purchase chat is concise, preserves exact prices and safely escapes text',async()=>{
 const f=fixture();f.actor.name='<Hero>';f.item.name='Hiking Boots';f.item.system.cost='1-2';
 const result=await f.service.execute(f.alice,await f.request({action:'purchase',items:[{id:'i',quantity:1}]}));
 assert.equal(result.message,'<Hero> wants to buy something from the shop:\n\nHiking Boots (cost 1-2)');
 assert.equal(f.chat[0].content,'<p>&lt;Hero&gt; wants to buy something from the shop:</p><p>Hiking Boots (cost 1-2)</p>');assert.equal(f.actor.system.resources.bullets.value,20);
 for(const items of [[],[{id:'i',quantity:0}],[{id:'i',quantity:2}],[{id:'unknown',quantity:1}],[{id:'i',quantity:1},{id:'i',quantity:1}]])await assert.rejects(f.service.execute(f.alice,await f.request({action:'purchase',items})));
});
test('API does not process arbitrary actions or invalid/replayed identities; no active GM blocks requests',async()=>{
 const f=fixture();for(const override of [{action:'update'},{id:'bad'},{timestamp:0},{actor:'Actor.hero.Item.embedded'}])await assert.rejects(f.service.execute(f.alice,await f.request(override)));f.env.game.users.activeGM=null;for(const u of f.env.game.users)u.active=false;await assert.rejects(f.service.request({action:'browse',settlement:f.id}),/active GM/);
});
test('standalone content contains Shop only, escapes text and has no editing controls; character selector enforces ownership',()=>{
 const f=fixture();assert.deepEqual(eligibleShopCharacters({...f.env,game:{...f.env.game,user:f.bob}}),[]);const html=playerShopContent({name:'<Secret>',groups:[],trading:normalizeTrading({enabled:true})},[f.actor],f.actor.uuid);assert.match(html,/&lt;Secret&gt;/);assert.match(html,/Resource Trading/);assert.doesNotMatch(html,/data-shop-add|data-remove|GM Notes|Overview|Projects|Factions|Threads|data-tab/);
});
test('Ark data uses verified MYZ paths and embedded Items; invalid references rejected',()=>{
 const f=fixture(),ark={documentName:'Actor',type:'ark',system:{population:'25',coordinates:'B3',water_source:'Well',dev_levels:{food:{value:12,max:20}},bosses:{boss1:{name:'Boss',type:'Fixer',description:'Guide'}},description:'Info'},items:[{type:'project',name:'Farm',system:{completed:true}},{type:'artifact',name:'Motor'}]};assert.equal(requireArk(ark,f.env),ark);const data=Object.fromEntries(arkInformation(ark,f.env));assert.equal(data['Water Source'],'Well');assert.equal(data['Development: food'],12);assert.equal(data.Projects,'Farm (completed)');assert.equal(data.Artifacts,'Motor');assert.match(data.Bosses,/Boss — Fixer — Guide/);assert.throws(()=>requireArk(f.actor,f.env));assert.throws(()=>requireArk({...ark,testUserPermission:()=>false},f.env),/inaccessible/);
});
test('new shop config and existing Ark UUID round trip without changing other sector content',()=>{
 const f=fixture(),file=serializeSector(f.sector,{moduleVersion:'0.1.36'}),result=deserializeSector(file,{code:'B2',sceneId:'zone'});assert.equal(result.settlement.arkUuid,'Actor.secret');assert.equal(result.settlement.notes,'PRIVATE');assert.equal(result.settlement.shop.playerAccess,true);assert.deepEqual(result.settlement.shop.trading,f.sector.settlement.shop.trading);assert.equal(file.extensions.unknown.length,0);
});
test('User document transport identifies requesting user and returns only a Shop snapshot',async()=>{
 const f=fixture(),callbacks=[];f.env.Hooks={on:(event,fn)=>callbacks.push(fn)};f.service.start();
 const clientEnv={...f.env,game:{...f.env.game,user:f.alice}},client=new PlayerShopService(clientEnv);client.start();
 const flags={};f.alice.getFlag=(m,k)=>flags[k];f.alice.setFlag=async(m,k,value)=>{flags[k]=structuredClone(value);for(const callback of callbacks)callback(f.alice,{flags:{[m]:{[k]:value}}});};
 const snapshot=await client.request({action:'browse',settlement:f.id});assert.equal(snapshot.name,'Market');assert(!JSON.stringify(snapshot).includes('PRIVATE'));assert.equal(client.pending.size,0);
 const r=await f.request();delete r.id;delete r.timestamp;const result=await client.request(r);assert.equal(result.completed,true);assert.equal(f.actor.system.resources.bullets.value,20);assert.equal(flags.shopResponse.data.completed,true);
});
test('malformed trading objects fail rather than silently becoming defaults',()=>{for(const raw of [null,[],false,'bad',{values:[]},{values:null}])assert.throws(()=>normalizeTrading(raw));});

test('Party Roster is authoritative even for owned non-roster characters; removal before a transaction rejects',async()=>{
 const f=fixture();assert.equal(eligibleShopCharacters({...f.env,game:{...f.env.game,user:f.alice}}).length,1);
 const request=await f.request();f.roster.members=[];assert.equal(eligibleShopCharacters({...f.env,game:{...f.env.game,user:f.alice}}).length,0);
 await assert.rejects(f.service.execute(f.alice,request),/Party Roster/);assert.equal(f.actor.system.resources.bullets.value,20);assert.equal(f.chat.length,0);
});

test('decimal rates preserve direction, exact arithmetic and minimum whole Give quantities',()=>{
 const rates={values:{bullets:'1',cleanWater:'0.5',cleanGrub:'0.25',booze:'2.75'}};
 assert.equal(tradeQuote(rates,'bullets','cleanWater',1).amount,2);assert.equal(tradeQuote(rates,'cleanWater','bullets',2).amount,1);assert.equal(tradeRatio(rates,'cleanWater','bullets').minimum,2);assert.throws(()=>tradeQuote(rates,'cleanWater','bullets',1),/Minimum/);assert.equal(tradeQuote(rates,'bullets','cleanGrub',1).amount,4);
 assert.equal(tradeQuote({values:{bullets:'0.3',cleanWater:'0.1'}},'bullets','cleanWater',1).amount,3);
 assert.equal(tradeQuote({values:{bullets:'1.5',booze:'2.75'}},'bullets','booze',11).amount,6);
 assert.equal(decimalFraction(1e-7).denominator,10000000n);
});
test('old three-resource settings migrate Booze additively; exact decimal strings round trip',()=>{
 const raw={enabled:true,values:{bullets:3,cleanWater:1,cleanGrub:2}},before=structuredClone(raw);const next=normalizeTrading(raw);assert.deepEqual(raw,before);assert.deepEqual(next.values,{bullets:3,cleanGrub:2,cleanWater:1,booze:1});
 const f=fixture();f.sector.settlement.shop.trading.values={bullets:'0.1',cleanWater:'0.25',cleanGrub:'1.5',booze:'2.750000000000000001'};const file=serializeSector(f.sector,{moduleVersion:'0.1.40'});const round=deserializeSector(file,{code:'A1',sceneId:'zone'});assert.deepEqual(round.settlement.shop.trading.values,f.sector.settlement.shop.trading.values);
});
test('all twelve decimal/Booze conversion directions use the existing relative-value direction',()=>{
 const rates={values:{bullets:'1.5',cleanGrub:'0.25',cleanWater:'0.5',booze:'2.75'}},quarters={bullets:6,cleanGrub:1,cleanWater:2,booze:11};
 for(const give of Object.keys(RESOURCES))for(const receive of Object.keys(RESOURCES))if(give!==receive){const q=tradeQuote(rates,give,receive,22);assert.equal(q.amount,Math.floor(22*quarters[give]/quarters[receive]),`${give} → ${receive}`);assert(q.amount>=1);}
});
test('all five Player Shop informational column sets match the GM definitions without management controls',()=>{
 const expected={general:['Item','Cost','Req.','Weight','Comment'],weapons:['Item','Cost','Damage','Range','Bonus','Weight','Comment'],armor:['Item','Cost','Rating','Rot Prot.','Weight','Comment'],vehicles:['Item','Cost','Passengers','Travel Type'],services:['Item','Cost','Req.','Comment']};
 for(const [type,columns] of Object.entries(expected)){const html=playerShopContent({name:'Shop',trading:normalizeTrading(),groups:[{type,name:type,entries:[]}]},[],null);assert.deepEqual(Array.from(html.matchAll(/<th>([^<]+)<\/th>/g),m=>m[1]),[...columns,'Buy']);assert.doesNotMatch(html,/data-shop-remove|data-shop-add|data-shop-entry-up/);}
});
