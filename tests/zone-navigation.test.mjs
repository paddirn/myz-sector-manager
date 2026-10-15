import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ZoneRuntime} from '../scripts/zone/runtime.mjs';
import {coordinateToBounds} from '../scripts/zone/grid.mjs';
import {fixture} from './helpers/zone-fixture.mjs';

test('Ark and sector navigation use GM-local Scene view and cell midpoints without tokens or record writes',async()=>{
  const f=fixture(),runtime=new ZoneRuntime({},f.env),pans=[];runtime.store.reload();f.zone.tokens.clear();
  let views=0;f.zone.view=async()=>{views++;f.env.canvas.scene=f.zone;};f.env.canvas.animatePan=async pan=>pans.push(pan);f.env.canvas.scene=f.combat;
  assert.match(runtime.summary(),/data-zone-ark/);assert.equal(await runtime.centerSector(runtime.store.config.arkCoordinate),true);assert.equal(views,1);assert.deepEqual(pans[0],{x:250,y:200,duration:350});
  const grid=runtime.store.config.grid;Object.assign(grid,{reference:'B2',originX:120,originY:240,columnAxis:'y',columnDirection:-1,rowDirection:-1});
  const bounds=coordinateToBounds('C3',grid);assert.equal(await runtime.centerSector('C3'),true);assert.deepEqual(pans[1],{x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2,duration:350});assert.equal(f.writes(),0);
});
test('sector navigation rejects missing configuration, bad coordinates, players, and configuration changes during Scene view',async()=>{
  const f=fixture(),runtime=new ZoneRuntime({},f.env),notices=[];runtime.store.reload();f.env.ui.notifications.warn=message=>notices.push(message);f.env.canvas.animatePan=()=>assert.fail('must not pan');
  assert.equal(await runtime.centerSector('bad'),false);assert.equal(await runtime.centerSector('ZZ999'),false);runtime.store.config.arkCoordinate=null;assert.doesNotMatch(runtime.summary(),/data-zone-ark/);
  f.env.game.user.isGM=false;assert.equal(await runtime.centerSector('A1'),false);f.env.game.user.isGM=true;
  runtime.store.config.sceneId='deleted';assert.equal(await runtime.centerSector('A1'),false);assert.match(notices.at(-1),/Configure a Zone Scene/);
  runtime.store.config.sceneId='zone';f.env.canvas.scene=f.combat;f.zone.view=async()=>{runtime.store.config.sceneId='combat';f.env.canvas.scene=f.zone;};assert.equal(await runtime.centerSector('A1'),false);
});

test('navigation survives a normal tracking reload while viewing the Zone, but aborts if grid calibration changes',async()=>{
  const f=fixture(),runtime=new ZoneRuntime({},f.env),pans=[];runtime.store.reload();f.env.canvas.scene=f.combat;f.env.canvas.animatePan=async pan=>pans.push(pan);
  f.zone.view=async()=>{f.env.canvas.scene=f.zone;runtime.store.reload();};assert.equal(await runtime.centerSector('A1'),true);assert.equal(pans.length,1);
  f.env.canvas.scene=f.combat;f.zone.view=async()=>{f.env.canvas.scene=f.zone;runtime.store.config.grid.width=123;};assert.equal(await runtime.centerSector('A1'),false);assert.equal(pans.length,1);
});
