import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSettlement,newSettlementEntry,settlementDefaults,SETTLEMENT_TABS,SETTLEMENT_COLLECTIONS,requireProject,assignProject,projectInformation,settlementAccent} from '../scripts/settlement.mjs';
import {normalizeSectorType,sectorTabs,isAuthored} from '../scripts/sector-types.mjs';
import {tabHasContent} from '../scripts/sector-content.mjs';
import {sectorIndicators} from '../scripts/sector-icons.mjs';
import {generateSector,saveGeneratedSector} from '../scripts/sector-randomizer.mjs';
import {generateEntry} from '../scripts/entry-generation.mjs';
import {travelFixture} from './helpers/travel-fixture.mjs';
import {fixture} from './helpers/zone-fixture.mjs';
import {overlayFixture} from './helpers/overlay-fixture.mjs';
import {SectorEntryTriggers} from '../scripts/zone/entry-triggers.mjs';
import {destinations} from '../scripts/wandering/model.mjs';
const project=(uuid='Item.project')=>({uuid,name:'Watchtower',documentName:'Item',type:'project',pack:uuid.startsWith('Compendium.')?'myz.projects':null,img:'systems/mutant-year-zero/assets/ico/project.svg',system:{description:'<p>Look out</p>',DEV_Requirement:'Warfare 10',other_requirements:'Scrap',skills:'Force',work_points:'20',DEV_Bonus:'Warfare +1',special:'Spot dangers',food:0,culture:0,technology:0,warfare:1,completed:false}});

