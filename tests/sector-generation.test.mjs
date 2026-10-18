import {normalizeLoot} from '../scripts/loot.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateSector,TABLE_UUIDS,ENVIRONMENTS,resolveTables,rollTable,rollBasePool,mapRot,mapThreatLevel,mapThreatType,mapEnvironment,saveGeneratedSector} from '../scripts/sector-randomizer.mjs';
import {tabHasContent} from '../scripts/sector-content.mjs';
function fixture(overrides={},dice={},faces=[1,6]){
  const texts={environment:'<b>Overgrown Ruins</b>',ruinsA:'Hospital',ruinsB:'Factory',rot:'2 — Rot-Heavy Area',threatLevel:'2',threatType:'Humanoid',humanoid:'Zone Ghouls',encounter:'Wanderers',monster:'Devourer',phenomenon:'Acid Rain',artifact:'Ancient Rifle',mood:'A distant howl',scrap:'Copper wire',...overrides};
  const calls=[],pools=[];
  const tables=new Map(Object.entries(TABLE_UUIDS).map(([key,uuid])=>[uuid,{uuid,name:key,documentName:'RollTable',async roll(options){assert.deepEqual(options,{recursive:false});calls.push(key);return {results:[{id:key,range:key==='artifact'?[111,111]:undefined,description:texts[key]}]};}}]));
  const env={game:{user:{isGM:true}},fromUuid:async uuid=>tables.get(uuid)};
  const queues=Object.fromEntries(Object.entries(dice).map(([key,value])=>[key,[...value]]));
  const roll=async formula=>queues[formula]?.length?queues[formula].shift():1;
  const rollBaseDice=async level=>{pools.push(level);return [...faces];};
  const existing={version:1,code:'A7',notes:'Keep manual notes',description:'Handwritten',supplies:{cleanGrub:{quantity:9,collected:true}},pathStunts:{artifact:true},locations:[{title:'Manual location'},{title:'Old generated',generated:{method:'core'}}],encounters:[],effects:[],loot:[{title:'Manual treasure'}],secrets:[{title:'Secret'}],custom:{keep:true}};
  return {env,tables,existing,options:{env,roll,rollBaseDice},calls,pools,queues};
}
test('all supplied UUIDs must resolve before rolling, with clear errors for each missing table and denied GM access',async()=>{
  for(const [key,uuid] of Object.entries(TABLE_UUIDS)){
    const f=fixture();f.tables.delete(uuid);for(const table of f.tables.values())table.roll=()=>assert.fail('must validate first');
    await assert.rejects(generateSector(f.existing,f.options),error=>error.message.includes(key)&&error.message.includes(uuid));
  }
  const f=fixture();f.env.game.user.isGM=false;await assert.rejects(resolveTables(f.env),/Only a GM/);
});
test('core pool preserves manual data, replaces generated entries, and routes artifacts, mood, threats and resources',async()=>{
  const f=fixture(),before=structuredClone(f.existing);const output=await generateSector(f.existing,f.options);
  assert.deepEqual(f.existing,before);assert.equal(output.terrain,'Overgrown Ruins');assert.equal(output.rot,2);assert.equal(output.mood,'A distant howl');assert.equal(output.locations[0].title,'Manual location');assert.equal(output.locations[1].title,'Hospital');assert.equal(output.encounters[0].title,'Zone Ghouls');assert.equal(output.loot[0].title,'Manual treasure');
  assert.deepEqual(output.loot.slice(1).map(entry=>entry.title),['Ancient Rifle','Copper wire']);assert.equal(output.supplies.cleanGrub.quantity,1);assert.equal(output.supplies.rotGrub.quantity,0);assert.equal(output.randomization.threatLevel,'fringe');assert.equal(output.threatLevel,2);assert.equal(output.notes,'Keep manual notes');assert.equal(output.supplies.cleanGrub.collected,true);assert.deepEqual(output.custom,before.custom);assert.deepEqual(output.pathStunts,before.pathStunts);assert.equal(output.locations[1].generated.sources[0].tableUuid,TABLE_UUIDS.ruinsA);assert.deepEqual(f.pools,[2]);
});
test('all p.156 environments use independent eligibility columns; Settlement requires GM-authored details',async()=>{
  assert.equal(Object.keys(ENVIRONMENTS).length,13);
  for(const [environment,expected] of Object.entries(ENVIRONMENTS)){
    const f=fixture({environment});
    if(expected.manual){await assert.rejects(generateSector(f.existing,f.options),/Settlement requires GM-authored/);assert.equal(f.pools.length,0);continue;}
    const output=await generateSector(f.existing,f.options);
    assert.equal(output.randomization.environment.threats,expected.threats);assert.equal(output.randomization.artifactCount,expected.artifacts?1:0);
    assert.equal(output.locations.length,expected.ruins?2:1);if(expected.ruins)assert.equal(output.locations[1].title,expected.ruins==='normal'?'Hospital':'Factory');
    assert.equal(f.calls.filter(key=>key==='ruinsA').length,expected.ruins==='normal'?1:0);assert.equal(f.calls.filter(key=>key==='ruinsB').length,expected.ruins==='industrial'?1:0);
  }
});
test('explicit environment columns take precedence and rich table cells retain boundaries',async()=>{
  assert.deepEqual(mapEnvironment({text:'11–12 Thick Woods No Yes No',mapping:{}}),{name:'Thick Woods',ruins:null,threats:true,artifacts:false});
  const f=fixture({environment:'<table><tr><td>Overgrown Ruins</td><td>Yes</td><td>Yes</td><td>Yes</td></tr></table>'});
  assert.equal((await generateSector(f.existing,f.options)).terrain,'Overgrown Ruins');
  assert.throws(()=>mapEnvironment({text:'Unknown ground',mapping:{}}));
  assert.equal(mapEnvironment({text:'Thick Woods No Yes Yes',mapping:{}}).artifacts,true);
  assert.equal(mapEnvironment({text:'Overgrown Ruins No Yes Yes',mapping:{}}).ruins,null);
  assert.equal(mapEnvironment({text:'Thick Woods',mapping:{environment:{ruins:null,threats:true,artifacts:true}}}).artifacts,true);
});
test('one Base Dice pool supplies both counts; every eligible six creates an independent artifact',async()=>{
  const f=fixture({threatLevel:'6'}, {},[1,1,6,6,6,3]);let artifacts=0;f.tables.get(TABLE_UUIDS.artifact).roll=async()=>({results:[{range:[111,111],description:`Artifact ${++artifacts}`}]});
  const output=await generateSector(f.existing,f.options);assert.deepEqual(f.pools,[6]);assert.equal(artifacts,3);assert.equal(output.randomization.threatSeverity,2);assert.equal(output.randomization.threatCount,1);assert.equal(output.encounters.length,1);assert.equal(output.encounters[0].generated.threatSeverity,2);assert.equal(output.randomization.artifactCount,3);assert.deepEqual(output.randomization.baseDice,[1,1,6,6,6,3]);assert.match(output.encounters[0].details,/2 Base Dice showing 1/);
});
test('Thick Woods permits threats but suppresses artifacts; custom independent flags suppress threats despite ones',async()=>{
  const woods=fixture({environment:'Thick Woods'}, {},[1,6]);const output=await generateSector(woods.existing,woods.options);assert.equal(output.encounters.length,1);assert.equal(output.randomization.artifactCount,0);assert(!woods.calls.includes('artifact'));
  const custom=fixture();custom.tables.get(TABLE_UUIDS.environment).roll=async()=>({results:[{description:'Custom enclave',flags:{'myz-sector-manager':{randomization:{environment:{ruins:null,threats:false,artifacts:true}}}}}]});
  const quiet=await generateSector(custom.existing,custom.options);assert.equal(quiet.randomization.rolledOnes,1);assert.equal(quiet.randomization.threatSeverity,0);assert.equal(quiet.encounters.length,0);assert.equal(quiet.randomization.artifactCount,1);
});
test('no relevant symbols, ineligible sixes, and numeric level zero generate neither corresponding threats nor artifacts',async()=>{
  const f=fixture({}, {},[2,4]);const output=await generateSector(f.existing,f.options);assert.equal(output.encounters.length,0);assert.equal(output.randomization.artifactCount,0);assert(!f.calls.includes('threatType'));assert(!f.calls.includes('artifact'));
  const empty=fixture({threatLevel:'0'}, {},[]);const zero=await generateSector(empty.existing,empty.options);assert.deepEqual(empty.pools,[]);assert.equal(zero.threatLevel,0);assert.deepEqual(zero.randomization.baseDice,[]);
});
test('category-only tables select Fringe uniformly in 1–4 and Central in 5–8; 9+ uses configurable default9',async()=>{
  for(const [text,key,die,expected] of [['1–4 Fringe Zone Sectors','fringe',4,4],['Central Zone','central',3,7],['9+ Unusually Dangerous Areas','dangerous',1,9]]){
    const f=fixture({threatLevel:text},{'1d4':[die]},Array(expected).fill(2));const output=await generateSector(f.existing,f.options);assert.equal(output.randomization.threatLevel,key);assert.equal(output.threatLevel,expected);
  }
  const danger=fixture({threatLevel:'Unusually Dangerous'},{},Array(12).fill(2));danger.options.options={dangerousLevel:12};assert.equal((await generateSector(danger.existing,danger.options)).threatLevel,12);
  const exact=fixture({threatLevel:'Threat Level: 10'},{},Array(10).fill(2));assert.equal((await generateSector(exact.existing,exact.options)).threatLevel,10);
  assert.deepEqual(mapThreatLevel({text:'Translated',mapping:{threatLevel:7}}),{category:'central',level:7});
});
test('one, two and three identities occur only with explicit 1d3 house rule; severity remains the original ones count',async()=>{
  for(const count of [1,2,3]){
    const f=fixture({threatLevel:'3'}, {'1d3':[count]},[1,1,6]);f.options.options={threatMode:'individual-d3'};let i=0;
    f.tables.get(TABLE_UUIDS.threatType).roll=async()=>({results:[{description:['Humanoid','Monster','Phenomena'][i++]}]});
    const output=await generateSector(f.existing,f.options);assert.equal(output.encounters.length+output.effects.length,count);assert.equal(output.randomization.threatSeverity,2);assert.equal(output.randomization.threatMode,'individual-d3');assert.equal(i,count);if(count===3){assert.equal(output.effects[0].category,'Phenomenon');assert.equal(output.effects[0].title,'Acid Rain');}
  }
});
test('default Base Dice API evaluates Nd6 once and retains individual active faces',async()=>{
  const formulas=[];const env={Roll:class{constructor(formula){formulas.push(formula);}async evaluate(){return {dice:[{results:[{result:1,active:true},{result:6,active:true},{result:5,active:false}]}]};}}};
  assert.deepEqual(await rollBasePool(2,env),[1,6]);assert.deepEqual(formulas,['2d6']);assert.deepEqual(await rollBasePool(0,env),[]);assert.equal(formulas.length,1);
});
test('consumable quantities use existing fields, classifications are exclusive, and scrap remains a loot entry',async()=>{
  const f=fixture({environment:'Thick Woods'},{'1d10000':[1,9000,1,9000,1,1,1,1],'1d6':[2,3,4,5],'1d3':[2,3]});
  const output=await generateSector(f.existing,f.options);
  assert.equal(output.supplies.rotGrub.quantity,2);assert.equal(output.supplies.cleanGrub.quantity,0);assert.equal(output.supplies.rotWater.quantity,3);assert.equal(output.supplies.cleanWater.quantity,0);assert.equal(output.supplies.bullets.quantity,4);assert.equal(output.supplies.booze.quantity,2);assert.equal(output.supplies.components.quantity,3);
  assert.deepEqual(output.loot.map(entry=>entry.title),['Manual treasure','Copper wire']);assert.equal(output.loot[1].quantity,5);
  const empty=fixture({}, {'1d10000':Array(6).fill(10000)},[3,4]);const none=await generateSector(empty.existing,empty.options);assert.deepEqual(none.loot,[normalizeLoot({title:'Manual treasure'})]);assert(Object.values(none.supplies).every(entry=>entry.quantity===0));
});
test('Booze and Components independently use 25 percent thresholds, including simultaneous presence',async()=>{
  for(const [booze,components] of [[1,1],[2500,2501],[2501,2500],[10000,10000]]){
    const f=fixture({}, {'1d10000':[10000,10000,10000,booze,components,10000],'1d3':[3,3]},[2,3]);
    const output=await generateSector(f.existing,f.options);assert.equal(output.supplies.booze.quantity,booze<=2500?3:0);assert.equal(output.supplies.components.quantity,components<=2500?3:0);assert.deepEqual(output.loot,[normalizeLoot({title:'Manual treasure'})]);
  }
});
test('repeat generation resets quantities without duplicating loot or deleting manual/historical resources',async()=>{
  const f=fixture();f.existing.loot.push({title:'COMPONENTS',quantity:9},{title:'COMPONENTS',quantity:2,generated:{method:'core'}},{title:'Clean Grub',quantity:4,resource:'grub',generated:{method:'core'}});
  const first=await generateSector(f.existing,f.options);const second=await generateSector(first,f.options);assert.deepEqual(second.loot,first.loot);assert.deepEqual(second.supplies,first.supplies);
  const zero=fixture({}, {'1d10000':Array(6).fill(10000)},[2,3]);const third=await generateSector(second,zero.options);assert(Object.values(third.supplies).every(entry=>entry.quantity===0));assert.equal(third.supplies.cleanGrub.collected,true);assert(third.loot.some(entry=>entry.title==='COMPONENTS'&&entry.quantity===9));assert(third.loot.some(entry=>entry.resource==='grub'&&entry.quantity===4));assert(third.loot.some(entry=>entry.title==='COMPONENTS'&&entry.generated?.method==='core'));
});
test('only Components can populate Loot and its value persists through a sector save/reload',async()=>{
  const f=fixture({environment:'Thick Woods'}, {'1d10000':[10000,10000,10000,10000,1,10000],'1d3':[2]},[3,4]);f.existing.loot=[];
  const output=await generateSector(f.existing,f.options);assert.deepEqual(output.loot,[]);assert.equal(output.supplies.components.quantity,2);assert(tabHasContent(output,'Loot'));
  let stored=structuredClone(f.existing);const journal={getFlag:()=>stored,update:async changes=>{stored=structuredClone(changes['flags.myz-sector-manager.sector']);},setFlag:async(mod,key,value)=>{stored=structuredClone(value);}};await saveGeneratedSector(journal,f.existing,output,f.env);assert.equal(journal.getFlag().supplies.components.quantity,2);
  assert.equal(tabHasContent({...output,supplies:Object.fromEntries(Object.keys(output.supplies).map(key=>[key,{quantity:0,collected:false}]))},'Loot'),false);
});
test('unusable results, contradictory environment data, invalid pools and options abort without modifying source data',async()=>{
  for(const overrides of [{environment:'Anything goes'},{rot:'Unknown'},{threatType:'Something else'},{mood:''},{threatLevel:'Unknown'},{threatLevel:'Fringe and Central'}]){
    const f=fixture(overrides),before=structuredClone(f.existing);await assert.rejects(generateSector(f.existing,f.options));assert.deepEqual(f.existing,before);
  }
  for(const faces of [[1], [1,7], [1,NaN]]){const f=fixture({}, {},faces);await assert.rejects(generateSector(f.existing,f.options),/Base Dice pool/);}
  const f=fixture();f.options.options={dangerousLevel:8};await assert.rejects(generateSector(f.existing,f.options),/at least 9/);
  assert.equal(mapRot({text:'0 — Rot Oasis',mapping:{}}),0);assert.equal(mapRot({text:'Weak Rot',mapping:{}}),1);assert.equal(mapRot({text:'Rot Hotspot',mapping:{}}),3);assert.equal(mapThreatType({text:'Localized entry',mapping:{threatType:'monster'}}),'monster');
});
test('document and nested table results preserve references and provenance; missing refs and cycles fail',async()=>{
  const f=fixture();const item={uuid:'Item.rifle',name:'Rifle',documentName:'Item'};f.tables.set(item.uuid,item);const table=f.tables.get(TABLE_UUIDS.artifact);table.roll=async()=>({results:[{range:[111,111],documentUuid:item.uuid}]});assert.equal((await generateSector(f.existing,f.options)).loot[1].uuid,item.uuid);
  const inner=f.tables.get(TABLE_UUIDS.ruinsA);table.roll=async()=>({results:[{documentUuid:inner.uuid}]});const nested=await rollTable(table,f.env);assert.equal(nested.text,'Hospital');assert.equal(nested.sources.length,2);
  inner.roll=async()=>({results:[{documentUuid:table.uuid}]});await assert.rejects(rollTable(table,f.env),/cycle/);table.roll=async()=>({results:[{documentUuid:'Item.missing'}]});await assert.rejects(rollTable(table,f.env),/missing/);
});
test('single flag write persists generation, preserves unrelated fields, and rejects stale sectors or players',async()=>{
  const f=fixture(),output=await generateSector(f.existing,f.options);let stored=structuredClone(f.existing),writes=0;const journal={getFlag:()=>stored,update:async changes=>{writes++;stored=structuredClone(changes['flags.myz-sector-manager.sector']);},setFlag:async(mod,key,value)=>{writes++;stored=structuredClone(value);}};
  await saveGeneratedSector(journal,f.existing,output,f.env);assert.equal(writes,1);assert.deepEqual(stored,{nameOverride:false,customName:'',...output});assert.deepEqual(stored.randomization.baseDice,[1,6]);await assert.rejects(saveGeneratedSector(journal,f.existing,output,f.env),/changed/);assert.equal(writes,1);f.env.game.user.isGM=false;await assert.rejects(saveGeneratedSector(journal,stored,output,f.env),/Only a GM/);
});
test('empty tab detection ignores defaults and placeholders and recognizes meaningful content',()=>{
  const empty={version:1,code:'A1',rot:0,status:'Unexplored',terrain:' ',encounters:[{title:'',status:'Active'}],effects:[{category:'Weather'}],loot:[],supplies:{bullets:{quantity:0,collected:false}}};
  for(const tab of ['Overview','Locations','Encounters','Effects','Loot','Secrets','History','Find the Path'])assert.equal(tabHasContent(empty,tab),false,tab);
  assert(tabHasContent({...empty,terrain:'Forest'},'Overview'));assert(tabHasContent({...empty,rot:2},'Overview'));assert(tabHasContent({...empty,loot:[{uuid:'Item.one'}]},'Loot'));assert(tabHasContent({...empty,supplies:{bullets:{quantity:2}}},'Loot'));assert(tabHasContent({...empty,effects:[{details:'Fog'}]},'Effects'));assert(tabHasContent({...empty,pathStunts:{artifact:true}},'Find the Path'));
});
test('inline UUIDs and legacy table document references keep Item links',async()=>{
  const f=fixture();const item={uuid:'Item.rifle',name:'Rifle',documentName:'Item'};f.tables.set(item.uuid,item);const table=f.tables.get(TABLE_UUIDS.artifact);
  table.roll=async()=>({results:[{description:'@UUID[Item.rifle]{Old Rifle}'}]});let result=await rollTable(table,f.env);assert.equal(result.text,'Old Rifle');assert.equal(result.uuid,item.uuid);table.roll=async()=>({results:[{text:'Old table text',documentCollection:'Item',documentId:'rifle'}]});result=await rollTable(table,f.env);assert.equal(result.uuid,item.uuid);
});
test('rename and generated data commit in a single update without temporary journalName',async()=>{
  const f=fixture(),next=await generateSector(f.existing,f.options);next.journalName='A new name';next.nameOverride=false;let stored=f.existing,updates=0;const journal={name:'Old name',getFlag:()=>stored,setFlag:()=>assert.fail('must use one update'),update:async changes=>{updates++;assert.equal(changes.name,'A7 - Overgrown Ruins');stored=changes['flags.myz-sector-manager.sector'];}};
  await saveGeneratedSector(journal,f.existing,next,f.env);assert.equal(updates,1);assert.equal(stored.journalName,undefined);
});

