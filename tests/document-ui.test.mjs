import {validateReference} from '../scripts/document-references.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveDocument,requireDocument,checkDocument,openDocument,validUuid,parseDocumentDrop,currentReferenceNode} from '../scripts/ui/documents.mjs';
import {referenceField} from '../scripts/ui/reference.mjs';
import {imagePath} from '../scripts/sector-images.mjs';
import {dropTypes,beginDrop} from '../scripts/ui/drop.mjs';
test('world, embedded and Compendium document types resolve with role validation and no source writes',async()=>{
 for(const type of ['Actor','Item','JournalEntry','JournalEntryPage','Scene','Macro'])for(const uuid of [`${type}.one`,`Compendium.world.pack.${type}.one`,`Actor.owner.${type}.embedded`]){const doc={uuid,documentName:type,name:'Source',testUserPermission:()=>true,update:()=>assert.fail('no writes')},env={game:{user:{}},fromUuid:async value=>{assert.equal(value,uuid);return doc;}};assert.equal((await resolveDocument(uuid,type,env)).doc,doc);assert.equal((await resolveDocument(uuid,'Wrong',env)).state,'invalid');}
});
test('missing, invalid, inaccessible and rejected references retain safe distinct states without leaking names/errors',async()=>{
 assert.equal((await resolveDocument('', '', {})).state,'empty');for(const uuid of ['',null,'<script>','Item.bad]'])assert.equal(validUuid(uuid),false);
 assert.equal((await resolveDocument('<bad>', '', {fromUuid:()=>assert.fail()})).state,'invalid');assert.equal((await resolveDocument('Item.missing','Item',{fromUuid:async()=>null})).state,'missing');
 const privateDoc={documentName:'Actor',testUserPermission:()=>false,get name(){assert.fail('restricted name read');}};assert.equal((await resolveDocument('Actor.private','Actor',{fromUuid:async()=>privateDoc})).state,'inaccessible');
 const result=await resolveDocument('Item.denied','Item',{fromUuid:async()=>{throw Error('SECRET STACK AUTH TOKEN');}});assert.equal(result.state,'unavailable');assert.doesNotMatch(result.message,/SECRET|STACK|TOKEN/);
});
test('only concurrent reads coalesce; permissions, failures, renames and deletion are never cached indefinitely',async()=>{
 let calls=0,finish,doc={documentName:'Actor',uuid:'Actor.one',name:'First',testUserPermission:()=>true};const env={fromUuid:()=>{calls++;return new Promise(r=>finish=r);}};
 const a=requireDocument('Actor.one','Actor',env),b=requireDocument('Actor.one','Actor',env);assert.equal(calls,1);finish(doc);assert.equal(await a,doc);assert.equal(await b,doc);
 env.fromUuid=async()=>{calls++;return doc;};doc.name='Updated';assert.equal((await requireDocument('Actor.one','Actor',env)).name,'Updated');doc.testUserPermission=()=>false;assert.equal((await resolveDocument('Actor.one','Actor',env)).state,'inaccessible');doc=null;assert.equal((await resolveDocument('Actor.one','Actor',env)).state,'missing');assert.equal(calls,4);
});
test('opening preserves native document behavior and never executes Macros or activates Scenes',async()=>{
 const seen=[],env={game:{user:{}}};for(const type of ['Actor','Item','JournalEntry','JournalEntryPage','Scene'])await openDocument({documentName:type,_onClickDocumentLink:()=>seen.push(type),activate:()=>assert.fail('no global activation')},{},env);
 await openDocument({documentName:'Macro',execute:()=>assert.fail('must not execute'),_onClickDocumentLink:()=>assert.fail('no Macro click execution'),sheet:{render:flag=>{assert.equal(flag,true);seen.push('Macro editor');}}},{},env);assert.equal(seen.length,6);
 await openDocument({documentName:'RollTable',_onClickDocumentLink:()=>assert.fail('no rolling from View'),roll:()=>assert.fail('no roll'),sheet:{render:()=>{}}},{},env);
 let viewed=0;await openDocument({documentName:'Scene',view:()=>viewed++,activate:()=>assert.fail('must not activate'),_onClickDocumentLink:()=>assert.fail('use GM-local view')},{},env);assert.equal(viewed,1);
 await assert.rejects(openDocument({documentName:'Actor',testUserPermission:()=>false,_onClickDocumentLink:()=>assert.fail()},{},env),/inaccessible/);
});
test('reference markup escapes saved values and retains original field names and controls',()=>{
 const html=referenceField({name:'special.events.0.uuid',uuid:'JournalEntry.bad"<x>',types:'JournalEntry|JournalEntryPage'});assert.match(html,/name="special.events.0.uuid"/);assert.match(html,/&quot;&lt;x&gt;/);assert.doesNotMatch(html,/<x>/);assert.match(html,/data-reference-attach/);assert.match(html,/data-reference-clear/);assert.match(html,/data-reference-state="resolving"/);
});
test('drop parsing uses native v14 API and feedback cannot mutate a departed view',()=>{
 const event={},env={foundry:{applications:{ux:{TextEditor:{implementation:{getDragEventData:e=>{assert.equal(e,event);return {uuid:'Actor.one',type:'Actor'};}}}}}}};assert.equal(parseDocumentDrop(event,env).uuid,'Actor.one');assert.throws(()=>parseDocumentDrop({},{}),/Invalid drag/);
 const node={dataset:{},isConnected:true,setAttribute(){}},host={draft:{},sectorId:'a',tab:'Inhabitants'};const finish=beginDrop(host,node);assert.equal(node.dataset.dropState,'pending');host.draft={};finish('completed');assert.equal(node.dataset.dropState,'pending');assert.equal(imagePath('data:image/png;base64,AA'),null);assert.equal(imagePath('blob:test'),null);
 assert.equal(currentReferenceNode({referenceClosed:true},node),false);
});

test('Document References settings do not read or disclose names before permission checks',async()=>{
 const key='generation.environment',env={game:{user:{}},fromUuid:async()=>({documentName:'RollTable',testUserPermission:()=>false,get name(){assert.fail('must not read restricted name');}})};
 const result=await validateReference(key,env,{formatVersion:1,references:{[key]:{mode:'custom',uuid:'RollTable.private'}}});assert.equal(result.status,'Inaccessible');assert.equal(result.name,'');assert.equal(result.document,null);
});
