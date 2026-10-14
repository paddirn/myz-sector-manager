import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../scripts/sector-manager.mjs',import.meta.url),'utf8');
function fixture(){
  const notices=[];
  const documents=new Map();
  class ApplicationV2 {async render(){return this;} }
  const context=vm.createContext({console,foundry:{utils:{deepClone:structuredClone},applications:{api:{ApplicationV2},ux:{TextEditor:{implementation:{getDragEventData:e=>e.payload}}}}},Hooks:{once(){}},game:{journal:[],user:{isGM:true}},ui:{notifications:{warn:x=>notices.push(x),error:x=>notices.push(x)}},fromUuid:async uuid=>documents.get(uuid)});
  vm.runInContext(source+'\nglobalThis.Manager=SectorManager; globalThis.normalizeSector=normalize;',context);
  return {context,app:new context.Manager(),notices,documents};
}
const journal=(id,code,name=id)=>({id,name,getFlag:()=>({version:1,code,status:'Scouted',loot:[{title:'Old artifact',uuid:'Item.old'}]})});

test('coordinates sort naturally with names as fallback and sidebar text is escaped',()=>{
  const {context,app}=fixture();
  context.game.journal=[journal('ten','A10'),journal('none','','Zed'),journal('two','A2','<Long sector>'),journal('one','A1')];
  assert.deepEqual(Array.from(app.journals,x=>x.id),['one','two','ten','none']);
  context.game.journal.get=()=>undefined;
  const html=app.build();
  assert.match(html,/<strong>A2<\/strong><small>Scouted<\/small><span>&lt;Long sector&gt;<\/span>/);
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
  let captured=0;app.capture=()=>captured++;app.element={querySelector:()=>null};
  const input={value:'Item.original'};const zone={dataset:{type:'Item'},querySelector:()=>input};
  const event={payload:{uuid:'Actor.wrong'},preventDefault(){},stopPropagation(){}};
  documents.set('Actor.wrong',{uuid:'Actor.wrong',documentName:'Actor'});
  await app.dropReference(event,zone);assert.equal(input.value,'Item.original');assert.equal(captured,0);assert.match(notices[0],/expects a Item/);
  documents.set('Item.valid',{uuid:'Item.valid',documentName:'Item'});event.payload.uuid='Item.valid';
  await app.dropReference(event,zone);assert.equal(input.value,'Item.valid');assert.equal(captured,1);assert.equal(app.dirty,true);
});

test('reference buttons open document sheets and view scenes; missing UUIDs report errors',async()=>{
  const {app,documents,notices}=fixture();let opened=0,viewed=0;
  documents.set('Item.one',{documentName:'Item',sheet:{render:async force=>{assert.equal(force,true);opened++;}}});
  documents.set('Scene.one',{documentName:'Scene',view:async()=>viewed++});
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
