import {test} from 'node:test';
import assert from 'node:assert/strict';
import {markerFixture} from './helpers/marker-fixture.mjs';
import {MARKER_FLAG,MARKER_KIND,LastKnownPositions,markerMetadata,styleMarker,captureMarkerSource} from '../scripts/wandering/markers.mjs';
import {MODULE,SETTING} from '../scripts/wandering/model.mjs';
const state=f=>f.token.getFlag(MODULE,MARKER_FLAG);
test('visible NPC creates one artwork Tile at its exact source footprint, persists association and hides before native movement',async()=>{
 const f=markerFixture(),before=structuredClone({x:f.token.x,y:f.token.y,texture:f.token.texture});const result=await f.service.manual();assert.equal(result.moved,1);assert.deepEqual(f.events.slice(0,3),['tile-create','hide','move']);assert.equal(f.token.hidden,true);assert.equal(f.zone.tiles.size,1);
 const tile=[...f.zone.tiles.values()][0];assert.equal(tile.x,before.x);assert.equal(tile.y,before.y);assert.equal(tile.width,150);assert.equal(tile.height,200);assert.equal(tile.rotation,0);assert.deepEqual(tile.texture,{anchorX:.5,anchorY:.5,fit:'contain',...before.texture});assert.equal(tile.hidden,false);assert.equal(tile.alpha,.65);assert.equal(tile.elevation,5);assert.equal(markerMetadata(tile).sourceTokenId,f.token.id);assert.equal(markerMetadata(tile).sector,'B2');assert.equal(markerMetadata(tile).grayscale,true);assert.equal(state(f).tileId,tile.id);assert.equal(state(f).phase,'active');
 await f.service.manual();assert.equal(f.zone.tiles.size,1);assert.equal(tile.x,before.x);assert.equal(tile.y,before.y);assert.equal(f.events.filter(e=>e==='tile-create').length,1);
});
test('automatic and manual wandering share markers, persisted claims prevent duplicate events and reloaded managers do not recreate them',async()=>{
 const f=markerFixture(),context={entryId:'entry1',token:f.zone.tokens.get('party'),group:f.store.config.groups[0]};await f.service.onEntry(context);await f.service.onEntry(context);assert.equal(f.zone.tiles.size,1);const reloaded=new LastKnownPositions(f.store,f.env);await reloaded.sceneReady(f.zone);assert.equal(state(f).phase,'active');const origin=[...f.zone.tiles.values()][0].x;await f.service.manual();assert.equal(f.zone.tiles.size,1);assert.equal([...f.zone.tiles.values()][0].x,origin);
});
test('already-hidden NPCs create no marker, persist suppression and never create one retroactively after manual reveal',async()=>{
 const f=markerFixture();f.token.hidden=true;await f.service.manual();assert.equal(f.zone.tiles.size,0);assert.equal(f.token.hidden,true);assert.equal(state(f).phase,'suppressed');f.token.hidden=false;await f.service.manual();assert.equal(f.zone.tiles.size,0);assert.equal(f.token.hidden,false);assert.equal(state(f).phase,'suppressed');
});
test('disabled markers preserve legacy visibility; autoHide off leaves a visible token and creates a marker; no destination changes nothing',async()=>{
 const f=markerFixture();f.settings.set(SETTING,{...f.config(),markers:false});await f.service.manual();assert.equal(f.token.hidden,false);assert.equal(f.zone.tiles.size,0);assert.equal(state(f),undefined);
 f.settings.set(SETTING,{...f.config(),markers:true,autoHide:false,grayscale:false});await f.service.manual();assert.equal(f.token.hidden,false);assert.equal(f.zone.tiles.size,1);assert.equal(markerMetadata([...f.zone.tiles.values()][0]).grayscale,false);
 const no=markerFixture();no.store.config.grid.columns=1;no.store.config.grid.rows=1;no.token.x=0;no.token.y=0;await no.service.manual();assert.equal(no.zone.tiles.size,0);assert.equal(state(no),undefined);assert.equal(no.token.hidden,false);
});
test('manual reveal preserves marker and position until the next actual wandering movement hides again',async()=>{
 const f=markerFixture();await f.service.manual();const tile=[...f.zone.tiles.values()][0];await f.token.update({hidden:false});assert.equal(f.token.hidden,false);assert.equal(f.zone.tiles.get(tile.id),tile);const length=f.events.length;await f.service.manual();assert.deepEqual(f.events.slice(length),['hide','move']);assert.equal(f.token.hidden,true);assert.equal(f.zone.tiles.size,1);
});
test('Tile, hiding, artwork and movement failures retain safe state and do not initialize incorrect markers',async()=>{
 for(const failure of ['tile','hide','image','move']){
  const f=markerFixture(),origin={x:f.token.x,y:f.token.y};f.fail[failure]=true;const result=await f.service.manual();assert.equal(result.moved,0,failure);assert.deepEqual({x:f.token.x,y:f.token.y},origin);assert.equal(f.zone.tiles.size,0,failure);assert.notEqual(state(f)?.phase,'active');assert.equal(f.token.hidden,false,failure);assert(f.warnings.some(w=>/denied|unavailable/.test(w)),failure);
 }
 const f=markerFixture();f.token.texture.src='javascript:alert(1)';await f.service.manual();assert.equal(f.zone.tiles.size,0);assert.equal(state(f),undefined);assert.equal(f.token.hidden,false);
});
test('partial/stopped movement never restores visibility at a changed location and retains the original marker consistently',async()=>{
 const f=markerFixture();f.token.move=async data=>{f.token.x=data.x+10;f.token.y=data.y;return false;};const result=await f.service.manual();assert.equal(result.moved,0);assert.equal(f.token.hidden,true);assert.equal(f.zone.tiles.size,1);assert.equal(state(f).phase,'active');assert.equal([...f.zone.tiles.values()][0].x,600);
});
test('failed cleanup and interrupted state reconcile safely after reload without replay or visibility leaks',async()=>{
 const f=markerFixture();f.fail.move=true;f.fail.delete=true;await f.service.manual();assert.equal(f.token.hidden,true);assert.equal(state(f).phase,'moving');assert.equal(f.zone.tiles.size,1);f.fail.delete=false;await f.markers.sceneReady(f.zone);assert.equal(f.zone.tiles.size,0);assert.equal(state(f).phase,'cleared');assert.equal(f.token.hidden,true);
});
test('individual clear and reset preserve visibility/position, touch only owned Tiles and reset authorizes a hidden future marker explicitly',async()=>{
 const f=markerFixture();await f.service.manual();const ordinary={id:'ordinary',parent:f.zone,getFlag:()=>undefined};f.zone.tiles.set(ordinary.id,ordinary);const position={x:f.token.x,y:f.token.y};await f.markers.clear(f.token);assert.equal(f.zone.tiles.size,1);assert(f.zone.tiles.has('ordinary'));assert.equal(f.token.hidden,true);assert.deepEqual({x:f.token.x,y:f.token.y},position);assert.equal(state(f).phase,'cleared');await f.service.manual();assert.equal(f.zone.tiles.size,1);
 await f.markers.clear(f.token,{reset:true});assert.equal(state(f).phase,'armed');assert.equal(f.token.hidden,true);await f.service.manual();assert.equal(f.zone.tiles.size,2);assert.equal(f.token.hidden,true);
});
test('clear Scene is scoped, clears stale token references and never changes visibility or unrelated Tiles',async()=>{
 const f=markerFixture();await f.service.manual();const unrelated={id:'unrelated',parent:f.zone,getFlag:()=>({version:1,kind:'different'})};f.zone.tiles.set(unrelated.id,unrelated);const foreign={id:'foreign',parent:f.zone,getFlag:()=>({version:1,kind:MARKER_KIND,sourceSceneId:'otherScene',sourceTokenId:'npc'})};f.zone.tiles.set(foreign.id,foreign);assert.equal(await f.markers.clearScene(f.zone),1);assert.deepEqual([...f.zone.tiles.keys()].sort(),['foreign','unrelated']);assert.equal(f.token.hidden,true);assert.equal(state(f).tileId,null);
});
test('manual Tile deletion clears stale tracking without recreating; source Token deletion cleans only its own marker',async()=>{
 const f=markerFixture();await f.service.manual();const tile=[...f.zone.tiles.values()][0];f.zone.tiles.delete(tile.id);await f.markers.deletedTile(tile);assert.equal(state(f).phase,'cleared');await f.service.manual();assert.equal(f.zone.tiles.size,0);
 await f.markers.clear(f.token,{reset:true});await f.service.manual();assert.equal(f.zone.tiles.size,1);await f.markers.deletedToken(f.token);assert.equal(f.zone.tiles.size,0);
});
test('copied token flags cannot adopt, move or delete another token marker; missing references and unknown versions fail safely',async()=>{
 const f=markerFixture();await f.service.manual();const original=state(f),tile=[...f.zone.tiles.values()][0],copy={...f.token,id:'copy',flags:structuredClone(f.token.flags)};f.zone.tokens.set(copy.id,copy);await f.markers.reconcile(copy);assert.equal(copy.getFlag(MODULE,MARKER_FLAG).tileId,null);assert.equal(f.zone.tiles.get(tile.id),tile);await f.markers.clear(copy);assert.equal(f.zone.tiles.get(tile.id),tile);
 f.token.flags[MODULE][MARKER_FLAG]={...original,tileId:'missing'};await f.markers.reconcile(f.token);assert.equal(state(f).phase,'cleared');assert.equal(f.zone.tiles.size,0); // Only verified owned stale Tiles are removed; no guessed Tile ID is deleted.
 f.token.flags[MODULE][MARKER_FLAG]={version:2,secret:'future'};await assert.rejects(f.markers.reconcile(f.token),/Unsupported/);assert.equal(state(f).secret,'future');
});
test('GM authority is checked before each mutation; handover preserves recoverable markers without a second creation',async()=>{
 const f=markerFixture(),create=f.zone.createEmbeddedDocuments;f.zone.createEmbeddedDocuments=async(...args)=>{const result=await create(...args);f.env.game.users.activeGM={id:'newGM'};return result;};await f.service.manual();assert.equal(f.token.x,600);assert.equal(f.zone.tiles.size,1);assert.equal(state(f).phase,'preparing');f.env.game.users.activeGM={id:'gm'};await f.markers.sceneReady(f.zone);assert.equal(f.zone.tiles.size,0);assert.equal(state(f).phase,'cleared');
});
test('PIXI Tile grayscale is local and idempotent, preserves other filters/textures, and falls back when unsupported',()=>{
 const f=markerFixture(),document={getFlag:()=>({version:1,kind:MARKER_KIND,grayscale:true})},other={},tile={document,mesh:{filters:[other],texture:{shared:true}}};let created=0,destroyed=0;class Filter{constructor(){created++;}desaturate(){this.gray=true;}destroy(){destroyed++;}}
 f.env.PIXI={filters:{ColorMatrixFilter:Filter}};styleMarker(tile,f.env);assert.equal(created,1);assert.equal(tile.mesh.filters.length,2);assert.equal(tile.mesh.filters[1].gray,true);styleMarker(tile,f.env);assert.equal(created,1);document.getFlag=()=>({version:1,kind:MARKER_KIND,grayscale:false});styleMarker(tile,f.env);assert.equal(destroyed,1);assert.deepEqual(tile.mesh.filters,[other]);assert.equal(tile.mesh.texture.shared,true);
 document.getFlag=()=>({version:1,kind:MARKER_KIND,grayscale:true});delete f.env.PIXI;styleMarker(tile,f.env);assert.deepEqual(tile.mesh.filters,[other]);
});

