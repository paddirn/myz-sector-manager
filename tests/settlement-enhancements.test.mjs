import test from 'node:test';
import assert from 'node:assert/strict';
import {bulletCost,rollBulletCost,purchaseMembers,purchaseContent,buyShopItem} from '../scripts/shop-purchases.mjs';
import {normalizeFaction,addFactionMember,resolveFactionActor} from '../scripts/settlement-factions.mjs';
import {normalizeSettlement} from '../scripts/settlement.mjs';

test('Bullet costs parse exact nonnegative integers and inclusive hyphen/en-dash ranges, rejecting barter, decimals, unsafe or reversed values',()=>{
 for(const value of [5,' 5 ','0'])assert.deepEqual(bulletCost(value),{min:Number(value),max:Number(value)});
 for(const value of ['3-6','3–6','3 - 6',' 3 – 6 '])assert.deepEqual(bulletCost(value),{min:3,max:6});
 for(const value of [undefined,null,'','Barter','3 bullets','3.5','-1','6-3','3-','1e2','1,000','9007199254740992'])assert.equal(bulletCost(value),null);
});
test('range pricing delegates one unbiased inclusive die roll, including both endpoints; single prices do not roll',async()=>{
 for(const value of [3,4,5,6]){let rolls=0;const env={Roll:class{constructor(formula){assert.equal(formula,'1d4 + 2');rolls++;}async evaluate(){return {total:value};}}};assert.equal(await rollBulletCost(bulletCost('3–6'),env),value);assert.equal(rolls,1);}
 assert.equal(await rollBulletCost(bulletCost('0'),{}),0);await assert.rejects(rollBulletCost(null),/integer/);
 await assert.rejects(rollBulletCost(bulletCost('3-6'),{Roll:class{async evaluate(){return {total:8};}}}),/invalid result/);
});
function fixture(){
 const group={id:'g',type:'weapons',entries:[{id:'e',uuid:'Item.rifle'}]},entry=group.entries[0],doc={documentName:'Item',uuid:entry.uuid,name:'<Rifle>',img:'icons/rifle.webp',type:'weapon',system:{cost:'3–6',damage:2,range:'Near',bonus:{value:1,max:2},weight:'1',comment:'@Macro[No]'}},actor={documentName:'Actor',uuid:'Actor.pc',name:'<PC>'},roster={version:1,members:[{actorUuid:actor.uuid,groupId:'',enabled:false,lead:false,eligibility:'exclude'}]},docs=new Map([[entry.uuid,doc],[actor.uuid,actor]]),messages=[],formulas=[];
 const host={data:null,draft:{settlement:{shop:{groups:[group]}}},sectorId:'s',rendered:true};host.data=host.draft;
 const env={game:{user:{isGM:true},settings:{get:()=>roster}},fromUuid:async uuid=>docs.get(uuid),foundry:{applications:{api:{DialogV2:{wait:async options=>{env.dialog=options;assert.equal(formulas.length,0);return options.buttons.find(b=>b.action==='buy').callback(null,null,{element:{querySelector:()=>({value:actor.uuid})}});}}}}},Roll:class{constructor(formula){formulas.push(formula);}async evaluate(){return {total:4};}},ChatMessage:{create:async message=>messages.push(message)}};
 return {group,entry,doc,actor,roster,docs,messages,formulas,host,env};
}
test('Buy reuses Party Roster, displays shared stats, resolves cost only on confirmation and announces one public escaped informational purchase',async()=>{
 const f=fixture(),before=structuredClone({doc:f.doc,actor:f.actor,shop:f.host.draft});
 await buyShopItem(f.host,f.group,f.entry,f.env);assert.equal(f.formulas.length,1);assert.equal(f.messages.length,1);assert.deepEqual(f.messages[0].whisper,[]);assert.equal(f.messages[0].blind,false);assert.match(f.messages[0].content,/&lt;PC&gt; purchased &lt;Rifle&gt; for 4 Bullets/);assert.match(f.messages[0].content,/clean Grub, clean Water, Booze \(doses\), or Scrap/);assert.match(f.env.dialog.content,/Damage/);assert.match(f.env.dialog.content,/1 \/ 2/);assert.match(f.env.dialog.content,/3–6/);assert.deepEqual({doc:f.doc,actor:f.actor,shop:f.host.draft},before);assert.equal(f.host.buyingShop,false);
});
test('confirmed single-value purchases do not roll and preserve zero/one/plural Bullet prices',async()=>{
 for(const price of [0,1,5]){const f=fixture();f.doc.system.cost=String(price);await buyShopItem(f.host,f.group,f.entry,f.env);assert.equal(f.formulas.length,0);assert.equal(f.messages.length,1);assert.match(f.messages[0].content,new RegExp(`for ${price} ${price===1?'Bullet':'Bullets'}\\.`));}
});
test('purchase roster deduplicates groups, skips missing/inaccessible Actors and keeps automatic-check exclusions available for manual shopping',async()=>{
 const f=fixture();f.roster.members.push({...f.roster.members[0],groupId:'second'},{...f.roster.members[0],actorUuid:'Actor.gone'},{...f.roster.members[0],actorUuid:'Actor.hidden'});f.docs.set('Actor.hidden',{documentName:'Actor',testUserPermission:()=>false});assert.deepEqual((await purchaseMembers(f.env)).map(a=>a.uuid),['Actor.pc']);
});
test('Cancel/X, empty roster, invalid cost and player access produce no purchase rolls or messages',async()=>{
 for(const outcome of [null,undefined]){const f=fixture();f.env.foundry.applications.api.DialogV2.wait=async()=>outcome;await buyShopItem(f.host,f.group,f.entry,f.env);assert.equal(f.messages.length,0);assert.equal(f.formulas.length,0);}
 for(const missing of ['cost','roster']){const f=fixture();if(missing==='cost')f.doc.system.cost='Rare barter';else f.roster.members=[];f.env.foundry.applications.api.DialogV2.wait=async options=>{assert.equal(options.buttons[1].disabled,true);assert.match(options.content,missing==='cost'?/Rare barter.*integer Bullet cost/:/No accessible Party members/);return null;};await buyShopItem(f.host,f.group,f.entry,f.env);assert.equal(f.messages.length,0);assert.equal(f.formulas.length,0);}
 const f=fixture();f.env.game.user.isGM=false;await buyShopItem(f.host,f.group,f.entry,f.env);assert.equal(f.messages.length,0);
});
test('Buy blocks stale roster/cost/sector changes and concurrent double clicks',async()=>{
 for(const change of ['cost','roster','sector']){const f=fixture();f.env.foundry.applications.api.DialogV2.wait=async()=>{if(change==='cost')f.doc.system.cost='10';if(change==='roster')f.roster.members=[];if(change==='sector')f.host.sectorId='other';return f.actor.uuid;};await assert.rejects(buyShopItem(f.host,f.group,f.entry,f.env));assert.equal(f.messages.length,0);assert.equal(f.formulas.length,0);}
 const f=fixture();let release;f.env.foundry.applications.api.DialogV2.wait=()=>new Promise(resolve=>release=resolve);const first=buyShopItem(f.host,f.group,f.entry,f.env);while(!release)await new Promise(resolve=>setTimeout(resolve,0));await buyShopItem(f.host,f.group,f.entry,f.env);release(f.actor.uuid);await first;assert.equal(f.messages.length,1);
});
test('purchase statistics use all five shared column sets and entry-local vehicle mode; unsafe names and comments remain text',()=>{
 const f=fixture();for(const [type,label] of [['general','Requirement'],['weapons','Damage'],['armor','Rating'],['vehicles','Travel Type'],['services','Requirement']]){const fields={cost:5,requirement:'Tech',damage:2,rating:'3 / 4',passengers:4,comment:'<script>bad</script>'},html=purchaseContent(f.doc,fields,{type},{travelType:'Water'},[f.actor]);assert.match(html,new RegExp(type==='general'||type==='services'?'Req.':label));assert.doesNotMatch(html,/<script>/);if(type==='vehicles')assert.match(html,/Water/);}
});
test('Faction migration consolidates legacy fields exactly once, retaining IDs, original values, unknown metadata and Inhabitant associations',()=>{
 const raw={id:'f',title:'Council',details:'Description\nwith lines',leader:'Elder',goals:'Water',notes:'Secret',actors:['Actor.one'],actorUuids:['Actor.two'],future:{keep:true}},before=structuredClone(raw),f=normalizeFaction(raw);assert.match(f.info,/Description: Description\nwith lines/);assert.match(f.info,/Leader: Elder/);assert.match(f.info,/GM Notes: Secret/);assert.deepEqual(f.future,raw.future);assert.deepEqual(f.members.map(m=>m.uuid),['Actor.two','Actor.one']);assert.deepEqual(normalizeFaction(f),f);assert.deepEqual(raw,before);
 const settlement=normalizeSettlement({factions:[raw],inhabitants:[{id:'npc',factionId:'f'}]});assert.equal(settlement.factions[0].id,'f');assert.equal(settlement.inhabitants[0].factionId,'f');const edited={...f,info:'Edited\nnotes'};assert.equal(normalizeFaction(edited).info,edited.info);
});
test('Faction members keep stable IDs and missing UUIDs, deduplicate within a faction, allow other factions and reject wrong documents',async()=>{
 const f=normalizeFaction({members:['Actor.missing',{id:'member',actorUuid:'Actor.pc'}]}),actor={documentName:'Actor',uuid:'Actor.pc'};assert.equal(addFactionMember(f,actor).duplicate,true);const second=normalizeFaction({});assert.equal(addFactionMember(second,actor).duplicate,false);assert.equal(f.members[1].id,'member');assert.equal(normalizeFaction(f).members[0].uuid,'Actor.missing');assert.throws(()=>addFactionMember(f,{documentName:'Item'}),/Actor/);assert.throws(()=>normalizeFaction({members:'bad'}),/Invalid/);assert.throws(()=>normalizeFaction({membersVersion:2}),/Unsupported/);assert.throws(()=>normalizeFaction({info:{bad:true}}),/Invalid/);
 const payload={type:'Actor',data:{_id:'pc'}};assert.equal(await resolveFactionActor(payload,{CONFIG:{Actor:{documentClass:{fromDropData:async data=>{assert.equal(data,payload);return actor;}}}}}),actor);await assert.rejects(resolveFactionActor({type:'Item',uuid:'Item.x'}),/Actor/);await assert.rejects(resolveFactionActor({uuid:'Actor.missing'},{fromUuid:async()=>null}),/missing/);
});