test('exact Foundry Environment strings parse names and independent labeled eligibility',async()=>{
  for(const [text,name,expected] of [
    ['Thick Woods, Ruin:No, Threat:Yes, Artifact:No','Thick Woods',{ruins:null,threats:true,artifacts:false}],
    ['Unscathed Ruins, Ruin:Yes, Threat:Yes, Artifact:Yes','Unscathed Ruins',{ruins:'normal',threats:true,artifacts:true}]
  ]){
    assert.deepEqual(mapEnvironment({text,mapping:{}}),{name,...expected});
    const f=fixture({environment:text});const output=await generateSector(f.existing,f.options);
    assert.equal(output.terrain,name);assert.equal(output.randomization.artifactCount,expected.artifacts?1:0);assert.equal(output.locations.length,expected.ruins?2:1);
  }
});
test('all eight flag combinations govern generation without name-based overrides',async()=>{
  for(const ruin of [false,true])for(const threats of [false,true])for(const artifacts of [false,true]){
    const text=`Unscathed Ruins, Ruin:${ruin?'Yes':'No'}, Threat:${threats?'Yes':'No'}, Artifact:${artifacts?'Yes':'No'}`;
    const f=fixture({environment:text});const output=await generateSector(f.existing,f.options);
    assert.equal(output.terrain,'Unscathed Ruins');assert.equal(output.locations.length,ruin?2:1);assert.equal(output.encounters.length,threats?1:0);assert.equal(output.randomization.artifactCount,artifacts?1:0);
  }
  const woods=fixture({environment:'Thick Woods, Ruin:Yes, Threat:No, Artifact:Yes'});const output=await generateSector(woods.existing,woods.options);assert.equal(output.locations[1].title,'Hospital');assert.equal(output.encounters.length,0);assert.equal(output.randomization.artifactCount,1);
  const industry=mapEnvironment({text:'Derelict Industries, Ruin:Yes, Threat:No, Artifact:No',mapping:{}});assert.equal(industry.ruins,'industrial');
});
test('combined environment results tolerate whitespace, case, reordered labels and custom environment names',()=>{
  assert.deepEqual(mapEnvironment({text:'  Unscathed Ruins ,  aRTifact : yES ,RUIN: nO, Threat : YeS  ',mapping:{}}),{name:'Unscathed Ruins',ruins:null,threats:true,artifacts:true});
  assert.deepEqual(mapEnvironment({text:'Homebrew Grove,Ruin:NO,Threat:no,Artifact:NO',mapping:{}}),{name:'Homebrew Grove',ruins:null,threats:false,artifacts:false});
  assert.equal(mapEnvironment({text:'thick woods',mapping:{}}).name,'Thick Woods');
});
test('malformed combined environment strings fail before dice, with source data unchanged',async()=>{
  for(const text of [
    ', Ruin:Yes, Threat:Yes, Artifact:Yes','Unscathed Ruins, Ruin:Yes, Threat:Yes',
    'Unscathed Ruins, Ruin:Maybe, Threat:Yes, Artifact:Yes','Unscathed Ruins, Ruin:, Threat:Yes, Artifact:Yes',
    'Unscathed Ruins, Ruin:Yes, Threat:Yes, Artifact:Yes,','Unscathed Ruins, Ruin:Yes, Ruin:No, Threat:Yes, Artifact:Yes',
    'Unscathed Ruins, Ruin:Yes, Threat:Yes, Artifcat:Yes','Unscathed Ruins, Yes, Yes, Yes',
    'Unscathed Ruins, Ruin:Yes, Threat:1, Artifact:No','Ruin:Yes, Threat:Yes, Artifact:Yes'
  ]){
    const f=fixture({environment:text}),before=structuredClone(f.existing);await assert.rejects(generateSector(f.existing,f.options),/Malformed Environment/);assert.deepEqual(f.existing,before);assert.equal(f.pools.length,0);assert.deepEqual(f.calls,['environment']);
  }
});
test('classification tables support compound text and preserve raw details; malformed labels fail clearly',()=>{
  assert.equal(mapRot({text:'Weak Rot, Rot Level:1, Exposure:1 Rot Point per day',mapping:{}}),1);
  assert.deepEqual(mapThreatLevel({text:'Central Zone, Threat Level:7',mapping:{}}),{category:'central',level:7});
  assert.equal(mapThreatType({text:'Monster, Threat Type:Monster, Description:Hostile beast',mapping:{}}),'monster');
  assert.equal(mapThreatType({text:'Threat Type:Phenomenon, Description:Hazard',mapping:{}}),'phenomenon');
  for(const [parser,text] of [[mapRot,'Weak Rot, Rot Level:1, Rot Level:2'],[mapThreatLevel,'Central Zone, Level:7, Threat Level:2'],[mapThreatType,'Monster, Threat Type:Unknown']])assert.throws(()=>parser({text,mapping:{}}));
});

