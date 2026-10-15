import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../scripts/sector-manager.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
function fixture(){
  const notices=[];
  const documents=new Map();
  class ApplicationV2 {async render(){return this;} }
  class ZoneRuntime {constructor(){this.store={sectorRecords:()=>[]};}summary(){return '';}bindSummary(){}api(){return {};}register(){}start(){}}
  const context=vm.createContext({console,ZoneRuntime,foundry:{utils:{deepClone:structuredClone},applications:{api:{ApplicationV2},ux:{TextEditor:{implementation:{getDragEventData:e=>e.payload}}}}},Hooks:{once(){}},game:{journal:[],user:{isGM:true}},ui:{notifications:{warn:x=>notices.push(x),error:x=>notices.push(x)}},fromUuid:async uuid=>documents.get(uuid)});
  vm.runInContext(source+'\nglobalThis.Manager=SectorManager; globalThis.normalizeSector=normalize;',context);
  const app=new context.Manager();app.element={querySelector:()=>null,querySelectorAll:()=>[],contains:()=>true};
  return {context,app,notices,documents};
}
const journal=(id,code,name=id)=>({id,name,getFlag:()=>({version:1,code,status:'Scouted',loot:[{title:'Old artifact',uuid:'Item.old'}]})});

test('coordinates sort naturally with names as fallback and sidebar text is escaped',()=>{
  const {context,app}=fixture();
  context.game.journal=[journal('ten','A10'),journal('none','','Zed'),journal('two','A2','<Long sector>'),journal('one','A1')];
  assert.deepEqual(Array.from(app.journals,x=>x.id),['one','two','ten','none']);
  context.game.journal.get=()=>undefined;
  const html=app.build();
  assert.match(html,/<span class="sm-sector-meta"><strong>A2<\/strong><small> · Scouted<\/small><\/span><span>&lt;Long sector&gt;<\/span>/);
  assert.match(html,/height:auto;min-height:0;flex:0 0 auto/);
});

test('older records receive independent supply defaults without modifying existing loot or source',()=>{
  const {context}=fixture();const original=journal('old','A1').getFlag();
  const data=context.normalizeSector(original);
  assert.equal(Object.keys(data.supplies).length,6);
  assert.equal(data.loot[0].uuid,'Item.old');
  assert.equal(original.supplies,undefined);
  data.supplies.cleanGrub.quantity=1.25;
  assert.equal(data.supplies.rotGrub.quantity,0);
});

test('capture keeps fractional supplies and checkbox booleans without touching existing loot',()=>{
  const {context,app}=fixture();const j=journal('old','A1');context.game.journal.get=()=>j;
  app.draft=context.normalizeSector(j.getFlag());
  app.element={querySelectorAll:()=>[
    {name:'supplies.cleanGrub.quantity',type:'number',value:'2.75'},
    {name:'supplies.cleanGrub.collected',type:'checkbox',checked:true,value:'on'},
    {name:'supplies.booze.quantity',type:'number',value:'-1'}
  ]};
  app.capture();assert.equal(app.draft.supplies.cleanGrub.quantity,2.75);
  assert.equal(app.draft.supplies.cleanGrub.collected,true);
  assert.equal(app.draft.supplies.booze.quantity,0);
  assert.equal(app.draft.loot[0].title,'Old artifact');
});

test('document drops resolve UUIDs, reject incorrect types, and preserve unsaved fields',async()=>{
  const {app,documents,notices}=fixture();
  let captured=0;app.capture=()=>captured++;app.element={querySelector:()=>null,contains:()=>true};app.renderReference=async()=>{};
  const input={value:'Item.original'};const zone={dataset:{type:'Item'},querySelector:()=>input};
  const event={payload:{uuid:'Actor.wrong'},preventDefault(){},stopPropagation(){}};
  documents.set('Actor.wrong',{uuid:'Actor.wrong',documentName:'Actor'});
  await app.dropReference(event,zone);assert.equal(input.value,'Item.original');assert.equal(captured,0);assert.match(notices[0],/expects a Item/);
  documents.set('Item.valid',{uuid:'Item.valid',documentName:'Item'});event.payload.uuid='Item.valid';
  await app.dropReference(event,zone);assert.equal(input.value,'Item.valid');assert.equal(captured,1);assert.equal(app.dirty,true);
});

