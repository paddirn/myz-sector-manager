const MOD = 'myz-sector-manager';
const KEY = 'sector';
const TABS = ['Overview', 'Locations', 'Encounters', 'Loot', 'Effects', 'Secrets', 'History'];
const COLLECTIONS = {Locations:'locations', Encounters:'encounters', Loot:'loot', Effects:'effects', Secrets:'secrets', History:'history'};
const REFERENCES = {locations:'Scene', encounters:'Actor', loot:'Item'};
const SUPPLIES = {cleanGrub:'Clean Grub', rotGrub:'Rot Grub', cleanWater:'Clean Water', rotWater:'Rot Water', bullets:'Bullets', booze:'Booze'};
const supplyDefaults = () => Object.fromEntries(Object.keys(SUPPLIES).map(key=>[key,{quantity:0,collected:false}]));
const normalize = data => {const result=foundry.utils.deepClone(data); result.supplies ??= {}; for(const key of Object.keys(SUPPLIES)) result.supplies[key] ??= {quantity:0,collected:false}; return result;};
const DEFAULT = () => ({version:1, code:'', terrain:'', rot:0, status:'Unexplored', description:'', notes:'', locations:[], encounters:[], loot:[], effects:[], secrets:[], history:[], supplies:supplyDefaults()});
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const attr = escapeHTML;
const field = (label,name,value='',type='text') => `<label class="sm-field"><span>${escapeHTML(label)}</span><input name="${attr(name)}" type="${type}" value="${attr(value)}" ${type==='number'?'min="0" step="1"':''}></label>`;
const area = (label,name,value='') => `<label class="sm-field"><span>${escapeHTML(label)}</span><textarea name="${attr(name)}" rows="5">${escapeHTML(value)}</textarea></label>`;
const select = (label,name,value,opts) => `<label class="sm-field"><span>${escapeHTML(label)}</span><select name="${attr(name)}">${opts.map(x=>`<option value="${attr(x)}" ${x===value?'selected':''}>${escapeHTML(x)}</option>`).join('')}</select></label>`;
const reference = (key,i,uuid='') => `<div class="sm-reference" data-reference data-type="${REFERENCES[key]||''}"><label class="sm-field"><span>Reference UUID (optional)${REFERENCES[key]?` · Drop ${REFERENCES[key]}`:''}</span><input name="${key}.${i}.uuid" value="${attr(uuid)}" aria-label="Reference UUID (optional)"></label><button type="button" data-reference-open>Open Reference</button></div>`;
const supplies = data => `<section class="sm-entry"><h3>Supplies</h3><table class="sm-supplies"><thead><tr><th>Supply</th><th>Quantity</th><th>Collected</th></tr></thead><tbody>${Object.entries(SUPPLIES).map(([key,label])=>{const value=data.supplies?.[key]??{quantity:0,collected:false};return `<tr><th scope="row">${label}</th><td><input aria-label="${label} quantity" name="supplies.${key}.quantity" type="number" min="0" step="any" value="${attr(value.quantity)}"></td><td><input aria-label="${label} collected" name="supplies.${key}.collected" type="checkbox" ${value.collected?'checked':''}></td></tr>`;}).join('')}</tbody></table><p>Quantities are recorded totals. Marking collected does not subtract them or transfer items.</p></section>`;

