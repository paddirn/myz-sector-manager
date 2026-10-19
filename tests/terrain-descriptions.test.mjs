import {withLegacyReferences} from './helpers/reference-fixture.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TERRAIN_DESCRIPTION_TABLES,terrainDescription} from '../scripts/terrain-descriptions.mjs';
test('all 13 exact terrain mappings roll once and preserve multiline plain/HTML snapshots',async()=>{
 assert.equal(Object.keys(TERRAIN_DESCRIPTION_TABLES).length,13);
 for(const [terrain,uuid] of Object.entries(TERRAIN_DESCRIPTION_TABLES)){
  let rolls=0;const env={fromUuid:async id=>{assert.equal(id,uuid);return {documentName:'RollTable',roll:async options=>{assert.deepEqual(options,{recursive:false});rolls++;return {results:[{description:'<p>First paragraph</p><p>Second<br>line</p>'}]};}};}};
  withLegacyReferences(env);assert.equal(await terrainDescription(`  ${terrain.toUpperCase().replaceAll(' ','   ')} `,env),'First paragraph\n\nSecond\nline');assert.equal(rolls,1);
 }
});
test('unknown terrain never rolls; missing, empty, compound and invalid tables warn without throwing',async()=>{
 let lookups=0,warnings=[];const env={fromUuid:async()=>{lookups++;return null;},ui:{notifications:{warn:m=>warnings.push(m)}}};
 withLegacyReferences(env);assert.equal(await terrainDescription('Ash Desert Highway',env),null);assert.equal(lookups,0);
 assert.equal(await terrainDescription('Ash Desert',env),null);assert.equal(warnings.length,1);
 for(const results of [[],[{text:''}],[{text:'A'},{text:'B'}],[{documentUuid:'Actor.x',text:'Unsafe reference'}]]){env.fromUuid=async()=>({documentName:'RollTable',roll:async()=>({results})});assert.equal(await terrainDescription('Ash Desert',env),null);}
 env.fromUuid=async()=>{throw Error('Denied');};assert.equal(await terrainDescription('Ash Desert',env),null);
});