test('native reference clicks invoke Foundry document-link hooks; missing UUIDs report errors',async()=>{
  const {app,documents,notices}=fixture();let opened=0,viewed=0;
  documents.set('Item.one',{documentName:'Item',_onClickDocumentLink:async()=>opened++});
  documents.set('Scene.one',{documentName:'Scene',_onClickDocumentLink:async()=>viewed++});
  const zone=uuid=>({querySelector:()=>({value:uuid})});
  await app.openReference(zone('Item.one'));await app.openReference(zone('Scene.one'));
  assert.equal(opened,1);assert.equal(viewed,1);
  await app.openReference(zone('Item.missing'));assert.match(notices[0],/could not be found/);
});


test('saving and reopening preserves fractional supplies, collected state and existing records',async()=>{
  const {context,app}=fixture();let stored={version:1,code:'A1',loot:[{title:'Artifact',uuid:'Item.old'}]};
  const j={id:'old',name:'Old sector',getFlag:()=>stored,update:async()=>{},setFlag:async(mod,key,data)=>{stored=structuredClone(data);}};
  context.game.journal.get=()=>j;context.ui.notifications.info=()=>{};
  app.sectorId='old';app.draft=context.normalizeSector(stored);app.capture=()=>{};
  app.draft.supplies.cleanWater={quantity:3.5,collected:true};
  await app.action('save');
  const reopened=new context.Manager();await reopened.navigate('old');
  assert.equal(reopened.draft.supplies.cleanWater.quantity,3.5);
  assert.equal(reopened.draft.supplies.cleanWater.collected,true);
  assert.equal(reopened.draft.loot[0].uuid,'Item.old');
});


const entries = () => ({version:1,locations:[{title:'Factory',uuid:'Scene.one'},{title:'Vault',uuid:'Scene.two'}],loot:[{title:'Artifact'}],encounters:[],effects:[],secrets:[],history:[]});

test('collapse identities survive editing, reordering and cloned data on reopen without changing flags',()=>{
  const {context,app}=fixture();app.sectorId='sector';app.draft=entries();
  const initial=JSON.stringify(app.draft);
  const id=app.entryState('locations').entries[0].id;
  app.setCollapsed('locations',id,true);
  assert.equal(JSON.stringify(app.draft),initial);assert.equal(app.dirty,false);
  assert.equal(app.entryState('locations').collapsed.size,1);
  app.draft.locations[0].title='Edited Factory';app.draft.locations.reverse();
  const state=app.entryState('locations');
  assert.equal(state.entries[1].id,id);assert(state.collapsed.has(id));
  const reopened=new context.Manager();reopened.sectorId='sector';reopened.draft=structuredClone(app.draft);
  assert.equal(reopened.entryState('locations').entries[1].id,id);
  assert(reopened.entryState('locations').collapsed.has(id));
});

test('expand and collapse all are scoped to the active tab and sector',()=>{
  const {app}=fixture();app.sectorId='one';app.draft=entries();app.tab='Locations';
  app.collapseAll(true);assert.equal(app.entryState('locations').collapsed.size,2);
  assert.equal(app.entryState('loot').collapsed.size,0);
  app.tab='Loot';app.collapseAll(true);assert.equal(app.entryState('loot').collapsed.size,1);
  app.tab='Locations';app.collapseAll(false);assert.equal(app.entryState('locations').collapsed.size,0);
  assert.equal(app.entryState('loot').collapsed.size,1);
  app.sectorId='two';app.draft=entries();assert.equal(app.entryState('loot').collapsed.size,0);
});

test('deleting by stable UI identity forgets its state without shifting remaining identities',async()=>{
  const {app}=fixture();app.sectorId='sector';app.draft=entries();app.capture=()=>{};
  const [first,second]=app.entryState('locations').entries;
  app.setCollapsed('locations',first.id,true);app.setCollapsed('locations',second.id,true);
  app.draft.locations.reverse();
  await app.removeEntry('locations',first.id);
  const state=app.entryState('locations');
  assert.equal(app.draft.locations.length,1);assert.equal(app.draft.locations[0].title,'Vault');
  assert.equal(state.entries[0].id,second.id);assert(!state.collapsed.has(first.id));assert(state.collapsed.has(second.id));
  app.draft.locations.push({title:'New'});
  const added=app.entryState('locations').entries[1];assert(!state.collapsed.has(added.id));
});

function referenceZone(uuid){
  const listeners={};
  const link={setAttribute(){},addEventListener:(name,fn)=>listeners[name]=fn,click:()=>listeners.click({preventDefault(){},stopPropagation(){}})};
  const target={classList:{add(){},remove(){}},textContent:'',innerHTML:'',querySelector:()=>link};
  const input={value:uuid}, clear={disabled:false};
  const zone={querySelector:selector=>selector==='input'?input:selector==='[data-reference-link]'?target:clear};
  return {zone,target,input,clear,listeners,link};
}