test('failed Tile creation cannot undo a concurrent GM hide; changed token positions are revalidated after artwork loading',async()=>{
 const f=markerFixture();f.zone.createEmbeddedDocuments=async()=>{f.token.hidden=true;throw Error('Tile creation denied');};await f.service.manual();assert.equal(f.token.hidden,true);assert.equal(f.token.x,600);assert.equal(f.zone.tiles.size,0);
 const moving=markerFixture();moving.env.foundry.canvas.loadTexture=async()=>{moving.token.x=1200;return {valid:true};};await moving.service.manual();assert.equal(moving.zone.tiles.size,0);assert.equal(moving.token.hidden,false);assert.equal(state(moving),undefined);assert.equal(moving.token.x,1200);
});

test('recovery waits for native pending movement and removes late Tiles from interrupted operations already cleared by the new GM',async()=>{
 const f=markerFixture();await f.service.manual();const saved=state(f);f.token.flags[MODULE][MARKER_FLAG]={...saved,phase:'moving'};f.token.movement={state:'pending'};f.token.x=saved.origin.x;f.token.y=saved.origin.y;await f.markers.reconcile(f.token);assert.equal(f.zone.tiles.size,1);assert.equal(state(f).phase,'moving');
 f.token.movement.state='completed';await f.markers.reconcile(f.token);assert.equal(f.zone.tiles.size,0);assert.equal(state(f).phase,'cleared');
 const tile={id:'late',parent:f.zone,getFlag:()=>({version:1,kind:MARKER_KIND,sourceSceneId:f.zone.id,sourceTokenId:f.token.id})};f.zone.tiles.set(tile.id,tile);await f.markers.reconcile(f.token);assert.equal(f.zone.tiles.size,0);assert.equal(state(f).phase,'cleared');assert.equal(f.token.hidden,true);
});

