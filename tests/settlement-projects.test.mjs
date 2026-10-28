import test from 'node:test';import assert from 'node:assert/strict';
import {connectedProjectPlayers,projectMultiplier,projectTotal,nextProjectProgress,projectHeading,projectReady,projectBucket,projectRequirement,writeArkProjectStatus} from '../scripts/settlement-projects.mjs';
import {synchronizeArkProjects} from '../scripts/settlement-ark.mjs';
import {preferredShopCharacter,characterEncumbrance} from '../scripts/player-shop-ui.mjs';
import {normalizeSettlement} from '../scripts/settlement.mjs';
import {serializeSector,deserializeSector} from '../scripts/portable/serialization.mjs';
test('Shop character preference uses only eligible roster candidates: assigned, unique controlled, alphabetic fallback',()=>{
 const actors=[{uuid:'Actor.a'},{uuid:'Actor.b'}],env={game:{user:{character:{uuid:'Actor.outside'}}},canvas:{tokens:{controlled:[{actor:actors[1]}]}}};assert.equal(preferredShopCharacter(actors,env),'Actor.b');env.game.user.character=actors[0];assert.equal(preferredShopCharacter(actors,env),'Actor.a');env.game.user.character=null;env.canvas.tokens.controlled.push({actor:actors[0]});assert.equal(preferredShopCharacter(actors,env),'Actor.a');assert.equal(preferredShopCharacter([],env),undefined);
});
test('character weight uses only MYZ computed encumbrance, never an invented formula',()=>{
 assert.deepEqual(characterEncumbrance({system:{encumbrance:{itemsWeight:10.5,encumbranceMax:10}}}),{current:10.5,maximum:10,encumbered:true});assert.equal(characterEncumbrance({system:{attributes:{strength:{max:5}}}}),null);
});
test('Project multipliers accept verified work_points forms, reject ambiguous text; count active player accounts excluding both GM roles',()=>{
 for(const value of [2,'2','2 x number of PCs','2 × number of PCs','2 * PCs'])assert.equal(projectMultiplier(value),2);
 for(const value of ['',null,'twice the players',0,-1])assert.equal(projectMultiplier(value),null);
 const users=[{id:'a',role:1,active:true},{id:'b',role:2,active:true},{id:'c',role:1,active:false},{id:'d',role:3,active:true,isGM:false},{id:'e',role:4,active:true,isGM:true}];const env={game:{users}};assert.equal(connectedProjectPlayers(env),2);assert.equal(projectTotal({system:{work_points:'2 x number of PCs'}},env),4);users[1].active=false;assert.equal(projectTotal({system:{work_points:'2 x number of PCs'}},env),2);assert.equal(projectTotal({system:{work_points:'Unknown'}},env),null);
});
test('Work Points remain editable without caps or automatic completion, with readiness limited to Not completed',()=>{
 const base={title:'Tower',status:'Not completed',workPoints:5};
 for(const total of [null,0,4,8]){const next=nextProjectProgress(base,99,total);assert.equal(next.status,'Not completed');assert.equal(next.workPoints,99);}
 assert(projectReady(base,4));assert(!projectReady(base,8));assert(!projectReady(base,null));
 for(const status of ['Completed','Not available']){const next=nextProjectProgress({...base,status},99,4);assert.equal(next.status,status);assert(!projectReady(next,4));assert.equal(projectHeading(next,4),'Tower');}
 assert.equal(projectBucket({...base,workPoints:0}),'Not started');assert.equal(projectBucket(base),'Not completed');assert.equal(projectHeading({...base,workPoints:0},4),'Tower (0/4)');for(const n of [-1,1.5,NaN])assert.throws(()=>nextProjectProgress(base,n,8));
});
test('first numeric multiplier is extracted from any position, invalid values have a useful diagnostic and effective player count never drops below one',()=>{
 for(const [text,expected] of [['2 x number of PCs',2],['3 × number of PCs',3],['Work Points: 4 per PC',4],['Requires 5 work points per character',5],['2 or 3',2],['First 2.5 per PC',2.5]])assert.equal(projectMultiplier(text),expected);
 for(const text of ['Requires -2 per PC','Requires −2 per PC','0 then 3','0 x PCs','unknown',null,undefined])assert.equal(projectMultiplier(text),null);
 const env={game:{users:[]}};assert.equal(projectTotal({system:{work_points:'2 x PCs'}},env),2);assert.match(projectRequirement({system:{}},env).diagnostic,/system.work_points/);env.game.users.push({id:'one',active:true,role:1});assert.equal(projectTotal({system:{work_points:'2 x PCs'}},env),2);env.game.users.push({id:'two',active:true,role:1},{id:'three',active:true,role:1});assert.equal(projectTotal({system:{work_points:'2 x PCs'}},env),6);
});

