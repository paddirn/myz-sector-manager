import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePathStunts,normalizeThreatLevel,sectorThreatLevel,threatDescriptor,meaningfulText,cleanThreatRecord,threatDeletion} from '../scripts/sector-fields.mjs';
test('stunt prerequisites preserve legacy selections by inferring the basic effect, then enforce explicit clearing',()=>{
  const older={artifact:true,halfTime:true,futureStunt:true};const loaded=normalizePathStunts(older,{legacy:true});assert.equal(loaded.safePath,true);assert.equal(loaded.artifact,true);assert.equal(older.safePath,undefined);
  const cleared=normalizePathStunts({...loaded,safePath:false});for(const key of ['artifact','assessRot','bullets','grub','water','halfTime','rush','saferRoute'])assert.equal(cleared[key],false);assert.equal(cleared.futureStunt,true);
  const active=normalizePathStunts({safePath:true,rush:true});assert.equal(active.rush,true);assert.equal(active.artifact,false);
});
test('nonnegative integer Threat Levels, legacy numeric fallback and descriptors',()=>{
  assert.equal(sectorThreatLevel({}),1);assert.equal(sectorThreatLevel({randomization:{numericThreatLevel:7}}),7);assert.equal(sectorThreatLevel({threatLevel:9,randomization:{numericThreatLevel:2}}),9);
  for(const value of ['',null,undefined,'invalid',-1,2.5,Infinity])assert.equal(normalizeThreatLevel(value,4),4);
  for(const [value,label] of [[0,'Fringe Zone'],[1,'Fringe Zone'],[4,'Fringe Zone'],[5,'Central Zone'],[8,'Central Zone'],[9,'Unusually Dangerous Area'],[10000,'Unusually Dangerous Area']]){assert.equal(threatDescriptor(value),label);assert.equal(normalizeThreatLevel(value),value);}
});
test('meaningful text treats empty rich markup and whitespace as empty without hiding real content',()=>{
  for(const text of ['',null,' \n\t','<p><br></p>','<p>&#32;&#x200B;&emsp;</p>','<div>&nbsp; &#160; &#xA0;</div>','<!-- note --><p>\u200b</p>'])assert.equal(meaningfulText(text),false,String(text));
  for(const text of ['A mood','<p>Ruins</p>','&lt;text&gt;','<img src="map.png">'])assert.equal(meaningfulText(text),true,text);
});

test('canonical Threat Level cleanup removes only legacy duplicates and emits a Foundry deletion patch',()=>{
  const old={version:1,randomization:{numericThreatLevel:0,threatLevel:'fringe',baseDice:[],custom:'keep'},notes:'Keep'};const before=structuredClone(old);const next=cleanThreatRecord(old);assert.equal(next.threatLevel,0);assert.equal(next.randomization.numericThreatLevel,undefined);assert.equal(next.randomization.custom,'keep');assert.deepEqual(old,before);
  assert.deepEqual(threatDeletion(old),{'flags.myz-sector-manager.sector.randomization.-=numericThreatLevel':null});assert.deepEqual(threatDeletion(next),{});
});
