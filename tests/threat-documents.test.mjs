import {withLegacyReferences} from './helpers/reference-fixture.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TABLE_UUIDS,resolveTables,rollThreat,rollTable,generateSector,saveGeneratedSector,mapThreatType} from '../scripts/sector-randomizer.mjs';
function fixture(){
  const calls=new Map(),documents=new Map();
  for(const [key,uuid] of Object.entries(TABLE_UUIDS))documents.set(uuid,{uuid,name:key,documentName:'RollTable',async roll(options){assert.equal(options.recursive,false);calls.set(key,(calls.get(key)||0)+1);return {results:[{description:key}]};}});
  const env={game:{user:{isGM:true}},fromUuid:async uuid=>documents.get(uuid)};withLegacyReferences(env);
  const set=(key,results)=>{documents.get(TABLE_UUIDS[key]).roll=async options=>{assert.equal(options.recursive,false);calls.set(key,(calls.get(key)||0)+1);return {results:typeof results==='function'?results():results};};};
  const doc=(type,name,uuid)=>{const document={documentName:type,name,uuid};documents.set(uuid,document);return document;};
  const ref=key=>({documentUuid:TABLE_UUIDS[key],description:'Category display alias'});
  return {env,documents,calls,set,doc,ref};
}
test('all four category table references roll exactly once and preserve world/compendium document names and UUIDs',async()=>{
  for(const [category,type,name,uuid] of [
    ['humanoid','Actor','Zone Ghoul','Actor.ghoul'],['monster','Actor','Devourer','Compendium.myz.monsters.Actor.devourer'],
    ['encounter','JournalEntry','Wanderers','JournalEntry.wanderers'],['phenomenon','JournalEntry','Rot Wind','Compendium.myz.zone.JournalEntry.rotwind']
  ]){
    const f=fixture();f.doc(type,name,uuid);f.set('threatType',[f.ref(category)]);f.set(category,[{documentUuid:uuid,description:'A table display label'}]);
    const threats=await rollThreat(await resolveTables(f.env),f.env);assert.equal(threats.length,1);assert.equal(threats[0].category,category);assert.equal(threats[0].result.documentTitle,name);assert.equal(threats[0].result.uuid,uuid);assert.equal(f.calls.get('threatType'),1);assert.equal(f.calls.get(category),1);
  }
});
test('automatic recursion uses originating TableResult parent and never reinterprets Wanderers or rerolls its table',async()=>{
  for(const category of ['humanoid','monster','encounter','phenomenon']){
    const f=fixture(),type=['humanoid','monster'].includes(category)?'Actor':'JournalEntry';f.doc(type,'Wanderers',`${type}.wanderers`);
    f.set('threatType',[{documentUuid:`${type}.wanderers`,description:'Wanderers',parent:f.documents.get(TABLE_UUIDS[category])}]);
    const threats=await rollThreat(await resolveTables(f.env),f.env);assert.equal(threats[0].category,category);assert.equal(threats[0].result.documentTitle,'Wanderers');assert.equal(f.calls.get(category),undefined);assert.equal(f.calls.get('threatType'),1);
  }
});
test('text categories include D66 Encounters, while originating parent allows final plain-text Wanderers',async()=>{
  const f=fixture();f.set('threatType',[{description:'2 D66 Encounters'}]);f.set('encounter',[{description:'Wanderers'}]);let threats=await rollThreat(await resolveTables(f.env),f.env);assert.equal(threats[0].category,'encounter');assert.equal(threats[0].result.text,'Wanderers');assert.equal(threats[0].result.uuid,'');
  f.set('threatType',[{description:'Wanderers',parent:f.documents.get(TABLE_UUIDS.encounter)}]);threats=await rollThreat(await resolveTables(f.env),f.env);assert.equal(threats[0].category,'encounter');assert.equal(f.calls.get('encounter'),1);
  assert.equal(mapThreatType({text:'1 Humanoids',mapping:{}}),'humanoid');assert.equal(mapThreatType({text:'D66 Encounters',mapping:{}}),'encounter');
});
test('unknown final document origins, wrong document types, missing references and cycles fail clearly',async()=>{
  const f=fixture();f.doc('Actor','Wanderers','Actor.wanderers');f.set('threatType',[{documentUuid:'Actor.wanderers'}]);await assert.rejects(rollThreat(await resolveTables(f.env),f.env),/no originating Threat category/);
  f.set('threatType',[f.ref('phenomenon')]);f.set('phenomenon',[{documentUuid:'Actor.wanderers'}]);await assert.rejects(rollThreat(await resolveTables(f.env),f.env),/must reference JournalEntry/);
  f.set('phenomenon',[{documentUuid:'JournalEntry.missing'}]);await assert.rejects(rollThreat(await resolveTables(f.env),f.env),/missing/);
  f.set('phenomenon',[f.ref('threatType')]);await assert.rejects(rollThreat(await resolveTables(f.env),f.env),/cycle/);
});
test('nested leaf tables retain multiple documents instead of dropping their references',async()=>{
  const f=fixture();f.doc('JournalEntry','Wanderers','JournalEntry.a');f.doc('JournalEntry','Refugees','Compendium.world.encounters.JournalEntry.b');
  const nested={uuid:'RollTable.nested',name:'Nested encounters',documentName:'RollTable',roll:async()=>({results:[{documentUuid:'JournalEntry.a'},{documentUuid:'Compendium.world.encounters.JournalEntry.b'}]})};f.documents.set(nested.uuid,nested);f.set('threatType',[f.ref('encounter')]);f.set('encounter',[{documentUuid:nested.uuid}]);
  const results=await rollThreat(await resolveTables(f.env),f.env);assert.deepEqual(results.map(entry=>entry.result.uuid),['JournalEntry.a','Compendium.world.encounters.JournalEntry.b']);assert(results.every(entry=>entry.category==='encounter'));
});
test('legacy references use canonical resolved UUIDs; getDocument supports document results but not text',async()=>{
  const f=fixture();f.doc('Actor','Ghoul','Compendium.myz.actors.Actor.ghoul');f.documents.set('Compendium.myz.actors.ghoul',f.documents.get('Compendium.myz.actors.Actor.ghoul'));
  f.set('humanoid',[{documentCollection:'myz.actors',documentId:'ghoul',description:'Ghoul'}]);assert.equal((await rollTable(f.documents.get(TABLE_UUIDS.humanoid),f.env)).uuid,'Compendium.myz.actors.Actor.ghoul');
  f.set('humanoid',[{type:'document',getDocument:async()=>f.documents.get('Compendium.myz.actors.Actor.ghoul')}]);assert.equal((await rollTable(f.documents.get(TABLE_UUIDS.humanoid),f.env)).documentTitle,'Ghoul');
  f.set('humanoid',[{type:'text',description:'Wanderers',getDocument:()=>assert.fail('text is not a missing document')}]);assert.equal((await rollTable(f.documents.get(TABLE_UUIDS.humanoid),f.env)).text,'Wanderers');
});
test('mixed categories generate editable Encounter/Effect entries and retain references after saving/reload',async()=>{
  const f=fixture();let index=0;const categories=['humanoid','encounter','phenomenon'];f.set('threatType',()=>[f.ref(categories[index++])]);
  f.doc('Actor','Zone Ghoul','Actor.ghoul');f.doc('JournalEntryPage','Wanderers','JournalEntry.wanderers.JournalEntryPage.page');f.doc('JournalEntryPage','Rot Wind','Compendium.myz.zone.JournalEntry.wind.JournalEntryPage.page');
  f.set('humanoid',[{documentUuid:'Actor.ghoul',description:'Display alias'}]);f.set('encounter',[{documentUuid:'JournalEntry.wanderers.JournalEntryPage.page'}]);f.set('phenomenon',[{documentUuid:'Compendium.myz.zone.JournalEntry.wind.JournalEntryPage.page'}]);
  f.set('environment',[{description:'Thick Woods, Ruin:No, Threat:Yes, Artifact:No'}]);f.set('rot',[{description:'Weak Rot'}]);f.set('threatLevel',[{description:'2'}]);f.set('mood',[{description:'Quiet'}]);
  const existing={version:1,code:'A1',notes:'Keep',encounters:[{title:'Manual'}],effects:[],loot:[],locations:[]};
  const options={env:f.env,options:{threatMode:'individual-d3'},roll:async formula=>formula==='1d3'?3:10000,rollBaseDice:async()=>[1,2]};
  const next=await generateSector(existing,options);assert.deepEqual(next.encounters.map(entry=>entry.title),['Manual','Zone Ghoul','Wanderers']);assert.equal(next.effects[0].title,'Rot Wind');assert.equal(next.effects[0].category,'Phenomenon');assert.equal(next.randomization.threatCount,3);assert.equal(existing.encounters.length,1);
  let stored=structuredClone(existing);const journal={getFlag:()=>stored,update:async changes=>{stored=structuredClone(changes['flags.myz-sector-manager.sector']);},setFlag:async(mod,key,value)=>{stored=structuredClone(value);}};await saveGeneratedSector(journal,existing,next,f.env);const reopened=structuredClone(journal.getFlag());assert.deepEqual(reopened.encounters.map(entry=>entry.uuid).filter(Boolean),['Actor.ghoul','JournalEntry.wanderers.JournalEntryPage.page']);assert.equal(reopened.effects[0].uuid,'Compendium.myz.zone.JournalEntry.wind.JournalEntryPage.page');
});