test('legacy UUIDs enrich into native links with keyboard support and no separate open button',async()=>{
  const {app,context,documents}=fixture();const {zone,target,listeners}=referenceZone('Item.one');let opened=0;
  documents.set('Item.one',{_onClickDocumentLink:async()=>opened++});
  context.foundry.applications.ux.TextEditor.implementation.enrichHTML=async(text,options)=>{
    assert.equal(text,'@UUID[Item.one]');assert.equal(options.documents,true);assert.equal(options.rolls,false);
    return '<a class="content-link">Artifact</a>';
  };
  await app.renderReference(zone);assert.match(target.innerHTML,/content-link/);
  await listeners.keydown({key:'Enter',preventDefault(){},stopPropagation(){}});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(opened,1);
  context.game.journal.get=()=>({name:'Sector'});app.draft=entries();app.tab='Locations';
  assert(!app.build().includes('Open Reference'));assert(!app.build().includes('Reference UUID (optional)'));
});

test('missing or malformed references retain their UUID and can be cleared safely',async()=>{
  const {app}=fixture();
  const missing=referenceZone('Item.missing');await app.renderReference(missing.zone);
  assert.match(missing.target.textContent,/Missing reference/);assert.equal(missing.input.value,'Item.missing');
  const malformed=referenceZone('Item.bad]@UUID[Actor.injected');await app.renderReference(malformed.zone);
  assert.match(malformed.target.textContent,/Reference unavailable/);assert.equal(malformed.target.innerHTML,'');
  app.capture=()=>{};await app.clearReference(missing.zone);assert.equal(missing.input.value,'');assert(missing.clear.disabled);
  assert.equal(missing.target.textContent,'Drop a document here');assert(app.dirty);
});

test('a slow enrichment cannot restore a reference after it was cleared',async()=>{
  const {app,context}=fixture();const {zone,input,target}=referenceZone('Item.slow');let resolve;
  context.fromUuid=()=>new Promise(done=>resolve=done);
  const pending=app.renderReference(zone);
  input.value='';await app.renderReference(zone);
  resolve({_onClickDocumentLink(){}});await pending;
  assert.equal(target.textContent,'Drop a document here');assert.equal(target.innerHTML,'');
});

test('all repeatable tabs have accessible entry toggles; Overview remains a form',()=>{
  const {app,context}=fixture();context.game.journal.get=()=>({name:'Sector'});app.sectorId='sector';app.draft=entries();
  for(const [tab,key] of Object.entries({Locations:'locations',Encounters:'encounters',Loot:'loot',Effects:'effects',Secrets:'secrets',History:'history'})){
    app.tab=tab;app.draft[key]=[{title:'One'},{title:'Two'}];const html=app.build();
    assert.match(html,/aria-expanded="true" aria-controls="sm-entry-\d+-body"/);
    assert.match(html,/data-expand-all/);assert.match(html,/data-collapse-all/);
  }
  app.tab='Overview';assert(!app.build().includes('data-entry-toggle'));
});


test('Effects exposes an Actor drop reference without changing older record category or custom data',()=>{
  const {app,context}=fixture();context.game.journal.get=()=>({name:'Sector'});app.sectorId='sector';app.draft=entries();app.tab='Effects';
  app.draft.effects=[{title:'Zone anomaly',category:'Phenomenon',duration:'One day',custom:{preserve:true}}];
  const before=JSON.stringify(app.draft);const html=app.build();assert.match(html,/data-reference data-type="Actor"/);assert.match(html,/name="effects.0.uuid"/);assert.match(html,/value="Phenomenon" selected/);assert.equal(JSON.stringify(app.draft),before);
});

