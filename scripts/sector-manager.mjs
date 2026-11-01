import {mainFrameButtons,positionMainMinimize} from './ui/main-window.mjs';
import {collectionEmpty} from './ui/presentation.mjs';
import {bindDropFeedback,beginDrop,dropTarget} from './ui/drop.mjs';
import {hydrateFactions} from './settlement-factions-ui.mjs';
import {hydrateShop} from './settlement-shop-ui.mjs';
import {requireDocument,resolveDocument,parseDocumentDrop,openDocument,currentReferenceNode} from './ui/documents.mjs';
import {referenceField,referenceState,documentLink,promptReference,bindReferenceUpdates,unbindReferenceUpdates} from './ui/reference.mjs';
import {imagePreview,pickImage} from './ui/images.mjs';
import {gearEntry,eventEntry} from './ui/content.mjs';
import {collectionActions,entryLabel,confirmEntryRemoval,unsavedChangesGuard} from './ui/actions.mjs';
import {sameRecord,acknowledgePaths,saveStatus} from './ui/save-state.mjs';
import {ScrollKeeper} from './ui/scroll.mjs';
import {InhabitantPortraits,avatarMarkup,portraitFields} from './ui/inhabitant-portraits.mjs';
import {entryCard,updateEntryCollapse,bindEntryCollapse,unbindEntryCollapse} from './ui/entry.mjs';
import {selectOptions} from './ui/options.mjs';
import {CampaignLogService} from './campaign/service.mjs';
import {openCampaignLog,logButton} from './campaign/ui.mjs';
import {activeSession} from './campaign/model.mjs';
import {PartySkillService} from './party-skills.mjs';
import {openPartySkillRequest} from './party-skills-ui.mjs';
import {PlayerShopService} from './player-shop-service.mjs';
import {createPlayerShopClass} from './player-shop-ui.mjs';
import {hydrateArk,requireArk,synchronizeArkDraft} from './settlement-ark.mjs';
import {settingsMenu,bindSettingsMenu,refreshSettingsMenu} from './settings-menu.mjs';
import {importSector,exportSector} from './portable/ui.mjs';
import {sortEditorEntries} from './entry-order.mjs';
import {inhabitantCollection} from './inhabitants.mjs';
import {hydrateInhabitants,bindInhabitantDrops,dropInhabitant,linkInhabitant} from './inhabitants-ui.mjs';
import {SETTLEMENT_COLLECTIONS,SETTLEMENT_ACCENT,settlementAccent,normalizeSettlement,newSettlementEntry,requireProject,assignProject} from './settlement.mjs';
import {renderSettlement,hydrateSettlement,bindSettlement,renderProject} from './settlement-ui.mjs';
import {MovementRecovery} from './travel/recovery.mjs';
import {registerDocumentReferences} from './document-reference-settings.mjs';
import {ensureReferenceMigration} from './document-references.mjs';
import {macroRunOnce} from './zone/entry-triggers.mjs';
import {safeImageSource} from './zone/presentation.mjs';
import {imagePath,journalImageSource} from './sector-images.mjs';
import {isSpecial,isSettlement,isAuthored,sectorOnScene,sectorTabs,sectorCollection,specialQuantity,normalizeSpecialGear,normalizeSectorType,sectorTitle,tabLabel} from './sector-types.mjs';
import {generateEntry,normalizeEncounter,ENCOUNTER_STATUSES,ENCOUNTER_TYPES} from './entry-generation.mjs';
import {normalizePathStunts,normalizeThreatLevel,sectorThreatLevel,threatDescriptor,meaningfulText,cleanThreatRecord,threatDeletion} from './sector-fields.mjs';
import {normalizeLoot,lootTitle,itemLootType,lootQuantity,lootCollected} from './loot.mjs';
import {canonicalCoordinate} from './zone/grid.mjs';
import {sectorIndicators,iconMarkup} from './sector-icons.mjs';
import {travelOptions,travelTimes,formatDuration,sectorTravelOptions,storedTravel,LINKED_STUNTS} from './travel-time.mjs';
import {sectorNaming,sectorName,ensureJournalFolders,JournalOrganization} from './journal-organization.mjs';
import {saveGeneratedSector,RANDOMIZATION_METHODS,DEFAULT_GENERATION_OPTIONS} from './sector-randomizer.mjs';
import {tabHasContent,CONSUMABLES} from './sector-content.mjs';
import {ZoneRuntime} from './zone/runtime.mjs';
const MOD = 'myz-sector-manager';
const KEY = 'sector';
const COLLECTIONS = {Locations:'locations', Encounters:'encounters', Loot:'loot', Effects:'effects', History:'history', Inhabitants:'special.inhabitants', 'Gear & Artifacts':'special.gear', Events:'special.events', Images:'special.images'};
const REFERENCES = {'settlement.projects':'Item','settlement.inhabitants':'Actor','settlement.inventory':'Item','settlement.ark':'Actor',locations:'Scene|JournalEntry|JournalEntryPage', encounters:'Actor|JournalEntry|JournalEntryPage', loot:'Item', effects:'Actor|JournalEntry|JournalEntryPage', 'effectMacro':'Macro', 'special.locations':'Scene|JournalEntry|JournalEntryPage', 'special.scene':'Scene', 'special.inhabitants':'Actor', 'special.gear':'Item', 'special.events':'JournalEntry|JournalEntryPage', 'special.images':'JournalEntryPage'};
// Session-only UI identities: never written to Journal flags.
const ENTRY_UI = new Map();
const CONSUMABLE_UI = new Map();
const OVERVIEW_UI = new Map();
let entrySequence = 0;
const SUPPLIES = CONSUMABLES;
const supplyDefaults = () => Object.fromEntries(Object.keys(SUPPLIES).map(key=>[key,{quantity:0,collected:false}]));
// Stable IDs and visibility metadata support future definitions without changing records.
const PATH_STUNTS = [
  ['safePath','Find a safe path and spot any threats.','Core Rulebook p. 56','standard'],
  ['artifact','Find an artifact.','Core Rulebook p. 56','standard'],
  ['assessRot',"Assess the sector's general Rot level.",'Core Rulebook p. 56','standard'],
  ['bullets','Find D6 bullets.','Core Rulebook p. 56','standard'],
  ['grub','Find D6 rations of Rot-contaminated grub.','Core Rulebook p. 56','standard'],
  ['water','Find D6 rations of Rot-free water.','Core Rulebook p. 56','standard'],
  ['halfTime','Explore the sector in half the normal time.','Core Rulebook p. 56','standard'],
  ['rush','Rush through in one-quarter of normal exploration time.','Core Rulebook p. 56','standard','Avoid threats without fully exploring or collecting resources.'],
  ['saferRoute','Find a safer route','Rot Finder talent; Core Rulebook p. 64','talent','Reduce effective Rot by one step for the current visit.']
].map(([id,label,source,group,description=label])=>({id,label,source,group,description,visibility:'players'}));
const ROT_LEVELS = [
  {level:0,label:'Rot Oasis',exposure:'No Rot Points from environmental exposure.'},
  {level:1,label:'Weak Rot',exposure:'1 Rot Point per day.'},
  {level:2,label:'Rot-Heavy Area',exposure:'1 Rot Point per hour.'},
  {level:3,label:'Rot Hotspot',exposure:'Localized Rot hotspot; not a sector-wide level.'}
];
// Verified Core Rulebook pp. 156–158 entries supplied by the user.
const TERRAIN_OPTIONS = [
  'Airplane Wreck','Amusement Park','Ash Desert','Battlefield','Bus Station','Car Park',
  'Church','Cinema','Crater','Crumbling Ruins','Dead Woods','Decayed Ruins','Derelict Industries',
  'Dilapidated Mansion','Factory','Fast Food Joint','Gas Station','Glasified Field','Highway',
  'Hospital','Huge Crater','Hunting Store','Mall','Marina','Marshlands','Military Base','Museum',
  'Office Building','Oil Cistern','Overgrown Park','Overgrown Ruins','Pipeline','Playground',
  'Police Station','Power Line','Purification Plant','Radio Mast','Radio Station','Refinery',
  'Residential Blocks','Road Tunnel','Rubbish Dump','Ruined Bridge','School','Scrublands',
  'Settlement','Shelter','Shipwreck','Shooting Range','Skyscraper','Sports Center','Suburbia',
  'Subway Station','Supermarket','Swimming Hall','Tank','Theater','Thick Woods','Train Station',
  'Unscathed Ruins','Windmill'
];
const stuntLabel=(stunt,data)=>`<label class="sm-stunt" title="${attr(stunt.description)}"><input type="checkbox" name="pathStunts.${stunt.id}" ${stunt.id!=='safePath'&&!data.pathStunts?.safePath?'disabled':''} ${data.pathStunts?.[stunt.id]?'checked':''}><span>${escapeHTML(stunt.label)}${stunt.group==='talent'?` (${escapeHTML(stunt.source)})`:''}<small>${escapeHTML(stunt.id==='safePath'?'Basic effect: does not use an additional stunt success.':stunt.description!==stunt.label?stunt.description:'')}</small></span></label>`;
const travelCalculator=data=>{
  const o=sectorTravelOptions(data),t=travelTimes(o);
  const modifiers=[['rushed','Rushed Exploration (×¼)','Rush through without fully exploring.'],['stalker','Stalker / Find the Path (×½)','Apply the exploration-time benefit only when obtained.'],['open','Open / Empty Terrain (×½)','Open terrain halves exploration time; excludes Difficult Terrain.'],['difficult','Difficult Terrain (×2+)','Use the GM-selected multiplier, at least 2; excludes Open Terrain.'],['night','Nighttime (×2)','Exploring at night doubles exploration time.']];
  return `<section class="sm-travel"><h3>Exploration &amp; Travel Time</h3><p>Explore Sector: <strong data-explore-time>${formatDuration(t.explore)}</strong></p><p>Pass Through Explored Sector: <strong data-pass-time>${formatDuration(t.pass)}</strong></p><fieldset><legend>Travel Mode</legend>${[['foot','On Foot'],['vehicle','Vehicle']].map(([value,label])=>`<label><input type="radio" name="travel.mode" value="${value}" ${o.mode===value?'checked':''}> ${label}</label>`).join(' ')}</fieldset><fieldset><legend>Exploration Modifiers</legend><div class="sm-modifier-columns">${[modifiers.slice(0,3),modifiers.slice(3)].map(column=>`<div>${column.map(([key,label,tip])=>`<label class="sm-stunt" title="${tip}"><input type="checkbox" name="travel.${key}" ${['rushed','stalker'].includes(key)&&!data.pathStunts?.safePath?'disabled':''} ${o[key]?'checked':''}>${label}${key==='difficult'?` <input aria-label="Difficult Terrain multiplier" name="travel.difficulty" type="number" min="2" step="any" value="${o.difficulty}">`:''}</label>`).join('')}</div>`).join('')}</div></fieldset><small>Planning reference only. Linked time stunts save automatically; other options save with Save Sector. Does not advance time, move the party, consume resources, or perform rolls.</small></section>`;
};
const pathStunts = data => `<section class="sm-path"><p>Track benefits obtained during the current visit or exploration. Each stunt is available once per Find the Path roll (p. 56). The repeat-search guidance also limits each stunt to once per sector (p. 160). The GM controls resets; these checkboxes do not enforce either restriction. Checkboxes save automatically. Nothing resets automatically, awards resources, changes Rot, or advances world time. Linked time stunts update the reference calculator below.</p><h3>Find the Path Stunts</h3><div class="sm-stunt-columns">${[PATH_STUNTS.slice(0,5),PATH_STUNTS.slice(5)].map(column=>`<div>${column.map(stunt=>stuntLabel(stunt,data)).join('')}</div>`).join('')}</div><button type="button" data-action="reset-stunts">Reset Stunts</button>${travelCalculator(data)}</section>`;
const sectorIcon=(data,key)=>{const info=sectorIndicators(data)[key];return `<span data-icon-slot="${key}">${iconMarkup(info.icon,info.title)}</span>`;};
const threatField=data=>`<div class="sm-field"><label for="sm-threat-level">Threat Level</label><div class="sm-threat-stepper"><button type="button" data-threat-step="-1" aria-label="Decrease Threat Level">−</button><input id="sm-threat-level" name="threatLevel" type="number" min="0" step="1" value="${sectorThreatLevel(data)}"><button type="button" data-threat-step="1" aria-label="Increase Threat Level">+</button></div><small data-threat-descriptor>${threatDescriptor(sectorThreatLevel(data))}</small></div>`;
const terrainField = data => `<label class="sm-field"><span>${sectorIcon(data,'terrain')} Terrain</span><input name="terrain" type="text" list="sm-terrain-options" value="${attr(data.terrain)}"><datalist id="sm-terrain-options">${TERRAIN_OPTIONS.map(value=>`<option value="${attr(value)}"></option>`).join('')}</datalist></label>`;
const rotField=data=>`<label class="sm-field"><span>${sectorIcon(data,'rot')} Rot Level</span><select name="rot">${ROT_LEVELS.some(entry=>String(entry.level)===String(data.rot))?'':`<option value="${attr(data.rot)}" selected>Existing value: ${escapeHTML(data.rot)}</option>`}${ROT_LEVELS.map(entry=>`<option value="${entry.level}" ${String(entry.level)===String(data.rot)?'selected':''}>${entry.level} - ${entry.label}</option>`).join('')}</select><small data-rot-exposure>${escapeHTML(ROT_LEVELS.find(entry=>String(entry.level)===String(data.rot))?.exposure||'Existing value retained; select a level to change it.')}</small></label>`;
const normalize = (data,title='') => {const result=sectorNaming(cleanThreatRecord(data),title);  result.pathStunts=normalizePathStunts(result.pathStunts,{legacy:true});result.threatLevel=sectorThreatLevel(result); result.travel=sectorTravelOptions(result); result.loot=(result.loot||[]).map(normalizeLoot);result.encounters=(result.encounters||[]).map(normalizeEncounter); result.supplies ??= {}; for(const key of Object.keys(SUPPLIES)) result.supplies[key] ??= {quantity:0,collected:false}; return normalizeSectorType(result);};
const DEFAULT = () => ({version:1, sectorType:'normal', special:{overlayImage:'',images:[],locations:[],sceneUuid:'',source:'',overview:'',situation:'',inhabitants:[],gear:[],events:[]}, threatLevel:1, nameOverride:false, customName:'', pathStunts:{}, code:'', terrain:'', rot:0, status:'Unexplored', description:'', notes:'', locations:[], encounters:[], loot:[], effects:[], secrets:[], history:[], supplies:supplyDefaults()});
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const attr = escapeHTML;
const field = (label,name,value='',type='text') => `<label class="sm-field"><span>${escapeHTML(label)}</span><input name="${attr(name)}" type="${type}" value="${attr(value)}" ${type==='number'?'min="0" step="1"':''}></label>`;
const area = (label,name,value='',rows=5) => `<label class="sm-field"><span>${escapeHTML(label)}</span><textarea name="${attr(name)}" rows="${rows}">${escapeHTML(value)}</textarea></label>`;
const select = (label,name,value,opts) => `<label class="sm-field"><span>${escapeHTML(label)}</span><select name="${attr(name)}">${selectOptions(value,opts)}</select></label>`;
const reference = (key,i,uuid='',name=`${key}.${i}.uuid`) => referenceField({name,uuid,types:REFERENCES[key]||''});
const outstandingSupplies = data => Object.keys(SUPPLIES).some(key=>Number(data.supplies?.[key]?.quantity)>0&&!data.supplies[key].collected);
const supplies = (data,collapsed) => `<section class="sm-consumables"><button type="button" class="sm-consumables-header" data-consumables-toggle aria-expanded="${!collapsed}" aria-controls="sm-consumables-body"><span data-consumables-chevron aria-hidden="true">${collapsed?'▶':'▼'}</span> Consumables</button><div id="sm-consumables-body" ${collapsed?'hidden':''}><div class="sm-consumable-columns">${[['cleanGrub','rotGrub','cleanWater','rotWater'],['bullets','booze','components']].map(keys=>`<table class="sm-supplies"><thead><tr><th>Resource</th><th>Quantity</th><th>Collected</th></tr></thead><tbody>${keys.map(key=>{const label=SUPPLIES[key],value=data.supplies?.[key]??{quantity:0,collected:false};return `<tr data-supply="${key}" class="${Number(value.quantity)>0&&!value.collected?'is-available':''}"><th scope="row">${label}</th><td><input aria-label="${label} quantity" name="supplies.${key}.quantity" type="number" min="0" step="any" value="${attr(value.quantity)}"></td><td><input aria-label="${label} collected" name="supplies.${key}.collected" type="checkbox" ${value.collected?'checked':''}></td></tr>`;}).join('')}</tbody></table>`).join('')}</div><p>Collected marks the recorded quantity; it does not transfer resources or subtract them.</p></div></section>`;