test('source transforms preserve exact off-grid x/y and footprint for 1x1/2x2, boundaries, rotations, signed elevations and texture scales',async()=>{
 for(const [width,height,x,y,elevation,rotation,scaleX,scaleY] of [[1,1,531.25,426.75,0,83,1,1],[2,2,2775.5,2700.25,5,270,2,.5],[1,1,10.5,17.25,-2,-45,-1,1.2]]){
  const f=markerFixture();Object.assign(f.token,{width,height,x,y,elevation,rotation});Object.assign(f.token.texture,{scaleX,scaleY});const before={x,y,width:width*100,height:height*100,elevation,rotation};await f.service.manual();assert.equal(f.zone.tiles.size,1);const tile=[...f.zone.tiles.values()][0];
  assert.equal(tile.x,x);assert.equal(tile.y,y);assert.equal(tile.width,before.width);assert.equal(tile.height,before.height);assert.equal(tile.rotation,0);assert.equal(tile.elevation,elevation+1);assert.equal(f.token.elevation,elevation);assert.equal(f.token.rotation,rotation);assert.equal(tile.texture.scaleX,scaleX);assert.equal(tile.texture.scaleY,scaleY);assert.equal(f.token.hidden,true);
 }
});
test('native v14 footprint and serialized document coordinates override rendered bounds without double scaling',()=>{
 const f=markerFixture();f.token.toObject=source=>{assert.equal(source,true);return {x:531.25,y:412.75,width:2,height:2,elevation:-2,hidden:false,texture:{src:'rat.webp',scaleX:2,scaleY:3}};};
 f.token.getSize=dimensions=>{assert.deepEqual(dimensions,{width:2,height:2});return {width:240,height:320};};f.token.object={x:999,y:888,bounds:{width:9999,height:9999},rotation:180};const captured=captureMarkerSource(f.token,f.store.config.grid);assert.equal(captured.x,531.25);assert.equal(captured.y,412.75);assert.equal(captured.width,240);assert.equal(captured.height,320);assert.equal(captured.elevation,-2);
});
test('artwork, dimensions, elevation and position are captured before async loading and pending-state updates',async()=>{
 const f=markerFixture(),initial={x:f.token.x,y:f.token.y,width:f.token.width*100,height:f.token.height*100,texture:{...f.token.texture},elevation:f.token.elevation};
 const load=f.env.foundry.canvas.loadTexture;f.env.foundry.canvas.loadTexture=async(...args)=>{f.token.width=2;f.token.height=3;f.token.elevation=20;f.token.rotation=300;f.token.texture.scaleX=4;f.token.texture.src='changed.webp';return load(...args);};
 const update=f.token.update.bind(f.token);f.token.update=async(data,options)=>{if(data['flags.myz-sector-manager.lastKnownPosition']?.phase==='preparing'){f.token.elevation=100;f.token.texture.scaleY=5;}return update(data,options);};
 await f.markers.move(f.token,f.config(),{x:1100,y:450},()=>update({x:1100,y:450}),()=>{});const tile=[...f.zone.tiles.values()][0];assert.equal(tile.x,initial.x);assert.equal(tile.y,initial.y);assert.equal(tile.width,initial.width);assert.equal(tile.height,initial.height);assert.deepEqual(tile.texture,{anchorX:.5,anchorY:.5,fit:'contain',...initial.texture});assert.equal(tile.elevation,initial.elevation+1);assert.equal(tile.rotation,0);
});
test('two eligible NPCs receive independent source snapshots in manual and automatic checks, without duplicate markers or repair of existing Tiles',async()=>{
 for(const automatic of [false,true]){
  const f=markerFixture(),other={...f.token,id:'other',uuid:'Scene.zone.Token.other',flags:structuredClone(f.token.flags),x:1050.5,y:845.25,elevation:8,texture:{...f.token.texture}};f.zone.tokens.set(other.id,other);
  if(automatic)await f.service.onEntry({entryId:'two-npcs',token:f.zone.tokens.get('party'),group:f.store.config.groups[0]});else await f.service.manual();
  assert.equal(f.zone.tiles.size,2);const tiles=[...f.zone.tiles.values()];assert.deepEqual(tiles.map(tile=>[tile.x,tile.y,tile.rotation,tile.elevation]),[[600,450,0,5],[1050.5,845.25,0,9]]);tiles[0].x=721;tiles[0].rotation=19;tiles[0].elevation=77;await f.markers.sceneReady(f.zone);await f.service.manual();assert.equal(f.zone.tiles.size,2);assert.deepEqual([tiles[0].x,tiles[0].rotation,tiles[0].elevation],[721,19,77]);
 }
});
