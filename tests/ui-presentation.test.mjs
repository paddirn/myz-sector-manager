import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,collectionEmpty} from '../scripts/ui/presentation.mjs';
import {readFileSync} from 'node:fs';
test('all entry collections have compact, contextual empty states with real creation guidance',()=>{
 for(const key of ['locations','encounters','loot','effects','history','special.locations','special.inhabitants','special.gear','special.events','special.images','settlement.projects','settlement.inhabitants','settlement.factions','settlement.events','settlement.threads','settlement.shop']){const html=collectionEmpty(key);assert.match(html,/data-empty-state/);assert.match(html,/<p>No /);assert.match(html,/<small>/);assert.doesNotMatch(html,/<button|onclick|<img/);}
 assert.match(collectionEmpty('encounters'),/No inhabitants added/);assert.match(collectionEmpty('loot'),/No gear or artifacts added/);assert.match(collectionEmpty('history'),/Add Entry or Add Event/);assert.match(collectionEmpty('settlement.shop'),/No shop inventory available/);
});
test('restricted or linked source empty states never promise unavailable manual creation',()=>{
 for(const key of ['locations','settlement.projects','settlement.shop'])assert.doesNotMatch(collectionEmpty(key,{canAdd:false}),/<small>|Use Add|Drop /);
 const linked=collectionEmpty('settlement.projects',{linkedArk:true});assert.match(linked,/Linked Ark projects appear here/);assert.doesNotMatch(linked,/Add Project/);
});
test('empty-state content and optional classes are escaped without introducing active markup',()=>{
 const html=emptyState('No <records>','"Try" <script>','custom" onclick="bad');assert.match(html,/No &lt;records&gt;/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script|class="custom" onclick=/);
});
test('polish stylesheet is packaged and remains scoped to Sector Manager',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../module.json',import.meta.url))),css=readFileSync(new URL('../styles/interface.css',import.meta.url),'utf8');assert(manifest.styles.includes('styles/interface.css'));assert.doesNotMatch(css,/(?:^|\n)(?:body|:root|\.application)\s*[{,]/);assert.match(css,/:focus-visible/);assert.match(css,/@container/);assert.doesNotMatch(css,/!important/);
});
