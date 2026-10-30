import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionActions,entryLabel,confirmEntryRemoval,unsavedChangesGuard} from '../scripts/ui/actions.mjs';
import {sameRecord,acknowledgePaths,saveStatus} from '../scripts/ui/save-state.mjs';
test('collection actions label every context, isolate attributes, and retain History generation',()=>{
 for(const key of ['locations','encounters','loot','effects','history','special.locations','special.inhabitants','special.gear','special.events','special.images','settlement.projects','settlement.inhabitants','settlement.factions','settlement.events','settlement.threads']){
  const html=collectionActions({key,count:2,history:key==='history'});assert.match(html,new RegExp('Add '+entryLabel(key)));assert.match(html,/data-expand-all/);assert.match(html,/data-collapse-all/);assert.match(html,new RegExp(`data-collection="${key}"`));if(key==='history')assert.match(html,/data-action="add-event"/);
 }
 assert.doesNotMatch(collectionActions({key:'locations',count:1}),/data-expand-all/);
 assert.match(collectionActions({key:'locations',disabled:true}),/disabled/);assert.match(collectionActions({key:'history',history:true,disabled:true}),/data-action="add-event"[^>]*disabled/);
});
test('shared removal confirmation escapes content, defaults Cancel, validates, restores focus and serializes',async()=>{
 let finish,options,focus=0;const host={element:{ownerDocument:{activeElement:{isConnected:true,focus:opts=>{assert.equal(opts.preventScroll,true);focus++;}}}}},env={foundry:{applications:{api:{DialogV2:{confirm:value=>{options=value;return new Promise(r=>finish=r);}}}}}};
 const first=confirmEntryRemoval(host,{kind:'Inhabitant',name:'<Mara> & "Z"'},env);assert.equal(await confirmEntryRemoval(host,{name:'Other'},env),false);assert.match(options.content,/&lt;Mara&gt; &amp; &quot;Z&quot;/);assert.equal(options.defaultYes,false);finish(false);assert.equal(await first,false);assert.equal(focus,1);
 env.foundry.applications.api.DialogV2.confirm=async()=>true;assert.equal(await confirmEntryRemoval(host,{valid:()=>false},env),false);
});
test('guard waits for collection saves; visual state alone never prompts',async()=>{
 let finish;const host={draft:{},sectorId:'a',dirty:false,autosaveWrite:new Promise(r=>finish=r)};const guarding=unsavedChangesGuard(host,{foundry:{applications:{api:{DialogV2:{wait:()=>assert.fail('no dirty prompt')}}}}});assert.equal(await unsavedChangesGuard(host),false);finish();assert.equal(await guarding,true);
});
test('save feedback distinguishes in-progress, failure, scoped saves and unsaved drafts',()=>{
 assert.equal(saveStatus({dirty:true,busy:true}),'Saving sector…');assert.match(saveStatus({dirty:true,saveNote:'Inhabitants saved automatically; other edits use Save Sector'}),/Unsaved changes.*Inhabitants saved automatically/);assert.match(saveStatus({dirty:true,saveNote:'Save failed'}),/Unsaved.*failed/);
});
test('baseline acknowledgment preserves unrelated remote conflicts and compares keys independently of order',()=>{
 const journal={},baseline={journal,record:{notes:'Original',special:{gear:[],unknown:'Keep'}}};acknowledgePaths(baseline,journal,{notes:'Remote',special:{gear:[{id:'x'}]}},['special.gear']);assert.equal(baseline.record.notes,'Original');assert.equal(baseline.record.special.unknown,'Keep');assert.deepEqual(baseline.record.special.gear,[{id:'x'}]);assert(sameRecord({b:2,a:{d:1,c:3}},{a:{c:3,d:1},b:2}));assert(!sameRecord({notes:'Original'},{notes:'Remote'}));
});
