import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateSector,TABLE_UUIDS,ENVIRONMENTS,resolveTables,rollTable,rollBasePool,mapRot,mapThreatLevel,mapThreatType,mapEnvironment,saveGeneratedSector} from '../scripts/sector-randomizer.mjs';
import {tabHasContent} from '../scripts/sector-content.mjs';
function fixture(overrides={},dice={},faces=[1,6]){
  const texts={environment:'<b>Overgrown Ruins</b>',ruinsA:'Hospital',ruinsB:'Factory',rot:'2 — Rot-Heavy Area',threatLevel:'2',threatType:'Humanoid',humanoid:'Zone Ghouls',monster:'Devourer',phenomenon:'Acid Rain',artifact:'Ancient Rifle',mood:'A distant howl',scrap:'Copper wire',...overrides};
  const calls=[],pools=[];
  const tables=new Map(Object.entries(TABLE_UUIDS).map(([key,uuid])=>[uuid,{uuid,name:key,documentName:'RollTable',async roll(options){assert.deepEqual(options,{recursive:false});calls.push(key);return {results:[{id:key,description:texts[key]}]};}}]));
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
  assert.deepEqual(output.loot.slice(1).map(entry=>entry.title),['Ancient Rifle','Clean Grub','Clean Water','Bullets','Copper wire']);assert.equal(output.loot[2].quantity,1);assert.equal(output.loot[2].classification,'clean');assert.equal(output.randomization.threatLevel,'fringe');assert.equal(output.randomization.numericThreatLevel,2);assert.equal(output.notes,'Keep manual notes');assert.deepEqual(output.supplies,before.supplies);assert.deepEqual(output.custom,before.custom);assert.deepEqual(output.pathStunts,before.pathStunts);assert.equal(output.locations[1].generated.sources[0].tableUuid,TABLE_UUIDS.ruinsA);assert.deepEqual(f.pools,[2]);
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
  const f=fixture({threatLevel:'6'}, {},[1,1,6,6,6,3]);let artifacts=0;f.tables.get(TABLE_UUIDS.artifact).roll=async()=>({results:[{description:`Artifact ${++artifacts}`}]});
  const output=await generateSector(f.existing,f.options);assert.deepEqual(f.pools,[6]);assert.equal(artifacts,3);assert.equal(output.randomization.threatSeverity,2);assert.equal(output.randomization.threatCount,1);assert.equal(output.encounters.length,1);assert.equal(output.encounters[0].generated.threatSeverity,2);assert.equal(output.randomization.artifactCount,3);assert.deepEqual(output.randomization.baseDice,[1,1,6,6,6,3]);assert.match(output.encounters[0].details,/2 Base Dice showing 1/);
});
test('Thick Woods permits threats but suppresses artifacts; custom independent flags suppress threats despite ones',async()=>{
  const woods=fixture({environment:'Thick Woods'}, {},[1,6]);const output=await generateSector(woods.existing,woods.options);assert.equal(output.encounters.length,1);assert.equal(output.randomization.artifactCount,0);assert(!woods.calls.includes('artifact'));
  const custom=fixture();custom.tables.get(TABLE_UUIDS.environment).roll=async()=>({results:[{description:'Custom enclave',flags:{'myz-sector-manager':{randomization:{environment:{ruins:null,threats:false,artifacts:true}}}}}]});
  const quiet=await generateSector(custom.existing,custom.options);assert.equal(quiet.randomization.rolledOnes,1);assert.equal(quiet.randomization.threatSeverity,0);assert.equal(quiet.encounters.length,0);assert.equal(quiet.randomization.artifactCount,1);
});
test('no relevant symbols, ineligible sixes, and numeric level zero generate neither corresponding threats nor artifacts',async()=>{
  const f=fixture({}, {},[2,4]);const output=await generateSector(f.existing,f.options);assert.equal(output.encounters.length,0);assert.equal(output.randomization.artifactCount,0);assert(!f.calls.includes('threatType'));assert(!f.calls.includes('artifact'));
  const empty=fixture({threatLevel:'0'}, {},[]);const zero=await generateSector(empty.existing,empty.options);assert.deepEqual(empty.pools,[]);assert.equal(zero.randomization.numericThreatLevel,0);assert.deepEqual(zero.randomization.baseDice,[]);
});
test('category-only tables select Fringe uniformly in 1–4 and Central in 5–8; 9+ uses configurable default9',async()=>{
  for(const [text,key,die,expected] of [['1–4 Fringe Zone Sectors','fringe',4,4],['Central Zone','central',3,7],['9+ Unusually Dangerous Areas','dangerous',1,9]]){
    const f=fixture({threatLevel:text},{'1d4':[die]},Array(expected).fill(2));const output=await generateSector(f.existing,f.options);assert.equal(output.randomization.threatLevel,key);assert.equal(output.randomization.numericThreatLevel,expected);
  }
  const danger=fixture({threatLevel:'Unusually Dangerous'},{},Array(12).fill(2));danger.options.options={dangerousLevel:12};assert.equal((await generateSector(danger.existing,danger.options)).randomization.numericThreatLevel,12);
  const exact=fixture({threatLevel:'Threat Level: 10'},{},Array(10).fill(2));assert.equal((await generateSector(exact.existing,exact.options)).randomization.numericThreatLevel,10);
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
test('resources remain independent house-rule additions: Rot grub/water, quantities, Components and absence',async()=>{
  const f=fixture({environment:'Thick Woods'},{'1d10000':[1,9000,1,9000,1,1,9000],'1d6':[2,3,4],'1d3':[3]});
  const loot=(await generateSector(f.existing,f.options)).loot;
  assert.equal(loot.find(entry=>entry.title==='Rot Grub').quantity,2);assert.equal(loot.find(entry=>entry.title==='Rot Water').quantity,3);assert.equal(loot.find(entry=>entry.title==='Bullets').quantity,4);assert.equal(loot.find(entry=>entry.title==='COMPONENTS').quantity,3);assert.equal(loot.find(entry=>entry.title==='Rot Water').classification,'rot');
  const empty=fixture({}, {'1d10000':Array(4).fill(10000)},[3,4]);assert.deepEqual((await generateSector(empty.existing,empty.options)).loot,[{title:'Manual treasure'}]);
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
  const f=fixture();const item={uuid:'Item.rifle',name:'Rifle',documentName:'Item'};f.tables.set(item.uuid,item);const table=f.tables.get(TABLE_UUIDS.artifact);table.roll=async()=>({results:[{documentUuid:item.uuid}]});assert.equal((await generateSector(f.existing,f.options)).loot[1].uuid,item.uuid);
  const inner=f.tables.get(TABLE_UUIDS.ruinsA);table.roll=async()=>({results:[{documentUuid:inner.uuid}]});const nested=await rollTable(table,f.env);assert.equal(nested.text,'Hospital');assert.equal(nested.sources.length,2);
  inner.roll=async()=>({results:[{documentUuid:table.uuid}]});await assert.rejects(rollTable(table,f.env),/cycle/);table.roll=async()=>({results:[{documentUuid:'Item.missing'}]});await assert.rejects(rollTable(table,f.env),/missing/);
});
test('single flag write persists generation, preserves unrelated fields, and rejects stale sectors or players',async()=>{
  const f=fixture(),output=await generateSector(f.existing,f.options);let stored=structuredClone(f.existing),writes=0;const journal={getFlag:()=>stored,setFlag:async(mod,key,value)=>{writes++;stored=structuredClone(value);}};
  await saveGeneratedSector(journal,f.existing,output,f.env);assert.equal(writes,1);assert.deepEqual(stored,output);assert.deepEqual(stored.randomization.baseDice,[1,6]);await assert.rejects(saveGeneratedSector(journal,f.existing,output,f.env),/changed/);assert.equal(writes,1);f.env.game.user.isGM=false;await assert.rejects(saveGeneratedSector(journal,stored,output,f.env),/Only a GM/);
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
  const f=fixture(),next=await generateSector(f.existing,f.options);next.journalName='A new name';let stored=f.existing,updates=0;const journal={name:'Old name',getFlag:()=>stored,setFlag:()=>assert.fail('must use one update'),update:async changes=>{updates++;assert.equal(changes.name,'A new name');stored=changes['flags.myz-sector-manager.sector'];}};
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
