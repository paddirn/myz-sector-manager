import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PORTABLE_SCHEMA} from '../scripts/portable/schema.mjs';
import {parsePortable,serializeSector,deserializeSector,inspectReferences,validatePortable} from '../scripts/portable/serialization.mjs';
const base=new URL('../docs/sector-json/',import.meta.url);
const json=name=>JSON.parse(readFileSync(new URL(name,base),'utf8'));
const schema=json('sector.schema.json'),guide=readFileSync(new URL('SECTOR-JSON-GUIDE.md',base),'utf8');
function dereference(node){return node.$ref?dereference(schema.$defs[node.$ref.split('/').at(-1)]):node;}
function compareDescriptor(actual,documented,path='file'){
 const doc=dereference(documented);
 for(const key of ['type','const','enum','minimum','maxLength','pattern','additionalProperties','maxItems'])if(Object.hasOwn(actual,key))assert.deepEqual(doc[key],actual[key],`${path}: ${key}`);
 assert.deepEqual(doc.required||[],actual.required||[],`${path}: required`);
 if(actual.format==='image-path'){assert.equal(doc.format,undefined);assert.match(doc.description,/runtime validation/);}
 if(actual.maximum!==undefined)assert.equal(doc.maximum,actual.maximum);
 if(actual.type==='integer')assert.equal(doc.maximum,actual.maximum??Number.MAX_SAFE_INTEGER);
 if(actual.properties){assert.deepEqual(Object.keys(doc.properties).sort(),Object.keys(actual.properties).sort(),`${path}: recognized properties`);for(const [key,value] of Object.entries(actual.properties))compareDescriptor(value,doc.properties[key],`${path}.${key}`);}
 if(actual.items)compareDescriptor(actual.items,doc.items,`${path}[]`);
 if(actual.anyOf){assert.equal(doc.anyOf.length,actual.anyOf.length);actual.anyOf.forEach((value,index)=>compareDescriptor(value,doc.anyOf[index],`${path}|${index}`));}
}
test('standalone documentation Schema matches every runtime field/type/enum/optional classification and distinguishes the three permissive type branches',()=>{
 assert.equal(schema.$schema,'https://json-schema.org/draft/2020-12/schema');assert.equal(schema.properties.sector.oneOf.length,3);
 const envelope=structuredClone(schema);envelope.properties.sector={$ref:'#/$defs/SectorContent'};compareDescriptor(PORTABLE_SCHEMA,envelope);
 for(const type of ['Normal','Special','Settlement']){const branch=schema.$defs[type+'Sector'];assert.deepEqual(branch.allOf[1].properties.sectorType,{const:type.toLowerCase()});assert.deepEqual(branch.allOf[1].required,['sectorType']);}
});
test('field catalog enumerates every declared object property and examples do not invent document references',async()=>{
 for(const [family,value] of Object.entries(schema.$defs)){
  if(!value.properties)continue;
  const start=guide.lastIndexOf(`### ${family}\n`);assert(start>=0,`Missing catalog family ${family}`);const rest=guide.slice(start),section=rest.split('\n### ').slice(0,1).join('');
  for(const key of Object.keys(value.properties))assert(section.includes(`| \`${key}\` |`),`Missing ${family}.${key}`);
 }
 for(const type of ['normal','special','settlement']){const example=json(`example-${type}-sector.json`),parsed=parsePortable(JSON.stringify(example));assert.equal(parsed.file.sector.sectorType,type);assert.equal(parsed.file.extensions.unknown.length,0);assert.deepEqual(await inspectReferences(parsed.file,{fromUuid:()=>assert.fail('Documentation examples must not invent UUIDs')}),[]);}
});
test('complete examples materialize through real import code and re-export with full supported round-trip content and new placement',()=>{
 for(const type of ['normal','special','settlement']){
  const example=json(`example-${type}-sector.json`),before=structuredClone(example),record=deserializeSector(example,{sceneId:'documentation-source',code:'A1'}),exported=serializeSector(record,{moduleVersion:'0.1.36'}),placed=deserializeSector(exported,{sceneId:'documentation-destination',code:'D7'}),again=serializeSector(placed,{moduleVersion:'0.1.36'});
  assert.deepEqual(example,before);assert.deepEqual(again.sector,exported.sector);assert.equal(placed.code,'D7');assert.equal(placed.sceneId,'documentation-destination');assert.equal(again.sector.code,undefined);assert.equal(again.sector.placement,undefined);assert.equal(again.extensions.unknown.length,0);
  if(type==='special')for(const key of ['locations','inhabitants','gear','events'])assert(placed.special[key].length>=2);
  if(type==='settlement'){assert.equal(example.sector.settlement.shop.playerAccess,false);assert.deepEqual(example.sector.settlement.shop.trading,{enabled:false,values:{bullets:1,cleanGrub:1,cleanWater:1}});assert.equal(placed.settlement.shop.playerAccess,false);assert.deepEqual(placed.settlement.shop.trading,example.sector.settlement.shop.trading);for(const key of ['projects','inhabitants','factions','events','threads'])assert(placed.settlement[key].length>0);assert.equal(placed.settlement.shop.groups.length,5);assert(placed.settlement.shop.groups.every(group=>group.entries.length===0));assert(placed.settlement.factions.some(faction=>faction.id===placed.settlement.inhabitants[0].factionId));}
 }
});
test('documented operational distinctions are real: empty reference constraints, unknown aliases, Special quantities and defaults',()=>{
 const file=sector=>({format:'myz-sector-manager',formatVersion:1,schemaVersion:1,sector});
 assert.throws(()=>validatePortable(file({sectorType:'settlement',settlement:{shop:{version:1,groups:[{id:'g',entries:[{id:'item',uuid:''}]}]}}})),/nonempty|UUID/);
 assert.throws(()=>validatePortable(file({sectorType:'settlement',settlement:{factions:[{id:'f',members:[{id:'member',uuid:''}]}]}})),/Actor reference/);
 const aliases=validatePortable(file({sectorType:'special',special:{inhabitants:[{id:'npc',name:'Mara',description:'A scout'}]}}));assert.equal(aliases.file.extensions.unknown.length,2);assert.equal(aliases.file.sector.special.inhabitants[0].title,undefined);
 const record=deserializeSector(file({sectorType:'special',special:{gear:[{quantity:0},{quantity:.5}]}}),{sceneId:'z',code:'A1'});assert.deepEqual(record.special.gear.map(entry=>entry.quantity),[1,1]);assert.equal(record.threatLevel,1);assert.equal(record.rot,0);
 const unknown=deserializeSector(file({sectorType:'special',special:{gear:[{type:'unsupported-category'}]}}),{sceneId:'z',code:'A1'});assert.equal(unknown.special.gear[0].type,'scrap');assert.equal(unknown.special.gear[0].legacyType,undefined);
});
