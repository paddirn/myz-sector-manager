import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ZoneRuntime} from '../scripts/zone/runtime.mjs';
import {fixture} from './helpers/zone-fixture.mjs';
const row=(html,kind)=>html.match(kind==='ark'?/<div class="zm-ark[\s\S]*?(?=<div class="zm-positions">|$)/:/<div class="zm-positions">[\s\S]*/)?.[0]||'';
test('selected sector distances reuse eight-neighbor units and Ark-party distance appears only on the Ark row',()=>{
  const f=fixture(),runtime=new ZoneRuntime({},f.env);runtime.store.reload();const html=runtime.summary({code:'D1'});
  assert.match(row(html,'ark'),/1 sector \(1.6 km\)/);assert.match(row(html,'ark'),/3 sectors \(4.8 km\)/);assert.match(row(html,'party'),/2 sectors \(3.2 km\)/);assert.doesNotMatch(row(html,'party'),/1 sector \(1.6 km\)/);assert.equal((html.match(/data-zone-coordinate="D1"/g)||[]).length,1);
});
test('selected distances recalculate for selection, Ark, party, and kilometer settings changes',()=>{
  const f=fixture(),runtime=new ZoneRuntime({},f.env);runtime.store.reload();
  assert.match(row(runtime.summary({code:'C1'}),'ark'),/2 sectors \(3.2 km\)/);
  runtime.store.config.arkCoordinate='B1';runtime.store.config.kmPerSector=2;f.zone.tokens.get('party').x=1000;
  const html=runtime.summary({code:'D1'});assert.match(row(html,'ark'),/2 sectors \(4 km\)/);assert.match(row(html,'party'),/1 sector \(2 km\)/);
});
test('empty selection, missing/invalid coordinates, unavailable party and player access do not invent distances',()=>{
  const f=fixture(),runtime=new ZoneRuntime({},f.env);runtime.store.reload();assert.match(runtime.summary(),/No sector selected/);
  for(const code of ['','bad','ZZ999']){const html=runtime.summary({code});assert.match(html,/Selected sector coordinates unavailable/);assert.doesNotMatch(html,/data-zone-coordinate=/);}
  f.zone.tokens.delete('party');assert.match(row(runtime.summary({code:'D1'}),'party'),/Distance unavailable/);runtime.store.config.arkCoordinate=null;assert.match(row(runtime.summary({code:'D1'}),'ark'),/Distance unavailable/);
  f.env.game.user.isGM=false;assert.equal(runtime.summary({code:'D1'}),'');
});

test('distance labels state both origins and use singular/plural with configured kilometers',()=>{
  const f=fixture(),runtime=new ZoneRuntime({},f.env);runtime.store.reload();let html=runtime.summary({code:'D1'});
  assert.match(row(html,'ark'),/Party is 1 sector \(1.6 km\) from the Ark/);
  assert.match(row(html,'ark'),/3 sectors \(4.8 km\) from the Ark/);
  assert.match(row(html,'party'),/2 sectors \(3.2 km\) from the Party/);
  runtime.store.config.arkCoordinate='B1';runtime.store.config.kmPerSector=2;f.zone.tokens.get('party').x=1000;
  html=runtime.summary({code:'D1'});assert.match(row(html,'ark'),/Party is 1 sector \(2 km\) from the Ark/);assert.match(row(html,'ark'),/2 sectors \(4 km\) from the Ark/);assert.match(row(html,'party'),/1 sector \(2 km\) from the Party/);
  html=runtime.summary({code:'C1'});assert.match(row(html,'party'),/0 sectors \(0 km\) from the Party/);
});

test('one selected coordinate control spans Ark and all Party rows',()=>{const f=fixture(),runtime=new ZoneRuntime({},f.env);runtime.store.reload();const html=runtime.summary({code:'D1'});assert.equal((html.match(/data-zone-coordinate=/g)||[]).length,1);assert.match(html,/zm-shared-selected/);assert.match(html,/grid-row:1 \/ span 2/);});