class SectorManager extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {id:'myz-sector-manager-app', window:{title:'MYZ Sector Manager',resizable:true}, position:{width:920,height:730}, classes:['myz-sector-manager']};
  constructor(options={}) {super(options); this.sectorId = options.sectorId ?? null; this.tab='Overview'; this.draft=null; this.dirty=false; this.filter=''; this.busy=false;}
  get journals(){return game.journal.filter(j=>j.getFlag(MOD,KEY)?.version===1).sort((a,b)=>{const ac=a.getFlag(MOD,KEY)?.code?.trim()||'', bc=b.getFlag(MOD,KEY)?.code?.trim()||''; return (ac&&bc?ac.localeCompare(bc,undefined,{numeric:true,sensitivity:'base'}):ac?-1:bc?1:0)||a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'});});}
  get journal(){return game.journal.get(this.sectorId);}
  get data(){return this.draft ?? DEFAULT();}
  async _prepareContext(){return {};}
  async _renderHTML(){const root=document.createElement('div');root.innerHTML=this.build();return root;}
  _replaceHTML(result,content){content.replaceChildren(result);}
  build(){
    const j=this.journal, d=this.data;
    const list=this.journals.filter(x=>`${x.name} ${x.getFlag(MOD,KEY)?.code||''}`.toLowerCase().includes(this.filter.toLowerCase()));
    const menu=`<aside class="sm-sidebar"><div class="sm-toolbar"><button data-action="new" type="button">+ New Sector</button></div><input data-filter placeholder="Search sectors" value="${attr(this.filter)}"><div class="sm-list">${list.map(x=>`<button type="button" data-open="${attr(x.id)}" class="${x.id===this.sectorId?'selected':''}"><strong>${escapeHTML(x.getFlag(MOD,KEY)?.code||'No coordinates')}</strong><small>${escapeHTML(x.getFlag(MOD,KEY)?.status||'')}</small><span>${escapeHTML(x.name)}</span></button>`).join('')||'<p>No sectors yet.</p>'}</div></aside>`;
    let main='<div class="sm-empty"><h2>Zone Sector Records</h2><p>Create a sector or select one from the list. Each record is a GM-only Journal Entry.</p></div>';
    if(j){
      let body='';
      if(this.tab==='Overview') body=`<div class="sm-grid">${field('Sector name','journalName',d.journalName??j.name)}${field('Sector ID / Coordinates','code',d.code)}${field('Terrain','terrain',d.terrain)}${field('Rot Level','rot',d.rot,'number')}${select('Exploration Status','status',d.status,['Unexplored','Scouted','Visited','Explored','Cleared','Lost'])}</div>${area('Description','description',d.description)}${area('GM Notes','notes',d.notes)}`;
      else {
        const key=COLLECTIONS[this.tab], arr=d[key]||[];
        const placeholders={Locations:'Ruined pumping station',Encounters:'Zone Ghoul patrol',Loot:'Old World artifact',Effects:'Acid rain / Magnetic anomaly',Secrets:'Hidden bunker entrance',History:'Party visited and opened the vault'};
        body=(this.tab==='Loot'?supplies(d):'')+`<div class="sm-section-header"><p>${this.tab==='Effects'?'Track weather, Zone phenomena, hazards, and special environmental effects.':`Track sector ${this.tab.toLowerCase()} as individual editable records.`}</p><button type="button" data-action="add" data-collection="${key}">+ Add Entry</button></div>`+
          arr.map((item,i)=>`<article class="sm-entry"><div class="sm-entry-head"><strong>${escapeHTML(item.title||`Entry ${i+1}`)}</strong><button type="button" data-remove="${key}:${i}" title="Remove entry">✕</button></div><div class="sm-grid">${field('Title',`${key}.${i}.title`,item.title||'')}${select('Status',`${key}.${i}.status`,item.status||'Active',['Active','Hidden','Discovered','Resolved','Collected','Depleted','Inactive'])}${this.tab==='Effects'?select('Category',`${key}.${i}.category`,item.category||'Weather',['Weather','Phenomenon','Special Effect','Hazard']):reference(key,i,item.uuid||'')}</div>${area('Details / Rules / Notes',`${key}.${i}.details`,item.details||'')}${this.tab==='Effects'?field('Duration / Trigger',`${key}.${i}.duration`,item.duration||''):''}</article>`).join('')+
          (!arr.length?`<div class="sm-empty">No ${escapeHTML(this.tab.toLowerCase())} yet. Add an entry to get started.</div>`:'');
      }
      main=`<section class="sm-main"><header class="sm-header"><div><h2>${escapeHTML(j.name)}</h2><small>GM only · Journal-backed · ${escapeHTML(d.code||'No sector ID')}</small></div><div class="sm-header-buttons"><button type="button" data-action="journal">Open Journal</button><button type="button" data-action="delete">Delete Sector</button></div></header><nav class="sm-tabs">${TABS.map(t=>`<button type="button" data-tab="${t}" class="${t===this.tab?'active':''}">${t}</button>`).join('')}</nav><div class="sm-content">${body}</div><footer class="sm-footer"><span>${this.dirty?'● Unsaved changes':'Changes saved'}</span><button type="button" data-action="save" ${this.busy?'disabled':''}>Save Sector</button></footer></section>`;
    }
    return `<style>
      .myz-sector-manager .window-content{padding:0;overflow:hidden}.sm-shell{display:flex;height:100%;min-height:450px;font-size:14px}.sm-shell button,.sm-shell input,.sm-shell select,.sm-shell textarea{font:inherit}.sm-sidebar{width:230px;flex:none;border-right:1px solid var(--color-border-light-primary,#777);padding:12px;display:flex;flex-direction:column;gap:10px;min-height:0}.sm-toolbar button{width:100%}.sm-sidebar input{width:100%;box-sizing:border-box}.sm-list{overflow:auto;flex:1;display:flex;flex-direction:column;gap:4px}.sm-list button{height:auto;min-height:0;flex:0 0 auto;line-height:1.4;overflow-wrap:anywhere;align-items:stretch;text-align:left;padding:8px;display:flex;flex-direction:column;gap:4px;white-space:normal}.sm-list button strong{font-size:1.15em;font-weight:700}.sm-reference{grid-column:1/-1;border:1px dashed #888;padding:8px;margin-bottom:12px}.sm-reference .sm-field{margin-bottom:6px}.sm-supplies{width:100%;table-layout:fixed}.sm-supplies th,.sm-supplies td{padding:6px;text-align:left}.sm-supplies input[type=number]{width:100%;min-width:0;box-sizing:border-box}.sm-supplies input[type=checkbox]{width:auto}.sm-list button.selected,.sm-tabs button.active{outline:2px solid #a87b3c}.sm-list small,.sm-header small{opacity:.75}.sm-main{display:flex;flex-direction:column;min-width:0;flex:1}.sm-header{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 15px;border-bottom:1px solid #777}.sm-header h2{margin:0}.sm-header-buttons{display:flex;gap:6px}.sm-tabs{display:flex;overflow-x:auto;gap:3px;padding:8px 12px;border-bottom:1px solid #777}.sm-tabs button{flex:none;padding:7px}.sm-content{flex:1;min-height:0;overflow:auto;padding:15px}.sm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.sm-field{display:flex;flex-direction:column;gap:4px;margin-bottom:12px;min-width:0}.sm-field span{font-weight:bold}.sm-field input,.sm-field textarea,.sm-field select{width:100%;box-sizing:border-box}.sm-field textarea{resize:vertical}.sm-footer{padding:10px 15px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #777}.sm-entry{border:1px solid #777;border-radius:5px;padding:12px;margin:0 0 12px}.sm-entry-head,.sm-section-header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px}.sm-entry-head button{width:35px;flex:none}.sm-empty{padding:22px;opacity:.8}.sm-section-header p{margin:0}.sm-section-header button{white-space:nowrap}@media(max-width:750px){.sm-sidebar{width:160px}.sm-grid{grid-template-columns:1fr}}
    </style><div class="sm-shell">${menu}${main}</div>`;
  }
  async _onRender(context,options){await super._onRender(context,options);const el=this.element;
    el.querySelectorAll('[data-reference]').forEach(zone=>{
      zone.addEventListener('dragover',event=>{event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';});
      zone.addEventListener('drop',event=>this.dropReference(event,zone));
      zone.querySelector('[data-reference-open]').addEventListener('click',()=>this.openReference(zone));
    });
    el.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>this.navigate(b.dataset.open)));
    el.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{this.capture();this.tab=b.dataset.tab;this.render();}));
    el.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>this.action(b.dataset.action,b.dataset.collection)));
    el.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{this.capture();const [key,ix]=b.dataset.remove.split(':');this.draft[key].splice(Number(ix),1);this.dirty=true;this.render();}));
    el.querySelector('[data-filter]')?.addEventListener('input',e=>{this.filter=e.target.value;el.querySelectorAll('[data-open]').forEach(b=>{const label=b.textContent.toLowerCase();b.hidden=!label.includes(this.filter.toLowerCase());});});
    el.querySelectorAll('.sm-content input,.sm-content select,.sm-content textarea').forEach(e=>e.addEventListener('input',()=>{this.dirty=true;const span=el.querySelector('.sm-footer span');if(span)span.textContent='● Unsaved changes';}));
  }
  capture(){if(!this.journal)return;const fields=this.element.querySelectorAll('.sm-content [name]');for(const f of fields){const parts=f.name.split('.');let target=this.draft;for(let i=0;i<parts.length-1;i++){target[parts[i]] ??= {};target=target[parts[i]];}let v=f.type==='checkbox'?f.checked:f.value;if(f.name.startsWith('supplies.')&&f.type==='number'){const n=Number(f.value);v=Number.isFinite(n)?Math.max(0,n):0;}if(f.name==='rot')v=Math.max(0,Number.parseInt(v,10)||0);target[parts.at(-1)]=v;}}
  async dropReference(event,zone){
    event.preventDefault();event.stopPropagation();
    try{
      const payload=foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
      if(!payload.uuid){ui.notifications.warn('Drop a document from Foundry.');return;}
      const doc=await fromUuid(payload.uuid);
      if(!doc)throw new Error('Reference could not be found.');
      if(zone.dataset.type && doc.documentName!==zone.dataset.type){ui.notifications.warn(`This entry expects a ${zone.dataset.type}.`);return;}
      const input=zone.querySelector('input');input.value=doc.uuid;
      this.capture();this.dirty=true;const status=this.element.querySelector('.sm-footer span');if(status)status.textContent='● Unsaved changes';
    }catch(err){ui.notifications.error(`Unable to attach reference: ${err.message}`);}
  }
  async openReference(zone){
    try{const uuid=zone.querySelector('input').value.trim();if(!uuid){ui.notifications.warn('Enter a UUID or drop a document first.');return;}
      const doc=await fromUuid(uuid);if(!doc)throw new Error('Reference could not be found.');
      if(doc.documentName==='Scene')await doc.view();
      else if(doc.sheet)await doc.sheet.render(true);
      else throw new Error('This document has no viewable sheet.');
    }catch(err){ui.notifications.error(`Unable to open reference: ${err.message}`);}
  }
  async confirmLose(){if(!this.dirty)return true;return await foundry.applications.api.DialogV2.confirm({window:{title:'Unsaved Changes'},content:'Discard unsaved changes?'});}
  async navigate(id){if(id===this.sectorId)return;if(!await this.confirmLose())return;this.sectorId=id;this.draft=normalize(this.journal.getFlag(MOD,KEY));this.tab='Overview';this.dirty=false;await this.render();}
  async action(which,key){try{
    if(which==='new'){if(!await this.confirmLose())return;const count=this.journals.length+1;const j=await JournalEntry.create({name:`New Sector ${count}`,ownership:{default:0},pages:[{name:'Sector Record',type:'text',text:{content:'<p>Sector record managed by MYZ Sector Manager. Use the Sector Manager to edit structured fields.</p>'}}]});await j.setFlag(MOD,KEY,DEFAULT());await this.navigate(j.id);return;}
    if(which==='add'){this.capture();this.draft[key].push({title:'',status:'Active',details:'',uuid:'',category:'Weather',duration:''});this.dirty=true;await this.render();return;}
    if(which==='save'){this.capture();this.busy=true;const j=this.journal;if(!j)return;await j.update({name:this.draft.journalName?.trim()||j.name});delete this.draft.journalName;await j.setFlag(MOD,KEY,this.draft);this.dirty=false;this.busy=false;await this.render();ui.notifications.info('Sector saved.');return;}
    if(which==='journal'){this.journal?.sheet?.render(true);return;}
    if(which==='delete'){if(!await foundry.applications.api.DialogV2.confirm({window:{title:'Delete Sector'},content:`Permanently delete the Journal Entry for ${escapeHTML(this.journal.name)}? This cannot be undone.`}))return;await this.journal.delete();this.sectorId=null;this.draft=null;this.dirty=false;await this.render();return;}
  }catch(err){this.busy=false;console.error(`${MOD} |`,err);ui.notifications.error(`Sector Manager: ${err.message}`);}}
}
let app;
Hooks.once('ready',()=>{
  game.myzSectorManager={
    open:async(id=null)=>{
      if(!game.user.isGM){ui.notifications.warn('GM access only.');return;}
      if(app?.rendered){if(id && id!==app.sectorId)await app.navigate(id);app.bringToFront();return app;}
      app=new SectorManager({sectorId:id});
      if(id && app.journal)app.draft=normalize(app.journal.getFlag(MOD,KEY));
      await app.render(true);return app;
    },
    getSector:(journalId)=>{if(!game.user.isGM)return null;const j=game.journal.get(journalId);return j?.getFlag(MOD,KEY)??null;}
  };
  console.info(`${MOD} | Ready. Run game.myzSectorManager.open() from a Script Macro.`);
});
