import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/zone-fixture.mjs';
import {wanderingDefaults,validateWandering,playerControlled,baseEligible,destinations,MODULE,SETTING,FLAG} from '../scripts/wandering/model.mjs';
import {WanderingTokens} from '../scripts/wandering/service.mjs';
import {SectorEntryTriggers} from '../scripts/zone/entry-triggers.mjs';
import {coordinateToBounds,positionToCoordinate,tokenCenter} from '../scripts/zone/grid.mjs';
function setup(){
 const f=fixture(),flags={},notices=[],updates=[];f.settings.set(SETTING,wanderingDefaults());f.env.game.users=[{id:'gm',isGM:true},{id:'player',isGM:false,active:false}];f.env.game.users.activeGM={id:'gm'};
 const get=f.configDoc.getFlag.bind(f.configDoc),set=f.configDoc.setFlag.bind(f.configDoc);f.configDoc.getFlag=(m,k)=>k==='wanderingEntries'?flags[k]:get(m,k);f.configDoc.setFlag=async(m,k,v)=>k==='wanderingEntries'?flags[k]=structuredClone(v):set(m,k,v);
 f.env.console={error(){}};f.env.ui.notifications={info:message=>notices.push(message),warn:message=>notices.push(message),error:message=>notices.push(message)};
 const npc=(id,x=600,y=450,actor={ownership:{default:0}})=>{
  const token={id,uuid:`Scene.zone.Token.${id}`,x,y,width:1,height:1,hidden:true,rotation:45,elevation:7,disposition:1,parent:f.zone,actor,ownership:{default:0},flags:{[FLAG]:true},getFlag(m,k){return this.flags[k];},setFlag:async function(m,k,v){this.flags[k]=v;},isOwner:true,canUserModify:()=>true,update:async function(data,options){assert.deepEqual(Object.keys(data).sort(),['x','y']);updates.push({id,data,options});Object.assign(this,data);return this;}};
  f.zone.tokens.set(id,token);return token;
 };
 const service=new WanderingTokens(f.store,f.env,{random:()=>0});
 const context=id=>({entryId:id,token:f.zone.tokens.get('party'),group:f.store.config.groups[0]});
 return {...f,flags,notices,updates,npc,service,context};
}
test('wandering defaults/validation, stationary flags, real ownership including offline/default owners, hidden/friendly/hostile NPCs and independent placed tokens',()=>{
 const f=setup(),a=f.npc('a'),b=f.npc('b',600,450,a.actor);assert.deepEqual(wanderingDefaults(),{version:1,enabled:true,maximum:2,frequency:'every',allowSpecial:false});
 for(const maximum of [0,7,1.5,NaN,'2'])assert.throws(()=>validateWandering({maximum}));assert.throws(()=>validateWandering({frequency:'bad'}));
 assert(baseEligible(a,f.store,f.env));b.flags[FLAG]=false;assert(!baseEligible(b,f.store,f.env));delete b.flags[FLAG];assert(!baseEligible(b,f.store,f.env));assert.equal(a.flags[FLAG],true);
 a.actor.ownership.player=3;assert(playerControlled(a,f.env));assert(!baseEligible(a,f.store,f.env));a.disposition=-1;assert(!baseEligible(a,f.store,f.env));a.actor.ownership={default:3};assert(playerControlled(a,f.env));a.actor.ownership={gm:3};assert(baseEligible(a,f.store,f.env));a.actor.hasPlayerOwner=true;assert(!baseEligible(a,f.store,f.env));delete a.actor.hasPlayerOwner;
 a.actor.testUserPermission=user=>user.id==='player';assert(!baseEligible(a,f.store,f.env));delete a.actor.testUserPermission;a.ownership.player=3;assert(!baseEligible(a,f.store,f.env));delete a.ownership.player;
 a.flags[FLAG]=true;f.store.config.groups.push({id:'npcParty',sceneId:'zone',tokenId:a.id});assert(!baseEligible(a,f.store,f.env));f.store.config.groups.pop();assert(!baseEligible(a,f.store,f.env,new Set([a.uuid])));a.movement={state:'paused'};assert(!baseEligible(a,f.store,f.env));
});
test('four physical cardinal moves use Zone dimensions, retain relative position and honor scene/grid edges and corners',()=>{
 const f=setup(),a=f.npc('a');const moves=destinations(a,f.store);assert.deepEqual(moves.map(p=>[p.direction,p.x,p.y]),[['North',600,50],['South',600,850],['East',1100,450],['West',100,450]]);
 for(const move of moves){assert((move.x===a.x)!==(move.y===a.y));assert([500,400].includes(Math.abs(move.x-a.x)+Math.abs(move.y-a.y)));}
 a.x=0;a.y=0;assert.deepEqual(destinations(a,f.store).map(p=>p.direction),['South','East']);a.x=2900;a.y=2800;assert(destinations(a,f.store).every(p=>p.x>=0&&p.y>=0&&p.x+100<=3000&&p.y+100<=3000));
 f.store.config.grid.columns=1;f.store.config.grid.rows=1;a.x=50;a.y=50;assert.equal(destinations(a,f.store).length,0);
});
test('swapped/reversed grid orientation and padded scenes still produce one-sector cardinal moves',()=>{
 const f=setup();Object.assign(f.store.config.grid,{reference:'C3',originX:600,originY:400,width:300,height:200,columns:5,rows:5,columnAxis:'y',columnDirection:-1,rowDirection:-1});f.zone.dimensions={sceneRect:{x:100,y:100,width:2000,height:2000}};
 const bounds=coordinateToBounds('B2',f.store.config.grid),a=f.npc('a',bounds.x+40,bounds.y+30);const from=positionToCoordinate(tokenCenter(a,f.zone),f.store.config.grid);assert.equal(from,'B2');
 const moves=destinations(a,f.store);assert.equal(moves.length,4);assert(moves.every(p=>p.x===a.x||p.y===a.y));assert.deepEqual(new Set(moves.map(p=>p.coordinate)),new Set(['C2','A2','B1','B3']));
 a.x=100;a.y=100;for(const p of destinations(a,f.store))assert(p.x>=100&&p.y>=100);
});
test('large tokens must fit, boundary offsets clamp where practical and invalid grid/Scene inputs produce no destinations',()=>{
 const f=setup(),a=f.npc('large');a.width=6;assert.equal(destinations(a,f.store).length,0);a.width=4;a.height=3;a.x=950;a.y=750;const moves=destinations(a,f.store);assert(moves.length);for(const move of moves){const b=coordinateToBounds(move.coordinate,f.store.config.grid);assert(move.x>=b.x&&move.y>=b.y&&move.x+400<=b.x+b.width&&move.y+300<=b.y+b.height);}
 f.store.config.grid.width=-1;assert.deepEqual(destinations(a,f.store),[]);
});
test('Special destinations are excluded by default, permitted explicitly; uncreated sectors/occupancy remain valid without Journal writes',()=>{
 const f=setup(),a=f.npc('a'),b=f.npc('b');assert.equal(destinations(a,f.store).length,4);f.env.game.journal.push({getFlag:()=>({version:1,code:'B1',sectorType:'special'})});
 assert(!destinations(a,f.store).some(p=>p.coordinate==='B1'));assert(destinations(a,f.store,{allowSpecial:true}).some(p=>p.coordinate==='B1'));assert(destinations(a,f.store).some(p=>p.coordinate==='C2'));assert.deepEqual(destinations(a,f.store),destinations(b,f.store));assert.equal(f.creations(),0);
});
test('automatic selection is without replacement, at most configured count, silent, native movement preserves unrelated data and excludes players/Party',async()=>{
 const f=setup(),a=f.npc('a'),b=f.npc('b'),c=f.npc('c'),player=f.npc('player',600,450,{hasPlayerOwner:true});const before={hidden:a.hidden,rotation:a.rotation,elevation:a.elevation,actor:a.actor};
 const result=await f.service.onEntry(f.context('move1'));assert.equal(result.moved,2);assert.deepEqual(f.updates.map(u=>u.id),['a','b']);assert.equal(c.x,600);assert.equal(player.x,600);assert.deepEqual({hidden:a.hidden,rotation:a.rotation,elevation:a.elevation,actor:a.actor},before);assert.equal(f.notices.length,0);assert(f.updates.every(u=>u.options.myzWandering&&u.options.animate&&!u.options.autoRotate&&u.options.constrainOptions.ignoreWalls));
 assert.equal((await f.service.onEntry(f.context('move1'))).moved,0);const reloaded=new WanderingTokens(f.store,f.env);assert.equal((await reloaded.onEntry(f.context('move1'))).moved,0);
});
test('disabled/manual frequencies prevent automatic changes; manual still works; quarter chance rolls once per entry rather than per token',async()=>{
 const f=setup();f.npc('a');f.npc('b');for(const change of [{enabled:false},{frequency:'manual'}]){f.settings.set(SETTING,{...wanderingDefaults(),...change});assert.equal((await f.service.onEntry(f.context(JSON.stringify(change)))).moved,0);assert.equal((await f.service.manual()).moved,2);}
 f.settings.set(SETTING,{...wanderingDefaults(),frequency:'quarter'});let rolls=0;f.service.random=()=>{rolls++;return .75;};assert.equal((await f.service.onEntry(f.context('chanceMiss'))).moved,0);assert.equal(rolls,1);f.service.random=()=>{rolls++;return 0;};assert.equal((await f.service.onEntry(f.context('chanceHit'))).moved,2);assert.equal(rolls,6);
});
test('no eligible tokens, movement failures, permissions and inactive GM behavior remain controlled',async()=>{
 const f=setup();assert.equal((await f.service.manual()).moved,0);assert.equal(f.notices[0],'No eligible wandering tokens.');const a=f.npc('a'),b=f.npc('b');a.update=async()=>{throw Error('Native denial');};assert.equal((await f.service.onEntry(f.context('failure'))).moved,1);assert.equal(f.service.busy.size,0);assert.equal(f.notices.length,1);
 f.env.game.users.activeGM={id:'another'};await assert.rejects(f.service.manual(),/active GM/);f.env.game.users.activeGM={id:'gm'};b.canUserModify=()=>false;assert(!baseEligible(b,f.store,f.env));a.parent=f.combat;assert(!baseEligible(a,f.store,f.env));
});
test('manual and automatic operations serialize, in-flight tokens cannot be selected twice and live GM handover prevents later moves',async()=>{
 const f=setup(),a=f.npc('a'),b=f.npc('b');let release;const nativeUpdate=a.update.bind(a);a.move=async(data,options)=>{await new Promise(resolve=>release=resolve);return nativeUpdate(data,options);};const first=f.service.onEntry(f.context('first')),second=f.service.manual();await new Promise(r=>setImmediate(r));assert(f.service.busy.has(a.uuid));assert.equal(f.updates.length,0);f.env.game.users.activeGM={id:'next'};release();await assert.rejects(first,/active GM/);await assert.rejects(second,/active GM/);assert.equal(b.x,600);assert.equal(f.service.busy.size,0);
});
test('bulk updates only selected modifiable documents, excludes player enablement and uses one native Scene batch',async()=>{
 const f=setup(),a=f.npc('a'),b=f.npc('b'),p=f.npc('player',600,450,{hasPlayerOwner:true});b.canUserModify=()=>false;let calls=0;f.zone.updateEmbeddedDocuments=async(type,updates)=>{calls++;assert.equal(type,'Token');for(const u of updates)f.zone.tokens.get(u._id).flags[FLAG]=u[`flags.${MODULE}.${FLAG}`];return updates;};f.env.canvas.tokens={controlled:[a,b,p].map(document=>({document}))};assert.equal(await f.service.bulk(true),1);assert.equal(calls,1);assert.equal(await f.service.bulk(false),2);assert.equal(a.flags[FLAG],false);assert.equal(p.flags[FLAG],false);
});
test('entry dispatcher orders Travel → wandering → Macros; uncreated/Special squares still wander and NPC/duplicate/startup/waypoint updates do not',async()=>{
 const f=setup(),order=[];f.env.foundry.utils={randomID:()=>String(Math.random())};let macroFlags={records:[]};const normal={getFlag:(m,k)=>k==='sector'?{version:1,code:'A1',effects:[{macroUuid:'Macro.test',triggerId:'test',macroRunOnce:false}]}:macroFlags,setFlag:async(m,k,v)=>macroFlags=v};f.env.game.journal[1]=normal;f.env.fromUuid=async()=>({documentName:'Macro',execute:async()=>order.push('macro')});
 const dispatcher=new SectorEntryTriggers(f.store,f.env,{beforeMacros:async()=>order.push('travel'),afterTravel:async()=>order.push('wander')});dispatcher.prime();const party=f.zone.tokens.get('party');await dispatcher.stopped(party);assert.deepEqual(order,[]);
 party.x=0;await dispatcher.updated(party,{x:0});assert.deepEqual(order,['travel','wander','macro']);await dispatcher.updated(party,{x:0});assert.equal(order.length,3);
 party.x=1000;await dispatcher.updated(party,{x:1000});assert.equal(order.at(-1),'wander');assert.equal(order.length,4);
 f.env.game.journal.push({getFlag:()=>({version:1,code:'D1',sectorType:'special'})});party.x=1500;await dispatcher.updated(party,{x:1500});assert.equal(order.length,5);assert.equal(order.at(-1),'wander');
 const npc=f.npc('npc');await dispatcher.updated(npc,{x:1000});assert.equal(order.length,5);party.movement={state:'pending'};party.x=500;await dispatcher.updated(party,{x:500});party.x=2000;await dispatcher.updated(party,{x:2000});assert.equal(order.length,5);party.movement.state='completed';await dispatcher.stopped(party);assert.equal(order.length,6);await dispatcher.stopped(party);assert.equal(order.length,6);
 dispatcher.afterTravel=async()=>{throw Error('Wandering failed');};party.x=0;await dispatcher.updated(party,{x:0});assert.equal(order.at(-1),'macro');
});

