import {PartySkillService} from '../scripts/party-skills.mjs';
import {openPartySkillRequest} from '../scripts/party-skills-ui.mjs';
import {PlayerShopService} from '../scripts/player-shop-service.mjs';
import {createPlayerShopClass} from '../scripts/player-shop-ui.mjs';
import {hydrateArk,requireArk,synchronizeArkDraft} from '../scripts/settlement-ark.mjs';
import {settingsMenu as renderSettingsMenu,bindSettingsMenu,refreshSettingsMenu} from '../scripts/settings-menu.mjs';
import {importSector,exportSector} from '../scripts/portable/ui.mjs';
import {sortEditorEntries} from '../scripts/entry-order.mjs';
import {inhabitantCollection} from '../scripts/inhabitants.mjs';
import {hydrateInhabitants,bindInhabitantDrops,dropInhabitant,linkInhabitant} from '../scripts/inhabitants-ui.mjs';
import {SETTLEMENT_COLLECTIONS,SETTLEMENT_ACCENT,settlementAccent,normalizeSettlement,newSettlementEntry,requireProject,assignProject} from '../scripts/settlement.mjs';
import {renderSettlement,hydrateSettlement,bindSettlement,renderProject} from '../scripts/settlement-ui.mjs';
import {macroRunOnce} from '../scripts/zone/entry-triggers.mjs';
import {safeImageSource} from '../scripts/zone/presentation.mjs';
import {imagePath,journalImageSource} from '../scripts/sector-images.mjs';
import {isSpecial,isSettlement,isAuthored,sectorOnScene,sectorTabs,sectorCollection,specialQuantity,normalizeSpecialGear,normalizeSectorType,sectorTitle,tabLabel} from '../scripts/sector-types.mjs';
import {generateEntry,normalizeEncounter,ENCOUNTER_STATUSES,ENCOUNTER_TYPES} from '../scripts/entry-generation.mjs';
import {normalizePathStunts,normalizeThreatLevel,sectorThreatLevel,threatDescriptor,meaningfulText,cleanThreatRecord,threatDeletion} from '../scripts/sector-fields.mjs';
import {LOOT_TYPES,normalizeLoot,lootTitle,itemLootType,lootQuantity,lootCollected} from '../scripts/loot.mjs';
import {canonicalCoordinate} from '../scripts/zone/grid.mjs';
import {sectorIndicators,iconMarkup} from '../scripts/sector-icons.mjs';
import {travelOptions,travelTimes,formatDuration,sectorTravelOptions,storedTravel,LINKED_STUNTS} from '../scripts/travel-time.mjs';
import {sectorNaming,sectorName,ensureJournalFolders,JournalOrganization} from '../scripts/journal-organization.mjs';
import {generateSector,saveGeneratedSector,RANDOMIZATION_METHODS,DEFAULT_GENERATION_OPTIONS} from '../scripts/sector-randomizer.mjs';
import {tabHasContent,CONSUMABLES} from '../scripts/sector-content.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../scripts/sector-manager.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
function fixture(){
  const notices=[];
  const documents=new Map();
  class ApplicationV2 {async render(){return this;} }
  class ZoneRuntime {constructor(){this.store={sectorRecords:()=>[]};}summary(){return '';}settingsActions(){return '';}setSelection(){}bindSummary(){}api(){return {};}register(){}start(){}}
  const context=vm.createContext({PartySkillService,openPartySkillRequest,PlayerShopService,createPlayerShopClass,hydrateArk,requireArk,synchronizeArkDraft,settingsMenu:(host,runtime)=>renderSettingsMenu(host,runtime,context),bindSettingsMenu,refreshSettingsMenu,importSector,exportSector,sortEditorEntries,inhabitantCollection,hydrateInhabitants,bindInhabitantDrops,dropInhabitant,linkInhabitant,SETTLEMENT_COLLECTIONS,SETTLEMENT_ACCENT,settlementAccent,normalizeSettlement,newSettlementEntry,requireProject,assignProject,renderSettlement,hydrateSettlement,bindSettlement,renderProject,console,macroRunOnce,safeImageSource,imagePath,journalImageSource,isSpecial,isSettlement,isAuthored,sectorOnScene,sectorTabs,sectorCollection,specialQuantity,normalizeSpecialGear,normalizeSectorType,sectorTitle,tabLabel,document:{activeElement:null},generateEntry,normalizeEncounter,ENCOUNTER_STATUSES,ENCOUNTER_TYPES,normalizePathStunts,normalizeThreatLevel,sectorThreatLevel,threatDescriptor,meaningfulText,cleanThreatRecord,threatDeletion,LOOT_TYPES,normalizeLoot,lootTitle,itemLootType,lootQuantity,lootCollected,canonicalCoordinate,sectorIndicators,iconMarkup,travelOptions,travelTimes,formatDuration,sectorTravelOptions,storedTravel,LINKED_STUNTS,sectorNaming,sectorName,ensureJournalFolders,JournalOrganization,ZoneRuntime,tabHasContent,CONSUMABLES,generateSector,saveGeneratedSector,RANDOMIZATION_METHODS,DEFAULT_GENERATION_OPTIONS,foundry:{utils:{deepClone:structuredClone,randomID:()=>crypto.randomUUID()},applications:{api:{ApplicationV2},ux:{TextEditor:{implementation:{getDragEventData:e=>e.payload}}}}},Hooks:{once(){},on(){}},game:{journal:[],user:{isGM:true}},ui:{notifications:{warn:x=>notices.push(x),error:x=>notices.push(x)}},fromUuid:async uuid=>documents.get(uuid)});
  vm.runInContext(source+'\nglobalThis.Manager=SectorManager; globalThis.normalizeSector=normalize;globalThis.dialogOptions=randomizeDialogOptions;',context);
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
  assert.match(html,/data-sector-label>A2 - &lt;Long sector&gt;<\/strong>/);assert.doesNotMatch(html,/No coordinates/);
  assert.match(html,/height:auto;min-height:0;flex:0 0 auto/);
});

test('older records receive independent supply defaults without modifying existing loot or source',()=>{
  const {context}=fixture();const original=journal('old','A1').getFlag();
  const data=context.normalizeSector(original);
  assert.equal(Object.keys(data.supplies).length,7);
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
  const j={id:'old',name:'Old sector',getFlag:()=>stored,update:async changes=>{if(changes['flags.myz-sector-manager.sector'])stored=structuredClone(changes['flags.myz-sector-manager.sector']);},setFlag:async(mod,key,data)=>{stored=structuredClone(data);}};
  context.game.journal.get=()=>j;context.ui.notifications.info=()=>{};
  app.sectorId='old';app.draft=context.normalizeSector(stored);app.capture=()=>{};
  app.draft.supplies.cleanWater={quantity:3.5,collected:true};app.draft.supplies.components={quantity:2.75,collected:false};
  await app.action('save');
  const reopened=new context.Manager();await reopened.navigate('old');
  assert.equal(reopened.draft.supplies.cleanWater.quantity,3.5);
  assert.equal(reopened.draft.supplies.cleanWater.collected,true);assert.equal(reopened.draft.supplies.components.quantity,2.75);
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
  for(const [tab,key] of Object.entries({Locations:'locations',Encounters:'encounters',Loot:'loot',Effects:'effects',History:'history'})){
    app.tab=tab;app.draft[key]=[{title:'One'},{title:'Two'}];const html=app.build();
    assert.match(html,/aria-expanded="true" aria-controls="sm-entry-\d+-body"/);
    assert.match(html,/data-expand-all/);assert.match(html,/data-collapse-all/);
  }
  app.tab='Overview';assert(!app.build().includes('data-entry-toggle'));
});


