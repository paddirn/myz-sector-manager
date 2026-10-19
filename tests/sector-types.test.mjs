import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSectorType,normalizeSpecialGear,sectorTabs,sectorTitle,sectorCollection} from '../scripts/sector-types.mjs';
import {tabHasContent} from '../scripts/sector-content.mjs';
import {generateSector,saveGeneratedSector} from '../scripts/sector-randomizer.mjs';
import {generateEntry} from '../scripts/entry-generation.mjs';

test('legacy records default to Normal without discarding secrets, normal entries or unknown metadata',()=>{
  const old={version:1,code:'B07',secrets:[{title:'Hidden'}],locations:[{uuid:'Scene.missing'}],encounters:[{uuid:'Actor.one'}],loot:[{quantity:2}],effects:[{details:'Rain'}],pathStunts:{safePath:true},history:[{title:'Visit'}],future:{keep:true}};
  const before=structuredClone(old),next=normalizeSectorType(old);assert.equal(next.sectorType,'normal');assert.deepEqual(old,before);for(const key of Object.keys(old))assert.deepEqual(next[key],old[key]);
  assert.deepEqual(sectorTabs(next),['Overview','Locations','Encounters','Loot','Effects','Find the Path','History']);assert(!sectorTabs(next).includes('Secrets'));
});
test('repeated conversion retains both content sets, shared records, unknown fields and long multiline text',()=>{
  const text=('Paragraph one\n\nParagraph two\n').repeat(1000);
  let data=normalizeSectorType({version:1,code:'B7',description:'Normal description',special:{overview:text,situation:text,sceneUuid:'Scene.missing',source:'Custom book',inhabitants:[{title:'Workers'}],gear:[{title:'Vest',type:'armor',quantity:2}],events:[{uuid:'Compendium.myz.book.JournalEntry.parent.JournalEntryPage.page'}],future:'keep'},pathStunts:{safePath:true},history:[{title:'Visit'}],secrets:['Legacy']});
  const before=structuredClone(data);for(const type of ['special','normal','special','normal']){data=normalizeSectorType({...structuredClone(data),sectorType:type});assert.deepEqual({...data,sectorType:'normal'},before);}
  assert.equal(sectorCollection(data,'special.gear').length,1);assert.equal(data.special.overview,text);
  assert.deepEqual(sectorTabs({sectorType:'special'}),['Overview','Locations','Inhabitants','Gear & Artifacts','Events','Images','Find the Path','History']);
});
test('Special Gear shares all six types and keeps positive integer quantities without adding collected flags',()=>{
  for(const type of ['scrap','armor','artifact','chassis','gear','weapon']){const entry=normalizeSpecialGear({title:'Unmodified',type,quantity:3,custom:'keep'});assert.equal(entry.type,type);assert.equal(entry.quantity,3);assert.equal(entry.title,'Unmodified');assert.equal(entry.collected,undefined);assert.equal(entry.custom,'keep');}
  for(const quantity of [undefined,0,-1,1.5,'bad',Infinity])assert.equal(normalizeSpecialGear({quantity}).quantity,1);
  assert.equal(normalizeSpecialGear({type:'Unknown'}).type,'scrap');
});
test('shared display titles combine coordinates and editable names with normal fallback and no duplicate prefix',()=>{
  for(const sectorType of ['normal','special']){
    assert.equal(sectorTitle({sectorType,code:'B07',nameOverride:true,customName:'The Doom Sphere'}),'B7 - The Doom Sphere');
    assert.equal(sectorTitle({sectorType,code:'B7',nameOverride:false,terrain:'Hospital'}),'B7 - Hospital');
    assert.equal(sectorTitle({sectorType,code:'B7',nameOverride:true,customName:'B7 - The Doom Sphere'}),'B7 - The Doom Sphere');
  }
});
test('Special tab indicators reflect independent authored content',()=>{
  const data=normalizeSectorType({sectorType:'special'});for(const tab of ['Overview','The Situation','Inhabitants','Gear & Artifacts','Events'])assert.equal(tabHasContent(data,tab),false);
  Object.assign(data.special,{sceneUuid:'Scene.one',situation:'Two paragraphs\n\nMore',inhabitants:[{title:'Group'}],gear:[{title:'Gear'}],events:[{uuid:'JournalEntry.j.JournalEntryPage.p'}]});for(const tab of ['Overview','The Situation','Inhabitants','Gear & Artifacts','Events'])assert.equal(tabHasContent(data,tab),true);
});
test('Special randomization and normal context generation are blocked before table access or writes',async()=>{
  const sector={sectorType:'special',version:1,code:'A1',special:{overview:'Keep'}};const before=structuredClone(sector);const env={game:{user:{isGM:true}},fromUuid:()=>assert.fail('No table lookup')};
  await assert.rejects(generateSector(sector,{env}),/manually authored/);await assert.rejects(saveGeneratedSector({update:()=>assert.fail('No writes')},sector,sector,env),/cannot receive/);
  for(const kind of ['encounters','effects','locations','loot'])await assert.rejects(generateEntry(kind,sector,{env}),/manually authored/);
  assert.deepEqual(sector,before);assert.equal((await generateEntry('history',sector,{env})).title,'');
});
