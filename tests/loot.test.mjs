import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LOOT_TYPES,normalizeLoot,itemLootType,lootTitle,lootQuantity,lootCollected} from '../scripts/loot.mjs';
import {sectorIndicators} from '../scripts/sector-icons.mjs';
test('loot title derives compact quantity/classification without mutating stored names',()=>{
  for(const [entry,title] of [[{title:'Scrap Rifle',type:'weapon'},'Scrap Rifle (weapon)'],[{title:'Bullets',quantity:6},'Bullets x 6 (scrap)'],[{title:'Ancient Radio',type:'artifact'},'Ancient Radio (artifact)'],[{title:'Kevlar Vest',type:'Armor',quantity:2},'Kevlar Vest x 2 (armor)'],[{title:'Binoculars',type:'gear'},'Binoculars (gear)'],[{title:'Components',quantity:3},'Components x 3 (scrap)']]){const before=structuredClone(entry);assert.equal(lootTitle(entry),title);assert.deepEqual(entry,before);}
  const entry={title:'Components',quantity:3};assert.equal(lootTitle(entry),'Components x 3 (scrap)');entry.quantity=4;assert.equal(lootTitle(entry),'Components x 4 (scrap)');assert.equal(entry.title,'Components');
  for(const quantity of [undefined,null,'invalid',NaN,Infinity,-2,''])assert.equal(lootQuantity(quantity),1);
  assert.equal(lootTitle({title:'Water',quantity:.5}),'Water (scrap)');assert.equal(lootQuantity(0),0);
});
test('all five world/compendium Item types normalize case; unsupported documents cannot infer a classification',()=>{
  assert.deepEqual(LOOT_TYPES,['scrap','armor','artifact','chassis','gear','weapon']);
  for(const type of LOOT_TYPES.slice(1))for(const uuid of ['Item.world','Compendium.pack.items.Item.abc'])assert.equal(itemLootType({documentName:'Item',type:type.toUpperCase(),uuid}),type);
  for(const doc of [{documentName:'Actor',type:'weapon'},{documentName:'Item',type:'talent'},null,{}])assert.equal(itemLootType(doc),null);
});
test('legacy loot statuses are retained; only Collected/Depleted map to collected, and explicit reversals control icons',()=>{
  for(const status of ['Active','Hidden','Discovered','Resolved','Collected','Depleted','Inactive']){
    const original={title:'Old loot',status,uuid:'Item.keep',quantity:2,details:'Keep notes',custom:{keep:true}};const before=structuredClone(original),entry=normalizeLoot(original);assert.equal(entry.collected,['Collected','Depleted'].includes(status));assert.equal(entry.status,status);assert.equal(entry.type,'scrap');assert.equal(entry.typeSource,'legacy');assert.deepEqual(original,before);assert.deepEqual(entry.custom,original.custom);
  }
  const reversed={title:'Artifact',status:'Collected',collected:false};assert.equal(lootCollected(reversed),false);assert.equal(sectorIndicators({loot:[reversed]}).loot.visible,true);assert.equal(sectorIndicators({loot:[{...reversed,collected:true}]}).loot.visible,false);
});
