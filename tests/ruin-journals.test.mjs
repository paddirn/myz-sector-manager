import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveRuinJournal,rollTable} from '../scripts/sector-randomizer.mjs';
const result=text=>({text,uuid:'',documentType:null,sources:[],mapping:{}});
test('normal/industrial ruin documents preserve world, compendium and Journal Page references',async()=>{
  for(const [uuid,type] of [['JournalEntry.a','JournalEntry'],['Compendium.myz.ruins.JournalEntry.b','JournalEntry'],['JournalEntry.a.JournalEntryPage.p','JournalEntryPage']]){
    const doc={uuid,name:'Hospital',documentName:type};const env={game:{journal:[]},fromUuid:async()=>doc};
    for(const name of ['Normal Ruins','Industrial Ruins']){
      const table={uuid:'RollTable.'+name,name,roll:async()=>({results:[{documentUuid:uuid,description:'Human-readable ruin'}]})};
      const rolled=await rollTable(table,env,[],{allowMissing:true});const resolved=await resolveRuinJournal(rolled.entries[0],env);assert.equal(resolved.uuid,uuid);assert.equal(resolved.text,'Human-readable ruin');assert.equal(resolved.documentType,type);
      assert.equal(structuredClone(resolved).uuid,uuid);
    }
  }
});
test('text-only ruins never guess a same-name journal or search packs',async()=>{
  const env={game:{journal:[{uuid:'JournalEntry.a',name:'Hospital'}],packs:[{getIndex(){throw new Error('Must not search');}}]},console:{warn(){}}};
  const unresolved=await resolveRuinJournal(result('Hospital'),env);assert.equal(unresolved.uuid,'');assert.match(unresolved.referenceWarning,/missing document metadata/);
});
test('missing explicit ruin references remain nonblocking and never link a same-name unrelated journal',async()=>{
  const env={game:{journal:[{name:'Hospital',uuid:'JournalEntry.unrelated'}]},fromUuid:async()=>null};
  const table={uuid:'RollTable.ruins',name:'Ruins',roll:async()=>({results:[{description:'Hospital',documentUuid:'JournalEntry.deleted'}]})};
  const rolled=await rollTable(table,env,[],{allowMissing:true});const resolved=await resolveRuinJournal(rolled.entries[0],env);assert.equal(resolved.text,'Hospital');assert.match(resolved.referenceWarning,/missing/);assert.notEqual(resolved.uuid,'JournalEntry.unrelated');assert.equal(resolved.sources[0].documentUuid,'JournalEntry.deleted');
  await assert.rejects(rollTable(table,env),/missing/);
});
