import {test} from 'node:test';
import assert from 'node:assert/strict';
import {markerFixture} from './helpers/marker-fixture.mjs';
import {captureMarkerSource,markerTileData,markerMetadata,ALIGNMENT_KIND,MARKER_FLAG} from '../scripts/wandering/markers.mjs';
import {alignmentMetadata,alignmentReport,inspectArtwork} from '../scripts/wandering/alignment.mjs';
import {MODULE} from '../scripts/wandering/model.mjs';
test('full texture fit/anchor/nonuniform signed scale survives the shared permanent and diagnostic builder',()=>{
 const f=markerFixture();Object.assign(f.token.texture,{fit:'contain',anchorX:.2,anchorY:.8,scaleX:1.25,scaleY:-.75});const source=captureMarkerSource(f.token,f.store.config.grid);
 const permanent=markerTileData(f.token,source,f.config()),temporary=markerTileData(f.token,source,f.config(),{kind:ALIGNMENT_KIND,alpha:1,grayscale:false});assert.deepEqual(permanent.texture,f.token.texture);assert.deepEqual(temporary.texture,permanent.texture);assert.equal(permanent.texture.scaleX,1.25);assert.equal(permanent.rotation,0);assert.equal(permanent.elevation,5);assert.equal(temporary.flags[MODULE][MARKER_FLAG].kind,ALIGNMENT_KIND);assert.equal(temporary.alpha,1);assert.equal(temporary.flags[MODULE][MARKER_FLAG].grayscale,false);
 delete f.token.texture.fit;delete f.token.texture.anchorX;delete f.token.texture.anchorY;const defaults=captureMarkerSource(f.token,f.store.config.grid);assert.equal(defaults.texture.fit,'contain');assert.equal(defaults.texture.anchorX,.5);assert.equal(defaults.texture.anchorY,.5);
});
test('native canvas-space mesh bounds take priority over meaningless placeable local zero and screen-space bounds',()=>{
 const mesh={position:{x:0,y:0},canvasBounds:{x:1411,y:1328,width:41.25,height:20.625},canvasTransform:{a:1,b:0,c:0,d:1,tx:1411,ty:1328},updateCanvasTransform(){},getBounds(){assert.fail('native canvas bounds must take precedence');}};
 const result=inspectArtwork({position:{x:0,y:0},mesh});assert.equal(result.placeable.position.x,0);assert.equal(result.canvasBounds.x,1411);assert.match(result.boundsMethod,/native/);
});
test('fallback bounds remove stage pan/zoom and missing renderer data never claims alignment success',()=>{
 const mesh={getBounds:()=>({x:120,y:240,width:80,height:40})},env={canvas:{stage:{worldTransform:{applyInverse:({x,y})=>({x:(x-100)/2,y:(y-200)/2})}}}};assert.deepEqual(inspectArtwork({mesh},env).canvasBounds,{x:10,y:20,width:40,height:20});
 const f=markerFixture(),source=captureMarkerSource(f.token,f.store.config.grid),tile=markerTileData(f.token,source,f.config());const report=alignmentReport(f.token,tile,source,f.env);assert.equal(report.canvasBoundsDelta,null);assert.match(report.status,/Waiting/);assert.match(report.note,/does not prove identical pixels/);
});
test('stationary test uses shared builder without moving/hiding/changing permanent tracking and cleans on Close or X',async()=>{
 for(const closeWith of ['button','x']){
  const f=markerFixture(),before=structuredClone(f.token.flags);let finish,options;f.env.foundry.applications.api.DialogV2.wait=config=>{options=config;config.render(null,{element:{querySelector:()=>null}});return new Promise(resolve=>finish=resolve);};
  const running=f.service.alignment.launch(f.token);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.zone.tiles.size,1);const tile=[...f.zone.tiles.values()][0];assert(alignmentMetadata(tile));assert.equal(markerMetadata(tile),null);assert.deepEqual(f.token.flags,before);assert.equal(f.token.hidden,false);assert.equal(f.token.x,600);assert.equal(f.token.y,450);assert.equal(tile.alpha,1);assert.equal(tile.texture.fit,'contain');assert(f.service.alignment.hasTest(f.token));
  assert.equal((await f.service.manual()).moved,0);assert.equal(f.zone.tiles.size,1);finish(closeWith==='x'?options.close():options.buttons[0].callback());await running;assert.equal(f.zone.tiles.size,0);assert.deepEqual(f.token.flags,before);assert.equal(f.service.alignment.hasTest(f.token),false);
 }
});
test('hidden/player/Party tokens cannot create a diagnostic; cleanup targets test Tiles only and recovers after reload',async()=>{
 const f=markerFixture();f.token.hidden=true;await assert.rejects(f.service.alignment.launch(f.token),/visible/);f.token.hidden=false;f.token.actor.hasPlayerOwner=true;await assert.rejects(f.service.alignment.launch(f.token),/visible/);f.token.actor.hasPlayerOwner=false;
 const source=captureMarkerSource(f.token,f.store.config.grid);await f.zone.createEmbeddedDocuments('Tile',[markerTileData(f.token,source,f.config()),markerTileData(f.token,source,f.config(),{kind:ALIGNMENT_KIND,ownerId:f.env.game.user.id})]);assert.equal(f.zone.tiles.size,2);await f.service.alignment.clearOrphans(f.zone);assert.equal(f.zone.tiles.size,1);assert(markerMetadata([...f.zone.tiles.values()][0]));
 f.env.game.users.activeGM={id:'other'};await assert.rejects(f.service.alignment.clear(f.zone),/active GM/);assert.equal(f.zone.tiles.size,1);
});
test('diagnostic comparison records fit and orientation discrepancies, shaders/filters and current document changes',()=>{
 const f=markerFixture(),source=captureMarkerSource(f.token,f.store.config.grid),tile=markerTileData(f.token,source,f.config());f.token.object={mesh:{canvasBounds:{x:1,y:2,width:100,height:50},shader:{constructor:{name:'TokenShader'}},filters:[]}};tile.object={position:{x:0,y:0},mesh:{canvasBounds:{x:1,y:2,width:100,height:100},filters:[{constructor:{name:'ColorMatrixFilter'}}]}};const report=alignmentReport(f.token,tile,source,f.env);assert.equal(report.canvasBoundsDelta.height,50);assert.equal(report.tokenRender.shader,'TokenShader');assert.deepEqual(report.tileRender.filters,['ColorMatrixFilter']);assert.match(report.intendedOrientation,/upright/);assert.equal(report.sourceCapture.texture.scaleX,-1);
});
