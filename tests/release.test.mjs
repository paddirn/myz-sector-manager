import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateManifest} from '../scripts/prepare-release.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('../module.json',import.meta.url),'utf8'));
const tag=`v${manifest.version}`;
test('release includes the root manifest and all current runtime entry points',()=>{
  const result=validateManifest(manifest,tag,root);
  assert.equal(result.archive,`myz-sector-manager-${tag}.zip`);
  assert(result.files.includes('module.json'));
  assert(result.files.includes('scripts/sector-manager.mjs'));
  assert(!result.files.includes('tests/sector-manager.test.mjs'));
});
test('reject mismatched tags, invalid versions, changed ID and incorrect release URLs',()=>{
  assert.throws(()=>validateManifest(manifest,'v999.0.0',root),/Tag must match/);
  for(const change of [{version:'01.2.3'},{version:'1.2.3-beta'},{id:'different'},{manifest:'https://example.com/module.json'},{download:'https://example.com/module.zip'},{compatibility:{minimum:'13',verified:'14'}}]){
    assert.throws(()=>validateManifest({...manifest,...change},tag,root));
  }
});
test('reject missing and unsafe module files and missing entry points',()=>{
  for(const esmodules of [[],['missing.mjs'],['../outside.mjs'],['/etc/passwd'],['-unsafe.mjs']]){
    assert.throws(()=>validateManifest({...manifest,esmodules},tag,root));
  }
});


test('release guard allows only confirmed absence and fails closed on errors or existing releases',async()=>{
  const {assertReleaseAbsent}=await import('../scripts/check-release.mjs');
  const options={repository:'paddirn/myz-sector-manager',tag,token:'test-placeholder'};
  for(const status of [200,401,403,429,500]){
    await assert.rejects(assertReleaseAbsent({...options,request:async()=>({status,ok:status===200})}),status===200?/already exists/:new RegExp(`HTTP ${status}`));
  }
  await assertReleaseAbsent({...options,request:async(url)=>{assert(url.endsWith(`/releases/tags/${tag}`));return {status:404,ok:false};}});
  await assert.rejects(assertReleaseAbsent({...options,request:async()=>{throw new Error('Network failed');}}),/Network failed/);
});


test('every relative runtime import is included in the installable package',()=>{
  const {files}=validateManifest(manifest,tag,root);const packed=new Set(files);
  for(const file of manifest.esmodules){
    const code=fs.readFileSync(path.join(root,file),'utf8');
    for(const match of code.matchAll(/from ['"](\.[^'"]+)['"]/g)){
      const imported=path.relative(root,path.resolve(root,path.dirname(file),match[1]));
      assert(packed.has(imported),`${file} imports ${imported} but it is missing from the release package`);
    }
  }
});
