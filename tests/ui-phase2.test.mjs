import test from 'node:test';
import assert from 'node:assert/strict';
import {portraitSources,placeholderImage} from '../scripts/ui/inhabitant-portraits.mjs';
import {scrollKey} from '../scripts/ui/scroll.mjs';
const actor=(img,uuid='Actor.world')=>({documentName:'Actor',uuid,img,testUserPermission:()=>true});
test('portrait policy preserves Actor/saved paths and recognizes Foundry placeholders',()=>{
 const entry={portrait:'portraits/saved.webp',uuid:'Actor.world',title:'Manual',details:'Snapshot'};const before=structuredClone(entry);
 for(const uuid of ['Actor.world','Compendium.myz.actors.Actor.world'])assert.deepEqual(portraitSources(entry,actor('portraits/live.webp',uuid)).map(r=>r.src),['portraits/live.webp','portraits/saved.webp']);
 for(const path of ['icons/svg/mystery-man.svg','/icons/svg/unknown.svg','https://host/icons/svg/mystery-man.svg?v=2']){assert(placeholderImage(path));assert.deepEqual(portraitSources(entry,actor(path)).map(r=>r.src),[entry.portrait]);}
 assert.deepEqual(entry,before);
});
test('missing, inaccessible, Journal and unsafe portraits use saved path or silhouette',()=>{
 const entry={portrait:'portraits/saved.webp'};
 for(const source of [null,{documentName:'JournalEntry',img:'journal.webp'},{...actor('live.webp'),testUserPermission:()=>false},actor('javascript:alert(1)')])assert.deepEqual(portraitSources(entry,source).map(r=>r.src),[entry.portrait]);
 assert.deepEqual(portraitSources({portrait:'data:image/png;base64,AA'},null),[]);
 assert.equal(portraitSources(entry,actor(entry.portrait)).length,1);
});
test('scroll keys use scope and stable entry IDs rather than changing field indices',()=>{
 const root={dataset:{scrollScope:'["sector","Inhabitants"]'}};
 const element=(name,id)=>({matches:()=>false,closest:selector=>selector==='[data-entry]'?{dataset:{entry:id}}:null,getAttribute:key=>key==='name'?name:null,dataset:{}});
 assert.equal(scrollKey(element('encounters.0.details','stable'),root),scrollKey(element('encounters.8.details','stable'),root));
 assert.notEqual(scrollKey(element('encounters.0.details','stable'),root),scrollKey(element('encounters.0.details','other'),root));
 assert.equal(scrollKey({matches:s=>s==='.sm-list'},root),'sidebar');
});
