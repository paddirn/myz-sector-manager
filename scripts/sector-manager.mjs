import {saveGeneratedSector,RANDOMIZATION_METHODS,DEFAULT_GENERATION_OPTIONS} from './sector-randomizer.mjs';
import {tabHasContent,CONSUMABLES} from './sector-content.mjs';
import {ZoneRuntime} from './zone/runtime.mjs';
const MOD = 'myz-sector-manager';
const KEY = 'sector';
const TABS = ['Overview', 'Find the Path', 'Locations', 'Encounters', 'Loot', 'Effects', 'Secrets', 'History'];
const COLLECTIONS = {Locations:'locations', Encounters:'encounters', Loot:'loot', Effects:'effects', Secrets:'secrets', History:'history'};
const REFERENCES = {locations:'Scene', encounters:'Actor|JournalEntry', loot:'Item', effects:'Actor|JournalEntry'};
// Session-only UI identities: never written to Journal flags.
const ENTRY_UI = new Map();
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
const pathStunts = data => `<section class="sm-path"><p>Track benefits obtained during the current visit or exploration. Each stunt is available once per Find the Path roll (p. 56). The repeat-search guidance also limits each stunt to once per sector (p. 160). The GM controls resets; these checkboxes do not enforce either restriction. Checkboxes save automatically. Nothing resets automatically or awards resources, changes Rot, or alters travel time.</p>${['standard','talent'].map(group=>`<h3>${group==='standard'?'Standard Benefits and Stunts':'Talent Stunts'}</h3>${PATH_STUNTS.filter(stunt=>stunt.group===group).map(stunt=>`<label class="sm-stunt" title="${attr(stunt.description)}"><input type="checkbox" name="pathStunts.${stunt.id}" ${data.pathStunts?.[stunt.id]?'checked':''}><span>${escapeHTML(stunt.label)}${group==='talent'?` (${escapeHTML(stunt.source)})`:''}<small>${escapeHTML(stunt.description!==stunt.label?stunt.description:'')}</small></span></label>`).join('')}`).join('')}<button type="button" data-action="reset-stunts">Reset Stunts</button></section>`;
const environmentFields = data => `<label class="sm-field"><span>Terrain</span><input name="terrain" type="text" list="sm-terrain-options" value="${attr(data.terrain)}"><datalist id="sm-terrain-options">${TERRAIN_OPTIONS.map(value=>`<option value="${attr(value)}"></option>`).join('')}</datalist></label><label class="sm-field"><span>Rot Level</span><select name="rot">${ROT_LEVELS.some(entry=>String(entry.level)===String(data.rot))?'':`<option value="${attr(data.rot)}" selected>Existing value: ${escapeHTML(data.rot)}</option>`}${ROT_LEVELS.map(entry=>`<option value="${entry.level}" ${String(entry.level)===String(data.rot)?'selected':''}>${entry.level} — ${entry.label}: ${entry.exposure}</option>`).join('')}</select><small data-rot-exposure>${escapeHTML(ROT_LEVELS.find(entry=>String(entry.level)===String(data.rot))?.exposure||'Existing value retained; select a level to change it.')}</small></label>`;
const normalize = data => {const result=foundry.utils.deepClone(data); result.pathStunts ??= {}; for(const stunt of PATH_STUNTS) result.pathStunts[stunt.id] ??= false; result.supplies ??= {}; for(const key of Object.keys(SUPPLIES)) result.supplies[key] ??= {quantity:0,collected:false}; return result;};
const DEFAULT = () => ({version:1, pathStunts:{}, code:'', terrain:'', rot:0, status:'Unexplored', description:'', notes:'', locations:[], encounters:[], loot:[], effects:[], secrets:[], history:[], supplies:supplyDefaults()});
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const attr = escapeHTML;
const field = (label,name,value='',type='text') => `<label class="sm-field"><span>${escapeHTML(label)}</span><input name="${attr(name)}" type="${type}" value="${attr(value)}" ${type==='number'?'min="0" step="1"':''}></label>`;
const area = (label,name,value='') => `<label class="sm-field"><span>${escapeHTML(label)}</span><textarea name="${attr(name)}" rows="5">${escapeHTML(value)}</textarea></label>`;
const select = (label,name,value,opts) => `<label class="sm-field"><span>${escapeHTML(label)}</span><select name="${attr(name)}">${opts.map(x=>`<option value="${attr(x)}" ${x===value?'selected':''}>${escapeHTML(x)}</option>`).join('')}</select></label>`;
const reference = (key,i,uuid='') => `<div class="sm-reference" data-reference data-type="${REFERENCES[key]||''}">
  <input type="hidden" name="${key}.${i}.uuid" value="${attr(uuid)}">
  <span class="sm-reference-label">Reference${REFERENCES[key]?` · Drop ${REFERENCES[key].replaceAll('|',' or ').replace('JournalEntry','Journal Entry')}`:' · Drop a document'}</span>
  <div class="sm-reference-row"><span data-reference-link role="status">${uuid?'Loading reference…':'Drop a document here'}</span><button type="button" data-reference-clear title="Remove reference" aria-label="Remove reference" ${uuid?'':'disabled'}><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>
</div>`;
const supplies = data => `<section class="sm-consumables"><h3>Consumables</h3><table class="sm-supplies"><thead><tr><th>Resource</th><th>Quantity</th><th>Collected</th></tr></thead><tbody>${Object.entries(SUPPLIES).map(([key,label])=>{const value=data.supplies?.[key]??{quantity:0,collected:false};return `<tr><th scope="row">${label}</th><td><input aria-label="${label} quantity" name="supplies.${key}.quantity" type="number" min="0" step="any" value="${attr(value.quantity)}"></td><td><input aria-label="${label} collected" name="supplies.${key}.collected" type="checkbox" ${value.collected?'checked':''}></td></tr>`;}).join('')}</tbody></table><p>Collected marks the recorded quantity; it does not transfer resources or subtract them.</p></section>`;

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
  static DEFAULT_OPTIONS = {id:'myz-sector-manager-app', window:{title:'MYZ Sector Manager',resizable:true}, position:{width:920,height:730}, classes:['myz-sector-manager']};
  constructor(options={}) {super(options); this.sectorId = options.sectorId ?? null; this.tab='Overview'; this.draft=null; this.dirty=false; this.filter=''; this.busy=false;}
  get journals(){return game.journal.filter(j=>j.getFlag(MOD,KEY)?.version===1).sort((a,b)=>{const ac=a.getFlag(MOD,KEY)?.code?.trim()||'', bc=b.getFlag(MOD,KEY)?.code?.trim()||''; return (ac&&bc?ac.localeCompare(bc,undefined,{numeric:true,sensitivity:'base'}):ac?-1:bc?1:0)||a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'});});}
  get journal(){return game.journal.get(this.sectorId);}
  get data(){return this.draft ?? DEFAULT();}
  async _prepareContext(){return {};}
  async _renderHTML(){
    const root=document.createElement('div');
    root.className='sm-root';
    root.innerHTML=this.build();
    await Promise.all(Array.from(root.querySelectorAll('[data-reference]'),zone=>this.renderReference(zone)));
    return root;
  }
  _replaceHTML(result,content){
    // ApplicationV2 supplies its actual .window-content node here. Its child
    // must also be a shrinking flex container, not an auto-height wrapper.
    content.classList.add('sm-window-content');
    content.replaceChildren(result);
  }
  build(){
    const j=this.journal, d=this.data;
    const list=this.journals;
    const matches=x=>`${x.name} ${x.getFlag(MOD,KEY)?.code||''}`.toLowerCase().includes(this.filter.toLowerCase());
    const menu=`<aside class="sm-sidebar"><input data-filter aria-label="Search sectors by coordinates or name" placeholder="Search sectors" value="${attr(this.filter)}"><div class="sm-list">${list.map(x=>`<button type="button" data-open="${attr(x.id)}" data-search="${attr(`${x.name} ${x.getFlag(MOD,KEY)?.code||''}`.toLowerCase())}" ${matches(x)?'':'hidden'} class="${x.id===this.sectorId?'selected':''}"><span class="sm-sector-meta"><strong>${escapeHTML(x.getFlag(MOD,KEY)?.code||'No coordinates')}</strong><small> · ${escapeHTML(x.getFlag(MOD,KEY)?.status||'')}</small></span><span>${escapeHTML(x.name)}</span></button>`).join('')}<p data-sector-empty ${list.some(matches)?'hidden':''}>${list.length?'No sectors match your search.':'No sectors yet.'}</p></div></aside>`;
    const zoneSummary=`<div class="sm-zone-summary">${zone.summary(this.journal?this.data:null)}</div>`;
    let main=`<section class="sm-main"><header class="sm-header"><h2>Zone Sectors</h2><div class="sm-header-buttons"><button type="button" disabled>Delete Sector</button><button type="button" data-action="new">+ New Sector</button></div></header>${zoneSummary}<div class="sm-content"><div class="sm-empty"><p>Create a sector or select one from the list. Each record is a GM-only Journal Entry.</p></div></div></section>`;
    if(j){
      let body='';
      if(this.tab==='Overview') body=`<div class="sm-grid">${field('Sector name','journalName',d.journalName??j.name)}${field('Sector ID / Coordinates','code',d.code)}${environmentFields(d)}${select('Exploration Status','status',d.status,['Unexplored','Scouted','Visited','Explored','Cleared','Lost'])}</div>${area('Mood','mood',d.mood||'')}${area('Description','description',d.description)}${area('GM Notes','notes',d.notes)}`;
      else if(this.tab==='Find the Path') body=pathStunts(d);
      else {
        const key=COLLECTIONS[this.tab], arr=d[key]||[];
        const state=this.entryState(key);
        body=(this.tab==='Loot'?supplies(d):'')+`<div class="sm-section-header"><p>${this.tab==='Effects'?'Track weather, Zone phenomena, hazards, and special environmental effects.':`Track sector ${this.tab.toLowerCase()} as individual editable records.`}</p><div class="sm-entry-controls">${arr.length>1?'<button type="button" data-expand-all>Expand All</button><button type="button" data-collapse-all>Collapse All</button>':''}<button type="button" data-action="add" data-collection="${key}">+ Add Entry</button></div></div>`+
          arr.map((item,i)=>{const id=state.entries[i].id, collapsed=state.collapsed.has(id);return `<article class="sm-entry ${collapsed?'is-collapsed':''}" data-entry="${id}"><div class="sm-entry-head" data-entry-header="${id}"><button type="button" class="sm-entry-toggle" data-entry-toggle aria-expanded="${!collapsed}" aria-controls="${id}-body"><span data-chevron aria-hidden="true">${collapsed?'▶':'▼'}</span><strong data-entry-title>${escapeHTML(item.title||`Entry ${i+1}`)}</strong></button><button type="button" data-remove="${key}:${id}" title="Remove entry" aria-label="Remove ${attr(item.title||`Entry ${i+1}`)}">✕</button></div><div class="sm-entry-body" id="${id}-body" ${collapsed?'hidden':''}><div class="sm-grid">${field('Title',`${key}.${i}.title`,item.title||'')}${this.tab==='Loot'&&item.quantity!==undefined?field('Quantity',`${key}.${i}.quantity`,item.quantity,'number'):''}${select('Status',`${key}.${i}.status`,item.status||'Active',['Active','Hidden','Discovered','Resolved','Collected','Depleted','Inactive'])}${this.tab==='Effects'?select('Category',`${key}.${i}.category`,item.category||'Weather',['Weather','Phenomenon','Special Effect','Hazard'])+reference(key,i,item.uuid||''):reference(key,i,item.uuid||'')}</div>${area('Details / Rules / Notes',`${key}.${i}.details`,item.details||'')}${this.tab==='Effects'?field('Duration / Trigger',`${key}.${i}.duration`,item.duration||''):''}</div></article>`;}).join('')+
          (!arr.length?`<div class="sm-empty">No ${escapeHTML(this.tab.toLowerCase())} yet. Add an entry to get started.</div>`:'');
      }
      main=`<section class="sm-main"><header class="sm-header"><div><h2>${escapeHTML(j.name)}</h2><small>GM only · Journal-backed · ${escapeHTML(d.code||'No sector ID')}</small></div><div class="sm-header-buttons"><button type="button" data-action="journal">Open Journal</button><button type="button" data-action="delete">Delete Sector</button><button type="button" data-action="new">+ New Sector</button></div></header>${zoneSummary}<nav class="sm-tabs">${TABS.map(t=>`<button type="button" data-tab="${t}" class="${t===this.tab?'active':''} ${tabHasContent(d,t)?'':'sm-tab-empty'}">${t}</button>`).join('')}<button type="button" data-action="randomize">Randomize</button></nav><div class="sm-content">${body}</div><footer class="sm-footer"><span>${this.dirty?'● Unsaved changes':'Changes saved'}</span><button type="button" data-action="save" ${this.busy?'disabled':''}>Save Sector</button></footer></section>`;
    }
    return `<style>
      .myz-sector-manager .sm-window-content{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0;padding:0;overflow:hidden}
      .myz-sector-manager .sm-root{display:flex;flex:1;min-height:0;min-width:0;overflow:hidden;container-type:inline-size}
      .myz-sector-manager .sm-shell{display:flex;flex:1;min-height:0;min-width:0;font-size:14px}
      .myz-sector-manager .sm-shell button,.myz-sector-manager .sm-shell input,.myz-sector-manager .sm-shell select,.myz-sector-manager .sm-shell textarea{font:inherit}
      .myz-sector-manager .sm-sidebar{width:230px;box-sizing:border-box;flex:none;border-right:1px solid var(--color-border-light-primary,#777);padding:12px;display:flex;flex-direction:column;gap:10px;min-height:0}
      .myz-sector-manager .sm-toolbar,.myz-sector-manager .sm-sidebar>input{flex-shrink:0}
      .myz-sector-manager .sm-toolbar button{width:100%}
      .myz-sector-manager .sm-list [hidden]{display:none!important}
      .myz-sector-manager .sm-sidebar input{width:100%;box-sizing:border-box}
      .myz-sector-manager .sm-list{overflow-y:auto;overflow-x:hidden;flex:1;min-height:0;display:flex;flex-direction:column;gap:4px;scrollbar-gutter:stable}
      .myz-sector-manager .sm-list button{height:auto;min-height:0;flex:0 0 auto;line-height:1.4;overflow-wrap:anywhere;align-items:stretch;text-align:left;padding:8px;display:flex;flex-direction:column;gap:2px;white-space:normal}
      .myz-sector-manager .sm-sector-meta{display:block;line-height:1.4}
      .myz-sector-manager .sm-sector-meta strong{font-size:1.15em;font-weight:700}
      .myz-sector-manager .sm-list button.selected,.myz-sector-manager .sm-tabs button.active{outline:2px solid #a87b3c;outline-offset:-2px}
      .myz-sector-manager .sm-list small,.myz-sector-manager .sm-header small{opacity:.75}
      .myz-sector-manager .sm-main{display:flex;flex-direction:column;min-height:0;min-width:0;flex:1;container-type:inline-size}
      .myz-sector-manager .sm-header{display:flex;flex-shrink:0;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding:12px 15px;border-bottom:1px solid #777}
      .myz-sector-manager .sm-header h2{margin:0;overflow-wrap:anywhere}
      .myz-sector-manager .sm-header-buttons{display:flex;flex-wrap:wrap;gap:6px}
      .myz-sector-manager .sm-tabs{display:flex;flex-shrink:0;overflow-x:auto;gap:3px;padding:8px 12px;border-bottom:1px solid #777}
      .myz-sector-manager .sm-tabs button{flex:none;padding:7px;height:auto}
      .myz-sector-manager .sm-tabs .sm-tab-empty:not(.active){opacity:.65}
      .myz-sector-manager .sm-tabs .sm-tab-empty.active{border-style:dashed}
      .myz-sector-manager .sm-content{flex:1;min-height:0;min-width:0;overflow-y:auto;overflow-x:hidden;padding:15px;scrollbar-gutter:stable}
      .myz-sector-manager .sm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .myz-sector-manager .sm-field{display:flex;flex-direction:column;gap:4px;margin-bottom:12px;min-width:0}
      .myz-sector-manager .sm-field span{font-weight:bold}
      .myz-sector-manager .sm-field input,.myz-sector-manager .sm-field textarea,.myz-sector-manager .sm-field select{width:100%;box-sizing:border-box}
      .myz-sector-manager .sm-field textarea{resize:vertical}
      .myz-sector-manager .sm-footer{flex-shrink:0;padding:10px 15px;display:flex;justify-content:space-between;gap:8px;align-items:center;border-top:1px solid #777}
      .myz-sector-manager .sm-entry{border:1px solid #777;border-radius:5px;margin:0 0 12px;min-width:0}
      .myz-sector-manager .sm-entry-head{display:flex;align-items:center;gap:8px;padding:8px;cursor:pointer}
      .myz-sector-manager .sm-entry-toggle{display:flex;align-items:center;gap:8px;flex:1;min-width:0;height:auto;text-align:left;white-space:normal;background:transparent;border:0;box-shadow:none;padding:4px}
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
      .myz-sector-manager .sm-reference-row{display:flex;align-items:center;gap:6px}
      .myz-sector-manager [data-reference-link]{flex:1;min-width:0;overflow-wrap:anywhere}
      .myz-sector-manager .sm-reference .content-link{white-space:normal;overflow-wrap:anywhere}
      .myz-sector-manager .sm-reference [data-reference-clear]{width:28px;flex:none}
      .myz-sector-manager .sm-reference .sm-reference-missing{opacity:.75;font-style:italic}
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
      .myz-sector-manager .sm-stunt{display:flex;align-items:flex-start;gap:10px;margin:10px 0;cursor:pointer}
      .myz-sector-manager .sm-stunt input{flex:none;appearance:auto;width:18px;height:18px;margin:2px;accent-color:var(--color-text-hyperlink,#3875b4)}
      .myz-sector-manager .sm-stunt small{display:block;opacity:.85}
      .myz-sector-manager .sm-empty{padding:22px;opacity:.8;overflow-wrap:anywhere}
      @container (min-width:650px){.myz-sector-manager .sm-consumables{width:50%}}
      @container (max-width:440px){.myz-sector-manager .sm-grid{grid-template-columns:1fr}}
      @container (max-width:750px){.myz-sector-manager .sm-sidebar{width:160px}}
    </style><div class="sm-shell">${menu}${main}</div>`;
  }

  async _onRender(context,options){await super._onRender(context,options);const el=this.element;
    this.refreshZoneSummary();
    el.querySelectorAll('[data-reference]').forEach(zone=>{
      zone.addEventListener('dragover',event=>{event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';});
      zone.addEventListener('drop',event=>this.dropReference(event,zone));
      zone.querySelector('[data-reference-clear]').addEventListener('click',()=>this.clearReference(zone));
    });
    // Delay pointer selection briefly so rerender cannot destroy the double-click target.
    el.querySelectorAll('[data-open]').forEach(b=>{
      b.addEventListener('click',event=>{clearTimeout(this.sidebarClick);if(event.detail===0){void this.navigate(b.dataset.open);return;}this.sidebarClick=setTimeout(()=>{void this.navigate(b.dataset.open);},300);});
      b.addEventListener('dblclick',event=>{event.preventDefault();clearTimeout(this.sidebarClick);void this.centerSidebarSector(b.dataset.open);});
    });
    el.querySelectorAll('[name^="pathStunts."]').forEach(input=>input.addEventListener('change',()=>{this.capture();void this.persistStunts().catch(error=>{this.markDirty();ui.notifications.error(`Could not save stunts: ${error.message}. Use Save Sector to retry.`);});}));
    el.querySelector('[name="rot"]')?.addEventListener('change',event=>{
      const hint=el.querySelector('[data-rot-exposure]');if(hint)hint.textContent=ROT_LEVELS.find(entry=>String(entry.level)===event.target.value)?.exposure||'Existing value retained.';
    });
    el.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{clearTimeout(this.sidebarClick);this.capture();this.tab=b.dataset.tab;this.render();}));
    el.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>this.action(b.dataset.action,b.dataset.collection)));
    el.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',event=>{event.stopPropagation();const [key,id]=b.dataset.remove.split(':');this.removeEntry(key,id);}));
    el.querySelectorAll('[data-entry-header]').forEach(header=>header.addEventListener('click',event=>{
      if(event.target.closest('[data-remove]'))return;
      const key=COLLECTIONS[this.tab], id=header.dataset.entryHeader;
      this.setCollapsed(key,id,!this.entryState(key).collapsed.has(id));
    }));
    el.querySelector('[data-expand-all]')?.addEventListener('click',()=>this.collapseAll(false));
    el.querySelector('[data-collapse-all]')?.addEventListener('click',()=>this.collapseAll(true));
    el.querySelector('[data-filter]')?.addEventListener('input',e=>{this.filter=e.target.value;el.querySelectorAll('[data-open]').forEach(b=>{b.hidden=!b.dataset.search.includes(this.filter.toLowerCase());});const empty=el.querySelector('[data-sector-empty]');if(empty)empty.hidden=Array.from(el.querySelectorAll('[data-open]')).some(b=>!b.hidden);});
    el.querySelectorAll('.sm-content input,.sm-content select,.sm-content textarea').forEach(e=>e.addEventListener('input',()=>{
      if(!e.name?.startsWith('pathStunts.'))this.markDirty();
      this.capture();this.refreshTabIndicators();if(e.name==='code')this.refreshZoneSummary();
      if(e.name?.endsWith('.title')){const title=e.closest('[data-entry]')?.querySelector('[data-entry-title]');if(title)title.textContent=e.value||'Untitled Entry';}
    }));
  }
  refreshTabIndicators(){
    for(const button of this.element.querySelectorAll('[data-tab]'))button.classList.toggle('sm-tab-empty',!tabHasContent(this.data,button.dataset.tab));
  }
  capture(){if(!this.journal)return;const fields=this.element.querySelectorAll('.sm-content [name]');for(const f of fields){const parts=f.name.split('.');let target=this.draft;for(let i=0;i<parts.length-1;i++){target[parts[i]] ??= {};target=target[parts[i]];}let v=f.type==='checkbox'?f.checked:f.value;if(f.name.startsWith('supplies.')&&f.type==='number'){const n=Number(f.value);v=Number.isFinite(n)?Math.max(0,n):0;}if(/^loot\.\d+\.quantity$/.test(f.name)){const quantity=Number(v);v=Number.isFinite(quantity)?Math.max(0,quantity):0;}if(f.name==='rot')v=ROT_LEVELS.some(entry=>String(entry.level)===String(v))?Number(v):this.draft.rot;target[parts.at(-1)]=v;}for(const key of Object.values(COLLECTIONS))this.entryState(key);}
  refreshZoneSummary(){
    const container=this.element?.querySelector('.sm-zone-summary');
    if(!container)return;
    container.innerHTML=zone.summary(this.journal?this.data:null);zone.bindSummary(container);
  }
  async newSector(code=''){
    const existing=code?zone.store.sectorRecords(code):[];
    if(existing.length){await this.navigate(existing[0].id);return;}
    if(!await this.confirmLose())return;
    const data=DEFAULT();data.code=code;
    const journal=await JournalEntry.create({name:code?`Sector ${code}`:`New Sector ${this.journals.length+1}`,ownership:{default:0},pages:[{name:'Sector Record',type:'text',text:{content:'<p>Sector record managed by MYZ Sector Manager. Use the Sector Manager to edit structured fields.</p>'}}],flags:{[MOD]:{[KEY]:data}}});
    this.sectorId=journal.id;this.draft=normalize(data);this.tab='Overview';this.dirty=false;this.filter='';await this.render();
  }
  markDirty(){this.dirty=true;const status=this.element.querySelector('.sm-footer span');if(status)status.textContent='● Unsaved changes';}

  entryState(key){
    let sector=ENTRY_UI.get(this.sectorId);
    if(!sector){sector=new Map();ENTRY_UI.set(this.sectorId,sector);}
    let state=sector.get(key);
    if(!state){state={entries:[],collapsed:new Set()};sector.set(key,state);}
    const available=new Set(state.entries);
    const entries=(this.data[key]||[]).map(item=>{
      const snapshot=JSON.stringify(item);
      // Identity survives edits/reorders in the current draft. Content matching
      // reconnects cloned Journal data on reopen, without persisting UI fields.
      const old=Array.from(available).find(entry=>entry.item===item)
        ||Array.from(available).find(entry=>entry.snapshot===snapshot);
      if(old)available.delete(old);
      return {id:old?.id||`sm-entry-${++entrySequence}`,item,snapshot};
    });
    for(const removed of available)state.collapsed.delete(removed.id);
    state.entries=entries;
    return state;
  }

  setCollapsed(key,id,collapsed){
    const state=this.entryState(key);
    if(!state.entries.some(entry=>entry.id===id))return;
    if(collapsed)state.collapsed.add(id);else state.collapsed.delete(id);
    const card=this.element.querySelector(`[data-entry="${id}"]`);
    if(!card)return;
    // Hide in place: no rerender, data capture, or loss of unsaved input/focus.
    card.classList.toggle('is-collapsed',collapsed);
    const toggle=card.querySelector('[data-entry-toggle]'), body=card.querySelector('.sm-entry-body');
    toggle.setAttribute('aria-expanded',String(!collapsed));
    card.querySelector('[data-chevron]').textContent=collapsed?'▶':'▼';
    if(collapsed && body.contains(document.activeElement))toggle.focus();
    body.hidden=collapsed;
  }

  collapseAll(collapsed){
    const key=COLLECTIONS[this.tab];
    if(!key)return;
    for(const {id} of this.entryState(key).entries)this.setCollapsed(key,id,collapsed);
  }

  async removeEntry(key,id){
    this.capture();
    const state=this.entryState(key), entry=state.entries.find(record=>record.id===id);
    if(!entry)return;
    const index=this.draft[key].indexOf(entry.item);
    if(index<0)return;
    this.draft[key].splice(index,1);
    this.entryState(key); // Also forget the removed entry's collapsed state.
    this.markDirty();
    await this.render();
  }

  async renderReference(zone){
    const input=zone.querySelector('input'), target=zone.querySelector('[data-reference-link]');
    const uuid=input.value;
    const request=zone.referenceRequest=(zone.referenceRequest||0)+1;
    const current=()=>zone.referenceRequest===request && input.value===uuid;
    zone.querySelector('[data-reference-clear]').disabled=!uuid;
    target.classList.remove('sm-reference-missing');
    if(!uuid){target.textContent='Drop a document here';return;}
    target.textContent='Loading reference…';
    try{
      // Never interpolate untrusted legacy strings into inline-link syntax.
      if(!/^[A-Za-z0-9_.-]+$/.test(uuid))throw new Error('Invalid document UUID');
      const doc=await fromUuid(uuid);
      if(!current())return;
      if(!doc){target.textContent=`Missing reference (${uuid})`;target.classList.add('sm-reference-missing');return;}
      const html=await foundry.applications.ux.TextEditor.implementation.enrichHTML(`@UUID[${uuid}]`,{documents:true,links:false,rolls:false,embeds:false,custom:false});
      if(!current())return;
      target.innerHTML=html;
      const link=target.querySelector('a.content-link');
      if(!link)throw new Error('Document link could not be rendered');
      link.tabIndex=0;
      link.setAttribute('role','link');
      // Route through the native document-link hook explicitly, so these links
      // also work inside this custom ApplicationV2 and are not handled twice.
      link.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();this.openReference(zone,event);});
      link.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();link.click();}});
    }catch(err){
      if(current()){target.textContent=`Reference unavailable (${uuid}): ${err.message}`;target.classList.add('sm-reference-missing');}
    }
  }

  clearReference(zone){
    zone.querySelector('input').value='';
    this.capture();this.markDirty();
    return this.renderReference(zone);
  }

  async dropReference(event,zone){
    event.preventDefault();event.stopPropagation();
    const draft=this.draft;
    try{
      const payload=foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
      if(!payload.uuid){ui.notifications.warn('Drop a document from Foundry.');return;}
      const doc=await fromUuid(payload.uuid);
      if(this.draft!==draft || !this.element.contains(zone))return;
      if(!doc)throw new Error('Reference could not be found.');
      if(zone.dataset.type && !zone.dataset.type.split('|').includes(doc.documentName)){ui.notifications.warn(`This entry expects a ${zone.dataset.type.replaceAll('|',' or ').replace('JournalEntry','Journal Entry')}.`);return;}
      zone.querySelector('input').value=doc.uuid;
      this.capture();this.markDirty();
      await this.renderReference(zone);
    }catch(err){ui.notifications.error(`Unable to attach reference: ${err.message}`);}
  }

  async openReference(zone,event){
    try{
      const uuid=zone.querySelector('input').value.trim();
      if(!uuid)return;
      const doc=await fromUuid(uuid);
      if(!doc)throw new Error('Reference could not be found.');
      await doc._onClickDocumentLink(event);
    }catch(err){ui.notifications.error(`Unable to open reference: ${err.message}`);}
  }
  async randomizeSector(){
    if(!game.user.isGM||!this.journal||this.randomizing)return;
    this.randomizing=true;
    try{
      await this.stuntWrite;this.capture();
      const journal=this.journal,expected=foundry.utils.deepClone(journal.getFlag(MOD,KEY)),base=foundry.utils.deepClone(this.draft),signature=JSON.stringify(base);
      const method=await foundry.applications.api.DialogV2.wait({...randomizeDialogOptions(),window:{title:'Randomize Sector'},content:randomizeDialogContent(`<p>Randomization replaces terrain, Rot, mood, and previous generated entries. Consumable quantities will be replaced; collected checkboxes are retained. Manual entries, notes, coordinates, and other fields are retained. Review the generated results before saving.</p><label>Randomization Method<select name="randomizationMethod">${RANDOMIZATION_METHODS.map(method=>`<option value="${method.id}">${escapeHTML(method.label)}</option>`).join('')}</select></label>`),buttons:[{action:'cancel',label:'Cancel',default:true,callback:()=>null},{action:'randomize',label:'Randomize',callback:(event,button,dialog)=>dialog.element.querySelector('[name="randomizationMethod"]').value}],close:()=>null,rejectClose:false});
      if(!method)return;
      const selectedMethod=RANDOMIZATION_METHODS.find(entry=>entry.id===method);
      if(!selectedMethod)throw new Error('Unknown randomization method.');
      const next=await selectedMethod.generate(base,{options:{threatMode:game.settings.get(MOD,'threatGenerationMode')||DEFAULT_GENERATION_OPTIONS.threatMode,dangerousLevel:game.settings.get(MOD,'dangerousThreatLevel')??DEFAULT_GENERATION_OPTIONS.dangerousLevel}});
      const summary=['locations','encounters','effects','loot'].map(key=>`<h4>${escapeHTML(key)}</h4><ul>${next[key].filter(entry=>entry.generated?.method==='core').map(entry=>`<li>${escapeHTML(entry.title)}${entry.quantity!==undefined?` × ${entry.quantity}`:''}</li>`).join('')||'<li>None generated</li>'}</ul>`).join('');
      const supplySummary=`<h4>Consumables (new quantities)</h4><ul>${Object.entries(SUPPLIES).map(([key,label])=>`<li>${escapeHTML(label)}: ${next.supplies[key].quantity}</li>`).join('')}</ul>`;
      if(!await foundry.applications.api.DialogV2.confirm({...randomizeDialogOptions(),window:{title:'Save Randomized Sector?'},content:randomizeDialogContent(`<p>Terrain: ${escapeHTML(next.terrain)} · Rot: ${next.rot}</p><p>Mood: ${escapeHTML(next.mood)}</p><p>Threat Level: ${next.randomization.numericThreatLevel} (${escapeHTML(next.randomization.threatLevel)}) · ${escapeHTML(next.randomization.levelSelection)}</p><p>Environment eligibility — Ruin: ${escapeHTML(next.randomization.environment.ruins||'No')}; Threat: ${next.randomization.environment.threats?'Yes':'No'}; Artifact: ${next.randomization.environment.artifacts?'Yes':'No'}.</p><p>Base Dice: ${escapeHTML(next.randomization.baseDice.join(', ')||'None (level 0)')}. Threat severity (1s): ${next.randomization.threatSeverity}. Artifacts (eligible 6s): ${next.randomization.artifactCount}. Threat identities: ${next.randomization.threatCount} (${next.randomization.threatMode==='core'?'Core: one threat, severity from 1s':'House rule: 1d3 individual threats'}).</p>${supplySummary}${summary}<p>Replace this sector's generated information? Manual entries and notes are retained.</p>`)}))return;
      if(this.sectorId!==journal.id||this.rendered===false||JSON.stringify(this.draft)!==signature)throw new Error('Sector selection or edits changed during generation. Nothing was saved; try again.');
      await saveGeneratedSector(journal,expected,next);
      this.draft=normalize(journal.getFlag(MOD,KEY));this.dirty=false;await this.render();ui.notifications.info('Sector randomized and saved.');
    }catch(error){ui.notifications.error(`Sector randomization: ${error.message}`);}
    finally{this.randomizing=false;}
  }
  async _onClose(options){clearTimeout(this.sidebarClick);await this.stuntWrite;return super._onClose(options);}
  persistStunts(){
    const journal=this.journal,states=foundry.utils.deepClone(this.draft.pathStunts);
    const write=(this.stuntWrite||Promise.resolve()).catch(()=>{}).then(async()=>{
      if(!game.user.isGM)throw new Error('GM access required');
      const stored=foundry.utils.deepClone(journal.getFlag(MOD,KEY));
      stored.pathStunts={...stored.pathStunts,...states};
      await journal.setFlag(MOD,KEY,stored);
    });
    this.stuntWrite=write;return write;
  }
  async centerSidebarSector(id){
    try{await this.navigate(id);const record=game.journal.get(id)?.getFlag(MOD,KEY);if(this.sectorId===id&&record)await zone.centerSector(record.code);}
    catch(error){ui.notifications.error(`Zone Map: ${error.message}`);}
  }
  async confirmLose(){if(!this.dirty)return true;return await foundry.applications.api.DialogV2.confirm({window:{title:'Unsaved Changes'},content:'Discard unsaved changes?'});}
  async navigate(id){if(id===this.sectorId)return;if(!await this.confirmLose())return;await this.stuntWrite;this.sectorId=id;this.draft=normalize(this.journal.getFlag(MOD,KEY));this.tab='Overview';this.dirty=false;await this.render();}
  async action(which,key){try{
    if(which==='randomize'){await this.randomizeSector();return;}
    if(which==='reset-stunts'){
      const sectorId=this.sectorId;
      if(!await foundry.applications.api.DialogV2.confirm({window:{title:'Reset Stunts'},content:'Clear all Find the Path checkboxes for this sector?'}))return;
      if(this.sectorId!==sectorId)return;
      this.capture();for(const stunt of PATH_STUNTS)this.draft.pathStunts[stunt.id]=false;try{await this.persistStunts();}catch(error){this.markDirty();throw error;}await this.render();return;
    }
    if(which==='new'){await this.newSector();return;}
    if(which==='add'){this.capture();this.draft[key].push({title:'',status:'Active',details:'',uuid:'',category:'Weather',duration:''});this.dirty=true;await this.render();return;}
    if(which==='save'){const pendingStunts=this.stuntWrite;await pendingStunts?.catch(()=>{});this.capture();this.busy=true;const j=this.journal;if(!j)return;await j.update({name:this.draft.journalName?.trim()||j.name});delete this.draft.journalName;await j.setFlag(MOD,KEY,this.draft);if(this.stuntWrite===pendingStunts)this.stuntWrite=undefined;this.dirty=false;this.busy=false;await this.render();ui.notifications.info('Sector saved.');return;}
    if(which==='journal'){this.journal?.sheet?.render(true);return;}
    if(which==='delete'){if(!await foundry.applications.api.DialogV2.confirm({window:{title:'Delete Sector'},content:`Permanently delete the Journal Entry for ${escapeHTML(this.journal.name)}? This cannot be undone.`}))return;await this.journal.delete();ENTRY_UI.delete(this.sectorId);this.sectorId=null;this.draft=null;this.dirty=false;await this.render();return;}
  }catch(err){this.busy=false;console.error(`${MOD} |`,err);ui.notifications.error(`Sector Manager: ${err.message}`);}}
}
let app;
const zone=new ZoneRuntime({
  onChange:()=>{if(app?.rendered)app.refreshZoneSummary();},
  openSector:id=>game.myzSectorManager.open(id),
  createSector:async code=>{const manager=await game.myzSectorManager.open();if(manager)await manager.newSector(code);}
});
Hooks.once('init',()=>{
  zone.register();
  game.settings.register(MOD,'threatGenerationMode',{name:'Sector generation: threat identities',hint:'Core uses one threat identity with severity equal to the number of Base Dice showing 1. The 1d3 option is a house rule and does not change the severity roll.',scope:'world',config:true,type:String,choices:{core:'Core Rulebook: one threat with severity','individual-d3':'House rule: 1d3 individual threats'},default:'core',restricted:true});
  game.settings.register(MOD,'dangerousThreatLevel',{name:'Sector generation: Unusually Dangerous level',hint:'Numeric Threat Level when the table returns the open-ended 9+ category. Default 9. Explicit numeric table results take precedence.',scope:'world',config:true,type:Number,default:9,restricted:true});
});
Hooks.once('ready',()=>{
  game.myzSectorManager={
    zone:zone.api(),
    open:async(id=null)=>{
      if(!game.user.isGM){ui.notifications.warn('GM access only.');return;}
      if(app?.rendered){if(id && id!==app.sectorId)await app.navigate(id);app.bringToFront();return app;}
      app=new SectorManager({sectorId:id});
      if(id && app.journal)app.draft=normalize(app.journal.getFlag(MOD,KEY));
      await app.render(true);return app;
    },
    getSector:(journalId)=>{if(!game.user.isGM)return null;const j=game.journal.get(journalId);return j?.getFlag(MOD,KEY)??null;}
  };
  zone.start();
  console.info(`${MOD} | Ready. Run game.myzSectorManager.open() from a Script Macro.`);
});