test('grub and water each use a single 50 percent presence roll and a single 25/75 classification roll',async()=>{
  for(const resource of ['Grub','Water'])for(const [presence,classification] of [[5000,2500],[5000,2501],[5001,1]]){
    const present=presence<=5000;
    const categoryRolls=present?[presence,classification]:[presence];
    const rolls=resource==='Grub'?[...categoryRolls,10000,10000,10000,10000,10000]:[10000,...categoryRolls,10000,10000,10000,10000];
    const f=fixture({}, {'1d10000':rolls,'1d6':[6]},[2,3]);const output=await generateSector(f.existing,f.options);
    assert.equal(output.supplies['clean'+resource].quantity,present&&classification<=2500?6:0);assert.equal(output.supplies['rot'+resource].quantity,present&&classification>2500?6:0);
  }
});

test('both ruin categories persist Journal/Page references and unresolved ruins save with a nonblocking warning',async()=>{
  for(const [environment,key,uuid,type] of [['Overgrown Ruins','ruinsA','JournalEntry.hospital','JournalEntry'],['Derelict Industries','ruinsB','Compendium.myz.ruins.JournalEntry.a.JournalEntryPage.p','JournalEntryPage']]){
    const f=fixture({environment});f.tables.set(uuid,{uuid,name:'Ruin Journal',documentName:type});f.tables.get(TABLE_UUIDS[key]).roll=async()=>({results:[{documentUuid:uuid,description:'Ruin title'}]});
    const next=await generateSector(f.existing,f.options);const entry=next.locations.find(entry=>entry.generated);assert.equal(entry.uuid,uuid);assert.equal(entry.title,type==='JournalEntryPage'?'Ruin Journal':'Ruin title');
    let stored=f.existing;await saveGeneratedSector({getFlag:()=>stored,update:async changes=>{stored=structuredClone(changes['flags.myz-sector-manager.sector']);},setFlag:async(mod,key,value)=>{stored=structuredClone(value);}},f.existing,next,f.env);assert.equal(stored.locations.find(entry=>entry.generated).uuid,uuid);
  }
  const f=fixture();f.tables.get(TABLE_UUIDS.ruinsA).roll=async()=>({results:[{documentUuid:'JournalEntry.deleted',description:'Hospital'}]});const before=structuredClone(f.existing);await assert.rejects(generateSector(f.existing,f.options),/missing or unavailable/);assert.deepEqual(f.existing,before);
});

