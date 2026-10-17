import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateSector,TABLE_UUIDS,resolveTables,rollTable,mapRot,mapThreatLevel,mapThreatType,saveGeneratedSector} from '../scripts/sector-randomizer.mjs';
import {tabHasContent} from '../scripts/sector-content.mjs';
const probabilities={threats:{fringe:1,central:1,dangerous:1},artifacts:{fringe:1,central:1,dangerous:1}};
function fixture(overrides={},dice={}){
  const texts={environment:'<b>Overgrown Ruins</b>',ruinsA:'Hospital',ruinsB:'Factory',rot:'2 — Rot-Heavy Area',threatLevel:'Fringe Zone',threatType:'Humanoid',humanoid:'Zone Ghouls',monster:'Devourer',phenomenon:'Acid Rain',artifact:'Ancient Rifle',mood:'A distant howl',scrap:'Copper wire',...overrides};
  const tables=new Map(Object.entries(TABLE_UUIDS).map(([key,uuid])=>[uuid,{uuid,name:key,documentName:'RollTable',async roll(options){assert.deepEqual(options,{recursive:false});return {results:[{id:key,description:texts[key]}]};}}]));
  const env={game:{user:{isGM:true}},fromUuid:async uuid=>tables.get(uuid)};
  const queues=Object.fromEntries(Object.entries(dice).map(([key,value])=>[key,[...value]]));
  const roll=async formula=>queues[formula]?.length?queues[formula].shift():1;
  const existing={version:1,code:'A7',notes:'Keep manual notes',description:'Handwritten',supplies:{cleanGrub:{quantity:9,collected:true}},pathStunts:{artifact:true},locations:[{title:'Manual location'},{title:'Old generated',generated:{method:'core'}}],encounters:[],effects:[],loot:[{title:'Manual treasure'}],secrets:[{title:'Secret'}],custom:{keep:true}};
  return {env,tables,existing,options:{env,roll,probabilities},queues};
}
test('all supplied UUIDs must resolve before rolling, with clear error for each missing table',async()=>{
  for(const [key,uuid] of Object.entries(TABLE_UUIDS)){
    const f=fixture();f.tables.delete(uuid);for(const table of f.tables.values())table.roll=()=>assert.fail('must validate first');
    await assert.rejects(generateSector(f.existing,f.options),error=>error.message.includes(key)&&error.message.includes(uuid));
  }
  const f=fixture();f.env.game.user.isGM=false;await assert.rejects(resolveTables(f.env),/Only a GM/);
});
test('generator preserves manual data, replaces only generated entries, and routes threats, artifacts, mood and resources',async()=>{
  const f=fixture(),before=structuredClone(f.existing);const output=await generateSector(f.existing,f.options);
  assert.deepEqual(f.existing,before);assert.equal(output.terrain,'Overgrown Ruins');assert.equal(output.rot,2);assert.equal(output.mood,'A distant howl');assert.equal(output.locations[0].title,'Manual location');assert.equal(output.locations[1].title,'Hospital');assert.equal(output.encounters[0].title,'Zone Ghouls');assert.equal(output.loot[0].title,'Manual treasure');
  assert.deepEqual(output.loot.slice(1).map(entry=>entry.title),['Ancient Rifle','Clean Grub','Clean Water','Bullets','Copper wire']);assert.equal(output.loot[2].quantity,1);assert.equal(output.loot[2].classification,'clean');assert.equal(output.randomization.threatLevel,'fringe');assert.equal(output.notes,'Keep manual notes');assert.deepEqual(output.supplies,before.supplies);assert.deepEqual(output.custom,before.custom);assert.deepEqual(output.pathStunts,before.pathStunts);assert.equal(output.locations[1].generated.sources[0].tableUuid,TABLE_UUIDS.ruinsA);
});
test('non-ruin environment never creates ruins; categories map independently of individual threats',async()=>{
  for(const [text,key] of [['Fringe Zone','fringe'],['Central Zone','central'],['Unusually Dangerous','dangerous']]){
    const f=fixture({environment:'Thick Woods',threatLevel:text});f.options.probabilities={threats:{fringe:0,central:0,dangerous:0},artifacts:{fringe:0,central:0,dangerous:0}};
    const output=await generateSector(f.existing,f.options);assert.equal(output.randomization.threatLevel,key);assert.equal(output.locations.length,1);assert.equal(output.encounters.length,0);assert.equal(output.effects.length,0);assert(!output.loot.some(entry=>entry.title==='Ancient Rifle'));
  }
});
test('one, two and three independent threats route Humanoid/Monster to Encounters and Phenomena to Effects',async()=>{
  for(const count of [1,2,3]){
    const f=fixture({}, {'1d3':[count]});let i=0;f.tables.get(TABLE_UUIDS.threatType).roll=async()=>({results:[{description:['Humanoid','Monster','Phenomena'][i++]}]});
    const output=await generateSector(f.existing,f.options);assert.equal(output.encounters.length+output.effects.length,count);assert.equal(i,count);if(count===3){assert.equal(output.effects[0].category,'Phenomenon');assert.equal(output.effects[0].title,'Acid Rain');}
  }
});
test('resource categories roll independently; Rot grub/water, quantities, Components and absence are preserved',async()=>{
  const f=fixture({environment:'Thick Woods'},{'1d10000':[1,1,1,9000,1,9000,1,1,9000],'1d6':[2,3,4],'1d3':[1,3]});
  const output=await generateSector(f.existing,f.options);const loot=output.loot;
  assert.equal(loot.find(entry=>entry.title==='Rot Grub').quantity,2);assert.equal(loot.find(entry=>entry.title==='Rot Water').quantity,3);assert.equal(loot.find(entry=>entry.title==='Bullets').quantity,4);assert.equal(loot.find(entry=>entry.title==='COMPONENTS').quantity,3);assert.equal(loot.find(entry=>entry.title==='Rot Water').classification,'rot');
  const empty=fixture({environment:'Thick Woods'},{'1d10000':Array(6).fill(10000)});empty.options.probabilities={threats:{fringe:0,central:0,dangerous:0},artifacts:{fringe:0,central:0,dangerous:0}};const none=await generateSector(empty.existing,empty.options);assert.deepEqual(none.loot,[{title:'Manual treasure'}]);
});
test('unusable results, dice and ambiguous categories fail without modifying source data',async()=>{
  for(const overrides of [{rot:'Unknown'},{threatType:'Something else'},{mood:''},{threatLevel:'Unknown'}]){
    const f=fixture(overrides),before=structuredClone(f.existing);await assert.rejects(generateSector(f.existing,f.options));assert.deepEqual(f.existing,before);
  }
  const f=fixture({}, {'1d6':[0]});await assert.rejects(generateSector(f.existing,f.options),/Invalid 1d6/);
  assert.equal(mapRot({text:'0 — Rot Oasis',mapping:{}}),0);assert.equal(mapRot({text:'Weak Rot',mapping:{}}),1);assert.equal(mapRot({text:'Rot Hotspot',mapping:{}}),3);
  assert.equal(mapThreatType({text:'Localized entry',mapping:{threatType:'monster'}}),'monster');assert.equal(mapThreatLevel({text:'Translated',mapping:{threatLevel:'central'}}),'central');
});
test('document and nested table results preserve references and table provenance; missing refs and cycles fail',async()=>{
  const f=fixture();const item={uuid:'Item.rifle',name:'Rifle',documentName:'Item'};f.tables.set(item.uuid,item);const table=f.tables.get(TABLE_UUIDS.artifact);table.roll=async()=>({results:[{documentUuid:item.uuid}]});const output=await generateSector(f.existing,f.options);assert.equal(output.loot[1].uuid,item.uuid);
  const inner=f.tables.get(TABLE_UUIDS.ruinsA);table.roll=async()=>({results:[{documentUuid:inner.uuid}]});const nested=await rollTable(table,f.env);assert.equal(nested.text,'Hospital');assert.equal(nested.sources.length,2);
  inner.roll=async()=>({results:[{documentUuid:table.uuid}]});await assert.rejects(rollTable(table,f.env),/cycle/);
  table.roll=async()=>({results:[{documentUuid:'Item.missing'}]});await assert.rejects(rollTable(table,f.env),/missing/);
});
test('single flag write persists a complete generation and rejects stale sectors or players',async()=>{
  const f=fixture(),output=await generateSector(f.existing,f.options);let stored=structuredClone(f.existing),writes=0;const journal={getFlag:()=>stored,setFlag:async(mod,key,value)=>{writes++;stored=structuredClone(value);}};
  await saveGeneratedSector(journal,f.existing,output,f.env);assert.equal(writes,1);assert.deepEqual(stored,output);
  await assert.rejects(saveGeneratedSector(journal,f.existing,output,f.env),/changed/);assert.equal(writes,1);
  f.env.game.user.isGM=false;await assert.rejects(saveGeneratedSector(journal,stored,output,f.env),/Only a GM/);
});
test('empty tab detection ignores defaults and placeholder entries, and recognizes meaningful content',()=>{
  const empty={version:1,code:'A1',rot:0,status:'Unexplored',terrain:' ',encounters:[{title:'',status:'Active'}],effects:[{category:'Weather'}],loot:[],supplies:{bullets:{quantity:0,collected:false}}};
  for(const tab of ['Overview','Locations','Encounters','Effects','Loot','Secrets','History','Find the Path'])assert.equal(tabHasContent(empty,tab),false,tab);
  assert(tabHasContent({...empty,terrain:'Forest'},'Overview'));assert(tabHasContent({...empty,rot:2},'Overview'));assert(tabHasContent({...empty,loot:[{uuid:'Item.one'}]},'Loot'));assert(tabHasContent({...empty,supplies:{bullets:{quantity:2}}},'Loot'));assert(tabHasContent({...empty,effects:[{details:'Fog'}]},'Effects'));assert(tabHasContent({...empty,pathStunts:{artifact:true}},'Find the Path'));
});

