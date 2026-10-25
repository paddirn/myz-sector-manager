import {parsePortable,serializeSector,exportFilename,inspectReferences,sectorCounts,MAX_BYTES} from './serialization.mjs';
import {captureDestination,assertDestination,persistImportedSector} from './persistence.mjs';
import {sectorName} from '../journal-organization.mjs';
import {escapeHTML as esc} from '../travel/model.mjs';
const styles='<style>.myz-sector-transfer{max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px)}.myz-sector-transfer .window-content{overflow:auto;min-width:0}.sm-transfer{overflow-wrap:anywhere}.sm-transfer ul{max-height:28vh;overflow:auto}.sm-transfer input{max-width:100%}</style>';
export async function exportSector(host,env=globalThis){
 if(!env.game.user.isGM||host.transferringSector)return;host.transferringSector=true;
 try{
  const journal=host.journal;if(!journal)throw new Error('Select a saved sector before exporting.');host.capture();
  if(host.dirty){
   const choice=await env.foundry.applications.api.DialogV2.wait({window:{title:'Unsaved Sector Changes'},content:'<p>Export uses persisted sector data. Save your edits first, or explicitly export the last saved version while keeping your current draft.</p>',buttons:[{action:'cancel',label:'Cancel',default:true,callback:()=>null},{action:'saved',label:'Export Last Saved Version',callback:()=> 'saved'},{action:'save',label:'Save and Export',callback:()=> 'save'}],close:()=>null,rejectClose:false});
   if(!choice)return;if(choice==='save'){await host.action('save');if(host.dirty||host.busy)throw new Error('Sector was not saved. Nothing exported.');}
  }
  await Promise.all([host.stuntWrite,host.lootWrite,host.specialWrite,host.inhabitantWrite,host.shopWrite]);
  if(!env.game.user.isGM||!host.rendered||host.journal!==journal)throw new Error('Sector selection changed. Restart export.');
  const record=journal.getFlag('myz-sector-manager','sector'),file=serializeSector(record,{moduleVersion:env.game.modules.get('myz-sector-manager')?.version,sourceName:journal.name}),filename=exportFilename(record,journal.name);
  const pretty=JSON.stringify(file,null,2),text=new TextEncoder().encode(pretty).length<=MAX_BYTES?pretty:JSON.stringify(file);
  if(typeof env.saveDataToFile==='function')env.saveDataToFile(text,'application/json',filename);
  else{const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=env.document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  env.ui.notifications.info('Sector exported successfully.');return file;
 }finally{host.transferringSector=false;}
}
export function importPreview(file,destination,existing,references,warnings){
 const missing=references.filter(reference=>!reference.resolved),counts=sectorCounts(file.sector),unknown=file.extensions?.unknown||[];
 return `${styles}<section class="sm-transfer"><h3>${esc(sectorName(file.sector))}</h3><dl><dt>Sector type</dt><dd>${esc(file.sector.sectorType)}</dd><dt>Destination Scene</dt><dd>${esc(destination.sceneName)}</dd><dt>Destination Zone coordinate</dt><dd>${esc(destination.code)}</dd><dt>Source format / schema</dt><dd>${file.formatVersion} / ${file.schemaVersion}</dd></dl><p>${existing?`Occupied by <strong>${esc(sectorName(existing))}</strong> (${esc(existing.sectorType||'normal')}). Import replaces its complete content and type; it does not merge fields.`:'Empty square: a new GM-only sector Journal will be created.'}</p><ul>${Object.entries(counts).map(([key,value])=>`<li>${esc(key)}: ${value}</li>`).join('')}</ul><h4>Missing Foundry references (${missing.length})</h4>${missing.length?`<ul>${missing.map(item=>`<li>${esc(item.path)}: ${esc(item.uuid)}${item.error?` — ${esc(item.error)}`:''}</li>`).join('')}</ul><p>UUIDs and descriptive content will be retained. No replacement documents will be created.</p>`:'<p>No missing UUIDs detected.</p>'}<h4>Compatibility warnings</h4><ul>${warnings.map(message=>`<li>${esc(message)}</li>`).join('')}${unknown.map(item=>`<li>Preserved unknown field: ${esc(item.path.join('.'))}</li>`).join('')||'<li>None.</li>'}</ul><p>File validation passed. No movement, tables, Macros or sector effects run during import.</p></section>`;
}
export async function importSector(host,runtime,env=globalThis){
 if(!env.game.user.isGM||host.transferringSector)return;host.transferringSector=true;
 try{
  const destination=captureDestination(runtime,env),check=()=>{if(!host.rendered)throw new Error('Sector Manager closed. Restart import.');return assertDestination(destination,runtime,env);};
  const file=await env.foundry.applications.api.DialogV2.wait({classes:['myz-sector-transfer'],position:{width:460},window:{title:'Import Sector'},content:`${styles}<section class="sm-transfer"><p>Import into ${esc(destination.sceneName)} · ${esc(destination.code)}. The file's original coordinates will not be used.</p><label>Local sector JSON file<input type="file" name="sectorFile" accept=".json,application/json"></label><p>Single-sector MYZ Sector Manager exports, up to 5 MiB. Nothing is changed until preview and confirmation.</p></section>`,buttons:[{action:'cancel',label:'Cancel',default:true,callback:()=>null},{action:'preview',label:'Preview',callback:(event,button,dialog)=>{const file=dialog.element.querySelector('[name="sectorFile"]').files[0];if(!file)throw new Error('Choose a local .json file.');if(!/\.json$/i.test(file.name)||file.size>MAX_BYTES)throw new Error('Choose a .json file no larger than 5 MiB.');return file;}}],close:()=>null,rejectClose:false});
  if(!file)return;
  const parsed=parsePortable(await file.text());check();
  const references=await inspectReferences(parsed.file,env);check();
  const existing=destination.journalId?env.game.journal.get(destination.journalId)?.getFlag('myz-sector-manager','sector'):null;
  const confirmed=await env.foundry.applications.api.DialogV2.wait({classes:['myz-sector-transfer'],position:{width:540},window:{title:'Sector Import Preview'},content:importPreview(parsed.file,destination,existing,references,parsed.warnings),buttons:[{action:'cancel',label:'Cancel',default:true,callback:()=>false},{action:'import',label:existing?'Continue to Replacement':'Import',callback:()=>true}],close:()=>false,rejectClose:false});
  if(!confirmed)return;check();
  if(existing&&!await env.foundry.applications.api.DialogV2.confirm({window:{title:'Replace Existing Sector'},content:`<p>Replace <strong>${esc(sectorName(existing))}</strong> (${esc(existing.sectorType||'normal')}) at ${esc(destination.code)} with <strong>${esc(sectorName(parsed.file.sector))}</strong> (${esc(parsed.file.sector.sectorType)})?</p><p>The existing content and type will be completely replaced. A recovery snapshot will be retained on the Journal. Referenced Foundry documents are not deleted.</p>`,yes:{label:'Replace Existing Sector'},no:{label:'Cancel',default:true},defaultYes:false}))return;
  if(!await host.confirmLose())return;check();
  const result=await persistImportedSector(parsed.file,destination,runtime,{replace:Boolean(existing),env});
  host.sectorId=result.journal.id;host.draft=host.loadDraft(result.sector,result.journal);host.dirty=false;host.tab='Overview';await host.render();
  env.ui.notifications.info(`Sector imported successfully at ${destination.code}${references.some(item=>!item.resolved)?'; missing UUID references were retained':''}.`);return result;
 }finally{host.transferringSector=false;}
}
