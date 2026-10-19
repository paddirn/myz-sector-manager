import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rollTable,rollThreat,generateSector,TABLE_UUIDS,MAX_TABLE_DEPTH} from '../scripts/sector-randomizer.mjs';
import {legacyIdentity,REFERENCE_BY_KEY} from '../scripts/document-references.mjs';
import {withLegacyReferences} from './helpers/reference-fixture.mjs';
import {travelFixture} from './helpers/travel-fixture.mjs';
import {MODULE} from '../scripts/travel/model.mjs';
function nativeResult(data={}){
 const row={id:'result',uuid:'RollTable.source.TableResult.result',type:'text',name:'',description:'',...data};
 for(const key of ['text','documentId','documentCollection'])Object.defineProperty(row,key,{get(){assert.fail(`Deprecated TableResult.${key} accessed`);}});
 return row;
}
function fixture(){
 const docs=new Map(),calls=[];const env={game:{user:{isGM:true}},fromUuid:async uuid=>docs.get(uuid)};withLegacyReferences(env);
 const table=(uuid,rows,name=uuid)=>{const document={uuid,name,documentName:'RollTable',async roll(options){assert.equal(this,document);assert.deepEqual(options,{recursive:false});calls.push(uuid);return {results:typeof rows==='function'?rows():rows,roll:{total:2}};}};docs.set(uuid,document);return document;};
 return {docs,calls,env,table};
}
test('v14 Name, Description and self UUID normalize without reading deprecated accessors',async()=>{
 const f=fixture();
 for(const [row,name,description] of [[{name:'Heavy Rain'},'Heavy Rain',''],[{description:'Fog'},'Fog','Fog'],[{name:'Storm',description:'First line\nSecond line'},'Storm','First line\nSecond line']]){
  const result=(await rollTable(f.table('RollTable.source',[nativeResult(row)]),f.env)).entries[0];assert.equal(result.name,name);assert.equal(result.text,name);assert.equal(result.description,description);assert.equal(result.uuid,'');
 }
 await assert.rejects(rollTable(f.table('RollTable.empty',[nativeResult()]),f.env),/empty result.*Name, Description/);
 const def=REFERENCE_BY_KEY.get('generation.mood');assert(legacyIdentity(def,{name:def.aliases[0],formula:'1d6',results:[nativeResult({name:'Quiet',range:[1,6]})]}));
});
test('world and compendium targets use documentUuid, never the TableResult own UUID; Actors/Journals are terminal',async()=>{
 for(const [type,uuid] of [['Actor','Actor.raider'],['JournalEntry','JournalEntry.travel'],['JournalEntryPage','Compendium.world.zone.JournalEntry.travel.JournalEntryPage.page']]){
  const f=fixture(),doc={uuid,documentName:type,name:'Travelers'};f.docs.set(uuid,doc);
  const result=(await rollTable(f.table('RollTable.source',[nativeResult({type:'document',documentUuid:uuid,name:'Visitor',description:'Helpful travelers.'})]),f.env)).entries[0];
  assert.equal(result.name,'Visitor');assert.equal(result.description,'Helpful travelers.');assert.equal(result.uuid,uuid);assert.equal(result.documentType,type);assert.equal(f.calls.length,1);
 }
});
test('nested world/compendium tables roll each selected table once and retain provenance, names and multiline narrative',async()=>{
 const f=fixture(),last=f.table('Compendium.world.zone.RollTable.final',[nativeResult({name:'Rain',description:'Wet roads.\nLow clouds.'})]);
 const middle=f.table('RollTable.middle',[nativeResult({type:'document',documentUuid:last.uuid})]);const outer=f.table('RollTable.outer',[nativeResult({type:'document',documentUuid:middle.uuid})]);
 const result=(await rollTable(outer,f.env)).entries[0];assert.equal(result.name,'Rain');assert.equal(result.description,'Wet roads.\nLow clouds.');assert.equal(result.sources.length,3);assert.deepEqual(f.calls,[outer.uuid,middle.uuid,last.uuid]);
});
test('cycles, maximum depth, missing/inaccessible links, empty tables and malformed fields fail with table/result/configuration context',async()=>{
 const f=fixture(),table=f.table('RollTable.cycle',[nativeResult({name:'Loop',type:'document',documentUuid:'RollTable.cycle'})]);
 await assert.rejects(rollTable(table,f.env,[],{configurationKey:'travelEvents.weatherTable'}),/travelEvents.weatherTable.*RollTable.cycle.*Loop.*cycle\/depth/);
 for(const problem of ['missing','inaccessible']){
  const uuid='Compendium.world.zone.RollTable.bad';if(problem==='inaccessible')f.docs.set(uuid,{uuid,documentName:'RollTable',visible:false});
  await assert.rejects(rollTable(f.table('RollTable.parent',[nativeResult({name:'Bad link',documentUuid:uuid})]),f.env),new RegExp(`RollTable.parent.*Bad link.*${problem}`));
 }
 await assert.rejects(rollTable(f.table('RollTable.empty',[]),f.env),/no usable results/);
 await assert.rejects(rollTable(f.table('RollTable.invalid',[nativeResult({description:42})]),f.env),/Description must be text/);
 let next=f.table('RollTable.last',[nativeResult({name:'Clear'})]);for(let i=0;i<MAX_TABLE_DEPTH;i++)next=f.table(`RollTable.depth${i}`,[nativeResult({documentUuid:next.uuid})]);
 await assert.rejects(rollTable(next,f.env),/depth limit/);assert.equal((await rollTable(next,f.env,[],{maxDepth:MAX_TABLE_DEPTH+1})).text,'Clear');
});
test('weather uses Name identity, supports nested text/Journal fallback, preserves long narratives and rejects Actors without changing saved weather',async()=>{
 const f=travelFixture(),narrative='Long weather description.\n'.repeat(1500);f.weatherResults.splice(0,1,nativeResult({name:'Heavy Rain',description:narrative}));
 let result=await f.service.rollWeather();assert.equal(result.condition,'Heavy Rain');assert.equal(result.description,narrative.trim());
 const last={uuid:'Compendium.world.weather.RollTable.last',name:'Weather detail',documentName:'RollTable',roll:async()=>({results:[nativeResult({name:'Fog',description:'Misty roads.'})]})};f.docs.set(last.uuid,last);f.weatherResults.splice(0,1,nativeResult({documentUuid:last.uuid}));result=await f.service.rollWeather();assert.equal(result.condition,'Fog');assert.equal(result.sources.length,2);
 const journal={uuid:'JournalEntry.weather',name:'Overcast',documentName:'JournalEntry'};f.docs.set(journal.uuid,journal);f.weatherResults.splice(0,1,nativeResult({documentUuid:journal.uuid}));assert.equal((await f.service.rollWeather()).condition,'Overcast');
 await f.service.setWeather('Clear');const before=f.state().weather,sectorBefore=structuredClone(f.sector);f.docs.set('Actor.bad',{uuid:'Actor.bad',name:'Bad Weather Actor',documentName:'Actor'});f.weatherResults.splice(0,1,nativeResult({documentUuid:'Actor.bad'}));
 const failed=await f.service.process({...f.context(),force:'weather'});assert.deepEqual(f.state().weather,before);assert.deepEqual(f.sector,sectorBefore);assert.equal(failed.meaningful,false);assert.match(failed.event.errors[0],/travelEvents.weatherTable.*Weather Conditions.*expected weather text or a Journal name.*Actor/);assert(f.state().diagnostics[0].stack);
});
test('weather compares stable labels independently of descriptions; recurring failures warn once and keep diagnostic stacks',async()=>{
 const f=travelFixture();await f.service.setWeather('Heavy Rain','Earlier narrative');f.weatherResults.splice(0,1,nativeResult({name:' heavy   rain ',description:'Changed description only.'}));f.probabilities.push(1,12);await f.service.onEntry(f.context());assert.equal(f.reports.length,0);assert.equal(f.state().weather.description,'Earlier narrative');
 f.weatherResults.splice(0,1,nativeResult({name:'Clear',description:'Sunshine.'}));f.probabilities.push(1,12);await f.service.onEntry(f.context());assert.equal(f.reports.length,1);assert.equal(f.reports[0].weatherChange.condition,'Clear');
 let warnings=0;f.env.ui.notifications.warn=()=>warnings++;f.weatherResults.splice(0,1,nativeResult());for(let i=0;i<2;i++)await f.service.process({...f.context(),force:'weather'});assert.equal(warnings,1);assert.equal(f.state().weather.condition,'Clear');assert.match(f.state().diagnostics.at(-1).stack,/rollTable/);
});
test('Travel encounters retain Name/Description and nested world/compendium Actor or Journal targets without illegal environment wrappers',async()=>{
 for(const [category,type,uuid] of [['monster','Actor','Actor.raider'],['encounter','JournalEntryPage','Compendium.world.zone.JournalEntry.travel.JournalEntryPage.page'],['encounter',null,null]]){
  const f=travelFixture({injected:false}),nativeEnv=f.env;Object.defineProperty(nativeEnv,'document',{get(){if(this!==nativeEnv)throw new TypeError('Illegal invocation');return undefined;}});
  f.docs.set(TABLE_UUIDS.threatType,{uuid:TABLE_UUIDS.threatType,name:'Threat Type',documentName:'RollTable',roll:async()=>({results:[nativeResult({name:category==='monster'?'Monster':'D66 Encounters'})]})});
  const nested={uuid:'Compendium.world.zone.RollTable.encounter',name:'Nested encounter',documentName:'RollTable',roll:async()=>({results:[nativeResult({name:'Road Visitors',description:'First line\nSecond line',...(uuid?{documentUuid:uuid}:{})})]})};f.docs.set(nested.uuid,nested);
  f.docs.set(TABLE_UUIDS[category],{uuid:TABLE_UUIDS[category],name:'Subtype',documentName:'RollTable',roll:async()=>({results:[nativeResult({documentUuid:nested.uuid})]})});if(uuid)f.docs.set(uuid,{uuid,name:'Linked identity',documentName:type});
  const result=await f.service.rollEncounter();assert.equal(result.title,'Road Visitors');assert.equal(result.details,'First line\nSecond line');assert.equal(result.uuid,uuid||'');assert.equal(result.sources.length,3);
 }
});
test('normal sector generation supports v14 Name-only classification tables with throwing deprecated getters and preserves original records',async()=>{
 const f=fixture(),labels={environment:'Thick Woods',rot:'Weak Rot',threatLevel:'0',mood:'Quiet'};
 for(const [key,uuid] of Object.entries(TABLE_UUIDS))f.table(uuid,[nativeResult({name:labels[key]||key})],key);
 const existing={version:1,code:'A1',notes:'Preserve',customField:{value:7},locations:[],encounters:[],effects:[],loot:[]},before=structuredClone(existing);
 const generated=await generateSector(existing,{env:f.env,roll:async()=>10000});assert.equal(generated.terrain,'Thick Woods');assert.equal(generated.rot,1);assert.equal(generated.threatLevel,0);assert.deepEqual(generated.customField,before.customField);assert.deepEqual(existing,before);
});
