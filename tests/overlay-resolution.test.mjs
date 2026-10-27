import {test} from 'node:test';
import assert from 'node:assert/strict';
import {overlayTextResolution} from '../scripts/zone/overlay.mjs';
import {overlayFixture} from './helpers/overlay-fixture.mjs';
test('overlay resolution follows renderer, DPR and zoom in bounded buckets; labels regenerate without changing coordinates',()=>{
 const f=overlayFixture();f.env.devicePixelRatio=2;f.stage.scale={x:1};assert.equal(overlayTextResolution(f.env),2);f.overlay.draw();const before=f.overlay.cells.get('A1').root.children.filter(n=>n.text);assert(before.every(n=>n.resolution===2));const xy=before.map(n=>[n.x,n.y]);f.stage.scale.x=1.6;f.overlay.draw();const after=f.overlay.cells.get('A1').root.children.filter(n=>n.text);assert(after.every(n=>n.resolution===3.5));assert.deepEqual(after.map(n=>[n.x,n.y]),xy);f.stage.scale.x=10;assert.equal(overlayTextResolution(f.env),4);f.env.devicePixelRatio=1;f.stage.scale.x=.25;assert.equal(overlayTextResolution(f.env),2);
});