test('linked UUID text resolves Items and old collection/id results remain supported',async()=>{
  const f=fixture();const item={uuid:'Item.rifle',name:'Rifle',documentName:'Item'};f.tables.set(item.uuid,item);const table=f.tables.get(TABLE_UUIDS.artifact);
  table.roll=async()=>({results:[{description:'@UUID[Item.rifle]{Old Rifle}'}]});let result=await rollTable(table,f.env);assert.equal(result.text,'Old Rifle');assert.equal(result.uuid,item.uuid);
  table.roll=async()=>({results:[{text:'Old table text',documentCollection:'Item',documentId:'rifle'}]});result=await rollTable(table,f.env);assert.equal(result.uuid,item.uuid);assert.equal(result.text,'Old table text');
});
test('rename and generated data commit in a single Document update without persisting temporary journalName',async()=>{
  const f=fixture(),next=await generateSector(f.existing,f.options);next.journalName='A new name';let stored=f.existing,updates=0;const journal={name:'Old name',getFlag:()=>stored,setFlag:()=>assert.fail('must not make a separate flag write'),update:async changes=>{updates++;assert.equal(changes.name,'A new name');stored=changes['flags.myz-sector-manager.sector'];}};
  await saveGeneratedSector(journal,f.existing,next,f.env);assert.equal(updates,1);assert.equal(stored.journalName,undefined);assert.equal(stored.terrain,'Overgrown Ruins');
});
test('artifact probabilities require an explicit rule/configuration instead of an invented official default',async()=>{
  const f=fixture();delete f.options.probabilities;await assert.rejects(generateSector(f.existing,f.options),/artifact chance.*rule required/);
});