test('Effects exposes an Actor drop reference without changing older record category or custom data',()=>{
  const {app,context}=fixture();context.game.journal.get=()=>({name:'Sector'});app.sectorId='sector';app.draft=entries();app.tab='Effects';
  app.draft.effects=[{title:'Zone anomaly',category:'Phenomenon',duration:'One day',custom:{preserve:true}}];
  const before=JSON.stringify(app.draft);const html=app.build();assert.match(html,/data-reference data-type="Actor\|JournalEntry\|JournalEntryPage"/);assert.match(html,/name="effects.0.uuid"/);assert.match(html,/value="Phenomenon" selected/);assert.equal(JSON.stringify(app.draft),before);
});

test('Find the Path defaults are additive, independent and include eight core benefits plus talent metadata',()=>{
  const {context,app}=fixture();const original={version:1,rot:'Custom Rot',terrain:'A bespoke place',pathStunts:{artifact:true,futureStunt:true},loot:[{title:'Keep'}]};
  const data=context.normalizeSector(original);assert.equal(data.pathStunts.artifact,true);assert.equal(data.pathStunts.safePath,true);assert.equal(data.pathStunts.futureStunt,true);assert.equal(original.pathStunts.safePath,undefined);
  data.pathStunts.bullets=true;assert.equal(context.normalizeSector({version:1}).pathStunts.bullets,false);
  context.game.journal.get=()=>({name:'Sector',getFlag:()=>original});app.draft=data;app.tab='Find the Path';
  const html=app.build();assert.equal((html.match(/name="pathStunts\./g)||[]).length,9);assert.doesNotMatch(html,/Talent Stunts|Standard Benefits and Stunts/);assert(html.indexOf('<h3>Find the Path Stunts</h3>')<html.indexOf('<h3>Exploration &amp; Travel Time</h3>'));assert.match(html,/Rot Finder talent; Core Rulebook p. 64/);assert.match(html,/once per Find the Path roll/);assert.match(html,/Checkboxes save automatically/);
});

test('stunt autosaves persist per sector across reopen without saving unrelated draft fields or overwriting old loot',async()=>{
  const {context,app}=fixture();let stored={version:1,code:'A1',terrain:'Original',loot:[{title:'Keep'}]};
  const j={id:'a',name:'A',getFlag:()=>stored,setFlag:async(mod,key,value)=>{stored=structuredClone(value);}};context.game.journal.get=id=>id==='a'?j:undefined;
  app.sectorId='a';app.draft=context.normalizeSector(stored);app.draft.terrain='Unsaved terrain';app.draft.pathStunts.safePath=true;app.draft.pathStunts.artifact=true;
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
  let html=app.build();assert.match(html,/list="sm-terrain-options"/);assert.match(html,/My custom &amp; unusual ruins/);assert.match(html,/value="Deadly mist" selected/);assert.match(html,/3 - Rot Hotspot/);
  app.element.querySelectorAll=()=>[{name:'terrain',type:'text',value:'Another custom terrain'},{name:'rot',type:'select-one',value:'Deadly mist'}];app.capture();assert.equal(app.draft.rot,'Deadly mist');assert.equal(app.draft.terrain,'Another custom terrain');
  for(const level of [0,1,2,3]){app.element.querySelectorAll=()=>[{name:'rot',type:'select-one',value:String(level)}];app.capture();assert.equal(app.draft.rot,level);assert.match(app.build(),new RegExp(`value="${level}" selected`));}
});

test('terrain suggestions contain all 61 verified names, uniquely sorted, with exact rulebook spelling',()=>{
  const {context,app}=fixture();context.game.journal.get=()=>({name:'A'});app.draft=context.normalizeSector({version:1,terrain:'Legacy unlisted location',rot:7});
  const html=app.build(),list=html.match(/<datalist id="sm-terrain-options">(.*?)<\/datalist>/s)[1];
  const options=Array.from(list.matchAll(/<option value="([^"]+)"><\/option>/g),match=>match[1]);
  assert.equal(options.length,61);assert.equal(new Set(options).size,61);assert.deepEqual(options,[...options].sort((a,b)=>a.localeCompare(b,'en')));assert(options.includes('Glasified Field'));assert(options.includes('Shipwreck'));assert(options.includes('Purification Plant'));assert.equal(options[0],'Airplane Wreck');assert.equal(options.at(-1),'Windmill');assert.match(html,/value="Legacy unlisted location"/);assert.match(html,/value="7" selected/);
});


test('randomization dialog targets half the inherited width with a usable minimum and auto-width fallback',()=>{
  const {context}=fixture();context.foundry.applications.api.DialogV2={DEFAULT_OPTIONS:{position:{width:800}}};
  assert.equal(context.dialogOptions().position.width,400);
  context.foundry.applications.api.DialogV2.DEFAULT_OPTIONS.position.width=400;assert.equal(context.dialogOptions().position.width,320);
  context.foundry.applications.api.DialogV2.DEFAULT_OPTIONS.position.width='auto';assert.equal(context.dialogOptions().position.width,320);
  assert.equal(context.dialogOptions().classes[0],'myz-sector-randomize-dialog');
});

test('Encounter and Effect reference drops accept Actors and Journal Entries, reject Items, and open native journal links',async()=>{
  const {app,documents}=fixture();app.capture=()=>{};app.renderReference=async()=>{};const input={value:''};const zone={dataset:{type:'Actor|JournalEntry'},querySelector:()=>input};
  for(const [uuid,type] of [['Actor.a','Actor'],['JournalEntry.j','JournalEntry'],['Compendium.world.encounters.JournalEntry.c','JournalEntry']]){
    let opens=0;documents.set(uuid,{uuid,documentName:type,_onClickDocumentLink:async()=>opens++});await app.dropReference({payload:{uuid},preventDefault(){},stopPropagation(){}},zone);assert.equal(input.value,uuid);await app.openReference(zone);assert.equal(opens,1);
  }
  documents.set('Item.bad',{uuid:'Item.bad',documentName:'Item'});const prior=input.value;await app.dropReference({payload:{uuid:'Item.bad'},preventDefault(){},stopPropagation(){}},zone);assert.equal(input.value,prior);
});

test('Consumables defaults and transition-based collapse preserve manual overrides without persisting UI state',()=>{
  const {app,context}=fixture();app.sectorId='a';app.draft=context.normalizeSector({version:1,supplies:{bullets:{quantity:0,collected:false}}});
  let state=app.consumablesState();assert.equal(state.collapsed,true);state.collapsed=false;assert.equal(app.consumablesState().collapsed,false);
  app.draft.supplies.bullets.quantity=3;assert.equal(app.consumablesState().collapsed,false);app.draft.supplies.bullets.collected=true;assert.equal(app.consumablesState().collapsed,true);
  state.collapsed=false;assert.equal(app.consumablesState().collapsed,false);app.draft.supplies.bullets.collected=false;assert.equal(app.consumablesState().collapsed,false);app.draft.supplies.bullets.quantity=0;assert.equal(app.consumablesState().collapsed,true);assert.equal(app.draft.collapsed,undefined);
  app.sectorId='b';assert.equal(app.consumablesState().collapsed,true);
});
test('Locations accept Scene, Journal Entry and Page drops and preserve native page opening',async()=>{
  const {app,documents}=fixture();app.capture=()=>{};app.renderReference=async()=>{};const input={value:''},zone={dataset:{type:'Scene|JournalEntry|JournalEntryPage'},querySelector:()=>input};
  for(const [uuid,type] of [['Scene.a','Scene'],['JournalEntry.j','JournalEntry'],['JournalEntry.j.JournalEntryPage.p','JournalEntryPage']]){
    let opened=0;documents.set(uuid,{uuid,documentName:type,_onClickDocumentLink:async()=>opened++});await app.dropReference({payload:{uuid},preventDefault(){},stopPropagation(){}},zone);assert.equal(input.value,uuid);await app.openReference(zone);assert.equal(opened,1);
  }
});

test('new sectors use the shared name and Sectors folder, preserving their coordinate field and stable ID',async()=>{
  const {context,app}=fixture();let created;
  context.ensureJournalFolders=async()=>({sectors:{id:'sector-folder'}});
  context.JournalEntry={create:async data=>{created=data;return {id:'stable-id',name:data.name};}};
  await app.newSector('a-03');assert.equal(created.folder,'sector-folder');assert.equal(created.name,'A3 - Unknown Terrain');assert.equal(created.flags['myz-sector-manager'].sector.code,'a-03');assert.equal(app.sectorId,'stable-id');
});

test('old conflicting travel flags use saved stunts, preserve Rot Finder and clean up only redundant values',async()=>{
  const {context,app}=fixture();let stored={version:1,pathStunts:{halfTime:true,rush:false,saferRoute:true,artifact:true},travel:{stalker:false,rushed:true,mode:'vehicle',open:true,difficulty:4},notes:'Original notes',loot:[{title:'Keep'}]};
  const before=structuredClone(stored);let writes=0;context.game.journal.get=()=>({name:'A',getFlag:()=>stored,setFlag:async(m,k,value)=>{writes++;stored=structuredClone(value);}});app.sectorId='a';app.draft=context.normalizeSector(stored);
  assert.equal(app.draft.travel.stalker,true);assert.equal(app.draft.travel.rushed,false);assert.equal(app.draft.pathStunts.saferRoute,true);assert.deepEqual(stored,before);
  app.draft.notes='Unrelated draft';await app.persistStunts();assert.equal(writes,1);assert.equal(stored.travel.stalker,undefined);assert.equal(stored.travel.rushed,undefined);assert.equal(stored.travel.mode,'vehicle');assert.equal(stored.travel.open,true);assert.equal(stored.notes,'Original notes');assert.deepEqual(stored.loot,before.loot);
  const reopened=context.normalizeSector(stored);assert.equal(reopened.travel.stalker,true);assert.equal(reopened.travel.rushed,false);assert.equal(reopened.pathStunts.saferRoute,true);
});

test('new-sector dialog prefills coordinates, cancels without writes, canonicalizes input and checks scene validity',async()=>{
  const {context,app}=fixture();const created=[];app.newSector=async code=>created.push(code);let options;
  context.foundry.applications.api.DialogV2={wait:async value=>{options=value;return null;}};
  await app.promptNewSector('B7');assert.match(options.content,/name="newSectorCode" value="B7"/);assert.deepEqual(created,[]);
  context.foundry.applications.api.DialogV2.wait=async()=> 'b-07';await app.promptNewSector('B7');assert.deepEqual(created,['B7']);
  await app.promptNewSector('B7',()=>false);assert.equal(created.length,1);
  context.foundry.applications.api.DialogV2.wait=async()=>'<bad>';await assert.rejects(app.promptNewSector('B7'),/Enter coordinates/);assert.equal(created.length,1);
});
test('manager fields and section headings reuse shared icons even with zero entry counts',()=>{
  const {app,context}=fixture();const data=entries();data.loot=[];data.status='Scouted';data.rot=0;data.terrain='Thick Woods';context.game.journal.get=()=>({name:'Sector',getFlag:()=>data});app.draft=data;app.tab='Overview';
  let html=app.build();for(const key of ['terrain','rot','status']){const info=sectorIndicators(data)[key];assert(html.includes(iconMarkup(info.icon,info.title)));}
  for(const [tab,key] of [['Encounters','encounters'],['Effects','phenomena'],['Loot','loot']]){app.tab=tab;const info=sectorIndicators(data)[key];assert(app.build().includes(iconMarkup(info.icon,info.title)));}
});

test('manager icon slots refresh current values, status, counts and collected resources without replacing controls',()=>{
  const {app}=fixture();const slots=['rot','status','encounters','phenomena','loot'].map(iconSlot=>({dataset:{iconSlot},innerHTML:''}));app.element.querySelectorAll=()=>slots;
  app.draft={rot:0,status:'Scouted',encounters:[],effects:[],supplies:{bullets:{quantity:1,collected:false}}};app.refreshSectorIcons();assert(slots[0].innerHTML.includes('Rot Level: 0'));assert(slots[4].innerHTML.includes('Uncollected Gear &amp; Artifacts Available'));
  app.draft.rot=2;app.draft.status='Explored';app.draft.encounters=[{}];app.draft.effects=[{category:'Weather'},{category:'Phenomenon'}];app.draft.supplies.bullets.collected=true;app.refreshSectorIcons();
  assert(slots[0].innerHTML.includes('Rot Level: 2'));assert(slots[1].innerHTML.includes('data-sector-icon="explored"'));assert(slots[2].innerHTML.includes('1 Inhabitant'));assert(slots[3].innerHTML.includes('1 Phenomenon'));assert(slots[4].innerHTML.includes('No Uncollected Gear &amp; Artifacts'));
});
test('a coordinate duplicate discovered during folder initialization respects cancelled unsaved-change navigation',async()=>{
  const {app,context}=fixture();context.ensureJournalFolders=async()=>({sectors:{id:'folder'}});app.sectorId='original';app.tab='Loot';app.confirmLose=async()=>true;app.navigate=async()=>{};
  // The VM keeps the same runtime/store instance used by newSector.
  vm.runInContext("zone.store.sectorRecords=()=>globalThis.coordinateChecks++===0?[]:[{id:'duplicate'}];",context);context.coordinateChecks=0;
  await app.newSector('B7');assert.equal(app.sectorId,'original');assert.equal(app.tab,'Loot');
});

test('Randomize requires a valid persisted sector and successful explicit first save, including programmatic calls',async()=>{
  const {app,context,notices}=fixture();let stored={version:1,initialSavePending:true,code:'',terrain:'',loot:[]},fail=true;
  const journal={id:'new',name:'New',getFlag:()=>stored,async update(changes){if(fail)throw new Error('Save failed');stored=structuredClone(changes['flags.myz-sector-manager.sector']);}};
  context.game.journal.get=()=>journal;context.ui.notifications.info=()=>{};context.console={error(){}};app.sectorId='new';app.draft=context.normalizeSector(stored);app.capture=()=>{};
  context.foundry.applications.api.DialogV2={wait:async()=>assert.fail('must not open unsaved randomization')};assert.equal(app.canRandomize,false);assert.match(app.build(),/data-action="randomize" disabled title="Save this sector before randomizing\."/);
  await app.randomizeSector();assert(notices.includes('Save this sector before randomizing.'));
  await app.action('save');assert.equal(stored.initialSavePending,true);assert.equal(app.draft.initialSavePending,true);assert.equal(app.canRandomize,false);
  fail=false;await app.action('save');assert.equal(stored.initialSavePending,false);assert.equal(app.canRandomize,true);assert.doesNotMatch(app.build(),/data-action="randomize" disabled/);
  delete stored.initialSavePending;assert.equal(app.canRandomize,true);journal.isTemporary=true;assert.equal(app.canRandomize,false);delete journal.isTemporary;stored={};assert.equal(app.canRandomize,false);
});
test('loot reference detection handles world/compendium Items and preserves manual choices until a different assignment',async()=>{
  const {app,documents}=fixture();app.tab='Loot';app.draft={loot:[normalizeLoot({title:'Stored name',uuid:'Item.original'})]};app.capture=()=>{};app.renderReference=async()=>{};app.element={contains:()=>true,querySelector:()=>null};
  const input={name:'loot.0.uuid',value:'Item.original'},typeControl={},title={};const card={querySelector:selector=>selector.includes('.type')?typeControl:title};const zone={dataset:{type:'Item'},querySelector:()=>input,closest:()=>card};
  const event={payload:{uuid:'Item.world'},preventDefault(){},stopPropagation(){}};
  for(const [uuid,type] of [['Item.world','weapon'],['Compendium.pack.items.Item.abc','armor']]){documents.set(uuid,{uuid,documentName:'Item',type});event.payload.uuid=uuid;await app.dropReference(event,zone);assert.equal(app.draft.loot[0].type,type);assert.equal(typeControl.value,type);assert.equal(title.textContent,`Stored name (${type})`);}
  app.draft.loot[0].type='gear';app.draft.loot[0].typeSource='manual';await app.dropReference(event,zone);assert.equal(app.draft.loot[0].type,'gear');app.assignLootType(zone,{documentName:'Item',type:'weapon'});assert.equal(app.draft.loot[0].type,'gear');
  documents.set('Item.unsupported',{uuid:'Item.unsupported',documentName:'Item',type:'talent'});event.payload.uuid='Item.unsupported';await app.dropReference(event,zone);assert.equal(app.draft.loot[0].type,'gear');
  app.draft.loot[0].typeSource='legacy';app.assignLootType(zone,{documentName:'Item',type:'chassis'});assert.equal(app.draft.loot[0].type,'chassis');assert.equal(app.draft.loot[0].title,'Stored name');
});
test('collection autosaves the Loot list, preserves other saved fields, serializes toggles, and detects conflicting changes',async()=>{
  const {app,context}=fixture();let stored={version:1,loot:[{title:'Radio',uuid:'Item.radio',status:'Hidden',quantity:2}],notes:'Saved notes',custom:{keep:true}},writes=0;
  const journal={id:'loot',name:'Sector',getFlag:()=>stored,setFlag:async(m,k,value)=>{writes++;stored=structuredClone(value);}};context.game.journal.get=()=>journal;app.sectorId='loot';app.draft=app.loadDraft(stored,journal);app.draft.notes='Unsaved notes';app.draft.loot[0].collected=true;
  const first=app.persistLoot();app.draft.loot[0].collected=false;const second=app.persistLoot();await Promise.all([first,second]);assert.equal(writes,2);assert.equal(stored.loot[0].collected,false);assert.equal(stored.loot[0].status,'Hidden');assert.equal(stored.notes,'Saved notes');assert.deepEqual(stored.custom,{keep:true});
  const reopened=new context.Manager();await reopened.navigate('loot');assert.equal(reopened.draft.loot[0].collected,false);assert.equal(reopened.draft.loot[0].uuid,'Item.radio');
  stored.loot.push({title:'Other GM loot'});app.draft.loot[0].collected=true;await assert.rejects(app.persistLoot(),/Saved Gear & Artifacts changed/);assert.equal(writes,2);assert.equal(stored.loot[0].collected,false);
});
test('collected entries initially collapse but remain manually expandable; other tabs retain Status controls',()=>{
  const {app,context}=fixture();context.game.journal.get=()=>({id:'a',getFlag:()=>({version:1})});app.sectorId='loot-collapse';app.draft=context.normalizeSector({...entries(),loot:[{title:'Taken',status:'Collected',uuid:'Item.keep'}]});app.tab='Loot';const state=app.entryState('loot');assert(state.collapsed.has(state.entries[0].id));assert.match(app.build(),/is-collected/);assert.match(app.build(),/name="loot.0.collected" checked/);assert.doesNotMatch(app.build(),/name="loot.0.status"/);
  state.collapsed.delete(state.entries[0].id);assert.equal(app.entryState('loot').collapsed.size,0);app.tab='Locations';assert.match(app.build(),/name="locations.0.status"/);
});
test('stunt and Loot autosaves share a queue so concurrent flags cannot overwrite one another',async()=>{
  const {app,context}=fixture();let stored={version:1,loot:[{title:'Keep'}],pathStunts:{artifact:false},notes:'Keep'};
  const journal={id:'a',getFlag:()=>stored,setFlag:async(m,k,value)=>{await new Promise(resolve=>setTimeout(resolve,1));stored=structuredClone(value);}};context.game.journal.get=()=>journal;app.draft=app.loadDraft(stored,journal);app.draft.loot[0].collected=true;app.draft.pathStunts.safePath=true;app.draft.pathStunts.artifact=true;
  await Promise.all([app.persistLoot(),app.persistStunts()]);assert.equal(stored.loot[0].collected,true);assert.equal(stored.pathStunts.artifact,true);assert.equal(stored.notes,'Keep');
});
test('a manual type selection made while an Item lookup is pending wins over late inference',async()=>{
  const {app,documents}=fixture();let resolve;documents.set('Item.slow',new Promise(done=>resolve=done));app.draft={loot:[normalizeLoot({title:'Keep',type:'scrap',uuid:'Item.old'})]};app.capture=()=>{};app.renderReference=async()=>{};app.element={contains:()=>true,querySelector:()=>null};
  const input={name:'loot.0.uuid',value:'Item.old'},zone={dataset:{type:'Item'},querySelector:()=>input,closest:()=>null},event={payload:{uuid:'Item.slow'},preventDefault(){},stopPropagation(){}};
  const pending=app.dropReference(event,zone);app.draft.loot[0].type='gear';app.draft.loot[0].typeSource='manual';app.lootTypeRevisions.set(app.draft.loot[0],1);resolve({uuid:'Item.slow',documentName:'Item',type:'weapon'});await pending;assert.equal(app.draft.loot[0].type,'gear');assert.equal(input.value,'Item.slow');
});
test('generated Loot initially collapses while manual entries stay expanded and manual toggles survive rerenders',()=>{
  const {app}=fixture();app.sectorId='generated-defaults';app.draft={loot:[{title:'Generated',generated:{method:'core'},collected:false},{title:'Manual',collected:false},{title:'Taken',collected:true}]};const state=app.entryState('loot');assert(state.collapsed.has(state.entries[0].id));assert(!state.collapsed.has(state.entries[1].id));assert(state.collapsed.has(state.entries[2].id));
  state.collapsed.delete(state.entries[0].id);assert(!app.entryState('loot').collapsed.has(state.entries[0].id));app.draft.loot[0].details='Edited';assert(!app.entryState('loot').collapsed.has(state.entries[0].id));
});
test('unchecking the basic effect clears known stunts during capture and autosave, preserving unrelated fields',async()=>{
  const {app,context}=fixture();let stored={version:1,pathStunts:{safePath:true,artifact:true,rush:true},loot:[],notes:'Keep'};const j={id:'gate',name:'Sector',getFlag:()=>stored,setFlag:async(m,k,value)=>{stored=structuredClone(value);}};context.game.journal.get=()=>j;app.sectorId='gate';app.draft=app.loadDraft(stored,j);
  app.element.querySelectorAll=()=>[{name:'pathStunts.safePath',type:'checkbox',checked:false},{name:'pathStunts.artifact',type:'checkbox',checked:true,disabled:true}];app.capture();assert.equal(app.draft.pathStunts.artifact,false);assert.equal(app.draft.pathStunts.rush,false);assert.equal(app.draft.travel.rushed,false);await app.persistStunts();assert.equal(stored.pathStunts.artifact,false);assert.equal(stored.pathStunts.safePath,false);assert.equal(stored.notes,'Keep');
});
test('Overview accordions initialize from meaningful content and retain independent per-sector choices',()=>{
  const {app}=fixture();app.sectorId='empty-overview';app.draft={mood:'<p>&nbsp;</p>',description:' '};assert.equal(app.overviewState().mood,true);assert.equal(app.overviewState().description,true);
  app.overviewState().mood=false;app.draft.mood='New text';assert.equal(app.overviewState().mood,false);assert.equal(app.overviewState().description,true);
  app.sectorId='populated-overview';app.draft={mood:'A mood',description:'<p>A ruin</p>'};assert.equal(app.overviewState().mood,false);assert.equal(app.overviewState().description,false);app.overviewState().description=true;assert.equal(app.overviewState().description,true);
});
test('Threat Level persists independently of generation metadata and does not reroll other data',async()=>{
  const {app,context}=fixture();let stored={version:1,randomization:{numericThreatLevel:6,baseDice:[1,2,3,4,5,6]},loot:[{title:'Keep'}]};const j={id:'threat',name:'Sector',getFlag:()=>stored,update:async changes=>{stored=structuredClone(changes['flags.myz-sector-manager.sector']);}};context.game.journal.get=()=>j;context.ui.notifications.info=()=>{};app.sectorId='threat';app.draft=app.loadDraft(stored,j);assert.equal(app.draft.threatLevel,6);
  app.element.querySelectorAll=()=>[{name:'threatLevel',type:'number',value:'12'}];app.capture();await app.action('save');assert.equal(stored.threatLevel,12);assert.deepEqual(stored.randomization.baseDice,[1,2,3,4,5,6]);assert.equal(stored.loot[0].title,'Keep');
  const reopened=new context.Manager();await reopened.navigate('threat');assert.equal(reopened.draft.threatLevel,12);
});

test('context Add actions append collapsed entries across every collection without resetting existing expansion',async()=>{
  const {app,context}=fixture();context.game.journal.get=()=>({id:'context',name:'Sector'});app.sectorId='context-add';app.capture=()=>{};context.generateEntry=async(key,sector,options)=>({title:options.event?'Event':'Generated',uuid:'JournalEntry.keep'});
  for(const key of ['locations','encounters','loot','effects','history']){
    app.draft={code:'A1',[key]:[{title:'Existing'}]};const existing=app.entryState(key).entries[0].id;await app.addContextEntry(key,{event:key==='history'});const state=app.entryState(key);assert.equal(app.draft[key].length,2);assert(!state.collapsed.has(existing));assert(state.collapsed.has(state.entries[1].id));assert.equal(app.draft[key][1].uuid,'JournalEntry.keep');state.collapsed.delete(state.entries[1].id);assert(!app.entryState(key).collapsed.has(state.entries[1].id));
  }
});
test('pending entry generation rejects duplicate clicks and cannot append into changed sectors or edited drafts',async()=>{
  const {app,context,notices}=fixture();context.console={error(){}};context.game.journal.get=()=>({id:'context'});app.sectorId='a';app.draft={encounters:[],notes:'Before'};app.capture=()=>{};let done,calls=0;context.generateEntry=()=>{calls++;return new Promise(resolve=>done=resolve);};
  const first=app.action('add','encounters');await app.action('add','encounters');assert.equal(calls,1);done({title:'One'});await first;assert.equal(app.draft.encounters.length,1);
  const changed=app.action('add','encounters');app.draft.notes='Edited';done({title:'Do not add'});await changed;assert.equal(app.draft.encounters.length,1);assert.match(notices.at(-1),/Nothing was added/);
  const switched=app.action('add','encounters');app.sectorId='b';done({title:'Wrong sector'});await switched;assert.equal(app.draft.encounters.length,1);
});
test('Encounters expose exactly four statuses and three types, retaining legacy values visibly; History keeps both buttons',()=>{
  const {app,context}=fixture();context.game.journal.get=()=>({id:'a',name:'Sector',getFlag:()=>({version:1})});app.draft=context.normalizeSector({...entries(),encounters:[{title:'Old',status:'Inactive',type:'Unrecognized'}]});app.tab='Encounters';let html=app.build();
  const status=html.match(/name="encounters.0.status">([\s\S]*?)<\/select>/)[1];assert.equal((status.match(/<option/g)||[]).length,4);for(const value of ['Active','Resolved','Defeated','Hidden'])assert(status.includes(`value="${value}"`));assert.match(html,/Previous status: Inactive/);assert.match(html,/Previous type: Unrecognized/);
  const type=html.match(/name="encounters.0.type">([\s\S]*?)<\/select>/)[1];assert.equal((type.match(/<option/g)||[]).length,3);app.tab='History';html=app.build();assert.match(html,/data-action="add"/);assert.match(html,/data-action="add-event"/);
});
test('closing during generation discards the pending entry and safely releases removed UI controls',async()=>{
  const {app,context,notices}=fixture();context.console={error(){}};context.game.journal.get=()=>({id:'closed'});app.sectorId='closed';app.draft={effects:[]};app.capture=()=>{};let done;context.generateEntry=()=>new Promise(resolve=>done=resolve);
  const pending=app.action('add','effects');app.rendered=false;app.element=null;done({title:'Do not append'});await pending;assert.equal(app.draft.effects.length,0);assert.equal(app.addingEntry,false);assert.match(notices.at(-1),/Nothing was added/);
});

test('Special UI uses ordered tabs, shared fields and Scene references without Normal tabs or Randomize',()=>{
  const {app,context}=fixture();const record={version:1,sectorType:'special',code:'B7',customName:'Doom Sphere',nameOverride:true};const j={id:'special',name:'Doom Sphere',getFlag:()=>record};context.game.journal=[j];context.game.journal.get=()=>j;app.sectorId=j.id;app.draft=context.normalizeSector(record);
  let html=app.build();assert.match(html,/sm-sector-special/);assert.match(html,/B7 - Doom Sphere/);assert.match(html,/name="special.sceneUuid"/);assert.match(html,/data-type="Scene"/);assert.match(html,/name="special.source"/);assert.match(html,/name="special.overview"/);assert.doesNotMatch(html,/data-action="randomize"|data-tab="Secrets"/);
  for(const tab of sectorTabs(record))assert(html.includes(`data-tab="${tab}"`));
  for(const [tab,key] of [['Inhabitants','inhabitants'],['Gear & Artifacts','gear'],['Events','events']]){app.tab=tab;app.draft.special[key]=[{title:'Keep',quantity:1,type:'scrap'}];html=app.build();assert.match(html,/aria-expanded="false"/);assert.doesNotMatch(html,/name="special\..*\.collected"/);}
  app.tab='Locations';app.build();assert.equal(app.tab,'Locations');assert.equal(app.canRandomize,false);
});
test('confirmed conversions preserve both content sets, cancel safely and fall back from incompatible tabs',async()=>{
  const {app,context}=fixture();context.game.journal.get=()=>({name:'Sector'});app.sectorId='conversion';app.draft=context.normalizeSector({version:1,code:'A1',description:'Normal',secrets:[{title:'Keep'}],locations:[{title:'Ruin'}],special:{overview:'Special\n\nMore',inhabitants:[{title:'Group'}]},history:[{title:'Visit'}],pathStunts:{safePath:true}});app.capture=()=>{};
  const before=structuredClone(app.draft);let confirm=false,options;context.foundry.applications.api.DialogV2={wait:async()=>app.draft.sectorType==='special'?'normal':'special',confirm:async value=>{options=value;return confirm;}};
  app.tab='Locations';await app.changeSectorType();assert.deepEqual(structuredClone(app.draft),before);assert.match(options.content,/Special Zone Sector/);confirm=true;
  for(const type of ['special','normal','special']){await app.changeSectorType();assert.equal(app.draft.sectorType,type);assert.deepEqual({...structuredClone(app.draft),sectorType:'normal'},before);assert.equal(app.tab,'Locations');}
  app.tab='History';await app.changeSectorType();assert.equal(app.tab,'History');assert.equal(app.dirty,true);
});
test('Special add/delete uses independent nested arrays, no rolls, collapsed new rows and stable expansion',async()=>{
  const {app,context}=fixture();context.game.journal.get=()=>({name:'Sector'});app.sectorId='special-entries';app.draft=context.normalizeSector({sectorType:'special'});app.capture=()=>{};context.generateEntry=()=>assert.fail('Special entries must not roll');
  for(const key of ['special.inhabitants','special.gear','special.events']){
    await app.addContextEntry(key);await app.addContextEntry(key);const state=app.entryState(key);assert.equal(state.entries.length,2);assert(state.collapsed.has(state.entries[0].id));state.collapsed.delete(state.entries[0].id);assert(!app.entryState(key).collapsed.has(state.entries[0].id));await app.removeEntry(key,state.entries[1].id);assert.equal(sectorCollection(app.draft,key).length,1);
  }
  assert.equal(app.draft.special.gear[0].quantity,1);assert.equal(app.draft.special.gear[0].type,'scrap');
  const before=JSON.stringify(app.draft);await app.addContextEntry('loot');await app.randomizeSector();assert.equal(JSON.stringify(app.draft),before);
});
test('creation dialog defaults Normal, confirms Special, and cancellation does not create records',async()=>{
  const {app,context}=fixture();const created=[];app.newSector=async(...args)=>created.push([args[0],args[2]]);let options;context.foundry.applications.api.DialogV2={wait:async value=>{options=value;return null;}};await app.promptNewSector('B7');assert.equal(options.window.title,'Create New Sector');assert.match(options.content,/value="normal" checked/);assert.equal(created.length,0);
  context.foundry.applications.api.DialogV2.wait=async()=>({code:'b-07',sectorType:'special'});await app.promptNewSector();assert.deepEqual(created,[['B7','special']]);
});

test('conversion cannot apply a stale confirmation to changed drafts or another sector',async()=>{
  const {app,context}=fixture();context.game.journal.get=()=>({name:'Sector'});app.sectorId='a';app.draft=context.normalizeSector({version:1});app.capture=()=>{};let finish;context.foundry.applications.api.DialogV2={wait:async()=> 'special',confirm:()=>new Promise(resolve=>finish=resolve)};
  const pending=app.changeSectorType();await new Promise(resolve=>setImmediate(resolve));app.draft.special.overview='Changed during confirmation';finish(true);await assert.rejects(pending,/selection or edits changed/);assert.equal(app.draft.sectorType,'normal');
});
test('shared History generation remains available for Special sectors and inactive Normal adds are blocked',async()=>{
  const {app,context}=fixture();context.game.journal.get=()=>({name:'Sector'});app.sectorId='history-special';app.draft=context.normalizeSector({sectorType:'special',history:[]});app.capture=()=>{};let eventFlag;context.generateEntry=async(key,data,options)=>{assert.equal(key,'history');assert.equal(data.sectorType,'special');eventFlag=options.event;return {title:'Ark or Zone event',uuid:'JournalEntry.parent.JournalEntryPage.page'};};
  await app.addContextEntry('history',{event:true});assert.equal(eventFlag,true);assert.equal(app.draft.history.length,1);assert.equal(app.draft.history[0].uuid,'JournalEntry.parent.JournalEntryPage.page');
});

function specialDropFixture(){
  const f=fixture();let saved=structuredClone(normalizeSectorType({version:1,sectorType:'special',code:'A1',notes:'Saved notes',special:{inhabitants:[],gear:[],images:[]}}));
  const journal={id:'drop',name:'Sector',getFlag:()=>saved,setFlag:async(mod,key,data)=>{saved=structuredClone(data);}};
  f.context.game.journal.get=()=>journal;f.app.sectorId='drop';f.app.draft=f.context.normalizeSector(saved);f.app.capture=()=>{};
  return {...f,journal,getSaved:()=>saved,event:uuid=>({payload:{uuid}})};
}
test('blank Actor/Item drops resolve world/compendium UUIDs, classify all MYZ Items, collapse and persist only their collection',async()=>{
  for(const [key,type] of [['special.inhabitants','Actor'],['special.gear','Item']])for(const prefix of ['',`Compendium.myz.docs.`])for(const itemType of (type==='Item'?['armor','artifact','chassis','gear','weapon','other']:[''])){
    const f=specialDropFixture(),uuid=`${prefix}${type}.one`;f.documents.set(uuid,{uuid,documentName:type,name:'Document title',type:itemType});f.app.draft.notes='Unsaved other edits';f.app.dirty=true;
    const event=f.event(uuid);await f.app.dropSpecialEntry(event,key);await f.app.dropSpecialEntry(event,key);
    const entries=sectorCollection(f.app.draft,key);assert.equal(entries.length,1);assert.equal(entries[0].uuid,uuid);assert.equal(entries[0].title,'Document title');assert.equal(sectorCollection(f.getSaved(),key).length,1);assert.equal(f.getSaved().notes,'Saved notes');assert.equal(f.app.draft.notes,'Unsaved other edits');assert.equal(f.app.dirty,true);assert(f.app.entryState(key).collapsed.has(f.app.entryState(key).entries[0].id));
    if(type==='Item'){assert.equal(entries[0].quantity,1);assert.equal(entries[0].type,itemType==='other'?'scrap':itemType);}
  }
});
test('image drops require image pages, preserve actual page UUIDs and paths, and never save broken/plain-text references',async()=>{
  for(const uuid of ['JournalEntry.a.JournalEntryPage.p','Compendium.myz.book.JournalEntry.a.JournalEntryPage.p']){
    const f=specialDropFixture();f.documents.set(uuid,{uuid,documentName:'JournalEntryPage',type:'image',src:'worlds/test/picture.webp',name:'Illustration'});await f.app.dropSpecialEntry(f.event(uuid),'special.images');assert.equal(f.getSaved().special.images[0].uuid,uuid);assert.equal(f.getSaved().special.images[0].imageSrc,'worlds/test/picture.webp');assert.equal(f.app.dirty,false);
  }
  for(const document of [null,{documentName:'Actor'},{documentName:'JournalEntryPage',type:'text'},{documentName:'JournalEntryPage',type:'image',src:''}]){const f=specialDropFixture();f.documents.set('JournalEntry.a.JournalEntryPage.p',document);await f.app.dropSpecialEntry(f.event('JournalEntry.a.JournalEntryPage.p'),'special.images');assert.equal(f.app.draft.special.images.length,0);assert.equal(f.getSaved().special.images.length,0);assert(f.notices.length);}
});
test('unsaved sectors reject blank drops and asynchronous selection changes cannot append entries',async()=>{
  const f=specialDropFixture();f.getSaved().initialSavePending=true;await f.app.dropSpecialEntry(f.event('Actor.a'),'special.inhabitants');assert.match(f.notices.at(-1),/Save this sector/);assert.equal(f.app.draft.special.inhabitants.length,0);
  delete f.getSaved().initialSavePending;let resolve;f.context.fromUuid=()=>new Promise(done=>resolve=done);const pending=f.app.dropSpecialEntry(f.event('Actor.a'),'special.inhabitants');f.app.sectorId='another';resolve({documentName:'Actor',name:'Actor',uuid:'Actor.a'});await pending;assert.equal(f.app.draft.special.inhabitants.length,0);assert.match(f.notices.at(-1),/selection or edits changed/);
});
test('drop autosave conflicts retain the draft for review and do not overwrite another GM change',async()=>{
  const f=specialDropFixture();let release;f.app.autosaveWrite=new Promise(resolve=>release=resolve);f.documents.set('Actor.a',{documentName:'Actor',name:'Actor',uuid:'Actor.a'});
  const pending=f.app.dropSpecialEntry(f.event('Actor.a'),'special.inhabitants');await Promise.resolve();f.getSaved().special.inhabitants.push({title:'Other GM'});release();await pending;assert.equal(f.app.draft.special.inhabitants.length,1);assert.equal(f.getSaved().special.inhabitants[0].title,'Other GM');assert.match(f.notices.at(-1),/Saved entries changed/);assert.equal(f.app.dirty,true);
});
test('Situation sizing grows and shrinks from its native/CSS minimum without resizing the window',()=>{
  const {app}=fixture();const area={style:{},scrollHeight:800,offsetHeight:160,clientHeight:158};app.element.querySelector=()=>area;app.sizeSituation();assert.equal(area.style.height,'802px');area.scrollHeight=158;app.sizeSituation();assert.equal(area.style.height,'160px');
});
test('Images previews remain visible while metadata uses optional details and page-only references',()=>{
  const {app,context}=fixture();context.game.journal.get=()=>({name:'Sector'});app.sectorId='gallery';app.draft=context.normalizeSector({sectorType:'special',special:{images:[{title:'One',uuid:'JournalEntry.a.JournalEntryPage.p'},{title:'Two'}]}});app.tab='Images';const html=app.build();assert.match(html,/\+ Add Image/);assert.equal((html.match(/data-image-preview/g)||[]).length,2);assert.match(html,/data-type="JournalEntryPage"/);assert.doesNotMatch(html,/data-image-preview[^>]*hidden|data-entry-toggle/);
});

test('a permission failure preserves an image page reference and shows an unavailable preview',async()=>{
  const {app,context}=fixture(),ref=referenceZone('Compendium.myz.book.JournalEntry.a.JournalEntryPage.p');ref.input.name='special.images.0.uuid';const preview={textContent:'',replaceChildren(){this.textContent='';}};ref.zone.closest=()=>({querySelector:()=>preview});context.fromUuid=async()=>{throw new Error('Permission denied');};
  await app.renderReference(ref.zone);assert.match(preview.textContent,/unavailable: Permission denied/);assert.equal(ref.input.value,'Compendium.myz.book.JournalEntry.a.JournalEntryPage.p');assert.match(ref.target.textContent,/Reference unavailable/);
});

test('Special Overview places the complete Overlay Image control after GM Notes without changing its path',()=>{
  const {app,context}=fixture();context.game.journal.get=()=>({name:'Sector'});app.sectorId='overview-order';app.draft=context.normalizeSector({sectorType:'special',special:{overlayImage:'worlds/test/image.webp'}});const before=JSON.stringify(app.draft),html=app.build();assert(html.indexOf('name="notes"')<html.lastIndexOf('data-overlay-image-pick'));assert(html.indexOf('name="special.overview"')<html.indexOf('name="notes"'));assert.equal(JSON.stringify(app.draft),before);
  app.draft.sectorType='normal';assert.doesNotMatch(app.build(),/data-overlay-image-pick aria-label/);
});
test('world and compendium Actor avatars resolve safely, clear to a fallback and never modify Actor data',async()=>{
  for(const uuid of ['Actor.portrait','Compendium.myz.actors.Actor.portrait']){
    const {app,context,documents}=fixture(),ref=referenceZone(uuid);ref.input.name='special.inhabitants.0.uuid';
    const target={attrs:{},innerHTML:'',setAttribute(key,value){this.attrs[key]=value;},removeAttribute(key){delete this.attrs[key];},replaceChildren(image){this.image=image;image.parentNode=this;}};
    ref.zone.closest=()=>({querySelector:selector=>selector==='[data-inhabitant-avatar]'?target:null});
    context.document.createElement=()=>({listeners:{},addEventListener(key,fn){this.listeners[key]=fn;}});context.foundry.applications.ux.TextEditor.implementation.enrichHTML=async()=>'<a class="content-link">Actor</a>';
    const actor={uuid,documentName:'Actor',name:'Portrait Actor',img:'worlds/test/portrait.webp'},before=structuredClone(actor);documents.set(uuid,actor);await app.renderReference(ref.zone);assert.equal(target.image.src,actor.img);assert.equal(target.image.draggable,false);assert.deepEqual(actor,before);
    target.image.listeners.error();assert.match(target.innerHTML,/<svg/);assert.equal(target.attrs['aria-label'],'No Actor portrait available');
    app.capture=()=>{};await app.clearReference(ref.zone);assert.equal(ref.input.value,'');assert.match(target.innerHTML,/<svg/);
    actor.img='javascript:alert(1)';ref.input.value=uuid;await app.renderReference(ref.zone);assert.match(target.innerHTML,/<svg/);
  }
});
test('Inhabitants and Events order titles before right-side arrows, with avatars only on Inhabitants',()=>{
  const {app,context}=fixture();context.game.journal.get=()=>({name:'Sector'});app.sectorId='headings';app.draft=context.normalizeSector({sectorType:'special',special:{inhabitants:[{title:'Inhabitant'}],events:[{title:'Event'}]}});
  for(const tab of ['Inhabitants','Events']){app.tab=tab;const html=app.build(),heading=html.slice(html.indexOf('data-entry-header'),html.indexOf('class="sm-entry-body"'));assert(heading.indexOf('data-entry-title')<heading.indexOf('data-chevron'));assert.match(heading,/sm-special-toggle/);if(tab==='Inhabitants')assert(heading.indexOf('data-inhabitant-avatar')<heading.indexOf('data-entry-title'));else assert.doesNotMatch(heading,/data-inhabitant-avatar/);}
});
test('Images bulk state affects full previews and metadata in place without changing data or another sector',()=>{
  const {app,context}=fixture();context.game.journal.get=()=>({name:'Sector'});app.sectorId='gallery-bulk';app.draft=context.normalizeSector({sectorType:'special',special:{images:[{title:'Linked',uuid:'JournalEntry.a.JournalEntryPage.p',details:'Notes'},{title:'Manual'}]}});app.tab='Images';const before=JSON.stringify(app.draft),state=app.entryState('special.images'),cards=new Map();
  for(const entry of state.entries){const button={attrs:{},setAttribute(key,value){this.attrs[key]=value;},focus(){}},body={hidden:false,contains:()=>false},chevron={},details={open:false};cards.set(entry.id,{classList:{toggle(){}},querySelector:selector=>({'[data-image-toggle]':button,'[data-image-body]':body,'[data-image-chevron]':chevron,'[data-image-metadata]':details}[selector])});}
  app.element.querySelector=selector=>cards.get(selector.match(/data-entry="([^"]+)"/)?.[1]);app.render=()=>assert.fail('Bulk actions must not rerender images');
  for(const collapsed of [true,false]){app.collapseAll(collapsed);for(const {id} of state.entries){const card=cards.get(id);assert.equal(card.querySelector('[data-image-body]').hidden,collapsed);assert.equal(card.querySelector('[data-image-metadata]').open,!collapsed);assert.equal(state.previewCollapsed.has(id),collapsed);}assert.equal(JSON.stringify(app.draft),before);}
  app.collapseAll(true);app.sectorId='different-gallery';app.draft=context.normalizeSector({sectorType:'special',special:{images:[{title:'Other'}]}});assert.equal(app.entryState('special.images').previewCollapsed.size,0);
  app.draft.special.images=[];app.collapseAll(true);app.collapseAll(false);assert.equal(JSON.stringify(app.draft.special.images),'[]');
});

test('Normal tab display labels change while IDs, storage, controls and descriptions remain compatible',()=>{
  const {app,context}=fixture();context.game.journal.get=()=>({name:'Sector'});app.sectorId='normal-labels';app.draft=context.normalizeSector({version:1,encounters:[{title:'Mutant',type:'Humanoid',status:'Defeated',uuid:'Actor.keep'}],loot:[{title:'Rifle',quantity:3,type:'weapon',uuid:'Item.keep'}],locations:[{title:'Manual',details:'Do not replace'}],history:[{title:'Visit'}]});
  const before=JSON.stringify(app.draft);for(const [tab,label,key] of [['Encounters','Inhabitants','encounters'],['Loot','Gear & Artifacts','loot']]){app.tab=tab;const html=app.build();assert(html.includes(`data-tab="${tab}"`));assert(html.includes(`>${label.replaceAll('&','&amp;')}</button>`));assert(html.includes(`name="${key}.0.title"`));assert.match(html,/sm-entry-toggle sm-special-toggle/);const heading=html.slice(html.indexOf('data-entry-header'),html.indexOf('class="sm-entry-body"'));assert(heading.indexOf('data-entry-title')<heading.indexOf('data-chevron'));}
  assert.equal(JSON.stringify(app.draft),before);assert.equal(app.draft.locations[0].details,'Do not replace');
});

test('Special Locations creates blank nested records without Ruins rolls and preserves hidden Normal Locations through conversion',async()=>{
 const {app,context}=fixture();context.game.journal.get=()=>({name:'Sector'});app.sectorId='special-locations';app.draft=context.normalizeSector({sectorType:'special',locations:[{title:'Hidden normal ruin',details:'Keep'}],special:{situation:'Old situation'}});app.capture=()=>{};context.generateEntry=()=>assert.fail('Special Locations must not roll');app.tab='Locations';
 await app.addContextEntry('special.locations');assert.equal(app.draft.special.locations.length,1);assert.equal(app.draft.special.locations[0].details,'');assert.equal(app.draft.locations[0].details,'Keep');assert.equal(app.entryState('special.locations').collapsed.size,1);
 const html=app.build();assert.match(html,/name="special.locations.0.title"/);assert.match(html,/data-type="Scene\|JournalEntry\|JournalEntryPage"/);assert.match(html,/Details \/ Rules \/ Notes/);
 context.foundry.applications.api.DialogV2={wait:async()=>app.draft.sectorType==='special'?'normal':'special',confirm:async()=>true};await app.changeSectorType();assert.equal(app.draft.locations[0].details,'Keep');await app.changeSectorType();assert.equal(app.draft.special.locations.length,1);
});
test('Special Overview retains existing Situation field, independent expanded sections and correct order',()=>{
 const {app,context}=fixture();context.game.journal.get=()=>({name:'Sector'});app.sectorId='special-overview-collapse';app.draft=context.normalizeSector({sectorType:'special',special:{overview:'Overview text',situation:'Existing\n\nSituation'}});const original=JSON.stringify(app.draft);let html=app.build();
 assert.doesNotMatch(html,/data-tab="The Situation"/);assert.match(html,/data-overview-section="special.overview" open/);assert.match(html,/data-overview-section="special.situation" open/);assert.match(html,/rows="7" data-autosize/);assert(html.indexOf('name="special.overview"')<html.indexOf('name="special.situation"'));assert(html.indexOf('name="special.situation"')<html.indexOf('name="notes"'));
 app.overviewState()['special.overview']=true;html=app.build();assert.match(html,/data-overview-section="special.overview" >/);assert.match(html,/data-overview-section="special.situation" open/);assert.equal(JSON.stringify(app.draft),original);
});
test('Effects Macro control preserves original Journal reference, independent optional Macro and visible execution outcomes',()=>{
 const {app,context}=fixture();context.game.journal.get=()=>({name:'Sector',getFlag:(m,key)=>key==='entryTriggers'?{records:[{triggerId:'stable',tokenUuid:'Scene.zone.Token.party',status:'failed',error:'Denied'}]}:null});app.sectorId='macro-ui';app.draft=context.normalizeSector({effects:[{title:'Storm',uuid:'JournalEntry.weather',details:'Keep weather notes',triggerId:'stable',macroUuid:'Macro.weather',macroEnabled:true}]});app.tab='Effects';const original=JSON.stringify(app.draft),html=app.build();assert.match(html,/name="effects.0.uuid" value="JournalEntry.weather"/);assert.match(html,/name="effects.0.macroUuid" value="Macro.weather"/);assert.match(html,/data-type="Macro"/);assert.match(html,/name="effects.0.macroRunOnce" checked/);assert.match(html,/failed — Denied/);assert.match(html,/data-reset-all-triggers/);assert.equal(JSON.stringify(app.draft),original);
});
test('Macro reference opens its editor without invoking executable native document links',async()=>{
 const {app,documents}=fixture();let opened=0;documents.set('Macro.one',{documentName:'Macro',sheet:{render:async force=>{assert.equal(force,true);opened++;}},_onClickDocumentLink:()=>assert.fail('Macro link would execute')});await app.openReference({querySelector:()=>({value:'Macro.one'})});assert.equal(opened,1);
});

test('Settlement UI uses the shared seven-tab shell, required name and authored sections without Normal generation controls',()=>{
 const {app,context}=fixture();const record={version:1,sectorType:'settlement',sceneId:'zone',code:'B7',nameOverride:true,customName:'Harbor'};context.game.journal.get=()=>({id:'settlement',getFlag:()=>record});app.sectorId='settlement';app.draft=context.normalizeSector(record);
 const html=app.build();assert.deepEqual([...html.matchAll(/data-tab="([^"]+)"/g)].map(m=>m[1]),['Overview','Projects','Inhabitants','Factions','Events','Threads','Shop']);assert.match(html,/Settlement Name/);assert.match(html,/name="settlement.population" type="text"/);assert.match(html,/name="settlement.arkUuid"/);assert.doesNotMatch(html,/data-action="randomize"|data-tab="Locations"|name="threatLevel"/);
 for(const tab of ['Projects','Inhabitants','Factions','Events','Threads']){app.tab=tab;assert.match(app.build(),/No .* have been added to this settlement/);}
});
test('Settlement Add uses stable persistent IDs, never rolls, and rejects inactive Normal collections',async()=>{
 const {app,context}=fixture();context.game.journal.get=()=>({id:'settlement'});app.sectorId='settlement-add';app.draft=context.normalizeSector({sectorType:'settlement'});app.capture=()=>{};context.generateEntry=()=>assert.fail('No generation');
 for(const key of Object.values(SETTLEMENT_COLLECTIONS).filter(key=>key!=='settlement.shop.groups')){await app.addContextEntry(key);const item=sectorCollection(app.draft,key)[0];assert.equal(typeof item.id,'string');assert(item.id);assert(!app.entryState(key).collapsed.has(app.entryState(key).entries[0].id));}
 const before=JSON.stringify(app.draft);await app.addContextEntry('loot');await app.randomizeSector();assert.equal(JSON.stringify(app.draft),before);
});
test('Settlement conversion requires chosen type and confirmation; cancellation/stale results cannot modify data',async()=>{
 const {app,context}=fixture();context.game.journal.get=()=>({id:'convert'});app.sectorId='convert';app.draft=context.normalizeSector({version:1,sectorType:'special',special:{overview:'Original'}});app.capture=()=>{};let confirm=false;context.foundry.applications.api.DialogV2={wait:async()=> 'settlement',confirm:async()=>confirm};const before=JSON.stringify(app.draft);await app.changeSectorType();assert.equal(JSON.stringify(app.draft),before);
 confirm=true;await assert.rejects(app.changeSectorType(),/Configure a Zone Scene/);assert.equal(JSON.stringify(app.draft),before);
});
test('Settlement saves require a name and valid coordinates before any Journal write',async()=>{
 const {app,context,notices}=fixture();context.console={error(){}};const j={id:'settlement',update:()=>assert.fail('No writes for invalid metadata')};context.game.journal.get=()=>j;app.sectorId=j.id;app.capture=()=>{};app.draft=context.normalizeSector({sectorType:'settlement',code:'A1',nameOverride:false});await app.action('save');assert.match(notices.at(-1),/Settlement Name/);app.draft.nameOverride=true;app.draft.customName='Village';app.draft.code='';await app.action('save');assert.match(notices.at(-1),/Settlement coordinates/);
});
test('Shop reference autosaves preserve fresh unrelated flags and reject concurrent inventory changes without overwriting them',async()=>{
 const {app,context}=fixture();let saved=context.normalizeSector({version:1,sectorType:'settlement',nameOverride:true,customName:'Harbor',code:'A1',notes:'Saved GM note'}),writes=0;const journal={id:'shop-autosave',getFlag:()=>saved,async setFlag(module,key,next){saved=structuredClone(next);writes++;}};app.sectorId=journal.id;context.game.journal.get=()=>journal;app.draft=structuredClone(saved);app.draft.notes='Unsaved unrelated note';const baseline=JSON.stringify(saved.settlement.shop);app.draft.settlement.shop.groups[0].entries.push({id:'first',uuid:'Item.gear'});saved.notes='Other GM updated note';saved.future={keep:true};await app.persistShop(journal,baseline);assert.equal(saved.notes,'Other GM updated note');assert.deepEqual(saved.future,{keep:true});assert.equal(saved.settlement.shop.groups[0].entries[0].uuid,'Item.gear');assert.equal(app.draft.notes,'Unsaved unrelated note');
 let release;app.autosaveWrite=new Promise(resolve=>release=resolve);const pending=app.persistShop(journal,JSON.stringify(saved.settlement.shop));saved.settlement.shop.groups[0].entries.push({id:'other',uuid:'Item.other'});release();await assert.rejects(pending,/Saved entries changed/);assert.equal(writes,1);assert.equal(saved.settlement.shop.groups[0].entries.length,2);assert.equal(app.draft.settlement.shop.groups[0].entries.length,1);
});