// Previously no width was supplied: DialogV2 inherited Foundry's default.
const randomizeDialogOptions = () => {
  const inherited=Number(foundry.applications.api.DialogV2.DEFAULT_OPTIONS?.position?.width);
  return {classes:['myz-sector-randomize-dialog'],position:{width:Math.max(320,Math.round(Number.isFinite(inherited)&&inherited>0?inherited/2:320))}};
};
const randomizeDialogContent = content => `<style>
  .application.myz-sector-randomize-dialog{max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);min-width:0}
  .myz-sector-randomize-dialog .window-content{min-width:0;min-height:0;overflow-y:auto;overflow-x:hidden}
  .myz-sector-randomize-dialog .dialog-content{min-width:0;min-height:0;max-height:calc(100dvh - 140px);overflow-y:auto;overflow-x:hidden}
  .myz-sector-randomize-dialog .dialog-buttons{flex-shrink:0;flex-wrap:wrap}
  .sm-randomize-content{overflow-wrap:anywhere;white-space:normal;min-width:0;max-width:100%}
  .sm-randomize-content select{width:100%;min-width:0;max-width:100%}
</style><div class="sm-randomize-content">${content}</div>`;

class SectorManager extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {id:'myz-sector-manager-app', window:{title:'MYZ Sector Manager',resizable:true,minimizable:true}, position:{width:920,height:730}, classes:['myz-sector-manager']};
  _getFrameButtons(options){return mainFrameButtons(this,super._getFrameButtons?.(options)||[]);}
  constructor(options={}) {super(options); this.sectorId = options.sectorId ?? null; this.tab='Overview'; this.draft=null; this.dirty=false; this.filter=''; this.busy=false;this.lootTypeRevisions=new WeakMap();this.scrollKeeper=new ScrollKeeper(globalThis);this.portraits=new InhabitantPortraits(this,globalThis);}
  get arkPlacementContext(){return {grid:zone.store.config?.grid,sceneId:zone.store.config?.sceneId,journals:game.journal,journalId:this.sectorId};}
  get journals(){return game.journal.filter(j=>j.getFlag(MOD,KEY)?.version===1&&sectorOnScene(j.getFlag(MOD,KEY),zone.store.config?.sceneId)).sort((a,b)=>{const ac=a.getFlag(MOD,KEY)?.code?.trim()||'', bc=b.getFlag(MOD,KEY)?.code?.trim()||''; return (ac&&bc?ac.localeCompare(bc,undefined,{numeric:true,sensitivity:'base'}):ac?-1:bc?1:0)||a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'});});}
  get journal(){return game.journal.get(this.sectorId);}
  get canRandomize(){const journal=this.journal,record=journal?.getFlag?.(MOD,KEY);return Boolean(!isAuthored(this.data)&&!isAuthored(record)&&journal?.id&&!journal.isTemporary&&record?.version===1&&record.initialSavePending!==true);}
  get data(){return this.draft ?? DEFAULT();}
  async _prepareContext(){return {};}
  async _renderHTML(){
    if(isSettlement(this.data))await synchronizeArkDraft(this);
    const root=document.createElement('div');
    root.className='sm-root';
    this.referenceClosed=false;this.referenceRoot=root;root.innerHTML=this.build();root.dataset.scrollScope=JSON.stringify([this.sectorId,this.tab]);this.portraits.prepare(root);if(isSettlement(this.data)&&this.tab==='Projects')root.querySelector('.sm-content')?.classList.add('sm-projects-grid');
    this.referenceHydration=Promise.all(Array.from(root.querySelectorAll('[data-reference]'),zone=>this.renderReference(zone))).catch(()=>{});
    if(isSettlement(this.data))await hydrateSettlement(this,root);
    hydrateInhabitants(this,root,globalThis);sortEditorEntries(this,root);
    return root;
  }
  _onPosition(position){super._onPosition?.(position);this.settingsMenuReposition?.();}
  _replaceHTML(result,content){
    // ApplicationV2 supplies its actual .window-content node here. Its child
    // must also be a shrinking flex container, not an auto-height wrapper.
    content.classList.add('sm-window-content');
    this.scrollKeeper.capture(content.querySelector('.sm-root'));content.replaceChildren(result);this.scrollKeeper.restore(result);
  }
  build(){
    const j=this.journal, d=this.data;
    const tabs=sectorTabs(d);if(!tabs.includes(this.tab))this.tab='Overview';
    const list=this.journals;
    const record=x=>x.id===this.sectorId?d:x.getFlag(MOD,KEY);
    const matches=x=>`${sectorTitle(record(x),x.name)} ${x.name}`.toLowerCase().includes(this.filter.toLowerCase());
    const menu=`<aside class="sm-sidebar"><input data-filter aria-label="Search sectors by coordinates or name" placeholder="Search sectors" value="${attr(this.filter)}"><div class="sm-list">${list.map(x=>`<button type="button" data-open="${attr(x.id)}" data-search="${attr(`${sectorTitle(record(x),x.name)} ${x.name}`.toLowerCase())}" ${matches(x)?'':'hidden'} ${x.id===this.sectorId?'aria-current="page"':''} class="${x.id===this.sectorId?'selected':''} ${isSettlement(record(x))?'sm-sector-settlement':isSpecial(record(x))?'sm-sector-special':''}"><span class="sm-sector-meta"><strong data-sector-label>${escapeHTML(sectorTitle(record(x),x.name))}</strong><small>${escapeHTML(record(x)?.status||'')}${isSettlement(record(x))?' • Settlement':isSpecial(record(x))?' • Special':' • Normal'}</small></span></button>`).join('')}<p data-sector-empty ${list.some(matches)?'hidden':''}>${list.length?'No sectors match your search.':'No sectors yet.'}</p></div></aside>`;
    const zoneSummary=`<div class="sm-zone-summary">${zone.summary(this.journal&&sectorOnScene(this.data,zone.store.config?.sceneId)?this.data:null)}</div>`;
    let main=`<section class="sm-main"><header class="sm-header"><h2>Zone Sectors</h2><div class="sm-header-buttons"><button type="button" disabled>Delete Sector</button><button type="button" data-action="new">+ New Sector</button>${logButton(campaignRecording())}${settingsMenu(this,zone)}</div></header>${zoneSummary}<div class="sm-content"><div class="sm-empty"><p>Create a sector or select one from the list. Each record is a GM-only Journal Entry.</p></div></div></section>`;
    if(j){
      let body='';
      if(isSettlement(d))body=renderSettlement(this,{field,area,select,reference,terrainField});
      else if(this.tab==='Overview') body=`<div class="sm-overview-grid"><div class="sm-field"><label for="sm-sector-name">Sector name</label><div class="sm-name-control"><input id="sm-sector-name" data-sector-name value="${attr(sectorName(d))}"><button type="button" data-action="reset-name">Reset to Default</button></div></div>${field('Coordinates','code',d.code).replace('<input name="code"','<input size="4" name="code"')}${terrainField(d)}${select('Exploration Status','status',d.status,['Unexplored','Scouted','Visited','Explored','Cleared','Lost']).replace('<span>Exploration Status</span>',`<span>${sectorIcon(d,'status')} Exploration Status</span>`)}${rotField(d)}${threatField(d)}</div>${isSpecial(d)?`<section><h3>Scene</h3>${reference('special.scene',0,d.special.sceneUuid,'special.sceneUuid')}</section>${field('Source','special.source',d.special.source)}${this.overviewSection('Overview','special.overview',d.special.overview)}${this.overviewSection('The Situation','special.situation',d.special.situation)}`:`${this.overviewSection('Mood','mood',d.mood)}${this.overviewSection('Description','description',d.description)}`}${area('GM Notes','notes',d.notes)}${isSpecial(d)?this.overlayImageControl():''}`;
      else if(this.tab==='Images')body=this.imagesEntries();
      else if(['Inhabitants','Gear & Artifacts','Events'].includes(this.tab))body=this.specialEntries(COLLECTIONS[this.tab]);
      else if(this.tab==='Find the Path') body=pathStunts(d);
      else {
        const key=this.collectionKey(), arr=sectorCollection(d,key);
        const state=this.entryState(key);
        body=({Encounters:'encounters',Effects:'phenomena',Loot:'loot'}[this.tab]?`<h3 data-sector-section data-collection-heading>${sectorIcon(d,{Encounters:'encounters',Effects:'phenomena',Loot:'loot'}[this.tab])} ${escapeHTML(tabLabel(this.tab))}</h3>`:`<h3 data-collection-heading>${escapeHTML(tabLabel(this.tab))}</h3>`)+(this.tab==='Loot'?supplies(d,this.consumablesState().collapsed):'')+`<div class="sm-section-header"><p>${this.tab==='Effects'?'<button type="button" data-reset-all-triggers>Reset all sector Macros</button>':''}${this.tab==='Effects'?'Track weather, Zone phenomena, hazards, and special environmental effects.':`Track sector ${tabLabel(this.tab).toLowerCase()} as individual editable records.`}</p>${collectionActions({key,count:arr.length,disabled:this.addingEntry,history:this.tab==='History'})}</div>`+
          arr.map((item,i)=>{const id=state.entries[i].id,collapsed=state.collapsed.has(id);if(key==='loot')return this.gearEntry(key,item,i,id,collapsed);return entryCard({id,collection:key,collapsed,headerContent:key==='encounters'?avatarMarkup():'',title:item.title||`Entry ${i+1}`,removeTitle:'Remove entry',removeLabel:`Remove ${item.title||`Entry ${i+1}`}`,body:`<div class="sm-grid">${field(key==='encounters'?'Name':'Title',`${key}.${i}.title`,item.title||'')}${this.tab==='Encounters'?select('Status',`${key}.${i}.status`,normalizeEncounter(item).status,ENCOUNTER_STATUSES)+select('Type',`${key}.${i}.type`,normalizeEncounter(item).type,ENCOUNTER_TYPES)+(item.legacyStatus?`<small>Previous status: ${escapeHTML(item.legacyStatus)} (retained)</small>`:'')+(item.legacyType?`<small>Previous type: ${escapeHTML(item.legacyType)} (retained)</small>`:''):select('Status',`${key}.${i}.status`,item.status||'Active',['Active','Hidden','Discovered','Resolved','Collected','Depleted','Inactive'])}${this.tab==='Effects'?select('Category',`${key}.${i}.category`,item.category||'Weather',['Weather','Phenomenon','Special Effect','Hazard'])+reference(key,i,item.uuid||''):reference(key,i,item.uuid||'')}</div>${item.referenceWarning?`<p class="sm-reference-missing" data-reference-warning role="status">${escapeHTML(item.referenceWarning)}</p>`:''}${area(key==='encounters'?'Description / Notes':'Details / Rules / Notes',`${key}.${i}.details`,item.details||'')}${this.tab==='Encounters'?`<div class="sm-inhabitant-description" data-inhabitant-preview></div>${portraitFields(`${key}.${i}.portrait`,item.portrait)}`:''}${this.tab==='Effects'?field('Duration / Trigger',`${key}.${i}.duration`,item.duration||'')+this.macroControl(item,i):''}`});}).join('')+
          (!arr.length?collectionEmpty(key):'');
      }
      main=`<section class="sm-main"><header class="sm-header"><div><h2 data-sector-heading>${escapeHTML(sectorTitle(d))}</h2><small>GM only · Journal-backed · ${escapeHTML(d.code||'No sector ID')}${isSettlement(d)?` · Scene: ${escapeHTML(game.scenes?.get(d.sceneId)?.name||d.sceneId||'Unassigned')}`:''}</small></div><div class="sm-header-buttons"><button type="button" data-action="change-type">Change Sector Type</button><button type="button" data-action="journal">Open Journal</button><button type="button" data-action="delete">Delete Sector</button><button type="button" data-action="new">+ New Sector</button>${logButton(campaignRecording())}${settingsMenu(this,zone)}</div></header>${zoneSummary}<nav class="sm-tabs" aria-label="Sector tabs">${tabs.map(t=>`<button type="button" data-tab="${t}" ${t===this.tab?'aria-current="page"':''} class="${t===this.tab?'active':''} ${tabHasContent(d,t)?'':'sm-tab-empty'}">${escapeHTML(tabLabel(t))}</button>`).join('')}${isAuthored(d)?'':`<button type="button" data-action="randomize" ${this.canRandomize?'':'disabled title="Save this sector before randomizing."'}>Randomize</button>`}</nav><div class="sm-content${isSettlement(d)&&this.tab==='Shop'?' sm-shop-content':''}">${body}</div><footer class="sm-footer"><span role="status" aria-live="polite">${escapeHTML(saveStatus(this))}</span><button type="button" data-action="save" ${this.busy?'disabled':''}>Save Sector</button></footer></section>`;
    }
    return `<style>
      .myz-sector-manager .sm-window-content{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0;padding:0;overflow:hidden}
      .myz-sector-manager .sm-root{display:flex;flex:1;min-height:0;min-width:0;overflow:hidden;container-type:inline-size}
      .myz-sector-manager .sm-shell{display:flex;flex:1;min-height:0;min-width:0;font-size:14px}
      .myz-sector-manager .sm-shell button,.myz-sector-manager .sm-shell input,.myz-sector-manager .sm-shell select,.myz-sector-manager .sm-shell textarea{font:inherit}
      .myz-sector-manager .sm-sidebar{width:230px;box-sizing:border-box;flex:none;border-right:1px solid var(--color-border-light-primary,#777);padding:12px;display:flex;flex-direction:column;gap:10px;min-height:0}
      .myz-sector-manager .sm-toolbar,.myz-sector-manager .sm-sidebar>input{flex-shrink:0}
      .myz-sector-manager .sm-toolbar button{width:100%}
      .myz-sector-manager .sm-projects-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-content:start}
      .myz-sector-manager .sm-projects-grid>.sm-section-header,.myz-sector-manager .sm-projects-grid>.sm-empty{grid-column:1 / -1}
      .myz-sector-manager .sm-project-group-grid>.sm-entry{min-width:0;margin:0}
      .myz-sector-manager .sm-project-status-group{grid-column:1/-1;border-bottom:1px solid var(--color-border-light-primary,#777);padding-bottom:12px}
      .myz-sector-manager .sm-project-status-group>summary{font-weight:bold;margin-bottom:10px;cursor:pointer}
      .myz-sector-manager .sm-project-group-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .myz-sector-manager .sm-project-group-grid>.sm-entry:not(.is-collapsed){grid-column:1/-1}
      .myz-sector-manager .sm-project-ready{color:var(--color-level-success,#248438);font-weight:bold;align-self:center}.myz-sector-manager .sm-project-ready[hidden]{display:none}
      .myz-sector-manager .sm-project-not-started{background:color-mix(in srgb,#398ac9 18%,transparent);border-inline-start:3px solid #398ac9}
      .myz-sector-manager .sm-project-completed{background:color-mix(in srgb,#39944b 18%,transparent);border-inline-start:3px solid #39944b}
      .myz-sector-manager .sm-project-unavailable{background:color-mix(in srgb,#888 14%,transparent);border-inline-start:3px solid #888}
      .myz-sector-manager .sm-project-controls{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:12px}.myz-sector-manager .sm-project-controls label{display:flex;flex-direction:column;gap:6px}.myz-sector-manager .sm-project-controls span{display:flex;align-items:center;gap:4px}.myz-sector-manager [data-project-points]{width:calc(2ch + 12px);min-width:calc(2ch + 12px);box-sizing:border-box;padding:2px 6px;text-align:center;appearance:textfield}.myz-sector-manager [data-project-points]::-webkit-inner-spin-button,.myz-sector-manager [data-project-points]::-webkit-outer-spin-button{appearance:none;margin:0}.myz-sector-manager [data-project-step]{width:26px;padding:0}
      @container(max-width:640px){.myz-sector-manager .sm-project-group-grid{grid-template-columns:minmax(0,1fr)}}
      .myz-sector-manager .sm-project-incomplete{background:color-mix(in srgb,var(--color-warm-2,#bd923e) 14%,transparent);border-inline-start:3px solid var(--color-warm-2,#bd923e)}
      @container(max-width:640px){.myz-sector-manager .sm-projects-grid{grid-template-columns:minmax(0,1fr)}}
      .myz-sector-manager .sm-list button.sm-sector-settlement{border-left:4px solid var(--sm-settlement-accent,${SETTLEMENT_ACCENT})}
      .myz-sector-manager .sm-content.sm-shop-content{display:flex;overflow:hidden;padding:8px;scrollbar-gutter:auto}
      .myz-sector-manager .sm-shop{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0;gap:6px}
      .myz-sector-manager .sm-shop button{width:auto;flex:none;padding:4px 7px;white-space:nowrap}
      .myz-sector-manager .sm-shop-top{display:flex;flex-wrap:wrap;gap:5px;align-items:center;flex:none;min-width:0}
      .myz-sector-manager .sm-shop-top label{display:flex;gap:4px;align-items:center;min-width:0}
      .myz-sector-manager .sm-shop-top select{min-width:0;max-width:150px}
      .myz-sector-manager .sm-shop-top small,.myz-sector-manager .sm-shop-top details{flex-basis:100%;overflow-wrap:anywhere}
      .myz-sector-manager .sm-shop-inventory{position:relative;flex:1;min-height:0;min-width:0;overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable;overflow-anchor:none}
      .myz-sector-manager .sm-shop-sticky{position:sticky;top:0;z-index:2;background:#e4dfd4;color:#191919;box-shadow:0 1px 2px #0006;border-radius:4px 4px 0 0}
      .myz-sector-manager .sm-shop-heading{display:flex;align-items:center;gap:2px;padding:3px;min-width:0;flex-wrap:wrap}
      .myz-sector-manager .sm-shop-heading [data-shop-toggle]{padding:3px;min-width:20px}
      .myz-sector-manager .sm-shop-name{min-width:60px;width:60px;flex:1;font-weight:bold!important;border:1px solid transparent;background:transparent;color:inherit;padding:3px}
      .myz-sector-manager .sm-shop-name:focus{border-color:#777;background:#fff}
      .myz-sector-manager .sm-shop-group-actions{display:flex;gap:2px;align-items:center;margin-left:auto}
      .myz-sector-manager .sm-shop-group-actions select{min-width:0;max-width:110px}
      .myz-sector-manager .sm-shop-table{font:inherit;width:100%;table-layout:fixed;border-collapse:collapse;margin:0}
      .myz-sector-manager .sm-shop .sm-shop-table thead{color:#fff}
      .myz-sector-manager .sm-shop .sm-shop-table thead tr th{color:#fff!important}
      .myz-sector-manager .sm-shop-table th,.myz-sector-manager .sm-shop-table td{padding:5px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
      .myz-sector-manager .sm-shop-table [data-shop-requirement]{white-space:nowrap;text-overflow:ellipsis;overflow:hidden}
      .myz-sector-manager .sm-shop-table [data-shop-comment]{white-space:pre-wrap}
      .myz-sector-manager .sm-shop-table [data-shop-travel]{width:100%;min-width:0}
      .myz-sector-manager .sm-shop-accessible-head{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
      .myz-sector-manager .sm-shop-table .is-selected{outline:1px solid #a87b3c;outline-offset:-1px}
      .myz-sector-manager .sm-shop-empty{padding:8px;margin:0}
      .myz-sector-manager .sm-shop-toolbar{display:flex;gap:4px;align-items:center;flex:none;min-width:0;border-top:1px solid #777;padding-top:6px}
      .myz-sector-manager .sm-shop-toolbar label{display:flex;gap:3px;align-items:center;min-width:0;white-space:nowrap}
      .myz-sector-manager .sm-shop-toolbar label:first-child{flex:1.4}
      .myz-sector-manager .sm-shop-toolbar label:has([data-shop-move]){flex:1}
      .myz-sector-manager .sm-shop-toolbar select{width:100%;min-width:0;max-width:100%}
      @container (max-width:600px){.myz-sector-manager .sm-shop-table th{font-size:11px;padding:4px 3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.myz-sector-manager .sm-shop-toolbar{flex-wrap:wrap}.myz-sector-manager .sm-shop-toolbar label:first-child{flex-basis:calc(100% - 65px)}.myz-sector-manager .sm-shop-toolbar label:has([data-shop-move]){flex:1 1 140px;min-width:min(140px,100%)}}
      @container (max-width:440px){.myz-sector-manager .sm-shop-group-actions{flex-basis:100%;justify-content:flex-end}}
      .myz-sector-manager .sm-inhabitant-description{overflow-wrap:anywhere;max-height:300px;overflow:auto}
      .myz-sector-manager .sm-inhabitant-description:empty{display:none}
      .myz-sector-manager .sm-project-image img{max-width:100%;max-height:100px;object-fit:contain}
      .myz-sector-manager [data-project-view] dd{white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 8px}
      .myz-sector-manager [data-project-view] dt{font-weight:bold}
      .myz-sector-manager .sm-list button.sm-sector-special{border-left:4px solid #9563C9}
      .myz-sector-manager .sm-list [hidden]{display:none!important}
      .myz-sector-manager .sm-sidebar input{width:100%;box-sizing:border-box}
      .myz-sector-manager .sm-list{overflow-y:auto;overflow-x:hidden;flex:1;min-height:0;display:flex;flex-direction:column;gap:4px;scrollbar-gutter:stable}
      .myz-sector-manager .sm-list button{height:auto;min-height:0;flex:0 0 auto;line-height:1.4;overflow-wrap:anywhere;align-items:stretch;text-align:left;padding:8px;display:flex;flex-direction:column;gap:2px;white-space:normal}
      .myz-sector-manager .sm-sector-meta{display:block;line-height:1.4}.myz-sector-manager .sm-sector-meta small{display:block}
      .myz-sector-manager .sm-sector-meta strong{display:block;font-size:1.15em;font-weight:700}
      .myz-sector-manager .sm-list button.selected,.myz-sector-manager .sm-tabs button.active{outline:2px solid #a87b3c;outline-offset:-2px}
      .myz-sector-manager .sm-list small,.myz-sector-manager .sm-header small{opacity:.75}
      .myz-sector-manager .sm-main{display:flex;flex-direction:column;min-height:0;min-width:0;flex:1;container-type:inline-size}
      .myz-sector-manager .sm-header{display:flex;flex-shrink:0;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding:12px 15px;border-bottom:1px solid #777}
      .myz-sector-manager .sm-header h2{margin:0;overflow-wrap:anywhere}
      .myz-sector-manager .sm-settings{display:inline-flex}
      .myz-sector-manager .sm-settings-menu{position:fixed;inset:auto;margin:0;min-width:220px;max-width:min(360px,calc(100vw - 16px));max-height:calc(100dvh - 16px);overflow:auto;padding:8px;border:1px solid #888;border-radius:5px;background:var(--color-bg-option,#eee);color:var(--color-text-primary,#222);box-shadow:0 4px 16px #0006}
      .myz-sector-manager .sm-settings-menu .zm-actions{display:flex;flex-direction:column;gap:3px}
      .myz-sector-manager .sm-settings-menu button{display:block;width:100%;height:auto;text-align:left;white-space:normal;padding:6px}
      .myz-sector-manager .sm-log-recording{box-shadow:inset 0 -2px #ca9435}.myz-sector-manager .sm-log-recording span{color:#b77e1b}
      .myz-sector-manager .sm-header-buttons{display:flex;flex-wrap:wrap;gap:6px}
      .myz-sector-manager .sm-tabs{display:flex;flex-shrink:0;overflow-x:auto;gap:3px;padding:8px 12px;border-bottom:1px solid #777}
      .myz-sector-manager .sm-tabs button{flex:none;padding:7px;height:auto}
      .myz-sector-manager .sm-tabs .sm-tab-empty:not(.active){opacity:.65}
      .myz-sector-manager .sm-tabs .sm-tab-empty.active{border-style:dashed}
      .myz-sector-manager .sm-content{flex:1;min-height:0;min-width:0;overflow-y:auto;overflow-x:hidden;padding:15px;scrollbar-gutter:stable}
      .myz-sector-manager .sm-overview-grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,.8fr) minmax(0,1fr);gap:10px;align-items:start}
      .myz-sector-manager .sm-overview-grid [name=code]{width:6ch;max-width:100%}
      .myz-sector-manager .sm-overview-grid [name=terrain]{width:100%;min-width:0}
      .myz-sector-manager .sm-overview-grid select{width:auto;max-width:100%;min-width:0}
      .myz-sector-manager .sm-threat-stepper{display:flex;gap:3px;align-items:center}
      .myz-sector-manager .sm-threat-stepper input{width:6ch;min-width:0;text-align:center}
      .myz-sector-manager .sm-threat-stepper button{width:26px;flex:none;padding:0}
      .myz-sector-manager .sm-overview-section{border:1px solid #777;border-radius:4px;padding:8px;margin:8px 0}
      .myz-sector-manager .sm-overview-section summary{cursor:pointer;font-weight:bold}
      .myz-sector-manager .sm-overview-section textarea{width:100%;margin-top:6px}
      .myz-sector-manager .sm-stunt:has(input:disabled){opacity:.5;cursor:default}
      @container (max-width:560px){.myz-sector-manager .sm-overview-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @container (max-width:380px){.myz-sector-manager .sm-overview-grid{grid-template-columns:1fr}}
      .myz-sector-manager .sm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .myz-sector-manager .sm-field{display:flex;flex-direction:column;gap:4px;margin-bottom:12px;min-width:0}
      .myz-sector-manager .sm-field span{font-weight:bold}
      .myz-sector-manager .sm-field input,.myz-sector-manager .sm-field textarea,.myz-sector-manager .sm-field select{width:100%;box-sizing:border-box}
      .myz-sector-manager .sm-field textarea{resize:vertical}
      .myz-sector-manager .sm-footer>span{min-width:0;overflow-wrap:anywhere}.myz-sector-manager .sm-footer>button{flex:none}
      .myz-sector-manager .sm-footer{flex-shrink:0;padding:10px 15px;display:flex;justify-content:space-between;gap:8px;align-items:center;border-top:1px solid #777}
      .myz-sector-manager .sm-entry.is-collected [data-entry-title]{text-decoration:line-through;opacity:.75}
      .myz-sector-manager .sm-loot-collected{display:flex;gap:6px;align-items:center}
      .myz-sector-manager .sm-loot-collected input{appearance:auto;flex:none;width:18px;height:18px;margin:0;accent-color:#3875b4}
      .myz-sector-manager .sm-entry{border:1px solid #777;border-radius:5px;margin:0 0 12px;min-width:0}
      .myz-sector-manager .sm-entry-toggle.sm-faction-toggle{flex:0 0 auto;width:auto;padding:4px}
      .myz-sector-manager .sm-entry-toggle.sm-faction-toggle [data-chevron]{margin-left:0}
      .myz-sector-manager .sm-faction-name{flex:1;min-width:0;font:inherit;font-weight:bold;background:transparent;border:1px solid transparent;color:inherit}
      .myz-sector-manager .sm-faction-gallery{display:flex;flex-wrap:wrap;align-items:start;gap:10px;padding:10px;border:1px dashed #888;min-height:120px}
      .myz-sector-manager .sm-faction-member{margin:0;width:110px;text-align:center;overflow-wrap:anywhere}
      .myz-sector-manager .sm-faction-member a{display:flex;flex-direction:column;align-items:center;gap:4px;white-space:normal;background:none;border:0}
      .myz-sector-manager .sm-faction-member img,.myz-sector-manager [data-member-image]{display:flex;align-items:center;justify-content:center;width:100px;height:100px;object-fit:contain;border:1px solid #888}
      .myz-sector-manager [data-member-image]:has(img){border:0}
      .myz-sector-manager .sm-faction-member button{width:auto;font-size:.85em}
      .myz-sector-manager .sm-faction-info{margin-top:14px;padding-top:10px;border-top:1px solid #888}
      .myz-sector-manager .sm-entry-head{display:flex;align-items:center;gap:8px;padding:8px;cursor:pointer}
      .myz-sector-manager .sm-entry-toggle{display:flex;justify-content:flex-start;align-items:center;gap:8px;flex:1;min-width:0;height:auto;text-align:left;white-space:normal;background:transparent;border:0;box-shadow:none;padding:4px}
      .myz-sector-manager .sm-entry-toggle strong{overflow-wrap:anywhere}
      .myz-sector-manager .sm-entry-head [data-remove]{width:30px;flex:none}
      .myz-sector-manager .sm-entry-body{padding:12px;border-top:1px solid #777}
      .myz-sector-manager .sm-entry-body[hidden]{display:none}
      .myz-sector-manager .sm-entry.is-collapsed .sm-entry-head{background:rgba(128,128,128,.12)}
      .myz-sector-manager .sm-entry-toggle:focus-visible,.myz-sector-manager .sm-reference a:focus-visible{outline:2px solid #a87b3c;outline-offset:2px}
      .myz-sector-manager .sm-section-header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px}
      .myz-sector-manager .sm-section-header p{margin:0}
      .myz-sector-manager .sm-entry-controls{display:flex;flex-wrap:wrap;gap:6px}
      .myz-sector-manager .sm-entry-controls button{width:auto;white-space:normal;height:auto}
      .myz-sector-manager .sm-reference{grid-column:1/-1;min-width:0;border:1px dashed #888;padding:8px;margin-bottom:12px}
      .myz-sector-manager .sm-reference-label{display:block;margin-bottom:6px;font-weight:bold}
      .myz-sector-manager [data-reference-state="inaccessible"],.myz-sector-manager [data-reference-state="invalid"]{border-inline-start:3px solid #ac6b20;padding-inline-start:5px}
      .myz-sector-manager [data-drop-state="valid"]{outline:2px solid #34834c;outline-offset:-2px}.myz-sector-manager [data-drop-state="invalid"],.myz-sector-manager [data-drop-state="failed"]{outline:2px dashed #b45228;outline-offset:-2px}.myz-sector-manager [data-drop-state="candidate"],.myz-sector-manager [data-drop-state="pending"]{outline:2px dotted #9563c9;outline-offset:-2px}.myz-sector-manager [data-drop-state="completed"]{outline:1px solid #34834c;outline-offset:-1px}
      .myz-sector-manager .sm-reference-row{display:flex;align-items:center;gap:6px}
      .myz-sector-manager [data-reference-link]{flex:1;min-width:0;overflow-wrap:anywhere}
      .myz-sector-manager .sm-reference .content-link{white-space:normal;overflow-wrap:anywhere}
      .myz-sector-manager .sm-reference [data-reference-clear]{width:28px;flex:none}
      .myz-sector-manager .sm-reference .sm-reference-missing{opacity:.75;font-style:italic}
      .myz-sector-manager .sm-consumables-header{display:flex;gap:6px;align-items:center;width:100%;text-align:left;font-weight:bold;background:none;border:0;margin:0;padding:0 0 6px;height:auto}
      .myz-sector-manager .sm-consumable-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}
      .myz-sector-manager .sm-consumables .sm-supplies tbody tr.is-available{background:rgba(168,123,60,.2);box-shadow:inset 3px 0 #a87b3c}
      @container (max-width:580px){.myz-sector-manager .sm-consumable-columns{grid-template-columns:1fr;gap:8px}}
      .myz-sector-manager .sm-consumables{box-sizing:border-box;width:100%;border:1px solid #777;border-radius:5px;padding:10px;margin-bottom:12px}
      .myz-sector-manager .sm-consumables h3{margin:0 0 8px}
      .myz-sector-manager .sm-consumables p{font-size:.85em;margin:8px 0 0}
      .myz-sector-manager .sm-supplies{width:100%;table-layout:auto;margin:0}
      .myz-sector-manager .sm-supplies th,.myz-sector-manager .sm-supplies td{padding:4px;text-align:left}
      .myz-sector-manager .sm-supplies th{font-size:.9em}
      .myz-sector-manager .sm-supplies input[type=number]{width:38px;min-width:35px;text-align:center;box-sizing:border-box;padding:2px;appearance:textfield;-moz-appearance:textfield}
      .myz-sector-manager .sm-supplies td:last-child,.myz-sector-manager .sm-supplies th:last-child{text-align:center}
      .myz-sector-manager .sm-supplies input[type=number]::-webkit-inner-spin-button,.myz-sector-manager .sm-supplies input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
      .myz-sector-manager .sm-supplies tbody tr:nth-child(even){background:rgba(128,128,128,.08)}
      .myz-sector-manager .sm-supplies input[type=checkbox]{appearance:auto;-webkit-appearance:checkbox;width:18px;height:18px;min-width:18px;margin:0;vertical-align:middle;opacity:1;accent-color:#3875b4;outline:1px solid #808080;outline-offset:1px;filter:none}
      .theme-dark .myz-sector-manager .sm-supplies input[type=checkbox],.myz-sector-manager.theme-dark .sm-supplies input[type=checkbox]{color-scheme:dark;accent-color:#7bbdff;outline-color:#ddd}
      .theme-light .myz-sector-manager .sm-supplies input[type=checkbox],.myz-sector-manager.theme-light .sm-supplies input[type=checkbox]{color-scheme:light;outline-color:#555}
      .myz-sector-manager .sm-supplies input[type=checkbox]:focus-visible{outline:2px solid #d49a3d;outline-offset:2px}
      .myz-sector-manager .sm-supplies input[type=checkbox]::before,.myz-sector-manager .sm-supplies input[type=checkbox]::after{content:none!important}
      .myz-sector-manager .sm-name-control{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
      .myz-sector-manager .sm-name-control input{flex:1;min-width:90px}
      .myz-sector-manager .sm-name-control button{flex:0 0 auto;width:auto;font-size:.85em;padding:2px 6px}
      .myz-sector-manager .sm-stunt-columns,.myz-sector-manager .sm-modifier-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
      .myz-sector-manager .sm-travel input[type=number]{width:70px;min-width:0}
      @container (max-width:580px){.myz-sector-manager .sm-stunt-columns,.myz-sector-manager .sm-modifier-columns{grid-template-columns:1fr}}
      .myz-sector-manager .sm-stunt{display:flex;align-items:flex-start;gap:10px;margin:10px 0;cursor:pointer}
      .myz-sector-manager .sm-stunt input{flex:none;appearance:auto;width:18px;height:18px;margin:2px;accent-color:var(--color-text-hyperlink,#3875b4)}
      .myz-sector-manager .sm-stunt small{display:block;opacity:.85}

      .myz-sector-manager .sm-content.sm-drop-hover{outline:2px dashed #9563c9;outline-offset:-5px;background:rgba(149,99,201,.08)}
      .myz-sector-manager textarea[data-autosize]{min-height:calc(7 * 1.4em + 16px);line-height:1.4;overflow-y:hidden;resize:none}
      .myz-sector-manager .sm-image-preview{min-width:0;max-width:100%;padding:8px;overflow-wrap:anywhere}
      .myz-sector-manager .sm-image-preview img{display:block;width:auto;max-width:100%;height:auto;margin:0 auto}
      .myz-sector-manager [data-overlay-image-pick]{display:block;max-width:100%;height:auto;white-space:normal}
      .myz-sector-manager .sm-overlay-image-control{width:50%;max-width:100%;box-sizing:border-box}
      @container (max-width:560px){.myz-sector-manager .sm-overlay-image-control{width:100%}}
      .myz-sector-manager [data-overlay-preview] img{max-height:100px;max-width:100%;object-fit:contain}
      .myz-sector-manager [data-image-metadata]{padding:10px}
      .myz-sector-manager .sm-image-heading{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:8px;overflow-wrap:anywhere}

      .myz-sector-manager .sm-entry-toggle [data-entry-title]{flex:1;min-width:0;text-align:left;overflow-wrap:anywhere}
      .myz-sector-manager .sm-entry-toggle [data-chevron],.myz-sector-manager .sm-entry-toggle [data-image-chevron]{margin-left:auto;flex:none}
      .myz-sector-manager .sm-collection-action,.myz-sector-manager .sm-entry-remove{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:28px}
      .myz-sector-manager .sm-inhabitant-avatar{display:flex;align-items:center;justify-content:center;flex:0 0 36px;width:36px;height:36px;overflow:hidden;border:1px solid #888;border-radius:4px;background:rgba(128,128,128,.12)}
      .myz-sector-manager .sm-inhabitant-avatar img{display:block;width:36px;height:36px;object-fit:contain}
      .myz-sector-manager [data-image-body][hidden]{display:none!important}
      .myz-sector-manager .sm-image-heading h3{margin:0;min-width:0}
      .myz-sector-manager .sm-inhabitant-portrait-editor{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0;min-width:0}
      .myz-sector-manager .sm-inhabitant-portrait-editor .sm-field{flex:1 1 240px;min-width:0}.myz-sector-manager .sm-inhabitant-portrait-editor button{width:auto;height:auto;flex:none}
      .myz-sector-manager .sm-inhabitant-portrait-preview{width:144px;height:144px;max-width:100%;display:flex;align-items:center;justify-content:center;border:1px solid #888;border-radius:4px;overflow:hidden;flex:0 0 144px}
      .myz-sector-manager .sm-inhabitant-portrait-preview img{width:100%;height:100%;object-fit:contain}.myz-sector-manager .sm-inhabitant-portrait-editor small{flex-basis:100%;overflow-wrap:anywhere}

      @container (max-width:440px){.myz-sector-manager .sm-grid{grid-template-columns:1fr}}
      @container (max-width:750px){.myz-sector-manager .sm-sidebar{width:160px}}
    </style><div class="sm-shell">${menu}${main}</div>`;
  }

  overlayImageControl(){
    return `<section class="sm-field sm-overlay-image-control"><span>Overlay Image</span><button type="button" data-overlay-image-pick aria-label="Choose Overlay Image"><span class="sm-image-preview" data-overlay-preview>Choose an image</span></button><button type="button" data-overlay-image-clear>Clear Overlay Image</button><small>Choose a file using Foundry's FilePicker. Save Sector to keep the selection.</small></section>`;
  }
  showImage(target,src,alt,missing){return imagePreview(target,src,alt,missing,{env:globalThis,current:()=>currentReferenceNode(this,target)});}
  refreshOverlayImage(){
    const target=this.element?.querySelector('[data-overlay-preview]');if(!target)return;
    this.showImage(target,imagePath(this.data.special?.overlayImage),'Overlay Image',this.data.special?.overlayImage?'Overlay image is missing or unavailable.':'Choose an image');
    this.element.querySelector('[data-overlay-image-clear]').disabled=!this.data.special?.overlayImage;
  }
  async pickOverlayImage(){
    try{
      if(!game.user.isGM||!isSpecial(this.data))return;
      const draft=this.draft,id=this.sectorId;
      await pickImage({path:draft.special.overlayImage,current:()=>this.draft===draft&&this.sectorId===id&&this.rendered!==false&&isSpecial(draft),onSelect:selected=>{this.capture();draft.special.overlayImage=selected;this.markDirty();this.refreshOverlayImage();zone.overlay?.setDraft?.(id,draft);}},globalThis);
    }catch(error){ui.notifications.error(`Unable to choose overlay image: ${error.message}`);}
  }
  imagesEntries(){
    const state=this.entryState('special.images'),entries=this.data.special.images;
    return `<h3 data-collection-heading>Images</h3><div class="sm-section-header"><p>Browse image-type Journal pages. Drop a page on the blank area to add and save it.</p>${collectionActions({key:'special.images',count:Math.max(2,entries.length)})}</div>`+entries.map((item,i)=>{
      const id=state.entries[i].id,prefix=`special.images.${i}`,collapsed=state.previewCollapsed.has(id);
      return entryCard({id,collection:'special.images',collapsed,image:true,title:item.title||`Image ${i+1}`,removeLabel:`Remove ${item.title||'image'}`,body:`<div class="sm-image-preview" data-image-preview role="status">Loading image page…</div><details data-image-metadata="${id}" ${state.collapsed.has(id)?'':'open'}><summary>Edit image details</summary>${field('Name',`${prefix}.title`,item.title)}${reference('special.images',i,item.uuid)}${area('Optional Notes',`${prefix}.details`,item.details)}</details>`});
    }).join('')+(!entries.length?collectionEmpty('special.images'):'');
  }
  setImageCollapsed(id,collapsed,metadata=false){
    const state=this.entryState('special.images');if(!state.entries.some(entry=>entry.id===id))return;
    if(collapsed)state.previewCollapsed.add(id);else state.previewCollapsed.delete(id);
    const card=this.element.querySelector(`[data-entry="${id}"]`);if(!card)return;
    updateEntryCollapse(card,collapsed,{image:true,document});this.scrollKeeper.settle();
    if(metadata){if(collapsed)state.collapsed.add(id);else state.collapsed.delete(id);card.querySelector('[data-image-metadata]').open=!collapsed;}
  }
  renderInhabitantAvatar(zone,doc){this.portraits.reference(zone,doc);}
  renderJournalImage(zone,doc,message){
    const input=zone.querySelector('input');if(!input.name?.startsWith('special.images.'))return;
    const target=zone.closest('[data-entry]')?.querySelector('[data-image-preview]');
    this.showImage(target,journalImageSource(doc),doc?.name||'Journal page image',message||'An Image-type Journal page with an available image source is required.');
  }
  sizeSituation(){
    const area=this.element?.querySelector('[data-autosize]');if(!area)return;
    area.style.height='auto';area.style.height=`${area.scrollHeight+area.offsetHeight-area.clientHeight}px`;
  }
  bindSpecialDrops(el){
    const key=COLLECTIONS[this.tab];if(!isSpecial(this.data)||!['special.gear','special.images'].includes(key))return;
    const content=el.querySelector('.sm-content'),expected=REFERENCES[key];
    const blank=event=>!event.target.closest('[data-entry],input,textarea,select,button,a');
    content.addEventListener('dragover',event=>{
      if(!blank(event))return;
      let payload;try{payload=foundry.applications.ux.TextEditor.implementation.getDragEventData(event);}catch{}
      if(payload?.type&&payload.type!==expected)return;
      if(payload?.uuid||Array.from(event.dataTransfer?.types||[]).includes('text/plain')){event.preventDefault();event.dataTransfer.dropEffect='copy';content.classList.add('sm-drop-hover');}
    });
    content.addEventListener('dragleave',event=>{if(!content.contains(event.relatedTarget))content.classList.remove('sm-drop-hover');});
    content.addEventListener('drop',event=>{content.classList.remove('sm-drop-hover');if(!blank(event))return;event.preventDefault();event.stopPropagation();void this.dropSpecialEntry(event,key);});
  }
  async dropSpecialEntry(event,key){
    if(key==='special.inhabitants')return dropInhabitant(this,event,key,globalThis);
    this.handledDrops??=new WeakSet();if(this.handledDrops.has(event))return;this.handledDrops.add(event);
    if(!game.user.isGM||!isSpecial(this.data)||!['special.inhabitants','special.gear','special.images'].includes(key))return;
    if(this.droppingEntry)return;
    const journal=this.journal,saved=journal?.getFlag(MOD,KEY);
    if(!journal?.id||journal.isTemporary||saved?.initialSavePending||!isSpecial(saved)){ui.notifications.warn('Save this Special sector before dropping documents to create entries.');return;}
    this.droppingEntry=true;const finish=beginDrop(this,dropTarget(event,this));
    try{
      this.capture();const draft=this.draft,id=this.sectorId,signature=JSON.stringify(draft),wasDirty=this.dirty,baseline=this.specialContext?.journal===journal?this.specialContext.baselines[key]:JSON.stringify(sectorCollection(saved,key));
      const payload=parseDocumentDrop(event,globalThis);
      if(!payload.uuid)throw new Error('Drop a Foundry document with a UUID.');
      const expected=REFERENCES[key],doc=await requireDocument(payload.uuid,expected,globalThis);
      if(doc?.documentName!==expected)throw new Error(`This tab requires ${expected==='JournalEntryPage'?'an Image-type Journal page':`an ${expected}`} document.`);
      const src=key==='special.images'?journalImageSource(doc):null;
      if(key==='special.images'&&!src)throw new Error('An Image-type Journal page with an available image source is required.');
      if(this.referenceClosed||this.draft!==draft||this.sectorId!==id||this.rendered===false||JSON.stringify(draft)!==signature)throw new Error('Sector selection or edits changed. Nothing was added; drop again.');
      const item={title:doc.name,referenceTitle:doc.name,uuid:doc.uuid,details:''};
      if(key==='special.gear')Object.assign(item,{type:itemLootType(doc)||'scrap',typeSource:'reference',quantity:1});
      if(src)item.imageSrc=src;
      sectorCollection(draft,key).push(item);this.entryState(key);this.markDirty();
      const after=JSON.stringify(draft);await this.persistSpecialCollection(key,journal,baseline);
      if(this.draft===draft&&this.sectorId===id){if(JSON.stringify(draft)===after)this.dirty=wasDirty;await this.render();}
      finish('completed');
    }catch(error){finish('failed');ui.notifications.warn(`Could not add entry: ${error.message}`);}
    finally{this.droppingEntry=false;}
  }
  persistSpecialCollection(key,journal,baseline){
    const entries=foundry.utils.deepClone(sectorCollection(this.draft,key));
    const write=(this.autosaveWrite||Promise.resolve()).catch(()=>{}).then(async()=>{
      const stored=foundry.utils.deepClone(journal.getFlag(MOD,KEY));
      if(!game.user.isGM||!isSpecial(stored)||stored.initialSavePending)throw new Error('Save this Special sector before adding entries.');
      if(JSON.stringify(sectorCollection(stored,key))!==baseline)throw new Error('Saved entries changed. Review the latest sector before retrying.');
      stored.special[key.split('.')[1]]=entries;await journal.setFlag(MOD,KEY,stored);this.acknowledge(journal,stored,[key]);if(this.specialContext?.journal===journal)this.specialContext.baselines[key]=JSON.stringify(entries);
    });this.autosaveWrite=write;this.specialWrite=write;return this.trackSave(write,entryLabel(key)+' entries');
  }
  gearEntry(key,item,index,id,collapsed){
    const normal=key==='loot',prefix=`${key}.${index}`;
    const extra=normal?`<label class="sm-loot-collected" title="Collected saves this sector’s Gear &amp; Artifacts entries automatically; other sector fields still use Save Sector."><input type="checkbox" name="${prefix}.collected" ${lootCollected(item)?'checked':''}> Collected</label>${item.status&&item.status!=='Active'?`<small title="Previous status retained for compatibility; the checkbox now controls availability.">Previous status: ${escapeHTML(item.status)}</small>`:''}`:'';
    const warning=item.referenceWarning?`<p class="sm-reference-missing" data-reference-warning role="status">${escapeHTML(item.referenceWarning)}</p>`:'';
    return gearEntry({id,key,item,index,collapsed,prefix,quantity:normal?normalizeLoot(item).quantity:specialQuantity(item.quantity),minimum:normal?0:1,step:normal?'any':1,reference:reference(key,index,item.uuid||''),extra,warning,classes:normal&&lootCollected(item)?'is-collected':''},{field,area});
  }
  specialEntries(key){
    const entries=sectorCollection(this.data,key),state=this.entryState(key),gear=key==='special.gear';
    const label=gear?'Item':key==='special.inhabitants'?'Inhabitant':'Event';
    return `<h3 data-collection-heading>${escapeHTML(tabLabel(this.tab))}</h3><div class="sm-section-header"><p>Manually authored ${escapeHTML(tabLabel(this.tab).toLowerCase())}; no RollTables are rolled.</p>${collectionActions({key,count:entries.length})}</div>`+entries.map((item,i)=>{
      const id=state.entries[i].id,collapsed=state.collapsed.has(id),prefix=`${key}.${i}`,avatar=key==='special.inhabitants'?avatarMarkup():'';
      if(gear)return this.gearEntry(key,item,i,id,collapsed);
      if(key==='special.events')return eventEntry({id,key,item,index:i,collapsed,prefix,metadata:reference(key,i,item.uuid)}, {field,area});
      return entryCard({id,collection:key,collapsed,title:item.title||`${label} ${i+1}`,headerContent:avatar,removeLabel:`Remove ${item.title||label}`,body:`<div class="sm-grid">${field('Name',`${prefix}.title`,item.title)}${reference(key,i,item.uuid)}</div>${area('Description / Notes',`${prefix}.details`,item.details)}<div class="sm-inhabitant-description" data-inhabitant-preview></div>${portraitFields(`${prefix}.portrait`,item.portrait)}`});
    }).join('')+(!entries.length?collectionEmpty(key):'');
  }
  async changeSectorType(){
    if(!game.user.isGM||!this.journal||this.changingType||this.randomizing||this.addingEntry||this.droppingProject||this.droppingInhabitant||this.droppingShop)return;
    this.changingType=true;
    try{
      this.capture();const draft=this.draft,id=this.sectorId,signature=JSON.stringify(draft);
      const destination=await foundry.applications.api.DialogV2.wait({window:{title:'Choose Sector Type'},position:{width:420},content:select('Sector Type','destinationType',draft.sectorType,['normal','special','settlement']),buttons:[{action:'cancel',label:'Cancel',default:true,callback:()=>null},{action:'choose',label:'Continue',callback:(event,button,dialog)=>dialog.element.querySelector('[name="destinationType"]').value}],close:()=>null,rejectClose:false});
      if(!destination||destination===draft.sectorType)return;
      const confirmed=await foundry.applications.api.DialogV2.confirm({window:{title:'Change Sector Type'},content:`<p>Convert to <strong>${destination==='settlement'?'Settlement':destination==='special'?'Special':'Normal'} Zone Sector</strong>?</p><p>The visible tabs will change. Existing content is preserved: inactive content is hidden, not deleted. Converting back restores previous content. Shared fields and inactive type-specific records remain unchanged.</p><p>Use Save Sector to persist the conversion.</p>`});
      if(!confirmed)return;
      if(this.sectorId!==id||this.draft!==draft||JSON.stringify(draft)!==signature||this.rendered===false)throw new Error('Sector selection or edits changed during conversion. Nothing was converted.');
      if(destination==='settlement'){const sceneId=draft.sceneId||zone.store.config?.sceneId;if(!sceneId)throw new Error('Configure a Zone Scene before converting to Settlement.');const settlement=normalizeSettlement(draft.settlement);draft.settlement=settlement;draft.sceneId=sceneId;}draft.sectorType=destination;if(!sectorTabs(draft).includes(this.tab))this.tab='Overview';this.markDirty();await this.render();
    }finally{this.changingType=false;}
  }
  referenceEntry(zone){
    const name=zone.querySelector('input').name||'',parts=name.split('.');
    const key=this.collectionKey(),card=zone.closest?.('[data-entry]');if(card?.dataset?.entry&&key&&(inhabitantCollection(this.data,this.tab)===key||key==='settlement.projects')&&name.startsWith(key+'.')){const record=this.entryState(key).entries.find(record=>record.id===card.dataset.entry);if(record)return record.item;}
    if(parts[0]==='settlement')return parts.slice(0,-1).reduce((value,key)=>value?.[key],this.draft);
    if(parts[0]==='encounters')return this.draft?.encounters?.[parts[1]];
    if(parts[0]==='special'&&parts.length===4)return this.draft?.special?.[parts[1]]?.[parts[2]];
    return parts[0]==='loot'?this.draft?.loot?.[parts[1]]:null;
  }
  assignSpecialTitle(zone,document,assigned){
    const name=zone.querySelector('input').name||'';if(!assigned||!name.startsWith('special.'))return;
    const entry=this.referenceEntry(zone);if(!entry)return;
    if(!entry.titleOverride&&(!entry.title||entry.title===entry.referenceTitle)){
      entry.title=document.name;entry.referenceTitle=document.name;
      const control=zone.closest('[data-entry]')?.querySelector('[name$=".title"]');if(control)control.value=entry.title;
    }
    this.refreshSpecialCards();
  }
  refreshSpecialCards(){
    const key=this.collectionKey();if(!key?.startsWith('special.'))return;
    for(const {id,item} of this.entryState(key).entries){const title=this.element.querySelector(`[data-entry="${id}"] [data-entry-title]`);if(title)title.textContent=key==='special.gear'?lootTitle(item,this.element.querySelector(`[data-entry="${id}"]`)?.dataset?.contentTitleFallback||'Untitled Entry'):item.title||this.element.querySelector(`[data-entry="${id}"]`)?.dataset?.contentTitleFallback||'Untitled Entry';}
  }
  async _onRender(context,options){await super._onRender(context,options);positionMainMinimize(this);const el=this.element;
    this.sceneScope=zone.store.config?.sceneId;
    el.style.setProperty('--sm-settlement-accent',settlementAccent(game.settings.get(MOD,'settlementAccent')));
    el.querySelector('[data-reset-all-triggers]')?.addEventListener('click',()=>this.resetMacroTriggers());
    el.querySelectorAll('[data-reset-trigger]').forEach(button=>button.addEventListener('click',()=>this.resetMacroTriggers(button.dataset.resetTrigger)));
    bindSettingsMenu(this,zone,{onImport:()=>importSector(this,zone),onExport:()=>exportSector(this)});
    this.refreshZoneSummary();zone.overlay?.setDraft?.(this.sectorId,this.draft);this.bindSpecialDrops(el);bindInhabitantDrops(this);if(isSettlement(this.data))bindSettlement(this);this.sizeSituation();
    el.querySelector('[data-overlay-image-pick]')?.addEventListener('click',()=>this.pickOverlayImage());
    el.querySelector('[data-overlay-image-clear]')?.addEventListener('click',()=>{this.draft.special.overlayImage='';this.markDirty();this.refreshOverlayImage();zone.overlay?.setDraft?.(this.sectorId,this.draft);});
    this.refreshOverlayImage();this.situationResize?.disconnect();if(globalThis.ResizeObserver){let width=0;this.situationResize=new ResizeObserver(entries=>{const next=entries[0]?.contentRect.width;if(next!==width){width=next;this.sizeSituation();}});this.situationResize.observe(el);}
    el.querySelectorAll('[data-image-metadata]').forEach(details=>details.addEventListener('toggle',()=>{const state=this.entryState('special.images');if(details.open)state.collapsed.delete(details.dataset.imageMetadata);else state.collapsed.add(details.dataset.imageMetadata);}));
    el.querySelector('[data-consumables-toggle]')?.addEventListener('click',()=>{const state=this.consumablesState();state.collapsed=!state.collapsed;this.refreshConsumables();});
    bindReferenceUpdates(this,globalThis);bindDropFeedback(this,globalThis);
    el.querySelectorAll('[data-reference]').forEach(zone=>{
      zone.addEventListener('dragover',event=>{event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';});
      const referenceInput=zone.querySelector('input');zone.assignedUuid=referenceInput.value;referenceInput.addEventListener('change',()=>{zone.dropAssignment=(zone.dropAssignment||0)+1;const changed=referenceInput.value!==zone.assignedUuid;this.capture();this.markDirty();void this.renderReference(zone,{detectType:changed});});
      zone.addEventListener('drop',event=>this.dropReference(event,zone));
      zone.querySelector('[data-reference-attach]')?.addEventListener('click',async()=>{const draft=this.draft,button=zone.querySelector('[data-reference-attach]');try{const uuid=await promptReference(referenceInput.value,zone.dataset.type,globalThis);if(uuid&&this.draft===draft&&currentReferenceNode(this,zone)&&zone.isConnected)await this.dropReference({preventDefault(){},stopPropagation(){}},zone,{uuid});}catch{ui.notifications.error('Reference attachment could not be completed.');}finally{if(button.isConnected)button.focus({preventScroll:true});}});
      zone.querySelector('[data-reference-clear]').addEventListener('click',()=>this.clearReference(zone));
    });
    // Delay pointer selection briefly so rerender cannot destroy the double-click target.
    el.querySelectorAll('[data-open]').forEach(b=>{
      b.addEventListener('click',event=>{clearTimeout(this.sidebarClick);if(event.detail===0){void this.navigate(b.dataset.open);return;}this.sidebarClick=setTimeout(()=>{void this.navigate(b.dataset.open);},300);});
      b.addEventListener('dblclick',event=>{event.preventDefault();clearTimeout(this.sidebarClick);void this.centerSidebarSector(b.dataset.open);});
    });
    el.querySelectorAll('[name^="pathStunts."],[name="travel.stalker"],[name="travel.rushed"]').forEach(input=>input.addEventListener('change',()=>{this.syncTimeStunt(input);this.capture();this.refreshStuntControls();this.refreshTravelTimes();void this.persistStunts().catch(error=>{this.markDirty();ui.notifications.error(`Could not save stunts: ${error.message}. Use Save Sector to retry.`);});}));
    el.querySelectorAll('[name^="loot."][name$=".collected"]').forEach(input=>input.addEventListener('change',()=>{this.capture();this.refreshLootCards();const card=input.closest('[data-entry]');this.setCollapsed('loot',card.dataset.entry,input.checked);void this.persistLoot().catch(error=>{this.markDirty();ui.notifications.error(`Could not save Gear & Artifacts: ${error.message}. Use Save Sector to retry.`);});}));
    el.querySelectorAll('[data-overview-section]').forEach(section=>section.addEventListener('toggle',()=>{this.overviewState()[section.dataset.overviewSection]=!section.open;this.sizeSituation();}));
    el.querySelectorAll('[data-threat-step]').forEach(button=>button.addEventListener('click',()=>{const input=el.querySelector('[name="threatLevel"]');input.value=normalizeThreatLevel(Number(input.value)+Number(button.dataset.threatStep),sectorThreatLevel(this.data));input.dispatchEvent(new Event('input',{bubbles:true}));}));
    el.querySelector('[name="threatLevel"]')?.addEventListener('change',event=>{event.target.value=this.draft.threatLevel;});
    el.querySelector('[name="rot"]')?.addEventListener('change',event=>{
      const hint=el.querySelector('[data-rot-exposure]');if(hint)hint.textContent=ROT_LEVELS.find(entry=>String(entry.level)===event.target.value)?.exposure||'Existing value retained.';
    });
    el.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{clearTimeout(this.sidebarClick);this.capture();this.tab=b.dataset.tab;this.render();}));
    el.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>this.action(b.dataset.action,b.dataset.collection)));
    el.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',event=>{event.stopPropagation();const [key,id]=b.dataset.remove.split(':');void this.removeEntry(key,id).catch(error=>ui.notifications.error(`Remove entry: ${error.message}`));}));
    this.portraits.bind(el);
    bindEntryCollapse(el,(id,image)=>{const key=this.collectionKey();if(image)this.setImageCollapsed(id,!this.entryState(key).previewCollapsed.has(id));else this.setCollapsed(key,id,!this.entryState(key).collapsed.has(id));});
    el.querySelector('[data-expand-all]')?.addEventListener('click',()=>this.collapseAll(false));
    el.querySelector('[data-collapse-all]')?.addEventListener('click',()=>this.collapseAll(true));
    el.querySelector('[data-filter]')?.addEventListener('input',e=>{this.filter=e.target.value;el.querySelectorAll('[data-open]').forEach(b=>{b.hidden=!b.dataset.search.includes(this.filter.toLowerCase());});const empty=el.querySelector('[data-sector-empty]');if(empty)empty.hidden=Array.from(el.querySelectorAll('[data-open]')).some(b=>!b.hidden);});
    el.querySelector('[name="settlement.arkUuid"]')?.addEventListener('change',()=>{this.capture();void this.render();});
    el.querySelectorAll('.sm-content input,.sm-content select,.sm-content textarea').forEach(e=>e.addEventListener('input',()=>{
      if(!e.name?.startsWith('pathStunts.')&&!LINKED_STUNTS[e.name])this.markDirty();
      if(e.name==='pathStunts.safePath'&&!e.checked){for(const input of el.querySelectorAll('[name^="pathStunts."],[name="travel.stalker"],[name="travel.rushed"]'))if(input!==e)input.checked=false;}
      this.syncTimeStunt(e);
      if(e.matches('[data-sector-name]')){this.draft.customName=e.value;this.draft.nameOverride=Boolean(e.value.trim());}
      if(e.name==='travel.open'&&e.checked){this.draft.travel.difficult=false;el.querySelector('[name="travel.difficult"]').checked=false;}
      if(e.name==='travel.difficult'&&e.checked){this.draft.travel.open=false;el.querySelector('[name="travel.open"]').checked=false;}
      if(/^(loot|special\.gear)\.\d+\.type$/.test(e.name)){const parts=e.name.split('.'),entry=parts[0]==='loot'?this.draft.loot[parts[1]]:this.draft.special.gear[parts[2]];entry.typeSource='manual';this.lootTypeRevisions.set(entry,(this.lootTypeRevisions.get(entry)||0)+1);}
      if(/^special\.(inhabitants|gear|events|images)\.\d+\.title$/.test(e.name)){const parts=e.name.split('.');this.draft.special[parts[1]][parts[2]].titleOverride=Boolean(e.value.trim());}
      this.capture();if(e.name?.endsWith('.title')||e.name?.startsWith('settlement.projects.')&&e.name.endsWith('.status'))sortEditorEntries(this);if(e.name==='special.situation')this.sizeSituation();if(e.name?.startsWith('settlement.')&&e.name.endsWith('.title')){const title=e.closest('[data-entry]')?.querySelector('[data-entry-title]');if(title&&!e.closest('[data-inventory-id]'))title.textContent=e.value||'Untitled Entry';}if(['terrain','code','status','rot'].includes(e.name))zone.overlay?.setDraft?.(this.sectorId,this.draft);if(e.name?.startsWith('pathStunts.')||LINKED_STUNTS[e.name])this.refreshStuntControls();if(e.name==='settlement.arkUuid'){void hydrateArk(this);void this.renderReference(e.closest('[data-reference]'));}if(e.name==='threatLevel')el.querySelector('[data-threat-descriptor]').textContent=threatDescriptor(this.draft.threatLevel);if(e.name?.startsWith('loot.'))this.refreshLootCards();if(e.name?.startsWith('special.'))this.refreshSpecialCards();if(e.name?.startsWith('travel.')||e.name?.startsWith('pathStunts.'))this.refreshTravelTimes();
      if(e.name?.startsWith('supplies.'))this.refreshConsumables();this.refreshTabIndicators();this.refreshSectorIcons();if(e.matches('[data-sector-name]')||['code','terrain'].includes(e.name)){this.refreshSectorLabels();this.refreshZoneSummary();}
      if(e.name?.endsWith('.title')&&!e.name.startsWith('loot.')&&!e.name.startsWith('special.gear.')&&!e.name.includes('.inventory.')){const title=e.closest('[data-entry]')?.querySelector('[data-entry-title]');if(title)title.textContent=e.value||e.closest('[data-entry]')?.dataset.contentTitleFallback||'Untitled Entry';}
    }));
  }
  overviewState(){
    let state=OVERVIEW_UI.get(this.sectorId);if(!state){state={mood:!meaningfulText(this.data.mood),description:!meaningfulText(this.data.description)};OVERVIEW_UI.set(this.sectorId,state);}return state;
  }
  overviewSection(label,key,value){return `<details class="sm-overview-section" data-overview-section="${key}" ${this.overviewState()[key]?'':'open'}><summary>${label}</summary><textarea name="${key}" aria-label="${label}" rows="${key==='special.situation'?7:key==='special.overview'?12:5}" ${key==='special.situation'?'data-autosize':''}>${escapeHTML(value||'')}</textarea></details>`;}
  refreshStuntControls(){
    const active=Boolean(this.draft.pathStunts?.safePath);
    for(const input of this.element.querySelectorAll('[name^="pathStunts."],[name="travel.stalker"],[name="travel.rushed"]')){
      if(input.name==='pathStunts.safePath')continue;input.disabled=!active;if(!active)input.checked=false;
    }
  }
  syncTimeStunt(input){
    const peer=LINKED_STUNTS[input.name]||Object.keys(LINKED_STUNTS).find(key=>LINKED_STUNTS[key]===input.name);
    if(peer){const control=this.element.querySelector(`[name="${peer}"]`);if(control)control.checked=input.checked;}
  }
  refreshTravelTimes(){
    this.draft.travel=sectorTravelOptions(this.draft);
    const times=travelTimes(this.draft.travel);
    const explore=this.element.querySelector('[data-explore-time]'),pass=this.element.querySelector('[data-pass-time]');
    if(explore)explore.textContent=formatDuration(times.explore);if(pass)pass.textContent=formatDuration(times.pass);
  }
  consumablesState(){
    const outstanding=outstandingSupplies(this.data);let state=CONSUMABLE_UI.get(this.sectorId);
    if(!state){state={outstanding,collapsed:!outstanding};CONSUMABLE_UI.set(this.sectorId,state);}
    else if(state.outstanding!==outstanding){state.outstanding=outstanding;state.collapsed=!outstanding;}
    return state;
  }
  refreshConsumables(){
    const state=this.consumablesState(),button=this.element.querySelector('[data-consumables-toggle]'),body=this.element.querySelector('#sm-consumables-body');
    if(!button||!body)return;
    button.setAttribute('aria-expanded',String(!state.collapsed));button.querySelector('[data-consumables-chevron]').textContent=state.collapsed?'▶':'▼';if(state.collapsed&&body.contains(document.activeElement))button.focus();body.hidden=state.collapsed;
    for(const row of this.element.querySelectorAll('[data-supply]')){const value=this.data.supplies?.[row.dataset.supply];row.classList.toggle('is-available',Number(value?.quantity)>0&&!value?.collected);}
  }
  refreshSectorLabels(){
    const label=sectorTitle(this.data),button=this.element.querySelector(`[data-open="${this.sectorId}"]`);
    if(button){button.querySelector('[data-sector-label]').textContent=label;button.dataset.search=`${label} ${this.journal.name}`.toLowerCase();button.hidden=!button.dataset.search.includes(this.filter.toLowerCase());}
    const heading=this.element.querySelector('[data-sector-heading]');if(heading)heading.textContent=label;
    const field=this.element.querySelector('[data-sector-name]');if(field&&field!==document.activeElement)field.value=sectorName(this.data);
  }
  refreshSectorIcons(){
    const info=sectorIndicators(this.data);
    for(const slot of this.element.querySelectorAll('[data-icon-slot]')){const item=info[slot.dataset.iconSlot];slot.innerHTML=iconMarkup(item.icon,item.title);}
  }
  refreshTabIndicators(){
    for(const button of this.element.querySelectorAll('[data-tab]'))button.classList.toggle('sm-tab-empty',!tabHasContent(this.data,button.dataset.tab));
  }
  capture(){if(!this.journal)return;const collection=this.collectionKey(),useIds=inhabitantCollection(this.data,this.tab)===collection||['settlement.projects','settlement.factions'].includes(collection),records=new Map(useIds&&collection?this.entryState(collection).entries.map(record=>[record.id,record.item]):[]);const fields=this.element.querySelectorAll('.sm-content [name]');for(const f of fields){if(f.disabled)continue;if(f.type==='radio'&&!f.checked)continue;let parts=f.name.split('.');let target=this.draft;const card=f.closest?.('[data-entry]'),item=records.get(card?.dataset?.entry);if(item&&collection&&f.name.startsWith(collection+'.')){target=item;parts=parts.slice(collection.split('.').length+1);}for(let i=0;i<parts.length-1;i++){target[parts[i]] ??= {};target=target[parts[i]];}let v=f.type==='checkbox'?f.checked:f.value;if(f.name.startsWith('supplies.')&&f.type==='number'){const n=Number(f.value);v=Number.isFinite(n)?Math.max(0,n):0;}if(/^special\.gear\.\d+\.quantity$/.test(f.name))v=specialQuantity(v);if(/^loot\.\d+\.quantity$/.test(f.name)){const quantity=Number(v);v=lootQuantity(v);}if(f.name==='threatLevel')v=normalizeThreatLevel(v,sectorThreatLevel(this.draft));if(f.name==='rot')v=ROT_LEVELS.some(entry=>String(entry.level)===String(v))?Number(v):this.draft.rot;if(f.name==='travel.difficulty')v=travelOptions({difficulty:v}).difficulty;target[parts.at(-1)]=v;}this.draft.pathStunts=normalizePathStunts(this.draft.pathStunts);this.draft.travel=sectorTravelOptions(this.draft);for(const key of [...Object.values(COLLECTIONS),'special.locations'])this.entryState(key);}
  refreshZoneSummary(){
    refreshSettingsMenu(this,zone);
    const container=this.element?.querySelector('.sm-zone-summary');
    if(!container)return;
    container.innerHTML=zone.summary(this.journal&&sectorOnScene(this.data,zone.store.config?.sceneId)?this.data:null);zone.bindSummary(container);
  }
  async promptNewSector(code='',valid=()=>true){
    if(this.creatingSector)return;
    this.creatingSector=true;
    try{
      const value=await foundry.applications.api.DialogV2.wait({window:{title:'Create New Sector'},position:{width:420},content:`<fieldset><legend>Sector Type</legend><label><input type="radio" name="newSectorType" value="normal" checked> Normal Zone Sector</label><p>Standard Zone exploration sector with locations, encounters, loot, effects, and random generation.</p><label><input type="radio" name="newSectorType" value="special"> Special Zone Sector</label><p>Detailed story-driven sector with its own situation, inhabitants, gear, artifacts, and events.</p><label><input type="radio" name="newSectorType" value="settlement"> Settlement</label><p>Inhabited community with projects, inhabitants, factions, events, threads, and shops.</p></fieldset><label>Coordinates<input name="newSectorCode" value="${attr(code)}" placeholder="A1"></label><p>Create a GM-only sector with the usual default values.</p>`,buttons:[{action:'cancel',label:'Cancel',default:true,callback:()=>null},{action:'create',label:'Create Sector',callback:(event,button,dialog)=>({code:dialog.element.querySelector('[name="newSectorCode"]').value,sectorType:dialog.element.querySelector('[name="newSectorType"]:checked').value})}],close:()=>null,rejectClose:false});
      if(value===null||value===undefined||!valid())return;
      const input=String(typeof value==='object'?value.code:value).trim();
      const canonical=input?canonicalCoordinate(input):'';
      if(input&&!canonical)throw new Error('Enter coordinates such as A1 or AA10.');
      await this.newSector(canonical,valid,typeof value==='object'?value.sectorType:'normal');
    }finally{this.creatingSector=false;}
  }
  async newSector(code='',valid=()=>true,sectorType='normal'){
    if(!game.user.isGM||!valid())return;
    const existing=code?zone.store.sectorRecords(code):[];
    if(existing.length){await this.navigate(existing[0].id);if(this.sectorId===existing[0].id){this.tab='Overview';await this.render();}return;}
    if(!await this.confirmLose()||!valid())return;
    if(sectorType==='settlement'&&(!code||!zone.store.config?.sceneId||!zone.store.scene))throw new Error('Choose a Zone Scene in Zone Settings and enter sector coordinates before creating a Settlement.');
    const sceneId=zone.store.config?.sceneId;
    const data=DEFAULT();data.sectorType=['normal','special','settlement'].includes(sectorType)?sectorType:'normal';if(isSettlement(data)){data.settlement=normalizeSettlement();data.sceneId=sceneId;}data.code=code;data.initialSavePending=true;
    const folders=await ensureJournalFolders();
    if(!valid()||(isSettlement(data)&&zone.store.config?.sceneId!==sceneId))return;
    const duplicate=code?zone.store.sectorRecords(code):[];if(duplicate.length){await this.navigate(duplicate[0].id);if(this.sectorId===duplicate[0].id){this.tab='Overview';await this.render();}return;}
    const journal=await JournalEntry.create({name:sectorName(data),folder:folders.sectors.id,ownership:{default:0},pages:[{name:'Sector Record',type:'text',text:{content:'<p>Sector record managed by MYZ Sector Manager. Use the Sector Manager to edit structured fields.</p>'}}],flags:{[MOD]:{[KEY]:data}}});
    this.sectorId=journal.id;this.draft=this.loadDraft(data,journal);zone.setSelection(code);this.tab='Overview';this.dirty=false;this.filter='';await this.render();
  }
  refreshSaveStatus(){const status=this.element?.querySelector('.sm-footer span');if(status)status.textContent=saveStatus(this);const button=this.element?.querySelector('[data-action="save"]');if(button)button.disabled=Boolean(this.busy);}
  markDirty(){this.dirty=true;this.editRevision=(this.editRevision||0)+1;this.refreshSaveStatus();}
  trackSave(write,label){this.saveNote=`Saving ${label} only…`;this.refreshSaveStatus();return write.then(value=>{this.saveNote=`${label} saved automatically; other edits use Save Sector`;this.refreshSaveStatus();return value;},error=>{this.saveNote=`${label} save failed; draft retained`;this.refreshSaveStatus();throw error;});}
  acknowledge(journal,stored,paths){acknowledgePaths(this.saveBaseline,journal,stored,paths,foundry.utils.deepClone);}
  confirmEntryRemoval(options){return confirmEntryRemoval(this,options,globalThis);}

  async resetMacroTriggers(triggerId=null){
    if(triggerId==='')return;
    const journal=this.journal;
    try{
      const confirmed=await foundry.applications.api.DialogV2.confirm({window:{title:triggerId?'Reset Macro trigger?':'Reset all sector Macros?'},content:'Allow these triggers to fire again for all expedition tokens? References and Effects data are retained.'});
      if(!confirmed)return;
      if(this.journal!==journal)throw new Error('Sector selection changed; try the reset again.');
      this.capture();await zone.triggers.reset(journal,triggerId);if(this.journal===journal)await this.render();
    }catch(error){ui.notifications.error(`Could not reset Macro triggers: ${error.message}`);}
  }
  macroControl(item,i){
    const history=this.journal?.getFlag?.(MOD,'entryTriggers')||{};
    const outcomes=(history.records||[]).filter(record=>record.triggerId===item.triggerId);
    const summary=outcomes.map(record=>`${record.tokenUuid}: ${record.status}${record.error?' — '+record.error:''}`).join('; ')||'Not fired';
    return `<fieldset><legend>Sector-entry Macro (optional)</legend>${reference('effectMacro',i,item.macroUuid||'',`effects.${i}.macroUuid`).replace('Reference','Macro Reference')}<label><input type="checkbox" name="effects.${i}.macroRunOnce" ${macroRunOnce(item)?'checked':''}> Run Once (First Entry Only)</label><label><input type="checkbox" name="effects.${i}.macroDisabled" ${item.macroDisabled?'checked':''}> Disable automatic trigger</label><small>Unchecked Run Once: run on every entry. Switching back uses existing history; reset to allow another first entry.</small><p>${escapeHTML(summary)}</p><button type="button" data-reset-trigger="${attr(item.triggerId||'')}" ${item.triggerId?'':'disabled'}>Reset this trigger</button></fieldset>`;
  }
  collectionKey(){if(isSettlement(this.data))return SETTLEMENT_COLLECTIONS[this.tab];return this.tab==='Locations'&&isSpecial(this.data)?'special.locations':COLLECTIONS[this.tab];}
  entryState(key){
    let sector=ENTRY_UI.get(this.sectorId);
    if(!sector){sector=new Map();ENTRY_UI.set(this.sectorId,sector);}
    let state=sector.get(key);
    if(!state){state={entries:[],collapsed:new Set(),previewCollapsed:new Set()};sector.set(key,state);}
    const available=new Set(state.entries);
    const entries=sectorCollection(this.data,key).map(item=>{
      const snapshot=JSON.stringify(item);
      // Identity survives edits/reorders in the current draft. Content matching
      // reconnects cloned Journal data on reopen, without persisting UI fields.
      const old=Array.from(available).find(entry=>entry.item===item)
        ||Array.from(available).find(entry=>item.id&&entry.item.id===item.id)
        ||Array.from(available).find(entry=>entry.snapshot===snapshot);
      if(old)available.delete(old);
      const record={id:old?.id||`sm-entry-${++entrySequence}`,item,snapshot};if(!old&&key.startsWith('special.'))state.collapsed.add(record.id);if(!old&&key==='loot'&&(lootCollected(item)||item.generated?.method==='core'))state.collapsed.add(record.id);return record;
    });
    for(const removed of available){state.collapsed.delete(removed.id);state.previewCollapsed.delete(removed.id);}
    state.entries=entries;
    return state;
  }

  setCollapsed(key,id,collapsed){
    const state=this.entryState(key);
    if(!state.entries.some(entry=>entry.id===id))return;
    if(collapsed)state.collapsed.add(id);else state.collapsed.delete(id);
    const card=this.element.querySelector(`[data-entry="${id}"]`);
    if(!card)return;
    // State stays in ENTRY_UI; the shared controller updates existing DOM only.
    updateEntryCollapse(card,collapsed,{document});this.scrollKeeper.settle();
  }

  collapseAll(collapsed){
    const key=this.collectionKey();
    if(!key)return;
    for(const {id} of this.entryState(key).entries){if(key==='special.images')this.setImageCollapsed(id,collapsed,true);else this.setCollapsed(key,id,collapsed);}
  }

  async removeEntry(key,id){
    if(!game.user.isGM)return;
    this.capture();
    const state=this.entryState(key), entry=state.entries.find(record=>record.id===id);
    if(!entry)return;
    if(key==='settlement.projects'&&entry.item.arkSource)return;
    const card=this.element.querySelector(`[data-entry="${id}"]`),focusRemoved=card?.contains(document.activeElement),cards=Array.from(this.element.querySelectorAll('.sm-content [data-entry]')),position=cards.indexOf(card),neighbor=(cards[position+1]||cards[position-1])?.dataset.entry;
    const draft=this.draft,name=entry.item.title||entry.item.referenceName||`Untitled ${entryLabel(key)}`;if(!await this.confirmEntryRemoval({kind:entryLabel(key),name,valid:()=>this.draft===draft&&this.entryState(key).entries.some(record=>record.id===id&&record.item===entry.item)&&(entry.item.title||entry.item.referenceName||`Untitled ${entryLabel(key)}`)===name}))return;
    const index=sectorCollection(this.draft,key).indexOf(entry.item);
    if(index<0)return;
    sectorCollection(this.draft,key).splice(index,1);
    this.entryState(key); // Also forget the removed entry's collapsed state.
    this.markDirty();
    await this.render();
    if(focusRemoved){const target=neighbor?Array.from(this.element.querySelectorAll('[data-entry]')).find(node=>node.dataset.entry===neighbor)?.querySelector('[data-entry-toggle],[data-image-toggle]'):this.element.querySelector('[data-action="add"]');target?.focus({preventScroll:true});}
  }

  resetSpecialBaseline(data,journal){
    this.specialContext={journal,baselines:Object.fromEntries(['special.inhabitants','special.gear','special.images'].map(key=>[key,JSON.stringify(sectorCollection(data,key))]))};
  }
  loadDraft(data,journal=this.journal){
    this.saveBaseline={journal,record:foundry.utils.deepClone(data)};this.saveNote='';
    this.resetSpecialBaseline(data,journal);
    this.lootContext={journal,baseline:JSON.stringify(data.loot||[])};
    const draft=normalize(data,journal?.name);
    for(const key of isSettlement(draft)?[]:[isSpecial(draft)?'special.inhabitants':'encounters']){const seen=new Set();for(const item of sectorCollection(draft,key)){if(!item.id||seen.has(item.id))item.id=foundry.utils.randomID();seen.add(item.id);}}
    return draft;
  }
  refreshLootCards(){
    if(this.tab!=='Loot')return;
    const entries=this.entryState('loot').entries;
    for(const [index,record] of entries.entries()){
      const card=this.element.querySelector(`[data-entry="${record.id}"]`);if(!card)continue;
      card.querySelector('[data-entry-title]').textContent=lootTitle(record.item,`Item ${index+1}`);
      card.classList.toggle('is-collected',lootCollected(record.item));
    }
  }
  assignLootType(zone,document,force=false){
    const input=zone.querySelector('input'),name=input.name||'',entry=this.referenceEntry(zone);if(name.endsWith('.macroUuid'))return;const special=name.startsWith('special.gear.');
    if(name.startsWith('settlement.')||name.startsWith('special.')&&!special)return;if(!entry||(!force&&entry.typeSource!=='legacy'))return;
    const type=itemLootType(document)||(special?'scrap':null);if(!type)return;
    entry.type=type;entry.typeSource='reference';
    const card=zone.closest?.('[data-entry]');const control=card?.querySelector(`[name="${name.replace(/uuid$/,'type')}"]`);if(control)control.value=type;
    const title=card?.querySelector('[data-entry-title]');if(title)title.textContent=lootTitle(entry,special?'Untitled Entry':`Entry ${Number(name.split('.')[1])+1}`);
  }
  persistReferenceCollection(key,journal,baseline,property){
    const entries=foundry.utils.deepClone(sectorCollection(this.draft,key)),type=this.draft.sectorType||'normal';
    const write=(this.autosaveWrite||Promise.resolve()).catch(()=>{}).then(async()=>{
      const stored=foundry.utils.deepClone(journal.getFlag(MOD,KEY));
      if(!game.user.isGM||stored?.version!==1||stored.initialSavePending||(stored.sectorType||'normal')!==type)throw new Error('Saved sector type changed. Reopen before adding references.');
      const current=key==='settlement.shop'?(stored.settlement?.shop??null):sectorCollection(stored,key);
      if(JSON.stringify(current)!==baseline)throw new Error('Saved entries changed. Review the latest sector before retrying.');
      const parts=key.split('.');let target=stored;for(const part of parts.slice(0,-1)){target[part]??={};target=target[part];}target[parts.at(-1)]=entries;
      await journal.setFlag(MOD,KEY,stored);this.acknowledge(journal,stored,[key]);
      if(this.specialContext?.journal===journal&&key.startsWith('special.'))this.specialContext.baselines[key]=JSON.stringify(entries);
    });this.autosaveWrite=write;this[property]=write;return this.trackSave(write,key==='settlement.shop'?'Shop collection':'Inhabitants');
  }
  persistInhabitants(key,journal,baseline){return this.persistReferenceCollection(key,journal,baseline,'inhabitantWrite');}
  persistShop(journal,baseline){return this.persistReferenceCollection('settlement.shop',journal,baseline,'shopWrite');}
  persistLoot(){
    const journal=this.journal,loot=foundry.utils.deepClone(this.draft.loot);
    if(!this.lootContext||this.lootContext.journal!==journal)this.lootContext={journal,baseline:JSON.stringify(journal.getFlag(MOD,KEY).loot||[])};
    const context=this.lootContext;
    const write=(this.autosaveWrite||Promise.resolve()).catch(()=>{}).then(async()=>{
      if(!game.user.isGM)throw new Error('GM access required');
      const stored=foundry.utils.deepClone(journal.getFlag(MOD,KEY));
      if(JSON.stringify(stored.loot||[])!==context.baseline)throw new Error('Saved Gear & Artifacts changed; review the latest sector before retrying.');
      stored.loot=loot;await journal.setFlag(MOD,KEY,stored);this.acknowledge(journal,stored,['loot']);context.baseline=JSON.stringify(loot);
    });
    this.autosaveWrite=write;this.lootWrite=write;return this.trackSave(write,'Gear & Artifacts entries');
  }
  async renderReference(zone,{detectType=false}={}){
    const input=zone.querySelector('input'),target=zone.querySelector('[data-reference-link]'),uuid=input.value,draft=this.draft,entry=this.referenceEntry(zone),revision=entry?this.lootTypeRevisions.get(entry)||0:0;
    zone.assignedUuid=uuid;const request=zone.referenceRequest=(zone.referenceRequest||0)+1;
    const current=()=>zone.referenceRequest===request&&input.value===uuid&&this.draft===draft&&currentReferenceNode(this,zone);
    zone.querySelector('[data-reference-clear]').disabled=!uuid;
    zone.dataset.referenceState=uuid?'resolving':'empty';referenceState(target,uuid?'resolving':'empty');this.renderInhabitantAvatar(zone,null);
    if(input.name?.startsWith('special.images.'))this.renderJournalImage(zone,null,'Assign an Image-type Journal page.');
    if(!uuid)return;
    const result=await resolveDocument(uuid,zone.dataset.type,globalThis);if(!current())return;if(result.state==='valid')try{this.validateDropPreview(zone,result.doc);}catch{result.state='invalid';result.doc=null;}
    zone.referenceUnavailable=result.state!=='valid';zone.dataset.referenceState=result.state;
    referenceState(target,result.state,{uuid,types:zone.dataset.type});
    if(result.state!=='valid'){this.portraits.unavailable(uuid);this.renderInhabitantAvatar(zone,null);this.renderJournalImage(zone,null,'Journal page is missing or unavailable.');return;}
    const doc=result.doc;this.renderJournalImage(zone,doc);this.renderInhabitantAvatar(zone,doc);
    if(detectType&&(!entry||(this.lootTypeRevisions.get(entry)||0)===revision))this.assignLootType(zone,doc,true);this.assignSpecialTitle(zone,doc,detectType);
    target.replaceChildren(documentLink(doc,{env:globalThis,current,onOpen:event=>this.openReference(zone,event)}));
  }

  clearReferenceWarning(zone){
    const [key,index]=zone.querySelector('input').name?.split('.')||[];
    if(key==='locations'&&this.draft?.locations?.[index])delete this.draft.locations[index].referenceWarning;
    zone.closest?.('.sm-entry-body')?.querySelector('[data-reference-warning]')?.remove();
  }
  clearReference(zone){
    zone.dropAssignment=(zone.dropAssignment||0)+1;
    zone.querySelector('input').value='';
    this.capture();this.clearReferenceWarning(zone);this.markDirty();
    const rendering=this.renderReference(zone);if(zone.querySelector('input').name==='settlement.arkUuid')void this.render();
    if(isSettlement(this.data)&&zone.querySelector('input').name.startsWith('settlement.projects.')){const target=zone.closest('[data-entry]').querySelector('[data-project-view]');void renderProject(this,target,this.referenceEntry(zone));}
    return rendering;
  }

  validateDropPreview(node,doc){
    const name=node.matches?.('[data-reference]')?node.querySelector('input').name:'';
    if(name.startsWith('settlement.projects.')||!name&&this.tab==='Projects')requireProject(doc,game.system?.id||'mutant-year-zero');
    if(name==='settlement.arkUuid')requireArk(doc);
    if(name.startsWith('special.images.')||!name&&this.tab==='Images')if(!journalImageSource(doc))throw new Error('An Image-type Journal page is required.');
    if(this.tab==='Shop'&&doc.documentName==='Actor'&&doc.type!=='vehicle')throw new Error('Vehicle Actor required.');
  }
  async dropReference(event,zone,payloadOverride){
    event.preventDefault();event.stopPropagation();
    if(!game.user.isGM)return;
    const finish=beginDrop(this,zone);
    const draft=this.draft,input=zone.querySelector('input'),originalUuid=input.value,assignment=zone.dropAssignment=(zone.dropAssignment||0)+1,entry=this.referenceEntry(zone),revision=entry?this.lootTypeRevisions.get(entry)||0:0;
    try{
      const payload=payloadOverride||parseDocumentDrop(event,globalThis);
      if(!payload.uuid){finish('failed');ui.notifications.warn('Drop a document from Foundry.');return;}
      const doc=await requireDocument(payload.uuid,zone.dataset.type,globalThis);
      if(this.referenceClosed||this.draft!==draft||zone.dropAssignment!==assignment||input.value!==originalUuid||!this.element.contains(zone))return;
      if(!doc)throw new Error('Reference could not be found.');
      if(zone.dataset.type && !zone.dataset.type.split('|').includes(doc.documentName)){ui.notifications.warn(`This entry expects a ${zone.dataset.type.replaceAll('|',' or ').replaceAll('JournalEntryPage','Journal Entry Page').replaceAll('JournalEntry','Journal Entry')}.`);return;}
      if(input.name?.startsWith('settlement.projects.'))requireProject(doc,game.system?.id||'mutant-year-zero');
      if(input.name==='settlement.arkUuid')requireArk(doc);
      if(input.name?.startsWith('special.images.')&&!journalImageSource(doc))throw new Error('An Image-type Journal page with an available image source is required.');
      if(inhabitantCollection(this.data,this.tab)&&doc.documentName==='Actor'&&!await linkInhabitant(this,zone,doc,globalThis,()=>zone.dropAssignment===assignment&&input.value===originalUuid&&!this.referenceClosed)){finish('completed');return;}
      const changed=zone.querySelector('input').value!==doc.uuid;
      if(input.name?.startsWith('settlement.projects.')&&entry)Object.assign(entry,assignProject(entry,doc,game.system?.id));zone.querySelector('input').value=doc.uuid;
      this.capture();if(input.name?.endsWith('.macroUuid')){const effect=this.draft.effects[Number(input.name.split('.')[1])];effect.triggerId||=foundry.utils.randomID();}if(!entry||(this.lootTypeRevisions.get(entry)||0)===revision)this.assignLootType(zone,doc,changed);this.assignSpecialTitle(zone,doc,changed);this.clearReferenceWarning(zone);this.markDirty();
      await this.renderReference(zone);if(input.name==='settlement.arkUuid')await this.render();
      if(input.name?.startsWith('settlement.projects.')){const target=zone.closest('[data-entry]').querySelector('[data-project-view]');await renderProject(this,target,entry);const title=zone.closest('[data-entry]').querySelector('[data-entry-title]');title.textContent=entry.referenceName;}
    finish('completed');
    }catch(err){finish('failed');ui.notifications.error(`Unable to attach reference: ${err.message}`);}
  }

  async refreshReferenceSections(doc,name){
    try{if(!this.rendered||this.referenceClosed)return;
      if(this.tab==='Factions'&&this.data.settlement?.factions.some(f=>f.members.some(m=>m.uuid===doc.uuid)))await hydrateFactions(this,this.element,globalThis);
      if(this.tab==='Shop'&&this.data.settlement?.shop.groups.some(g=>g.entries.some(e=>e.uuid===doc.uuid)))await hydrateShop(this,this.element);
      if(this.tab==='Projects'&&name==='deleteItem')for(const target of this.element.querySelectorAll('[data-project-view]')){const entry=this.data.settlement.projects[Number(target.dataset.projectView)];if(entry.uuid===doc.uuid)await renderProject(this,target,entry);}
    }catch{ui.notifications.error('Reference display could not be refreshed. Reopen to retry.');}
  }
  async openReference(zone,event){
    if(!game.user.isGM)return;
    try{const uuid=zone.querySelector('input').value.trim();if(!uuid)return;const doc=await requireDocument(uuid,zone.dataset?.type||'',globalThis);if(zone.querySelector('input').value.trim()===uuid&&currentReferenceNode(this,zone))await openDocument(doc,event,globalThis);}catch{ui.notifications.error('Unable to open reference: document could not be found or is inaccessible/invalid.');}
  }
  async randomizeSector(){
    if(!game.user.isGM||isAuthored(this.data)||this.changingType||this.randomizing)return;
    if(!this.canRandomize){ui.notifications.warn('Save this sector before randomizing.');return;}
    this.randomizing=true;
    try{
      await Promise.all([this.stuntWrite,this.lootWrite]);this.capture();
      const journal=this.journal,expected=foundry.utils.deepClone(journal.getFlag(MOD,KEY)),base=foundry.utils.deepClone(this.draft),signature=JSON.stringify(base);
      const method=await foundry.applications.api.DialogV2.wait({...randomizeDialogOptions(),window:{title:'Randomize Sector'},content:randomizeDialogContent(`<p>Randomization replaces terrain, Rot, mood, and previous generated entries. Consumable quantities will be replaced; collected checkboxes are retained. Manual entries, notes, coordinates, and other fields are retained. Review the generated results before saving.</p><label>Randomization Method<select name="randomizationMethod">${RANDOMIZATION_METHODS.map(method=>`<option value="${method.id}">${escapeHTML(method.label)}</option>`).join('')}</select></label><label>Threat Generation<select name="threatGeneration"><option value="core" ${game.settings.get(MOD,'threatGenerationMode')!=='individual-d3'?'selected':''}>Core Rulebook (Default)</option><option value="individual-d3" ${game.settings.get(MOD,'threatGenerationMode')==='individual-d3'?'selected':''}>Multiple Threats (House Rule)</option></select></label><p>Core Rulebook: one threat if eligible 1s occur, with their count as severity. Multiple Threats: roll 1d3 independent threats after the same eligible 1s. Both use the original 6s for artifacts.</p>`),buttons:[{action:'cancel',label:'Cancel',default:true,callback:()=>null},{action:'randomize',label:'Randomize',callback:(event,button,dialog)=>({method:dialog.element.querySelector('[name="randomizationMethod"]').value,threatMode:dialog.element.querySelector('[name="threatGeneration"]').value})}],close:()=>null,rejectClose:false});
      if(!method)return;
      const selectedMethod=RANDOMIZATION_METHODS.find(entry=>entry.id===method.method);
      if(!selectedMethod)throw new Error('Unknown randomization method.');
      if(!['core','individual-d3'].includes(method.threatMode))throw new Error('Unknown threat generation mode.');
      await game.settings.set(MOD,'threatGenerationMode',method.threatMode);
      const next=await selectedMethod.generate(base,{options:{threatMode:method.threatMode,dangerousLevel:game.settings.get(MOD,'dangerousThreatLevel')??DEFAULT_GENERATION_OPTIONS.dangerousLevel}});
      const summary=['locations','encounters','effects','loot'].map(key=>`<h4>${escapeHTML(key)}</h4><ul>${next[key].filter(entry=>entry.generated?.method==='core').map(entry=>`<li>${escapeHTML(entry.title)}${entry.quantity!==undefined?` × ${entry.quantity}`:''}${entry.referenceWarning?` — ${escapeHTML(entry.referenceWarning)}`:''}</li>`).join('')||'<li>None generated</li>'}</ul>`).join('');
      const supplySummary=`<h4>Consumables (new quantities)</h4><ul>${Object.entries(SUPPLIES).map(([key,label])=>`<li>${escapeHTML(label)}: ${next.supplies[key].quantity}</li>`).join('')}</ul>`;
      if(!await foundry.applications.api.DialogV2.confirm({...randomizeDialogOptions(),window:{title:'Save Randomized Sector?'},content:randomizeDialogContent(`<p>Terrain: ${escapeHTML(next.terrain)} · Rot: ${next.rot}</p><p>Mood: ${escapeHTML(next.mood)}</p><h4>Description</h4><div style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHTML(next.description||'')}</div><p>Threat Level: ${next.threatLevel} (${escapeHTML(next.randomization.threatLevel)}) · ${escapeHTML(next.randomization.levelSelection)}</p><p>Environment eligibility — Ruin: ${escapeHTML(next.randomization.environment.ruins||'No')}; Threat: ${next.randomization.environment.threats?'Yes':'No'}; Artifact: ${next.randomization.environment.artifacts?'Yes':'No'}.</p><p>Base Dice: ${escapeHTML(next.randomization.baseDice.join(', ')||'None (level 0)')}. Threat severity (1s): ${next.randomization.threatSeverity}. Artifacts (eligible 6s): ${next.randomization.artifactCount}. Threat identities: ${next.randomization.threatCount} (${next.randomization.threatMode==='core'?'Core: one threat, severity from 1s':'House rule: 1d3 individual threats'}).</p>${supplySummary}${summary}<p>Replace this sector's generated information? Manual entries and notes are retained.</p>`)}))return;
      if(this.sectorId!==journal.id||this.rendered===false||JSON.stringify(this.draft)!==signature)throw new Error('Sector selection or edits changed during generation. Nothing was saved; try again.');
      await saveGeneratedSector(journal,expected,next);
      this.draft=this.loadDraft(journal.getFlag(MOD,KEY),journal);for(const key of ['locations','encounters','effects','loot']){const state=this.entryState(key);for(const entry of state.entries)if(entry.item.generated?.method==='core'&&(key!=='loot'||(!entry.item.resource&&entry.item.title!=='COMPONENTS')))state.collapsed.add(entry.id);}CONSUMABLE_UI.delete(this.sectorId);this.dirty=false;await this.render();ui.notifications.info('Sector randomized and saved.');
    }catch(error){ui.notifications.error(`Sector randomization: ${error.message}`);}
    finally{this.randomizing=false;}
  }
  async close(options={}){if(this.closing||this.navigating)return this;this.closing=true;try{if(!await this.confirmLose())return this;return await super.close(options);}finally{this.closing=false;}}
  async _onClose(options){this.referenceClosed=true;this.referenceRoot=null;unbindReferenceUpdates(this,globalThis);this.dropFeedbackCleanup?.();this.scrollKeeper.capture(this.element?.querySelector?.('.sm-root'));this.scrollKeeper.disconnect();this.portraits.stop();unbindEntryCollapse(this.element);clearTimeout(this.sidebarClick);await Promise.allSettled([this.stuntWrite,this.lootWrite,this.specialWrite,this.inhabitantWrite,this.shopWrite]);this.situationResize?.disconnect();zone.overlay?.clearDraft?.();return super._onClose(options);}
  persistStunts(){
    const journal=this.journal,states=normalizePathStunts(foundry.utils.deepClone(this.draft.pathStunts));
    const write=(this.autosaveWrite||Promise.resolve()).catch(()=>{}).then(async()=>{
      if(!game.user.isGM)throw new Error('GM access required');
      const stored=foundry.utils.deepClone(journal.getFlag(MOD,KEY));
      stored.pathStunts={...stored.pathStunts,...states};
      if(stored.travel)stored.travel=storedTravel(stored.travel);
      await journal.setFlag(MOD,KEY,stored);this.acknowledge(journal,stored,['pathStunts','travel']);
    });
    this.autosaveWrite=write;this.stuntWrite=write;return this.trackSave(write,'Find the Path');
  }
  async centerSidebarSector(id){
    try{await this.navigate(id);const record=game.journal.get(id)?.getFlag(MOD,KEY);if(this.sectorId===id&&record)await zone.centerSector(record.code);}
    catch(error){ui.notifications.error(`Zone Map: ${error.message}`);}
  }
  async confirmLose(){return unsavedChangesGuard(this,globalThis);}
  async navigate(id){if(this.navigating||this.closing)return;this.navigating=true;try{if(id===this.sectorId){zone.setSelection(this.data.code);return;}if(!await this.confirmLose())return;await Promise.allSettled([this.stuntWrite,this.lootWrite,this.specialWrite,this.inhabitantWrite,this.shopWrite]);this.sectorId=id;this.draft=this.loadDraft(this.journal.getFlag(MOD,KEY),this.journal);zone.setSelection(this.draft.code);this.tab='Overview';this.dirty=false;await this.render();}finally{this.navigating=false;}}
  async addContextEntry(key,{event=false}={}){
    if(isSettlement(this.data)){
      if(!game.user.isGM||!this.journal||this.addingEntry||(!Object.values(SETTLEMENT_COLLECTIONS).includes(key)||key==='settlement.shop.groups'))return;
      this.capture();sectorCollection(this.draft,key).push(newSettlementEntry(key.split('.')[1]));const state=this.entryState(key);state.collapsed.delete(state.entries.at(-1).id);this.markDirty();await this.render();return;
    }
    if(!key||(isSpecial(this.data)?key!=='history'&&!key.startsWith('special.'):key.startsWith('special.')))return;
    if(this.addingEntry||this.rendered===false||!game.user.isGM||!this.journal||(!Object.values(COLLECTIONS).includes(key)&&key!=='special.locations'))return;
    this.addingEntry=true;
    const buttons=Array.from(this.element?.querySelectorAll('[data-action="add"],[data-action="add-event"]')||[]);buttons.forEach(button=>button.disabled=true);
    try{
      this.capture();const draft=this.draft,sectorId=this.sectorId,signature=JSON.stringify(draft);
      const item=key.startsWith('special.')?(key==='special.gear'?normalizeSpecialGear({title:'',details:'',uuid:''}):{title:'',details:'',uuid:''}):await generateEntry(key,foundry.utils.deepClone(draft),{arkCoordinate:zone.store.config?.arkCoordinate,event});
      if(this.sectorId!==sectorId||this.draft!==draft||JSON.stringify(draft)!==signature||this.rendered===false)throw new Error('Sector selection or edits changed while generating. Nothing was added; try again.');
      if(['encounters','special.inhabitants'].includes(key))item.id??=foundry.utils.randomID();
      if(!key.startsWith('special.'))this.draft[key]??=[];sectorCollection(this.draft,key).push(item);const state=this.entryState(key),record=state.entries.at(-1);state.collapsed.add(record.id);
      this.markDirty();await this.render();
    }finally{this.addingEntry=false;buttons.forEach(button=>button.disabled=false);this.element?.querySelectorAll('[data-action="add"],[data-action="add-event"]').forEach(button=>button.disabled=false);}
  }
  saveSector(){
    if(this.busy)return Promise.resolve(false);
    this.busy=true;this.refreshSaveStatus();
    // Join the existing write queue. New collection saves wait for this write,
    // while this save waits only for the operations already queued before it.
    const pending={stunt:this.stuntWrite,loot:this.lootWrite,all:[this.autosaveWrite,this.projectWrite,this.specialWrite,this.inhabitantWrite,this.shopWrite]};
    const write=this.writeSector(pending);this.autosaveWrite=write;return write;
  }
  async writeSector(pending){
    try{
      if(!game.user.isGM)throw new Error('GM access required');
      await Promise.allSettled([...pending.all,pending.stunt,pending.loot]);
      this.capture();
      if(isSettlement(this.data)){
        if(!this.draft.nameOverride||!this.draft.customName?.trim())throw new Error('Enter a Settlement Name before saving.');
        if(!canonicalCoordinate(this.draft.code))throw new Error('Enter Settlement coordinates such as A1 or AA10 before saving.');
        if(this.draft.settlement.arkUuid){const linked=await fromUuid(this.draft.settlement.arkUuid);if(linked)requireArk(linked);}
        this.draft.settlement=normalizeSettlement(this.draft.settlement);
      }
      if(this.draft.code&&!canonicalCoordinate(this.draft.code))throw new Error('Enter coordinates such as A1 or AA10.');
      const j=this.journal;if(!j)throw new Error('Sector is no longer available.');
      if(this.saveBaseline?.journal===j&&!sameRecord(j.getFlag(MOD,KEY),this.saveBaseline.record))throw new Error('Saved sector changed in another session. Reopen and review it before saving; your draft is retained.');
      const revision=this.editRevision||0,name=sectorName(this.draft);
      delete this.draft.journalName;
      const stored=cleanThreatRecord(this.draft);stored.travel=storedTravel(stored.travel);
      if(stored.initialSavePending===true)stored.initialSavePending=false;
      await j.update({...(j.name===name?{}:{name}),[`flags.${MOD}.${KEY}`]:stored,...threatDeletion(j.getFlag(MOD,KEY))});
      if(this.stuntWrite===pending.stunt)this.stuntWrite=undefined;
      if(this.lootWrite===pending.loot)this.lootWrite=undefined;
      this.lootContext={journal:j,baseline:JSON.stringify(stored.loot||[])};this.resetSpecialBaseline(stored,j);
      if(this.draft.initialSavePending===true)this.draft.initialSavePending=false;
      this.saveBaseline={journal:j,record:foundry.utils.deepClone(j.getFlag(MOD,KEY))};
      this.dirty=(this.editRevision||0)!==revision;this.busy=false;
      this.saveNote=this.dirty?'Earlier edits saved; newer edits remain unsaved':'';
      zone.setSelection(this.draft.code);await this.render();return true;
    }finally{this.busy=false;this.refreshSaveStatus();}
  }
  async action(which,key){try{
    if(this.busy&&which!=='journal')return false;
    if(isSettlement(this.data)&&!game.user.isGM)return;
    if(which==='change-type'){await this.changeSectorType();return;}
    if(which==='reset-name'){this.draft.nameOverride=false;this.draft.customName='';this.markDirty();this.refreshSectorLabels();return;}
    if(which==='randomize'){await this.randomizeSector();return;}
    if(which==='reset-stunts'){
      const sectorId=this.sectorId;
      if(!await foundry.applications.api.DialogV2.confirm({window:{title:'Reset Stunts'},content:'Clear all Find the Path checkboxes for this sector?'}))return;
      if(this.sectorId!==sectorId)return;
      this.capture();for(const stunt of PATH_STUNTS)this.draft.pathStunts[stunt.id]=false;try{await this.persistStunts();}catch(error){this.markDirty();throw error;}await this.render();return;
    }
    if(which==='campaign-log'){await openCampaignLog(campaign);return;}
    if(which==='new'){await this.promptNewSector();return;}
    if(which==='add'||which==='add-event'){await this.addContextEntry(key,{event:which==='add-event'});return;}
    if(which==='save')return await this.saveSector();
    if(which==='journal'){this.journal?.sheet?.render(true);return;}
    if(which==='delete'){if(!await foundry.applications.api.DialogV2.confirm({window:{title:'Delete Sector'},content:`Permanently delete the Journal Entry for ${escapeHTML(this.journal.name)}? This cannot be undone.`}))return;await this.journal.delete();ENTRY_UI.delete(this.sectorId);CONSUMABLE_UI.delete(this.sectorId);OVERVIEW_UI.delete(this.sectorId);this.sectorId=null;this.draft=null;this.dirty=false;await this.render();return;}
  }catch(err){this.busy=false;if(which==='save'){this.saveNote=`Save failed: ${err.message}`;this.refreshSaveStatus();}console.error(`${MOD} |`,err);ui.notifications.error(`Sector Manager: ${err.message}`);return false;}}
}
let app;
const refreshArk=doc=>{if(app?.projectSyncDepth||!game.user.isGM||!app?.rendered||!isSettlement(app.data)||app.data.settlement.arkUuid!==(doc.documentName==='Actor'?doc.uuid:doc.parent?.uuid))return;app.capture();void app.render().catch(error=>ui.notifications.error(`Ark refresh: ${error.message}`));};
Hooks.on('userConnected',()=>{if(!app?.projectSyncDepth&&game.user.isGM&&app?.rendered&&isSettlement(app.data)&&app.tab==='Projects'){app.capture();void app.render();}});
for(const hook of ['updateActor','deleteActor','createItem','updateItem','deleteItem'])Hooks.on(hook,refreshArk);
// Refresh current Project names/statistics without replacing cards or losing unsaved progress.
Hooks.on('updateItem',doc=>{
  if(app?.projectSyncDepth||!game.user.isGM||!app?.rendered||!isSettlement(app.data)||app.tab!=='Projects')return;
  const targets=Array.from(app.element.querySelectorAll('[data-project-view]')).filter(target=>app.data.settlement.projects[Number(target.dataset.projectView)]?.uuid===doc.uuid);
  if(!targets.length)return;app.capture();
  void Promise.all(targets.map(async target=>{const entry=app.data.settlement.projects[Number(target.dataset.projectView)];const reference=target.closest('[data-entry]').querySelector('[data-reference]');if(reference)await app.renderReference(reference);await renderProject(app,target,entry);})).catch(error=>ui.notifications.error(`Project refresh: ${error.message}`));
});
const organization=new JournalOrganization();
const playerShops=new PlayerShopService();
const partySkills=new PartySkillService();
const zone=new ZoneRuntime({
  onDestination:context=>campaign.captureTravelEntry(context),
  onChange:()=>{if(app?.rendered){if(app.sceneScope!==zone.store.config?.sceneId){app.sceneScope=zone.store.config?.sceneId;app.capture();void app.render();}else app.refreshZoneSummary();}},
  openSector:async id=>{const manager=await game.myzSectorManager.open(id);if(manager?.sectorId===id){manager.capture();manager.tab='Overview';await manager.render();}},
  createSector:async(code,valid)=>{const manager=await game.myzSectorManager.open();if(manager)await manager.promptNewSector(code,valid);}
});
const campaign=new CampaignLogService(zone);
zone.travel.onTriggered=event=>campaign.recordTravelEvent(event);
const campaignRecording=()=>{try{return Boolean(activeSession(campaign.state));}catch{return false;}};
let campaignActive=false;
campaign.subscribe(kind=>{if(kind==='tick')return;const recording=campaignRecording();if(campaignActive===recording)return;campaignActive=recording;const button=app?.element?.querySelector('[data-action="campaign-log"]');if(button){const holder=document.createElement('span');holder.innerHTML=logButton(recording);button.className=holder.firstElementChild.className;button.title=holder.firstElementChild.title;button.setAttribute('aria-label',holder.firstElementChild.getAttribute('aria-label'));button.innerHTML=holder.firstElementChild.innerHTML;}});
Hooks.once('init',()=>{
  campaign.register();
  game.settings.register(MOD,'settlementAccent',{name:'Settlement map highlight color',hint:'Hex color for Settlement borders; Special and Normal sectors keep their existing styles.',scope:'world',config:true,type:String,default:SETTLEMENT_ACCENT,restricted:true,onChange:value=>{zone.overlay?.draw();app?.element?.style?.setProperty('--sm-settlement-accent',settlementAccent(value));}});
  zone.register();zone.ReferenceClass=registerDocumentReferences();
  game.settings.register(MOD,'threatGenerationMode',{name:'Sector generation: threat identities',hint:'Core uses one threat identity with severity equal to the number of Base Dice showing 1. The 1d3 option is a house rule and does not change the severity roll.',scope:'world',config:true,type:String,choices:{core:'Core Rulebook: one threat with severity','individual-d3':'House rule: 1d3 individual threats'},default:'core',restricted:true});
  game.settings.register(MOD,'dangerousThreatLevel',{name:'Sector generation: Unusually Dangerous level',hint:'Numeric Threat Level when the table returns the open-ended 9+ category. Default 9. Explicit numeric table results take precedence.',scope:'world',config:true,type:Number,default:9,restricted:true});
});
Hooks.once('ready',async()=>{
  const referencesReady=ensureReferenceMigration().catch(error=>{console.error(`${MOD} | Document References migration`,error);ui.notifications.error(`Document References migration: ${error.message}. Open Module Settings → Document References to review/retry.`);});
  playerShops.start();partySkills.start();
  const PlayerShop=createPlayerShopClass(foundry.applications.api.ApplicationV2,playerShops);
  game.myzSectorManager={
    openCampaignLog:()=>openCampaignLog(campaign),
    toggleCampaignSession:()=>campaign.toggle(),
    requestPartySkillRoll:()=>openPartySkillRequest(partySkills),
    openPendingPartySkillRolls:()=>partySkills.syncPlayer(),
    openPlayerShop:async journalUuid=>{try{const shop=new PlayerShop(journalUuid);await shop.refresh();return shop;}catch(error){ui.notifications.error(`Player Shop: ${error.message}`);throw error;}},
    zone:zone.api(),
    travel:{diagnostics:context=>zone.travel.inspect(context),weather:()=>game.user.isGM?zone.travel.state.weather:null,history:()=>game.user.isGM?zone.travel.state.history:[],configure:async()=>{if(game.user.isGM)return new zone.TravelClass().render(true);},roster:async()=>{if(game.user.isGM)return new zone.RosterClass().render(true);}},
    migrateJournals:()=>organization.run(),
    open:async(id=null)=>{
      if(!game.user.isGM){ui.notifications.warn('GM access only.');return;}
      await referencesReady;
      if(app?.rendered){if(id && id!==app.sectorId)await app.navigate(id);app.bringToFront();return app;}
      app=new SectorManager({sectorId:id});
      if(id && app.journal){app.draft=app.loadDraft(app.journal.getFlag(MOD,KEY),app.journal);zone.setSelection(app.draft.code);}
      await app.render(true);return app;
    },
    getSector:(journalId)=>{if(!game.user.isGM)return null;const j=game.journal.get(journalId);return j?.getFlag(MOD,KEY)??null;}
  };
  await referencesReady;organization.start();zone.start();campaign.start();
  const recovery=new MovementRecovery(globalThis,{suppressed:token=>zone.triggers.executing.has(token.uuid||`Scene.${token.parent?.id}.Token.${token.id}`)});recovery.start();
  console.info(`${MOD} | Ready. Run game.myzSectorManager.open() from a Script Macro.`);
});