test('Core and house modes share severity and artifact counts; neither bypasses threat eligibility or absent ones',async()=>{
  for(const environment of ['Overgrown Ruins, Ruin:No, Threat:Yes, Artifact:Yes','Overgrown Ruins, Ruin:No, Threat:No, Artifact:Yes'])for(const faces of [[1,6],[2,6]]){
    const results=[];
    for(const mode of ['core','individual-d3']){
      const f=fixture({environment},{'1d3':[3]},faces);f.options.options={threatMode:mode};const result=await generateSector(f.existing,f.options);results.push(result);
      const eligible=environment.includes('Threat:Yes')&&faces.includes(1);assert.equal(result.randomization.threatCount,eligible?(mode==='core'?1:3):0);assert.equal(result.randomization.threatSeverity,eligible?1:0);assert.equal(f.calls.filter(key=>key==='threatType').length,eligible?(mode==='core'?1:3):0);
    }
    assert.equal(results[0].randomization.artifactCount,results[1].randomization.artifactCount);assert.deepEqual(results[0].loot.filter(entry=>entry.title==='Ancient Rifle'),results[1].loot.filter(entry=>entry.title==='Ancient Rifle'));
  }
});

test('a Core identity roll cannot silently create multiple final threats',async()=>{
  const f=fixture();f.tables.get(TABLE_UUIDS.humanoid).roll=async()=>({results:[{description:'One'},{description:'Two'}]});const before=structuredClone(f.existing);await assert.rejects(generateSector(f.existing,f.options),/exactly one threat result/);assert.deepEqual(f.existing,before);
});

