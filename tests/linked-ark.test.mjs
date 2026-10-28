import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arkInformation,arkCoordinateState,synchronizeArkProjects,synchronizeArkDraft} from '../scripts/settlement-ark.mjs';
import {serializeSector,deserializeSector,validatePortable} from '../scripts/portable/serialization.mjs';
const project=(id='farm',system={})=>({documentName:'Item',type:'project',id,uuid:`Actor.ark.Item.${id}`,name:`Project ${id}`,system:{description:'Description',work_points:'5 / 10',completed:false,comment:'Source note',...system}});
const ark=items=>({documentName:'Actor',type:'ark',uuid:'Actor.ark',system:{coordinates:'B2',population:'42',dev_levels:Object.fromEntries(['food','culture','technology','warfare'].map((k,i)=>[k,{value:11+i,max:0}]))},items:items||[project()]});
const env={game:{system:{id:'mutant-year-zero'},user:{isGM:true}}};
test('Ark development displays current values only in the official category order',()=>{
 const rows=arkInformation(ark(),env).filter(([k])=>k.startsWith('Development:'));
 assert.deepEqual(rows,[['Development: food',11],['Development: culture',12],['Development: technology',13],['Development: warfare',14]]);
});
test('Ark Project synchronization is idempotent, preserves manual records and uses source completion/work-point text without invented progress',()=>{
 const manual={id:'manual',title:'Manual',uuid:'Item.manual',progress:'Campaign progress',notes:'Keep'},settlement={arkUuid:'Actor.ark',projects:[manual]},source=ark(),before=structuredClone(settlement);
 const first=synchronizeArkProjects(settlement,source);assert(first.changed);assert.deepEqual(settlement,before);assert.equal(first.projects[0],manual);
 const linked=first.projects[1];assert.equal(linked.progress,'5 / 10');assert.equal(linked.status,'Not completed');assert.equal(linked.details,'Description');assert.equal(linked.notes,'Source note');assert.equal(linked.arkSource.projectUuid,source.items[0].uuid);
 const again=synchronizeArkProjects({...settlement,projects:first.projects},source);assert.equal(again.changed,false);assert.deepEqual(again.projects,first.projects);
 source.items[0].name='Renamed';source.items[0].system.completed=true;source.items[0].system.work_points='Complete';const updated=synchronizeArkProjects({...settlement,projects:first.projects},source);assert.equal(updated.projects[1].id,linked.id);assert.equal(updated.projects[1].title,'Renamed');assert.equal(updated.projects[1].status,'Completed');assert.equal(updated.projects[1].progress,'Complete');assert.deepEqual(updated.projects[0],manual);
});
test('missing/deleted/detached Ark Projects retain snapshots and can recover without duplicating entries',()=>{
 const settlement={arkUuid:'Actor.ark',projects:[]},first=synchronizeArkProjects(settlement,ark()).projects;
 for(const source of [null,ark([]),{...ark(),uuid:'Actor.other'}]){const result=synchronizeArkProjects({...settlement,projects:first},source);assert.equal(result.projects.length,1);assert.equal(result.projects[0].arkSource.missing,true);assert.equal(result.projects[0].details,'Description');assert.equal(synchronizeArkProjects({...settlement,projects:result.projects},source).changed,false);}
 const missing=synchronizeArkProjects({...settlement,projects:first},null).projects;
 assert.equal(synchronizeArkProjects({...settlement,projects:missing},ark()).projects[0].arkSource.missing,false);
 const detached=synchronizeArkProjects({arkUuid:'',projects:first},null).projects;assert.equal(detached[0].arkSource.arkUuid,'Actor.ark');assert(detached[0].arkSource.missing);
});
test('stable identities avoid manual ID collisions and repeated source metadata duplicates',()=>{
 const settlement={arkUuid:'Actor.ark',projects:[]},source=ark([project('a'),project('b')]),first=synchronizeArkProjects(settlement,source).projects;
 const manual={id:first[0].id,title:'Manual'},collision=synchronizeArkProjects({...settlement,projects:[manual]},source);assert.equal(new Set(collision.projects.map(p=>p.id)).size,3);
 const crossFamily=synchronizeArkProjects({...settlement,inhabitants:[{id:first[0].id,title:'Resident'}]},source);assert.notEqual(crossFamily.projects[0].id,first[0].id);
 const duplicates=synchronizeArkProjects({...settlement,projects:[...first,{...first[0],id:'duplicate'}]},source);assert.equal(duplicates.projects.length,2);
});
test('synchronization updates only the current draft and never writes source Actors or Journals',async()=>{
 const source=ark();let dirty=0,writes=0;const host={draft:{settlement:{arkUuid:source.uuid,projects:[]}},markDirty:()=>dirty++,journal:{update:()=>writes++}};
 const local={...env,fromUuid:async()=>source};assert(await synchronizeArkDraft(host,local));assert.equal(dirty,1);assert.equal(writes,0);assert.equal(await synchronizeArkDraft(host,local),false);assert.equal(dirty,1);
 let resolve;local.fromUuid=()=>new Promise(r=>resolve=r);const old=host.draft,task=synchronizeArkDraft(host,local);host.draft={settlement:{arkUuid:'Actor.other',projects:[]}};resolve(source);assert.equal(await task,false);assert.equal(host.draft.settlement.projects.length,0);host.draft=old;
});
test('coordinate assessment covers valid/manual, invalid, occupied, ambiguous, foreign Scene and out-of-grid without mutations',()=>{
 const grid={reference:'A1',originX:0,originY:0,width:100,height:100,columns:3,rows:3,columnAxis:'x',columnDirection:1,rowDirection:1};
 const sector={version:1,sectorType:'settlement',code:'A1',sceneId:'zone'},source=ark(),context={grid,sceneId:'zone',journals:[],journalId:'self'};
 const before=JSON.stringify({sector,source,context});assert.equal(arkCoordinateState(source,sector,context).state,'manual');assert.equal(JSON.stringify({sector,source,context}),before);
 assert.equal(arkCoordinateState(source,{...sector,code:'B2'},context).state,'matched');assert.equal(arkCoordinateState(source,sector,{}).state,'unavailable');assert.equal(arkCoordinateState({...source,system:{coordinates:'bad'}},sector,context).state,'invalid');assert.equal(arkCoordinateState({...source,system:{coordinates:'Z99'}},sector,context).state,'out-of-grid');assert.equal(arkCoordinateState(source,{...sector,sceneId:'other'},context).state,'foreign-scene');
 const other={id:'other',getFlag:()=>({...sector,code:'B2'})};assert.equal(arkCoordinateState(source,sector,{...context,journals:[other]}).state,'occupied');assert.equal(arkCoordinateState(source,sector,{...context,journals:[other,{...other,id:'third'}]}).state,'ambiguous');
});
test('Ark source metadata round trips through real import/export and incomplete metadata is rejected',()=>{
 const settlement={arkUuid:'Actor.ark',projects:[]};settlement.projects=synchronizeArkProjects(settlement,ark()).projects;
 const record={version:1,sectorType:'settlement',code:'A1',settlement},file=serializeSector(record,{moduleVersion:'0.1.39'});assert.equal(file.extensions.unknown.length,0);
 const imported=deserializeSector(file,{code:'C3',sceneId:'zone'});assert.deepEqual(imported.settlement.projects,settlement.projects);assert.equal(synchronizeArkProjects(imported.settlement,ark()).changed,false);
 const invalid=structuredClone(file);delete invalid.sector.settlement.projects[0].arkSource.projectUuid;assert.throws(()=>validatePortable(invalid),/required/);
});

test('Project presentation sorts zero-progress Not started alphabetically and sorts Completed names without mutating stored order',async()=>{
 const {projectDisplayCompare}=await import('../scripts/entry-order.mjs');
 const entries=[{title:'Zebra',status:'Completed'},{title:'Zulu',status:'Not completed'},{title:'Alpha',status:'Completed'},{title:'Beta',status:'Not completed'}],before=structuredClone(entries);
 const displayed=entries.map((entry,index)=>({entry,index})).sort((a,b)=>projectDisplayCompare(a.entry,b.entry,a.entry.title,b.entry.title,a.index,b.index));assert.deepEqual(displayed.map(row=>row.entry.title),['Beta','Zulu','Alpha','Zebra']);assert.deepEqual(entries,before);
});
