// Real editor DOM and save handlers with simulated Foundry documents, not live Foundry.
const {readFileSync}=require('node:fs');
const path=require('node:path');
module.exports=async(page,assert)=>{
 const files=['normal','special','settlement'].map(type=>JSON.parse(readFileSync(path.join(__dirname,'../docs/sector-json',`example-${type}-sector.json`),'utf8')));
 files.push(JSON.parse(readFileSync(path.join(__dirname,'fixtures/sector-special-legacy-v1.json'),'utf8')));
 await page.evaluate(async files=>{
  const {deserializeSector}=await import('/scripts/portable/serialization.mjs');globalThis.phase5Ids=[];globalThis.phase5Downloads=[];globalThis.saveDataToFile=(text,mime,name)=>phase5Downloads.push({text,mime,name});
  for(const [index,file] of files.entries()){
   const sector=deserializeSector(file,{code:`H${index+1}`,sceneId:'zone'});
   const journal=await JournalEntry.create({name:sector.customName,ownership:{default:0},flags:{'myz-sector-manager':{sector}}});phase5Ids.push(journal.id);
  }
 },files);
 const covered=new Set();
 for(let index=0;index<files.length;index++){
  await page.evaluate(async index=>{await manager.navigate(phase5Ids[index]);manager.element.style.height='730px';manager.element.style.width='920px';},index);
  const type=files[index].sector.sectorType;
  const tabs=await page.locator('[data-tab]').evaluateAll(nodes=>nodes.map(n=>n.dataset.tab));
  for(const tab of tabs){
   await page.evaluate(async tab=>{manager.tab=tab;await manager.render();await manager.referenceHydration;},tab);
   const result=await page.evaluate(async()=>{
    const {SECTOR_SCHEMA}=await import('/scripts/portable/schema.mjs');
    const recognizes=(schema,parts)=>{if(!parts.length)return true;if(schema.anyOf)return schema.anyOf.some(branch=>recognizes(branch,parts));if(schema.type==='array')return /^\d+$/.test(parts[0])&&recognizes(schema.items,parts.slice(1));return !!schema.properties?.[parts[0]]&&recognizes(schema.properties[parts[0]],parts.slice(1));};
    const names=[...manager.element.querySelectorAll('.sm-content [name]')].map(el=>el.name);
    return {names,uncovered:names.filter(name=>name!=='code'&&!recognizes(SECTOR_SCHEMA,name.split('.')))};
   });assert.deepEqual(result.uncovered,[],`${type}/${tab} editable field missing from portable contract`);result.names.forEach(name=>covered.add(name.replace(/\.\d+\./g,'.[].')));
  }
  await page.locator('[data-tab="Overview"]').click();const noteName=type==='settlement'?'settlement.notes':'notes';const field=page.locator(`[name="${noteName}"]`);await field.fill(`Edited ${type} — “Écho”\n\nSecond paragraph.`);
  assert.equal(await page.evaluate(()=>manager.dirty),true);
  // Saving keeps editing context; exporting saved flags never includes the UI's scroll/collapse state.
  const sidebar=await page.locator('.sm-list').evaluate(el=>{el.scrollTop=420;return el.scrollTop;});
  await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.busy&&!manager.dirty);
  assert.equal(await page.locator('.sm-list').evaluate(el=>el.scrollTop),sidebar);
  const result=await page.evaluate(async({type,noteName})=>{
   const {exportSector}=await import('/scripts/portable/ui.mjs'),{deserializeSector,serializeSector}=await import('/scripts/portable/serialization.mjs');
   const before=JSON.stringify(manager.journal.getFlag('myz-sector-manager','sector'));const file=await exportSector(manager);
   const again=serializeSector(deserializeSector(file,{code:'A1',sceneId:'another-world'}),{moduleVersion:'0.1.36'});
   return {file,again,before,after:JSON.stringify(manager.journal.getFlag('myz-sector-manager','sector')),note:noteName.split('.').reduce((v,k)=>v[k],file.sector)};
  },{type,noteName});
  assert.equal(result.before,result.after);assert.equal(result.note,`Edited ${type} — “Écho”\n\nSecond paragraph.`);assert.deepEqual(result.again.sector,result.file.sector);assert.equal(result.file.extensions.unknown.length,0);
  if(index===3)for(const [key,count] of [['locations',5],['inhabitants',6],['gear',19],['events',6]])assert.equal(result.file.sector.special[key].length,count);
 }
 assert.equal(await page.evaluate(()=>phase5Downloads.length),4);assert(covered.size>70,`Expected broad real editable-field coverage, got ${covered.size}`);assert.deepEqual(await page.evaluate(()=>notifyErrors),[]);
 console.log(`Phase 5: real DOM field/schema audit (${covered.size} field paths), all types + synthetic legacy import/edit/save/export, cross-world round trips, source purity and sidebar scroll pass`);
};
if(require.main===module){process.env.MYZ_PHASE5_ONLY='1';require('./interface-browser.cjs');}