test('Find the Path defaults are additive, independent and include eight core benefits plus talent metadata',()=>{
  const {context,app}=fixture();const original={version:1,rot:'Custom Rot',terrain:'A bespoke place',pathStunts:{artifact:true,futureStunt:true},loot:[{title:'Keep'}]};
  const data=context.normalizeSector(original);assert.equal(data.pathStunts.artifact,true);assert.equal(data.pathStunts.safePath,false);assert.equal(data.pathStunts.futureStunt,true);assert.equal(original.pathStunts.safePath,undefined);
  data.pathStunts.bullets=true;assert.equal(context.normalizeSector({version:1}).pathStunts.bullets,false);
  context.game.journal.get=()=>({name:'Sector',getFlag:()=>original});app.draft=data;app.tab='Find the Path';
  const html=app.build();assert.equal((html.match(/name="pathStunts\./g)||[]).length,9);assert.match(html,/Talent Stunts/);assert.match(html,/Rot Finder talent; Core Rulebook p. 64/);assert.match(html,/once per Find the Path roll/);assert.match(html,/Checkboxes save automatically/);
});

test('stunt autosaves persist per sector across reopen without saving unrelated draft fields or overwriting old loot',async()=>{
  const {context,app}=fixture();let stored={version:1,code:'A1',terrain:'Original',loot:[{title:'Keep'}]};
  const j={id:'a',name:'A',getFlag:()=>stored,setFlag:async(mod,key,value)=>{stored=structuredClone(value);}};context.game.journal.get=id=>id==='a'?j:undefined;
  app.sectorId='a';app.draft=context.normalizeSector(stored);app.draft.terrain='Unsaved terrain';app.draft.pathStunts.artifact=true;
  const first=app.persistStunts();app.draft.pathStunts.bullets=true;const second=app.persistStunts();await Promise.all([first,second]);
  const reopened=new context.Manager();await reopened.navigate('a');assert.equal(reopened.draft.pathStunts.artifact,true);assert.equal(reopened.draft.pathStunts.bullets,true);assert.equal(stored.terrain,'Original');assert.equal(stored.loot[0].title,'Keep');
  assert.equal(context.normalizeSector({version:1,code:'B1'}).pathStunts.artifact,false);
});

test('reset stunts requires confirmation and persists only defined checkboxes for the current sector',async()=>{
  const {context,app}=fixture();let stored={version:1,pathStunts:{artifact:true,saferRoute:true,futureStunt:true},loot:[{title:'Keep'}]};
  context.game.journal.get=()=>({name:'A',getFlag:()=>stored,setFlag:async(mod,key,value)=>{stored=structuredClone(value);}});app.sectorId='a';app.draft=context.normalizeSector(stored);app.capture=()=>{};
  context.foundry.applications.api.DialogV2={confirm:async()=>false};await app.action('reset-stunts');assert.equal(stored.pathStunts.artifact,true);
  context.foundry.applications.api.DialogV2.confirm=async()=>true;await app.action('reset-stunts');assert.equal(stored.pathStunts.artifact,false);assert.equal(stored.pathStunts.saferRoute,false);assert.equal(stored.pathStunts.futureStunt,true);assert.equal(stored.loot[0].title,'Keep');
});

test('environment controls retain custom terrain and legacy Rot values, then capture selected numeric levels',()=>{
  const {context,app}=fixture();context.game.journal.get=()=>({name:'A'});app.draft=context.normalizeSector({version:1,terrain:'My custom & unusual ruins',rot:'Deadly mist'});
  let html=app.build();assert.match(html,/list="sm-terrain-options"/);assert.match(html,/My custom &amp; unusual ruins/);assert.match(html,/value="Deadly mist" selected/);assert.match(html,/Localized Rot hotspot; not a sector-wide level/);
  app.element.querySelectorAll=()=>[{name:'terrain',type:'text',value:'Another custom terrain'},{name:'rot',type:'select-one',value:'Deadly mist'}];app.capture();assert.equal(app.draft.rot,'Deadly mist');assert.equal(app.draft.terrain,'Another custom terrain');
  for(const level of [0,1,2,3]){app.element.querySelectorAll=()=>[{name:'rot',type:'select-one',value:String(level)}];app.capture();assert.equal(app.draft.rot,level);assert.match(app.build(),new RegExp(`value="${level}" selected`));}
});

test('terrain suggestions contain all 61 verified names, uniquely sorted, with exact rulebook spelling',()=>{
  const {context,app}=fixture();context.game.journal.get=()=>({name:'A'});app.draft=context.normalizeSector({version:1,terrain:'Legacy unlisted location',rot:7});
  const html=app.build(),list=html.match(/<datalist id="sm-terrain-options">(.*?)<\/datalist>/s)[1];
  const options=Array.from(list.matchAll(/<option value="([^"]+)"><\/option>/g),match=>match[1]);
  assert.equal(options.length,61);assert.equal(new Set(options).size,61);assert.deepEqual(options,[...options].sort((a,b)=>a.localeCompare(b,'en')));assert(options.includes('Glasified Field'));assert(options.includes('Shipwreck'));assert(options.includes('Purification Plant'));assert.equal(options[0],'Airplane Wreck');assert.equal(options.at(-1),'Windmill');assert.match(html,/value="Legacy unlisted location"/);assert.match(html,/value="7" selected/);
});