test('Settlement is independent and exposes exactly seven ordered tabs, with Projects rather than Locations',()=>{
 const data=normalizeSectorType({version:1,sectorType:'settlement'});assert.equal(data.sectorType,'settlement');assert(isAuthored(data));assert.deepEqual(sectorTabs(data),['Overview','Projects','Inhabitants','Factions','Events','Threads','Shop']);assert.deepEqual(sectorTabs(data),SETTLEMENT_TABS);assert.equal(data.settlement.version,1);assert.equal(SETTLEMENT_COLLECTIONS.Projects,'settlement.projects');
 for(const type of ['normal','special']){const previous={version:1,sectorType:type,future:{retain:1},special:{inhabitants:[{title:'Existing'}]},loot:[{title:'Existing loot'}]};const next=normalizeSectorType(previous);assert.equal(next.settlement,undefined);assert.equal(next.sectorType,type);assert.deepEqual(next.loot,previous.loot);assert.deepEqual(next.future,previous.future);assert.equal(previous.settlement,undefined);}
});
test('all authored entries and nested inventories persist stable IDs, unknown properties and long content through JSON reloads and conversions',()=>{
 const s=settlementDefaults();for(const key of ['projects','inhabitants','factions','events','threads','shops'])s[key].push({...newSettlementEntry(key),...(key==='shops'?{inventory:[]}:{}),title:key,details:'Long narrative\n'.repeat(500),future:{keep:true}});s.shops[0].inventory.push({...newSettlementEntry('inventory'),title:'Water',quantity:'About 40',price:'A favor for the merchant'});s.custom={keep:true};
 let data=normalizeSectorType({version:1,sectorType:'settlement',settlement:s,loot:[{uuid:'Item.old'}],special:{overview:'Keep Special'},effects:[{macroUuid:'Macro.old'}]});const before=structuredClone(data);
 for(const type of ['normal','special','settlement','normal','settlement']){data=normalizeSectorType({...JSON.parse(JSON.stringify(data)),sectorType:type});assert.deepEqual(data.settlement,before.settlement);assert.deepEqual(data.loot,before.loot);assert.deepEqual(data.effects,before.effects);assert.deepEqual(data.special,before.special);}
 const ids=[...Object.values(SETTLEMENT_COLLECTIONS).flatMap(key=>key.split('.').slice(1).reduce((value,part)=>value[part],data.settlement).map(e=>e.id)),...data.settlement.shops[0].inventory.map(e=>e.id)];assert.equal(new Set(ids).size,ids.length);
});
test('Settlement defaults and editing do not leak across records or scenes; malformed schemas fail without mutating input',()=>{
 const a=normalizeSettlement(),b=normalizeSettlement();a.shops.push({...newSettlementEntry('shops'),inventory:[]});a.shops[0].inventory.push(newSettlementEntry('inventory'));assert.equal(b.shops.length,0);const saved=JSON.parse(JSON.stringify(a));assert.deepEqual(normalizeSettlement(saved),a);
 for(const invalid of [null,[],{version:2},{inhabitants:'broken'},{projects:[null]},{shops:[{inventory:{bad:true}}]}]){const before=structuredClone(invalid);assert.throws(()=>normalizeSettlement(invalid),/Record was not changed/);assert.deepEqual(invalid,before);}
 const duplicate=normalizeSettlement({inhabitants:[{id:'a'},{id:'a'}],factions:[{id:'a'}]});assert.equal(new Set([...duplicate.inhabitants,...duplicate.factions].map(e=>e.id)).size,3);
});
test('Project validation accepts only official MYZ project Items, from world and Compendiums',()=>{
 for(const uuid of ['Item.project','Compendium.myz.projects.Item.project'])assert.equal(requireProject(project(uuid)).uuid,uuid);
 for(const doc of [undefined,{documentName:'Actor',type:'project'},{documentName:'Item',type:'gear'},{documentName:'RollTable',type:'project'}])assert.throws(()=>requireProject(doc),/Ark Project Item/);
 assert.throws(()=>requireProject(project(),'other-system'),/Ark Project Item/);
});
test('assignments reference live project definitions, preserve independent progress, and never mutate source Items',()=>{
 const doc=project(),before=structuredClone(doc),a=assignProject(newSettlementEntry('projects'),doc),b=assignProject(newSettlementEntry('projects'),doc);
 a.status='Completed';a.progress='20';a.notes='Built by guards';a.completedAt='Session 12';assert.equal(b.status,'Planned');assert.equal(b.progress,'');assert.notEqual(a.id,b.id);assert.equal(a.uuid,b.uuid);assert.equal(a.system,undefined);assert.equal(a.description,undefined);assert.deepEqual(doc,before);
 assert.deepEqual(projectInformation(doc).find(([label])=>label==='Development requirements'),['Development requirements','Warfare 10']);assert(projectInformation(doc).some(([label,value])=>label==='Warfare'&&value===1));doc.system.work_points='30';assert(projectInformation(doc).some(([label,value])=>label==='Work points'&&value==='30'));assert.equal(a.work_points,undefined);
 const restored=normalizeSettlement(JSON.parse(JSON.stringify({projects:[a,b]})));assert.equal(restored.projects[0].status,'Completed');assert.equal(restored.projects[1].status,'Planned');restored.projects.splice(0,1);assert.deepEqual(doc.system.work_points,'30');
});
test('missing Factions, Actors and Items remain authored references; deleted factions do not delete inhabitants',()=>{
 const s=normalizeSettlement({inhabitants:[{id:'npc',title:'Guard',factionId:'missing',uuid:'Actor.missing',disposition:'Hostile'}],projects:[{id:'project',uuid:'Compendium.missing.projects.Item.one',status:'Completed',progress:'done'}],disposition:'Friendly'});assert.equal(s.inhabitants[0].factionId,'missing');assert.equal(s.inhabitants[0].disposition,'Hostile');assert.equal(s.disposition,'Friendly');assert.equal(s.projects[0].status,'Completed');assert.equal(s.projects[0].uuid,'Compendium.missing.projects.Item.one');
});
test('Settlement content indicators do not read inactive Normal or Special arrays',()=>{
 const data=normalizeSectorType({sectorType:'settlement',effects:[{category:'Phenomenon'}],rot:3,loot:[{title:'Old'}],special:{inhabitants:[{title:'Old'}]}});for(const tab of SETTLEMENT_TABS)assert.equal(tabHasContent(data,tab),false);data.settlement.inhabitants.push({title:'Guard'});data.settlement.projects.push({uuid:'Item.project'});assert(tabHasContent(data,'Inhabitants'));assert(tabHasContent(data,'Projects'));const indicators=sectorIndicators(data);assert.equal(indicators.encounters.value,1);for(const key of ['rot','phenomena','loot','status'])assert.equal(indicators[key].visible,false);
});
test('automatic Settlement entry bypasses random Travel/weather and Normal Macro effects while preserving weather and wandering sequencing',async()=>{
 const f=travelFixture();await f.service.onEntry(f.context());const state=f.state(),rolls=f.rolls.length,writes=f.stateWrites();f.sector.sectorType='settlement';f.sector.effects=[{triggerId:'old',macroUuid:'Macro.old'}];f.env.fromUuid=async()=>assert.fail('No lookup on Settlement entry');
 assert.equal(await f.service.onEntry(f.context()),null);assert.deepEqual(f.state(),state);assert.equal(f.rolls.length,rolls);assert.equal(f.stateWrites(),writes);
 let wandering=0;const dispatcher=new SectorEntryTriggers(f.store,f.env,{beforeMacros:()=>assert.fail('No Normal travel'),afterTravel:()=>wandering++});dispatcher.prime();assert.equal(wandering,0);f.token.x=0;await dispatcher.updated(f.token,{x:0});assert.equal(wandering,1);await dispatcher.updated(f.token,{x:0});assert.equal(wandering,1);assert.deepEqual(f.state(),state);
});
test('Settlement wandering destinations use the existing allowSpecial setting, preserving cardinal movement',()=>{
 const f=fixture(),npc={id:'npc',x:600,y:450,width:1,height:1,parent:f.zone};f.zone.tokens.set(npc.id,npc);f.env.game.journal.push({getFlag:()=>({version:1,sectorType:'settlement',code:'C2'})});
 const restricted=destinations(npc,f.store),allowed=destinations(npc,f.store,{allowSpecial:true});assert(!restricted.some(d=>d.coordinate==='C2'));assert(allowed.some(d=>d.coordinate==='C2'));assert.equal(allowed.length,4);assert.equal(restricted.length,3);assert(allowed.every(d=>Math.abs(d.x-npc.x)===500&&d.y===npc.y||Math.abs(d.y-npc.y)===400&&d.x===npc.x));
});
test('Settlement randomization/context generation fails before rolling or writing',async()=>{
 const data={version:1,sectorType:'settlement',settlement:normalizeSettlement()},before=structuredClone(data),env={game:{user:{isGM:true}},fromUuid:()=>assert.fail('No table access')};await assert.rejects(generateSector(data,{env}),/manually authored/);await assert.rejects(saveGeneratedSector({update:()=>assert.fail('No writes')},data,data,env),/cannot receive/);for(const kind of ['encounters','effects','locations','loot'])await assert.rejects(generateEntry(kind,data,{env}),/manually authored/);assert.deepEqual(data,before);
});
test('Settlement overlay uses a distinct passive border, shared grid, names, live replacements and configurable safe colors',()=>{
 const f=overlayFixture();let data={version:1,sectorType:'settlement',code:'A1',nameOverride:true,customName:'New Ark',settlement:normalizeSettlement()};f.env.game.journal=[{id:'s',getFlag:()=>data}];f.env.game.settings={get:()=> '#ff8800'};f.overlay.draw();const cell=f.overlay.cells.get('A1');assert(cell.root.children.some(c=>c.name==='settlement-sector-highlight'));assert(!cell.root.children.some(c=>c.name==='special-sector-highlight'));assert.equal(cell.root.eventMode,'none');assert.equal(cell.root.interactiveChildren,false);assert(cell.root.children.some(c=>c.text==='Settlement: New Ark'));const before=cell.root;data={...data,customName:'Renamed'};f.overlay.draw();assert.notEqual(cell.root,before);assert(cell.root.children.some(c=>c.text==='Settlement: Renamed'));assert.equal(settlementAccent('bad;css'), '#47aeb3');assert.equal(settlementAccent('#ff8800'),'#ff8800');
});
test('Scene-scoped Settlements with matching coordinates remain independent without changing legacy sector scope',()=>{
 const f=fixture();const a={version:1,sectorType:'settlement',sceneId:'zone',code:'B2',settlement:normalizeSettlement({population:'About 40'})},b={...structuredClone(a),sceneId:'combat',settlement:normalizeSettlement({population:'Several hundred'})};f.env.game.journal.push({id:'a',getFlag:()=>a},{id:'b',getFlag:()=>b});
 assert.deepEqual(f.store.sectorRecords('B2').map(doc=>doc.id),['a']);f.store.config.sceneId='combat';assert.deepEqual(f.store.sectorRecords('B2').map(doc=>doc.id),['b']);assert.equal(a.settlement.population,'About 40');assert.equal(b.settlement.population,'Several hundred');
 const overlay=overlayFixture();overlay.env.game.journal=[{id:'a',getFlag:()=>({...a,code:'A1'})},{id:'b',getFlag:()=>({...b,code:'B1'})}];overlay.overlay.draw();assert(overlay.overlay.records.has('A1'));assert(!overlay.overlay.records.has('B1'));
});