function fixture(){const item={id:'one',uuid:'Actor.ark.Item.one',type:'project',name:'Tower',system:{completed:false,work_points:'2 x number of PCs'}},actor={documentName:'Actor',type:'ark',uuid:'Actor.ark',items:[item],testUserPermission:()=>true};item.parent=actor;const writes=[];actor.updateEmbeddedDocuments=async(type,updates)=>{writes.push({type,updates});for(const update of updates)assert.equal(update._id,item.id);item.system.completed=updates[0]['system.completed'];};const settlement={arkUuid:actor.uuid,projects:[]};settlement.projects=synchronizeArkProjects(settlement,actor).projects;return {actor,item,settlement,writes,entry:settlement.projects[0],env:{game:{user:{isGM:true}},fromUuid:async()=>actor}};}
test('Ark completion writes only stable embedded Project ID; no-op and bidirectional synchronization cannot loop; Not available survives unchecked source',async()=>{
 const f=fixture();await writeArkProjectStatus(f.settlement,f.entry,'Completed',f.env);assert.deepEqual(f.writes,[{type:'Item',updates:[{_id:'one','system.completed':true}]}]);await writeArkProjectStatus(f.settlement,f.entry,'Completed',f.env);assert.equal(f.writes.length,1);f.entry.status='Not available';await writeArkProjectStatus(f.settlement,f.entry,'Not available',f.env);assert.equal(f.item.system.completed,false);f.settlement.projects=synchronizeArkProjects(f.settlement,f.actor).projects;assert.equal(f.settlement.projects[0].status,'Not available');f.item.system.completed=true;const next=synchronizeArkProjects(f.settlement,f.actor);assert.equal(next.projects[0].status,'Completed');assert.equal(synchronizeArkProjects({...f.settlement,projects:next.projects},f.actor).changed,false);f.item.system.completed=false;assert.equal(synchronizeArkProjects({...f.settlement,projects:next.projects},f.actor).projects[0].status,'Not completed');
});
test('Ark writes reject player/permission/foreign/missing sources without modifying unrelated records',async()=>{
 for(const mutate of [f=>f.env.game.user.isGM=false,f=>f.actor.testUserPermission=()=>false,f=>f.entry.arkSource.arkUuid='Actor.other',f=>f.actor.items=[]]){const f=fixture();mutate(f);await assert.rejects(writeArkProjectStatus(f.settlement,f.entry,'Completed',f.env));assert.equal(f.writes.length,0);}
 const f=fixture();const manual={status:'Not completed'};await writeArkProjectStatus(f.settlement,manual,'Completed',f.env);assert.equal(f.writes.length,0);
});
test('Work Points and unavailable status survive normalization, repeated Ark sync and JSON export/import; legacy progress remains separate',()=>{
 const s=normalizeSettlement({projects:[{id:'p',title:'Tower',status:'Not available',workPoints:5,progress:'Legacy note'}]});const file=serializeSector({version:1,sectorType:'settlement',settlement:s},{moduleVersion:'0.1.42'});assert.equal(file.extensions.unknown.length,0);const restored=deserializeSector(file,{code:'A1',sceneId:'zone'});assert.deepEqual(restored.settlement.projects[0],s.projects[0]);assert.throws(()=>normalizeSettlement({projects:[{workPoints:-1}]}));
});

test('four presentation groups sort active progress descending, ties and zero-progress names alphabetically, without changing stored order',async()=>{
 const {projectDisplayCompare}=await import('../scripts/entry-order.mjs');const entries=[{title:'Zulu',status:'Not completed',workPoints:2},{title:'Beta',status:'Not completed',workPoints:5},{title:'Alpha',status:'Not completed',workPoints:5},{title:'First',status:'Completed',workPoints:99},{title:'Zero Z',status:'Not completed',workPoints:0},{title:'Zero A',status:'Not completed',workPoints:0},{title:'Locked',status:'Not available',workPoints:8}],before=structuredClone(entries);
 const sorted=entries.map((p,i)=>({p,i})).sort((a,b)=>projectDisplayCompare(a.p,b.p,a.p.title,b.p.title,a.i,b.i));assert.deepEqual(sorted.map(x=>x.p.title),['Alpha','Beta','Zulu','Zero A','Zero Z','First','Locked']);assert.deepEqual(entries,before);assert.equal(projectHeading(entries[6],1),'Locked');
});
