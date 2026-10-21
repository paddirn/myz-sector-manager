import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveShopDrop,putShopItem,normalizeShop} from '../scripts/settlement-shop.mjs';

test('v14 configured Item drop resolver accepts consecutive world, Compendium, embedded and non-UUID payloads of any Item type',async()=>{
 const calls=[],shop=normalizeShop({version:1,groups:[{id:'a',entries:[]},{id:'b',type:'weapons',entries:[]}]});
 const payloads=[{type:'Item',uuid:'Item.one'},{type:'Item',uuid:'Compendium.myz.gear.Item.two'},{type:'Item',uuid:'Actor.actor.Item.three'},{type:'Item',data:{_id:'four'}}];
 const env={CONFIG:{Item:{documentClass:{async fromDropData(data){calls.push(data);return {documentName:'Item',uuid:data.uuid||'Item.four',type:'custom'};}}}},fromUuid(){throw Error('Must use native resolver');}};
 for(const [i,payload] of payloads.entries()){const doc=await resolveShopDrop(payload,env);putShopItem(shop,doc,i%2?'b':'a');}
 assert.deepEqual(calls,payloads);assert.equal(shop.groups[0].entries.length,2);assert.equal(shop.groups[1].entries.length,2);
 assert.equal(putShopItem(shop,await resolveShopDrop(payloads[0],env),'a').duplicate,true);
});
test('drop resolution distinguishes unsupported data, missing documents, access errors and non-Items without mutating inventory',async()=>{
 for(const payload of [null,{},[],{type:'Actor',uuid:'Actor.one'}])await assert.rejects(resolveShopDrop(payload),/Invalid|requires/);
 await assert.rejects(resolveShopDrop({type:'Item',uuid:'Item.missing'},{fromUuid:async()=>null}),/missing or inaccessible/);
 await assert.rejects(resolveShopDrop({type:'Item',uuid:'Compendium.private.items.Item.one'},{CONFIG:{Item:{documentClass:{fromDropData(){throw Error('Permission denied');}}}}}),/Compendium access: Permission denied/);
 await assert.rejects(resolveShopDrop({uuid:'Actor.one'},{fromUuid:async()=>({documentName:'Actor'})}),/requires a Foundry Item/);
 await assert.rejects(resolveShopDrop({type:'Item'},{Item:{fromDropData:async()=>({documentName:'Item'})}}),/no stable UUID/);
 assert.equal((await resolveShopDrop({uuid:'Item.old'},{fromUuid:async uuid=>({documentName:'Item',uuid})})).uuid,'Item.old');
});
