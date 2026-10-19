import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MODULE,REFERENCE_SETTING,REFERENCE_DEFINITIONS,emptyReferenceConfiguration,referenceConfiguration,configuredUuid,referenceSelection,validateReference,validateAllReferences,resolveConfiguredDocument,validateReferenceOverrides,saveReferenceConfiguration,exportReferenceConfiguration,importReferenceConfiguration,migrateReferenceConfiguration,ensureReferenceMigration,legacyIdentity} from '../scripts/document-references.mjs';
import {registerDocumentReferences} from '../scripts/document-reference-settings.mjs';
import {generateSector,rollThreat,TABLE_UUIDS} from '../scripts/sector-randomizer.mjs';
import {terrainDescription} from '../scripts/terrain-descriptions.mjs';
import {generateEntry} from '../scripts/entry-generation.mjs';
function fixture(configuration=emptyReferenceConfiguration()){
 let saved=structuredClone(configuration),writes=0,lookups=0;const docs=new Map(),warnings=[],registered=new Map(),menus=new Map();
 const env={console:{info(){},warn(){}},game:{version:'14.366',modules:new Map([[MODULE,{version:'0.1.24'}]]),user:{isGM:true,id:'gm'},users:{activeGM:{id:'gm'}},settings:{get:()=>saved,set:async(m,k,next)=>{assert.equal(m,MODULE);assert.equal(k,REFERENCE_SETTING);saved=structuredClone(next);writes++;},register:(m,k,options)=>registered.set(k,options),registerMenu:(m,k,options)=>menus.set(k,options)}},foundry:{applications:{api:{ApplicationV2:class{}}}},fromUuid:async uuid=>{lookups++;return docs.get(uuid);},ui:{notifications:{warn:m=>warnings.push(m)}}};
 const table=(uuid,name='Test table',text='A result')=>{const doc={uuid,name,documentName:'RollTable',formula:'1d6',results:[{range:[1,6],weight:1,description:text}],testUserPermission:()=>true,roll:async()=>({results:[{description:text}]})};docs.set(uuid,doc);return doc;};
 return {env,docs,table,warnings,registered,menus,saved:()=>saved,writes:()=>writes,lookups:()=>lookups};
}
test('registry audits 29 unique resources; zero bundled defaults; fresh worlds never resolve legacy IDs implicitly',async()=>{
 assert.equal(REFERENCE_DEFINITIONS.length,29);assert.equal(new Set(REFERENCE_DEFINITIONS.map(def=>def.key)).size,29);assert.equal(REFERENCE_DEFINITIONS.filter(def=>def.defaultUuid).length,0);assert.equal(REFERENCE_DEFINITIONS.filter(def=>def.required).length,13);
 const f=fixture();for(const def of REFERENCE_DEFINITIONS)f.table(def.legacyUuid,def.label);
 const results=await validateAllReferences(f.env);assert(results.every(row=>row.status==='Unconfigured'));assert.equal(f.lookups(),0);await assert.rejects(resolveConfiguredDocument('generation.environment',f.env),/Unconfigured/);
});
test('world custom/default/disabled states, live replacement, world/compendium UUIDs and resolution errors are distinct',async()=>{
 const f=fixture();const key='generation.environment';assert.equal(configuredUuid(key,f.env),null);
 for(const uuid of ['RollTable.world','Compendium.test.tables.RollTable.environment']){const table=f.table(uuid);await saveReferenceConfiguration({...f.saved(),references:{[key]:{mode:'custom',uuid}}},f.env);assert.equal(configuredUuid(key,f.env),uuid);assert.equal(await resolveConfiguredDocument(key,f.env),table);}
 await saveReferenceConfiguration({...f.saved(),references:{[key]:{mode:'disabled'}}},f.env);assert.equal(referenceSelection(key,f.env).mode,'disabled');assert.equal((await validateReference(key,f.env)).status,'Disabled');await assert.rejects(resolveConfiguredDocument(key,f.env),/Disabled/);
 await saveReferenceConfiguration({...f.saved(),references:{[key]:{mode:'default'}}},f.env);assert.equal((await validateReference(key,f.env)).status,'Unconfigured');
});
test('validation reports missing, invalid, wrong-type and inaccessible references without writes or document mutation',async()=>{
 const f=fixture(),key='generation.environment',uuid='RollTable.test';const candidate={references:{[key]:{mode:'custom',uuid}}};
 assert.equal((await validateReference(key,f.env,candidate)).status,'Missing');f.docs.set(uuid,{documentName:'Actor',name:'Wrong'});assert.equal((await validateReference(key,f.env,candidate)).status,'Wrong Document Type');const doc=f.table(uuid);doc.testUserPermission=()=>false;assert.equal((await validateReference(key,f.env,candidate)).status,'Inaccessible');f.env.fromUuid=async()=>{throw Error('Pack locked');};assert.equal((await validateReference(key,f.env,candidate)).status,'Inaccessible');assert.equal((await validateReference(key,f.env,{references:{[key]:{mode:'custom',uuid:'not a uuid!'}}})).status,'Missing');assert.equal(f.writes(),0);
});
test('registration uses restricted native world setting and ApplicationV2 settings menu',()=>{
 const f=fixture();const type=registerDocumentReferences(f.env);const setting=f.registered.get(REFERENCE_SETTING);assert.equal(setting.scope,'world');assert.equal(setting.restricted,true);assert.equal(setting.type,Object);const menu=f.menus.get('documentReferencesMenu');assert.equal(menu.type,type);assert.equal(menu.restricted,true);assert(type.prototype instanceof f.env.foundry.applications.api.ApplicationV2);
});
test('migration recognizes structurally valid named legacy tables; preserves overrides and all unrelated world data',async()=>{
 const f=fixture();const normal=REFERENCE_DEFINITIONS.find(def=>def.key==='generation.environment'),terrain=REFERENCE_DEFINITIONS.find(def=>def.terrain==='Ash Desert');f.table(normal.legacyUuid,normal.label);const description=f.table(terrain.legacyUuid,terrain.label);description.results=Array.from({length:6},(_,i)=>({weight:1,range:[i+1,i+1],description:`Original paragraph ${i}`}));
 f.saved().references['generation.rot']={mode:'disabled'};f.saved().untouched={sector:'not rewritten'};const before=structuredClone(f.saved());const result=await migrateReferenceConfiguration(f.env);assert.deepEqual(result.references[normal.key],{mode:'custom',uuid:normal.legacyUuid});assert.deepEqual(result.references[terrain.key],{mode:'custom',uuid:terrain.legacyUuid});assert.deepEqual(result.references['generation.rot'],{mode:'disabled'});assert.deepEqual(result.untouched,before.untouched);assert.equal(result.migration.version,1);assert.equal(f.warnings.length,1);const lookups=f.lookups();await migrateReferenceConfiguration(f.env);assert.equal(f.writes(),1);assert.equal(f.lookups(),lookups);
});
test('unrelated legacy names, wrong types, missing tables and malformed six-result descriptions are never activated',async()=>{
 const f=fixture();for(const def of REFERENCE_DEFINITIONS)f.table(def.legacyUuid,'Completely unrelated');const wrong=REFERENCE_DEFINITIONS[0];f.docs.get(wrong.legacyUuid).documentName='Actor';const terrain=REFERENCE_DEFINITIONS.find(def=>def.terrain);const doc=f.docs.get(terrain.legacyUuid);doc.name=terrain.label;assert.equal(legacyIdentity(terrain,doc),false);
 const result=await migrateReferenceConfiguration(f.env);assert.deepEqual(result.references,{});assert.equal(result.migration.outcomes.length,29);assert(result.migration.outcomes.some(row=>row.status==='Review legacy identity'));assert(result.migration.outcomes.some(row=>row.status==='Wrong Document Type'));
});
test('migration requires active GM, avoids duplicate in-flight work and never overwrites concurrent settings',async()=>{
 const f=fixture();f.env.game.users.activeGM={id:'other'};assert.equal(await migrateReferenceConfiguration(f.env),null);assert.equal(f.lookups(),0);f.env.game.users.activeGM={id:'gm'};
 await Promise.all([ensureReferenceMigration(f.env),ensureReferenceMigration(f.env)]);assert.equal(f.writes(),1);
 const conflict=fixture();let first=true;conflict.env.fromUuid=async()=>{if(first){first=false;await saveReferenceConfiguration({...conflict.saved(),references:{'generation.rot':{mode:'disabled'}}},conflict.env);}return null;};await assert.rejects(migrateReferenceConfiguration(conflict.env),/changed during migration/);assert.equal(conflict.writes(),1);assert.equal(conflict.saved().migration.version,0);assert.equal(conflict.saved().references['generation.rot'].mode,'disabled');
});
test('configuration export/import preserves explicit modes, labels and missing UUIDs; merge/replace never apply before Save',()=>{
 const f=fixture();f.saved().references={'generation.rot':{mode:'disabled'},'generation.environment':{mode:'custom',uuid:'RollTable.world',name:'World environment'}};const text=JSON.stringify(exportReferenceConfiguration(f.saved(),f.env));const data=JSON.parse(text);assert.equal(data.formatVersion,1);assert.equal(data.moduleVersion,'0.1.24');assert.equal(Object.keys(data.references).length,29);assert.equal(data.references['generation.rot'].mode,'disabled');
 const imported=JSON.stringify({formatVersion:1,module:MODULE,references:{'generation.environment':{mode:'custom',uuid:'Compendium.shared.tables.RollTable.env',name:'Original name'}}});const before=structuredClone(f.saved());const merged=importReferenceConfiguration(imported,f.saved(),'merge');assert.equal(merged.references['generation.rot'].mode,'disabled');assert.equal(merged.references['generation.environment'].name,'Original name');const replaced=importReferenceConfiguration(imported,f.saved(),'replace');assert.equal(replaced.references['generation.rot'],undefined);assert.deepEqual(f.saved(),before);assert.equal(f.writes(),0);
});
test('malformed/oversized imports, pollution, unknown keys/properties/types and versions are rejected atomically',()=>{
 const f=fixture(),base={formatVersion:1,module:MODULE,references:{}};const before=JSON.stringify(f.saved());
 for(const input of ['{','x'.repeat(200001),JSON.stringify({...base,formatVersion:2}),JSON.stringify({...base,module:'other'}),JSON.stringify({...base,unknown:true}),JSON.stringify({...base,references:{unknown:{mode:'disabled'}}}),JSON.stringify({...base,references:{'generation.rot':{mode:'custom',uuid:4}}}),JSON.stringify({...base,references:{'generation.rot':{mode:'disabled',uuid:'RollTable.x'}}}),JSON.stringify({...base,references:{'generation.rot':{mode:'disabled',documentType:'Actor'}}}),'{"formatVersion":1,"module":"myz-sector-manager","references":{"__proto__":{"polluted":true}}}'])assert.throws(()=>importReferenceConfiguration(input,f.saved()));
 assert.equal(JSON.stringify(f.saved()),before);assert.equal({}.polluted,undefined);assert.throws(()=>validateReferenceOverrides({'generation.rot':{mode:'custom',uuid:'RollTable.x',code:'execute'}}));
});
test('save enforces GM permission, structural validation and optimistic concurrency',async()=>{
 const f=fixture();const baseline=JSON.stringify(f.saved());await saveReferenceConfiguration({...f.saved(),references:{'generation.rot':{mode:'disabled'}}},f.env,baseline);await assert.rejects(saveReferenceConfiguration(emptyReferenceConfiguration(),f.env,baseline),/another window/);f.env.game.user.isGM=false;await assert.rejects(saveReferenceConfiguration(f.saved(),f.env),/Only a GM/);await assert.rejects(resolveConfiguredDocument('generation.rot',f.env),/GM access/);assert.equal(f.writes(),1);
});
test('runtime custom references drive full generation, nested Threat identity, Events and terrain descriptions without legacy lookup',async()=>{
 const f=fixture();const calls=[];const texts={environment:'Thick Woods, Ruin:No, Threat:Yes, Artifact:No',rot:'0',threatLevel:'1',threatType:'Humanoid',humanoid:'A stranger',mood:'Silence',scrap:'Scrap'};
 for(const def of REFERENCE_DEFINITIONS){const uuid=`Compendium.test.tables.RollTable.${def.key.replaceAll('.','')}`;f.saved().references[def.key]={mode:'custom',uuid};const doc=f.table(uuid,def.label,texts[def.key.slice(11)]||'Description');const original=doc.roll;doc.roll=async()=>{calls.push(def.key);return original();};}
 const humanoid=referenceSelection('generation.humanoid',f.env).uuid;f.docs.get(referenceSelection('generation.threatType',f.env).uuid).roll=async()=>({results:[{documentUuid:humanoid}]});
 const before={version:1,code:'A1',description:'Old',locations:[],encounters:[],effects:[],loot:[]};const result=await generateSector(before,{env:f.env,rollBaseDice:async()=>[1],roll:async()=>10000});assert.equal(result.terrain,'Thick Woods');assert.equal(result.description,'Description');assert.equal(result.encounters[0].title,'A stranger');assert.equal(result.randomization.threatSeverity,1);assert(calls.includes('generation.humanoid'));assert(calls.includes('terrainDescriptions.thickWoods'));
 const eventUuid=referenceSelection('events.ark',f.env).uuid;f.docs.set('JournalEntry.event',{uuid:'JournalEntry.event',documentName:'JournalEntry',name:'Custom Event'});f.docs.get(eventUuid).roll=async()=>({results:[{documentUuid:'JournalEntry.event'}]});assert.equal((await generateEntry('history',before,{env:f.env,event:true,arkCoordinate:'A1'})).title,'Custom Event');
 const key='terrainDescriptions.thickWoods';f.saved().references[key]={mode:'disabled'};assert.equal(await terrainDescription('Thick Woods',f.env),null);assert.equal(before.description,'Old');
});
test('settings read errors and unsupported saved formats never become an empty migration overwrite',async()=>{
 const f=fixture();f.env.game.settings.get=()=>{throw Error('Setting read failed');};await assert.rejects(migrateReferenceConfiguration(f.env),/Setting read failed/);assert.equal(f.writes(),0);
 f.env.game.settings.get=()=>({formatVersion:2,references:{'generation.rot':{mode:'disabled'}}});await assert.rejects(migrateReferenceConfiguration(f.env),/Unsupported saved/);assert.equal(f.writes(),0);
});
test('missing required resources fail generation atomically; optional warnings deduplicate and disabled descriptions never fall back',async()=>{
 const f=fixture(),sector={version:1,code:'A1',description:'Keep',custom:{retained:true},locations:[{title:'Keep Location'}]},before=structuredClone(sector);
 await assert.rejects(generateSector(sector,{env:f.env}),/Unconfigured/);assert.deepEqual(sector,before);assert.equal(f.lookups(),0);
 for(let i=0;i<3;i++)assert.equal(await terrainDescription('Thick Woods',f.env),null);assert.equal(f.warnings.length,1);
 const key='terrainDescriptions.thickWoods',def=REFERENCE_DEFINITIONS.find(def=>def.key===key);f.table(def.legacyUuid,'Thick Woods','Do not use disabled legacy reference');f.saved().references[key]={mode:'disabled'};const lookups=f.lookups();assert.equal(await terrainDescription('Thick Woods',f.env),null);assert.equal(f.lookups(),lookups);
 await assert.rejects(generateSector({...sector,sectorType:'special'},{env:f.env}),/manually authored/);assert.equal(f.lookups(),lookups);
});
