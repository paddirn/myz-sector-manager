import test from 'node:test';
import assert from 'node:assert/strict';
import {gearEntry,eventEntry,gearFields,eventFields,contentEmpty} from '../scripts/ui/content.mjs';
import {escapeEntryText as esc} from '../scripts/ui/entry.mjs';
import {selectOptions} from '../scripts/ui/options.mjs';
import {normalizeLoot} from '../scripts/loot.mjs';
import {normalizeSpecialGear,specialQuantity} from '../scripts/sector-types.mjs';
const render={field:(label,name,value)=>`<label><span>${esc(label)}</span><input name="${esc(name)}" value="${esc(value)}"></label>`,area:(label,name,value,rows)=>`<label><span>${esc(label)}</span><textarea name="${esc(name)}" rows="${rows}">${esc(value)}</textarea></label>`};
test('shared Gear fields preserve Normal decimal/zero inputs and Special whole-number configuration',()=>{
 for(const quantity of [0,.25,2.75,5]){const item=Object.freeze({id:'gear',title:'Custom Item',type:'weapon',quantity,details:'Keep <notes>'});const normal=gearEntry({id:'ui-normal',key:'loot',item,prefix:'loot.0',quantity:normalizeLoot(item).quantity,minimum:0,step:'any',reference:'<div data-reference>Item</div>',extra:'<input name="loot.0.collected" type="checkbox">'},render),special=gearEntry({id:'ui-special',key:'special.gear',item,prefix:'special.gear.0',quantity:specialQuantity(quantity),minimum:1,step:1,reference:'<div data-reference>Item</div>'},render);
  assert.match(normal,new RegExp(`min="0" step="any" value="${quantity}"`));assert.match(special,new RegExp(`min="1" step="1" value="${specialQuantity(quantity)}"`));
  for(const html of [normal,special]){for(const label of ['Title','Quantity','Type','Description / Notes'])assert(html.includes(`<span>${label}</span>`));assert.match(html,/data-entry-toggle/);assert.match(html,/data-remove=/);assert.match(html,/Keep &lt;notes&gt;/);assert(html.indexOf('>Title<')<html.indexOf('>Quantity<'));assert(html.indexOf('>Quantity<')<html.indexOf('>Type<'));assert(html.indexOf('>Type<')<html.indexOf('data-reference'));}
  assert.match(normal,/loot\.0\.collected/);assert.doesNotMatch(special,/collected|supplies\./);
 }
});
test('unknown Gear types survive each normalizer and render as escaped selected custom choices',()=>{
 const original={title:'Manual',type:'Relic <x> "rare"',typeSource:'manual',quantity:.5,custom:{preserve:true}},before=structuredClone(original);
 for(const normalize of [normalizeLoot,normalizeSpecialGear]){const item=normalize(original);assert.equal(item.type,original.type);assert.equal(item.typeSource,'manual');const html=gearFields({item,prefix:'items.0',quantity:item.quantity,minimum:0,step:'any'},render);assert.match(html,/value="Relic &lt;x&gt; &quot;rare&quot;" selected/);assert.match(html,/Legacy\/custom value/);assert.doesNotMatch(html,/<x>/);assert.equal(item.title,'Manual');}
 assert.deepEqual(original,before);assert.equal(normalizeLoot({type:'Armor'}).type,'armor');assert.equal(normalizeSpecialGear({type:'Armor'}).type,'armor');
});
test('friendly type labels do not change option values or duplicate/replace custom choices',()=>{
 const html=selectOptions('odd & custom',['gear','weapon'],v=>v[0].toUpperCase()+v.slice(1));assert.match(html,/value="weapon" >Weapon/);assert.match(html,/value="odd &amp; custom" selected>odd &amp; custom/);assert.equal((html.match(/<option/g)||[]).length,3);
});
test('shared Event controls keep metadata and authored extensions separate without mutating records',()=>{
 const item=Object.freeze({id:'event',title:'Custom Event',details:'Narrative\n<keep>',status:'Active',trigger:'Trigger',outcomes:'Outcome',related:'NPC / Faction',notes:'Secret',uuid:'JournalEntry.world.JournalEntryPage.page'});
 const special=eventEntry({id:'ui-special',key:'special.events',item,prefix:'special.events.0',metadata:'<div data-reference>Journal/Page</div>'},render),settlement=eventEntry({id:'ui-settlement',key:'settlement.events',item,prefix:'settlement.events.0',metadata:'<select name="settlement.events.0.status"></select>',extra:'<textarea name="settlement.events.0.trigger">Trigger</textarea><textarea name="settlement.events.0.notes">Secret</textarea>'},render);
 for(const html of [special,settlement]){assert.match(html,/>Event Title</);assert.match(html,/>Description</);assert.match(html,/\.details" rows="5"/);assert.match(html,/data-entry-toggle/);assert.equal((html.match(/data-remove=/g)||[]).length,1);assert.match(html,/Narrative\n&lt;keep&gt;/);assert.doesNotMatch(html,/data-reset-trigger|macroUuid|campaignLog|travelEvents/);}
 assert.match(special,/Journal\/Page/);assert.doesNotMatch(special,/\.status|\.trigger|\.related|\.notes/);assert.match(settlement,/\.status/);assert.doesNotMatch(settlement,/data-reference/);
});
test('shared content renderers own no collection actions, listeners or save behavior; empty states match',()=>{
 assert.match(contentEmpty('item'),/No gear or artifacts added/);assert.match(contentEmpty('event'),/No events added/);
 for(const html of [gearFields({item:{},prefix:'loot.0',quantity:1,minimum:0,step:'any'},render),eventFields({item:{},prefix:'special.events.0'},render)])assert.doesNotMatch(html,/data-action=|data-expand-all|onclick|onsubmit|<script/);
});