test('two GM clients filter the same movement and authority handover does not repeat an observed crossing',async()=>{
 const f=setup(),{ZoneStore}=await import('../scripts/zone/store.mjs');f.npc('a');f.npc('b');let firstChecks=0,secondChecks=0;
 const env2={...f.env,game:{...f.env.game,user:{id:'gm2',isGM:true}}},store2=new ZoneStore(env2);store2.reload();
 const one=new SectorEntryTriggers(f.store,f.env,{afterTravel:async ctx=>{firstChecks++;await f.service.onEntry(ctx);}}),service2=new WanderingTokens(store2,env2,{random:()=>0}),two=new SectorEntryTriggers(store2,env2,{afterTravel:async ctx=>{secondChecks++;await service2.onEntry(ctx);}});one.prime();two.prime();
 const party=f.zone.tokens.get('party');party.x=0;await Promise.all([one.updated(party,{x:0}),two.updated(party,{x:0})]);assert.equal(firstChecks,1);assert.equal(secondChecks,0);assert.equal(f.updates.length,2);
 f.env.game.users.activeGM={id:'gm2'};await Promise.all([one.updated(party,{x:0}),two.updated(party,{x:0})]);assert.equal(secondChecks,0);party.x=500;await Promise.all([one.updated(party,{x:500}),two.updated(party,{x:500})]);assert.equal(firstChecks,1);assert.equal(secondChecks,1);assert.equal(f.updates.length,4);
});
test('NPC programmatic update/move/stop events cannot recursively run wandering, Travel or Party Macros',async()=>{
 const f=setup(),npc=f.npc('npc');let travel=0,checks=0;const dispatcher=new SectorEntryTriggers(f.store,f.env,{beforeMacros:async()=>travel++,afterTravel:async context=>{checks++;await f.service.onEntry(context);}});dispatcher.prime();const native=npc.update.bind(npc);npc.update=async(data,options)=>{const result=await native(data,options);await dispatcher.updated(npc,data);await dispatcher.stopped(npc);return result;};
 const party=f.zone.tokens.get('party');party.x=0;await dispatcher.updated(party,{x:0});assert.equal(checks,1);assert.equal(travel,1);assert.equal(f.updates.length,1);await dispatcher.updated(party,{x:0});assert.equal(checks,1);
});
