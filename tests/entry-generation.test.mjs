import {withLegacyReferences} from './helpers/reference-fixture.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateEntry,normalizeEncounter,locationRuinKind,EVENT_TABLES} from '../scripts/entry-generation.mjs';
import {TABLE_UUIDS,rollArtifact,artifactAllowed,generateSector} from '../scripts/sector-randomizer.mjs';
function fixture(){
  const docs=new Map(),calls=[];const env={game:{user:{isGM:true},journal:[],actors:[],packs:[]},fromUuid:async uuid=>docs.get(uuid)};withLegacyReferences(env);
  const table=(key,results)=>{const uuid=TABLE_UUIDS[key]||EVENT_TABLES[key]||key;let index=0;const value={uuid,name:key,documentName:'RollTable',async roll(options){assert.deepEqual(options,{recursive:false});calls.push(key);const raw=typeof results==='function'?results(index++):results;return Array.isArray(raw)?{results:raw}:raw;}};docs.set(uuid,value);return value;};
  const document=(type,uuid,name)=>{const doc={documentName:type,uuid,name};docs.set(uuid,doc);return doc;};
  return {env,docs,calls,table,document};
}
test('manual Encounters preserve all three category identities and world/compendium document UUIDs',async()=>{
  for(const [category,type] of [['humanoid','Humanoid'],['monster','Monster'],['encounter','Encounter']])for(const compendium of [false,true]){
    const f=fixture(),documentName=category==='encounter'?'JournalEntry':'Actor',uuid=compendium?`Compendium.myz.docs.${documentName}.one`:`${documentName}.one`;
    f.document(documentName,uuid,'Wanderers');f.table(category,[{documentUuid:uuid}]);f.table('threatType',[{documentUuid:TABLE_UUIDS[category]}]);
    const entry=await generateEntry('encounters',{},f);assert.equal(entry.title,'Wanderers');assert.equal(entry.type,type);assert.equal(entry.uuid,uuid);assert.equal(entry.status,'Active');assert.deepEqual(f.calls,['threatType',category]);
  }
});
test('manual Phenomena rolls are discarded before resolving/rolling their nested table and retries are bounded',async()=>{
  const f=fixture();f.document('Actor','Actor.a','Beast');f.table('monster',[{documentUuid:'Actor.a'}]);f.table('threatType',index=>[{range:index<2?[6,6]:[3,5],description:index<2?'Phenomena':'Monsters',...(index<2?{documentUuid:TABLE_UUIDS.phenomenon}:{documentUuid:TABLE_UUIDS.monster})}]);
  const entry=await generateEntry('encounters',{},f);assert.equal(entry.type,'Monster');assert.deepEqual(f.calls,['threatType','threatType','threatType','monster']);
  const blocked=fixture();blocked.table('threatType',[{range:[6,6],documentUuid:'RollTable.missing'}]);await assert.rejects(generateEntry('encounters',{},blocked),/30 attempts/);assert.equal(blocked.calls.length,30);
});
test('pre-recursed threat results reuse the parent category without rolling its subtype again',async()=>{
  const f=fixture(),actor=f.document('Actor','Actor.a','Same name'),parent={documentName:'RollTable',uuid:TABLE_UUIDS.humanoid};f.table('threatType',[{documentUuid:actor.uuid,parent}]);
  assert.equal((await generateEntry('encounters',{},f)).type,'Humanoid');assert.deepEqual(f.calls,['threatType']);
});
test('Encounters normalize old classifications/statuses without losing unknown values or manual overrides',()=>{
  assert.deepEqual(normalizeEncounter({title:'Keep',status:'Inactive',type:'Odd',uuid:'Actor.a'}),{title:'Keep',status:'Active',type:'Encounter',uuid:'Actor.a',legacyStatus:'Inactive',legacyType:'Odd'});
  assert.equal(normalizeEncounter({generated:{threatCategory:'monster'}}).type,'Monster');assert.equal(normalizeEncounter({type:'Humanoid',generated:{threatCategory:'monster'}}).type,'Humanoid');assert.equal(normalizeEncounter({status:'defeated'}).status,'Defeated');
});
test('Scrap accepts plain text, world/compendium Items and explicit quantities without inventing UUIDs',async()=>{
  const f=fixture();f.table('scrap',[{description:'Copper wire'}]);let entry=await generateEntry('loot',{},f);assert.equal(entry.uuid,'');assert.equal(entry.quantity,1);assert.equal(entry.type,'scrap');
  f.table('scrap',[{description:'Copper wire, Quantity:3'}]);entry=await generateEntry('loot',{},f);assert.equal(entry.title,'Copper wire');assert.equal(entry.quantity,3);
  for(const uuid of ['Item.a','Compendium.myz.items.Item.a']){const item=f.document('Item',uuid,'Scrap Rifle');item.type='weapon';f.table('scrap',[{documentUuid:uuid,flags:{'myz-sector-manager':{randomization:{quantity:4}}}}]);entry=await generateEntry('loot',{},f);assert.equal(entry.uuid,uuid);assert.equal(entry.quantity,4);assert.equal(entry.type,'weapon');}
});
test('Effects and History resolve actual Journals; Ark coordinates determine event table selection',async()=>{
  for(const uuid of ['JournalEntry.event','Compendium.myz.journals.JournalEntry.event']){
    const f=fixture();f.document('JournalEntry',uuid,'Event title');for(const key of ['phenomenon','zone','ark'])f.table(key,[{documentUuid:uuid}]);
    const effect=await generateEntry('effects',{},f);assert.equal(effect.category,'Phenomenon');assert.equal(effect.title,'Event title');assert.equal(effect.uuid,uuid);
    await generateEntry('history',{code:'b-07'},{...f,event:true,arkCoordinate:'B7'});assert.equal(f.calls.at(-1),'ark');
    await generateEntry('history',{code:'B7'},{...f,event:true,arkCoordinate:'A1'});assert.equal(f.calls.at(-1),'zone');
    await generateEntry('history',{code:'B7'},{...f,event:true});assert.equal(f.calls.at(-1),'zone');
    assert.equal((await generateEntry('history',{},f)).title,'');
  }
});
test('Locations share explicit eligibility and normal/industrial mapping; unknown/missing/no-ruin terrain creates an empty entry',async()=>{
  const f=fixture();f.document('JournalEntry','JournalEntry.ruin','Ruin');for(const key of ['ruinsA','ruinsB'])f.table(key,[{documentUuid:'JournalEntry.ruin'}]);
  for(const [terrain,expected] of [['Overgrown Ruins','ruinsA'],['Crumbling Ruins','ruinsA'],['Decayed Ruins','ruinsA'],['Unscathed Ruins','ruinsA'],['Derelict Industries','ruinsB'],['Custom Site, Ruin:Yes','ruinsA']]){const result=await generateEntry('locations',{terrain},f);assert.equal(result.uuid,'JournalEntry.ruin');assert.equal(f.calls.at(-1),expected);}
  const count=f.calls.length;for(const terrain of ['',undefined,'Thick Woods','Custom Site','Overgrown Ruins, Ruin:No'])assert.equal((await generateEntry('locations',{terrain},f)).title,'');assert.equal(f.calls.length,count);
  assert.equal(locationRuinKind({terrain:'Custom Site',randomization:{environment:{name:'Custom Site',ruins:'industrial',threats:true,artifacts:false}}}),'industrial');assert.equal(locationRuinKind({terrain:'Thick Woods',randomization:{environment:{name:'Overgrown Ruins',ruins:'normal'}}}),null);
});
test('missing, wrong-type, inaccessible and ambiguous final documents fail without modifying sector input',async()=>{
  const sector={terrain:'Overgrown Ruins',effects:[{title:'Keep'}]},before=structuredClone(sector);const f=fixture();f.table('phenomenon',[{documentUuid:'JournalEntry.missing'}]);await assert.rejects(generateEntry('effects',sector,f),/missing/i);assert.deepEqual(sector,before);
  f.document('Actor','Actor.a','Wrong');f.table('phenomenon',[{documentUuid:'Actor.a'}]);await assert.rejects(generateEntry('effects',sector,f),/JournalEntry/);
  f.table('phenomenon',[{description:'Duplicate'}]);f.env.game.journal=[{name:'Duplicate',uuid:'JournalEntry.a'},{name:'Duplicate',uuid:'JournalEntry.b'}];await assert.rejects(generateEntry('effects',sector,f),/missing document metadata/);
  f.env.game.user.isGM=false;await assert.rejects(generateEntry('effects',sector,f),/GM access/);
});
test('artifact D666 exclusion covers all 643–666 values, rerolls normally and never interprets names',async()=>{
  for(let value=643;value<=666;value++){
    const f=fixture(),table=f.table('artifact',index=>({roll:{total:index?642:value},results:[{range:index?[641,642]:[value,value],description:'Artifact 666'}]}));
    const result=await rollArtifact(table,f.env);assert.equal(result.text,'Artifact 666');assert.equal(f.calls.length,2);
  }
  assert.equal(artifactAllowed({results:[{range:[641,645]}],roll:{total:642}}),true);assert.equal(artifactAllowed({results:[{range:[641,645]}],roll:{total:643}}),false);
  assert.throws(()=>artifactAllowed({results:[{range:[641,645]}]}),/actual D666 roll/);assert.throws(()=>artifactAllowed({results:[{description:'Artifact 111'}]}),/Cannot determine/);assert.throws(()=>artifactAllowed({results:[{range:[111,642]}],roll:{total:643}}),/does not match/);assert.throws(()=>artifactAllowed({results:[{range:[1,216]}],roll:{total:143}}),/not a D666/);
});
test('artifact exclusion is bounded and rejects before resolving a broken excluded reference',async()=>{
  const f=fixture(),table=f.table('artifact',[{range:[643,666],documentUuid:'Item.missing'}]);await assert.rejects(rollArtifact(table,f.env),/30 attempts/);assert.equal(f.calls.length,30);
});
test('a pre-recursed Monster leaf numbered six is not mistaken for the top-level Phenomena result',async()=>{
  const f=fixture();f.document('Actor','Actor.monster','Monster');f.table('threatType',{roll:{total:6},results:[{range:[6,6],documentUuid:'Actor.monster',parent:{uuid:TABLE_UUIDS.monster,documentName:'RollTable'}}]});
  assert.equal((await generateEntry('encounters',{},f)).type,'Monster');assert.deepEqual(f.calls,['threatType']);
});
test('Scrap preserves supported structured fields and rejects malformed quantity/mapping data',async()=>{
  const f=fixture();f.table('scrap',[{description:'Base',flags:{'myz-sector-manager':{randomization:{loot:{title:'Structured name',quantity:2,type:'gear',details:'Useful details'}}}}}]);const entry=await generateEntry('loot',{},f);assert.equal(entry.title,'Structured name');assert.equal(entry.quantity,2);assert.equal(entry.type,'gear');assert.equal(entry.details,'Useful details');
  for(const mapping of [{quantity:'bad'},{loot:{details:{invalid:true}}},{loot:'invalid'}]){f.table('scrap',[{description:'Base',flags:{'myz-sector-manager':{randomization:mapping}}}]);await assert.rejects(generateEntry('loot',{},f),/Scrap/);}
});
test('world and compendium pages preserve exact UUIDs and page names across all journal generation actions',async()=>{
  for(const prefix of ['JournalEntry.parent','Compendium.myz.journals.JournalEntry.parent'])for(const name of ['MAGNETIC FIELD','ACID RAIN','A HARD CHOICE']){
    const f=fixture(),uuid=prefix+'.JournalEntryPage.page';f.document('JournalEntryPage',uuid,name);
    for(const key of ['phenomenon','zone','ark','ruinsA','encounter'])f.table(key,[{documentUuid:uuid,description:'Different table label'}]);
    f.table('threatType',[{documentUuid:TABLE_UUIDS.encounter}]);
    for(const [kind,options] of [['effects',{}],['history',{event:true}],['history',{event:true,arkCoordinate:'A1'}],['locations',{}],['encounters',{}]]){
      const result=await generateEntry(kind,{code:'A1',terrain:'Overgrown Ruins'},{...f,...options});
      assert.equal(result.title,name);assert.equal(result.uuid,uuid);assert.equal(structuredClone(result).uuid,uuid);assert.equal(result.status,'Active');
      if(kind==='effects'){assert.equal(result.category,'Phenomenon');assert.equal(result.duration,'');}
    }
  }
});
test('native TableResult getDocument resolves embedded page metadata without guessing a parent UUID',async()=>{
  const f=fixture(),uuid='JournalEntry.parent.JournalEntryPage.page',doc=f.document('JournalEntryPage',uuid,'MAGNETIC FIELD');
  f.table('phenomenon',[{documentCollection:'JournalEntryPage',documentId:'page',getDocument:async()=>doc}]);
  assert.equal((await generateEntry('effects',{},f)).uuid,uuid);
});
test('plain text journal generation fails clearly without guessing matching names',async()=>{
  const f=fixture();f.env.console={warn:()=>{}};f.env.game.journal=[{name:'ACID RAIN',uuid:'JournalEntry.wrong'}];f.table('phenomenon',[{description:'ACID RAIN'}]);
  await assert.rejects(generateEntry('effects',{},f),/missing document metadata/);
});
