import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const text=fs.readFileSync(new URL('../docs/legacy-marker-cleanup.md',import.meta.url),'utf8');
const code=text.split('<!-- legacy-marker-cleanup:start -->')[1].split('```javascript\n')[1].split('\n```')[0];
const ns='myz-sector-manager',key='lastKnownPosition';
function fixture(){
 const notices=[],deleted=[],unsets=[];let confirmations=0,settingsWrites=0;const context={game:{user:{isGM:true}},canvas:{},console:{error(){}}};let settings={version:1,enabled:false,maximum:5,frequency:'quarter',allowSpecial:true,markers:true,grayscale:false,autoHide:true,custom:'preserve'};
 const scene={id:'scene',tiles:new Map(),tokens:new Map(),deleteEmbeddedDocuments:async(type,ids)=>{assert.equal(type,'Tile');deleted.push(...ids);const removed=ids.map(id=>scene.tiles.get(id));for(const id of ids)scene.tiles.delete(id);return removed;}};context.canvas.scene=scene;
 const tile=(id,flag)=>{const doc={id,flag,getFlag:(module,field)=>{assert.equal(module,ns);assert.equal(field,key);return doc.flag;}};scene.tiles.set(id,doc);return doc;};
 const owned=id=>tile(id,{version:1,kind:'wandering-last-known',sourceSceneId:scene.id,sourceTokenId:'npc'});
 const token=(id,flag,hidden)=>{const doc={id,hidden,x:10,y:20,flags:{wanderingEnabled:true,other:'preserve',[key]:flag},getFlag:(m,k)=>doc.flags[k],canUserModify:()=>true,unsetFlag:async(m,k)=>{assert.equal(m,ns);assert.equal(k,key);unsets.push(id);delete doc.flags[k];}};scene.tokens.set(id,doc);return doc;};
 context.game.settings={get:()=>settings,set:async(m,k,value)=>{assert.equal(m,ns);assert.equal(k,'wanderingConfiguration');settingsWrites++;settings=value;}};
 context.foundry={applications:{api:{DialogV2:{confirm:async()=>{confirmations++;return true;}}}}};context.ui={notifications:{warn:m=>notices.push(m),info:m=>notices.push(m)}};
 return {context,scene,tile,owned,token,notices,deleted,unsets,confirmations:()=>confirmations,settingsWrites:()=>settingsWrites,settings:()=>settings,setSettings:value=>settings=value,run:()=>vm.runInNewContext(`(async()=>{${code}\n})()`,context)};
}
test('documented cleanup macro confirms and deletes only known owned Tiles, clears only obsolete flags/options, and preserves positions/visibility/eligibility',async()=>{
 const f=fixture();f.owned('owned');f.tile('test',{version:1,kind:'wandering-alignment-test',sourceSceneId:'scene',sourceTokenId:'npc'});f.tile('ordinary',null);f.tile('foreign',{version:1,kind:'wandering-last-known',sourceSceneId:'other',sourceTokenId:'npc'});f.tile('unknown',{version:2,kind:'wandering-last-known',sourceSceneId:'scene',sourceTokenId:'npc'});f.tile('malformed',{version:1,kind:'wandering-last-known',sourceSceneId:'scene'});
 const visible=f.token('visible',{version:1,phase:'active',sourceSceneId:'scene',sourceTokenId:'visible'},false),hidden=f.token('hidden',{version:1,phase:'suppressed',sourceSceneId:'scene',sourceTokenId:'hidden'},true),future=f.token('future',{version:2,phase:'active'},true);
 const result=await f.run();assert.equal(result.removed,2);assert.equal(result.cleared,2);assert.equal(f.confirmations(),1);assert.deepEqual([...f.scene.tiles.keys()].sort(),['foreign','malformed','ordinary','unknown']);assert.equal(visible.hidden,false);assert.equal(hidden.hidden,true);assert.equal(visible.x,10);assert.equal(hidden.y,20);assert.equal(visible.flags.wanderingEnabled,true);assert.equal(hidden.flags.other,'preserve');assert.equal(future.flags[key].version,2);assert.deepEqual(JSON.parse(JSON.stringify(f.settings())),{version:1,enabled:false,maximum:5,frequency:'quarter',allowSpecial:true,custom:'preserve'});
 const repeated=await f.run();assert.equal(repeated.removed,0);assert.equal(repeated.cleared,0);assert.equal(f.confirmations(),1);assert.match(f.notices.at(-1),/No known legacy/);
});
test('cancellation, player access and Scene changes perform no cleanup',async()=>{
 for(const mode of ['cancel','player','scene-change']){
  const f=fixture();f.owned('owned');if(mode==='player')f.context.game.user.isGM=false;else f.context.foundry.applications.api.DialogV2.confirm=async()=>{if(mode==='scene-change')f.context.canvas.scene={id:'different'};return mode!=='cancel';};
  if(mode==='scene-change')await assert.rejects(f.run(),/Scene changed/);else await f.run();assert.equal(f.deleted.length,0);assert.equal(f.unsets.length,0);assert.equal(f.settingsWrites(),0);
 }
});
test('ownership is revalidated after confirmation and unknown settings versions remain unchanged',async()=>{
 const f=fixture(),tile=f.owned('changed');f.context.foundry.applications.api.DialogV2.confirm=async()=>{tile.flag=null;return true;};const saved={version:2,markers:true,maximum:4,future:'keep'};f.setSettings(saved);await f.run();assert.equal(f.deleted.length,0);assert.equal(f.scene.tiles.size,1);assert.equal(f.settings(),saved);assert.equal(f.settingsWrites(),0);
});
test('native Tile deletion failure stops flag cleanup; inaccessible token flags are retained and partial flag errors are reported',async()=>{
 const fail=fixture();fail.owned('owned');fail.scene.deleteEmbeddedDocuments=async()=>{throw Error('Native deletion denied');};await assert.rejects(fail.run(),/Native deletion denied/);assert.equal(fail.settingsWrites(),0);
 const f=fixture(),token=f.token('denied',{version:1,phase:'cleared',sourceSceneId:'scene',sourceTokenId:'denied'},true);token.unsetFlag=async()=>{throw Error('Permission changed');};const result=await f.run();assert.equal(result.cleared,0);assert.equal(result.errors.length,1);assert.equal(token.hidden,true);assert.equal(token.flags[key].phase,'cleared');assert(f.notices.some(message=>/need review/.test(message)));
});