test('randomization and atomic persistence preserve custom names and travel planning states',async()=>{
  const f=fixture();f.existing.nameOverride=true;f.existing.customName='The Last Tower';f.existing.travel={mode:'vehicle',night:true};
  const next=await generateSector(f.existing,f.options);let stored;const journal={name:'The Last Tower',getFlag:()=>f.existing,setFlag:async(m,k,value)=>{stored=value;},update:()=>assert.fail('custom title must not be replaced')};
  await saveGeneratedSector(journal,f.existing,next,f.env);assert.equal(stored.customName,'The Last Tower');assert.equal(stored.nameOverride,true);assert.deepEqual(stored.travel,f.existing.travel);
});

test('randomization preserves all nine stunts and only removes redundant travel aliases when saving',async()=>{
  const f=fixture();f.existing.pathStunts={safePath:true,artifact:true,assessRot:true,bullets:true,grub:true,water:true,halfTime:true,rush:true,saferRoute:true};f.existing.travel={mode:'vehicle',night:true,stalker:false,rushed:false,difficulty:3};
  const next=await generateSector(f.existing,f.options);assert.deepEqual(next.pathStunts,f.existing.pathStunts);let stored;
  const journal={getFlag:()=>f.existing,update:async changes=>{stored=changes['flags.myz-sector-manager.sector'];},setFlag:async(m,k,value)=>{stored=value;}};
  await saveGeneratedSector(journal,f.existing,next,f.env);assert.deepEqual(stored.pathStunts,f.existing.pathStunts);assert.deepEqual(stored.travel,{mode:'vehicle',night:true,difficulty:3});
});
test('generated Loot classifies referenced world/compendium Items, plaintext artifacts and scrap',async()=>{
  for(const type of ['armor','artifact','chassis','gear','weapon']){
    const f=fixture(),uuid=`Compendium.myz.items.Item.${type}`;f.tables.set(uuid,{uuid,name:'Reference',documentName:'Item',type:type.toUpperCase()});f.tables.get(TABLE_UUIDS.artifact).roll=async()=>({results:[{range:[111,111],documentUuid:uuid}]});
    const next=await generateSector(f.existing,f.options);const entry=next.loot.find(item=>item.uuid===uuid);assert.equal(entry.type,type);assert.equal(entry.collected,false);assert.equal(entry.quantity,1);
  }
  const f=fixture(),next=await generateSector(f.existing,f.options);assert.equal(next.loot.find(entry=>entry.title==='Ancient Rifle').type,'artifact');assert.equal(next.loot.find(entry=>entry.title==='Copper wire').type,'scrap');
});
test('direct generation persistence cannot bypass the initial-save safeguard',async()=>{
  const f=fixture();f.existing.initialSavePending=true;const journal={getFlag:()=>f.existing,setFlag:()=>assert.fail('no write'),update:()=>assert.fail('no write')};await assert.rejects(saveGeneratedSector(journal,f.existing,f.existing,f.env),/Save this sector before randomizing/);
});
test('full sector generation uses bounded artifact exclusion and preserves source data on exhaustion',async()=>{
  const f=fixture();let attempts=0;f.tables.get(TABLE_UUIDS.artifact).roll=async()=>({results:[++attempts===1?{range:[643,666],documentUuid:'Item.missingExcluded'}:{range:[111,111],description:'Allowed artifact'}]});const next=await generateSector(f.existing,f.options);assert.equal(attempts,2);assert(next.loot.some(entry=>entry.title==='Allowed artifact'));
  const before=structuredClone(f.existing);f.tables.get(TABLE_UUIDS.artifact).roll=async()=>({results:[{range:[643,666],documentUuid:'Item.missingExcluded'}]});await assert.rejects(generateSector(f.existing,f.options),/30 attempts/);assert.deepEqual(f.existing,before);
});

test('Normal randomization preserves all inactive Special content and legacy Secrets',async()=>{
  const f=fixture();f.existing.sectorType='normal';f.existing.special={sceneUuid:'Scene.missing',source:'Book',overview:'Special\n\nIntro',situation:'Keep',inhabitants:[{title:'Group'}],gear:[{title:'Weapon',quantity:2,type:'weapon'}],events:[{uuid:'JournalEntry.parent.JournalEntryPage.page'}],future:{keep:true}};f.existing.secrets=[{title:'Hidden legacy secret'}];
  const before=structuredClone(f.existing);const next=await generateSector(f.existing,f.options);assert.deepEqual(next.special,before.special);assert.deepEqual(next.secrets,before.secrets);assert.equal(next.sectorType,'normal');assert.deepEqual(f.existing,before);
});
