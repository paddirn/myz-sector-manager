// Optional layout/interaction smoke test: requires Playwright and Chromium.
// This models the documented ApplicationV2 content slot and native APIs;
// it does not load Foundry or prove live v14 integration.
const {chromium}=require('playwright');
const {readFileSync,existsSync}=require('node:fs');
const assert=require('node:assert/strict');
const http=require('node:http');
const path=require('node:path');

(async()=>{
  const executablePath=process.env.MYZ_CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
  const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox']});
  const root=path.resolve(__dirname,'..');
  const server=http.createServer((request,response)=>{
    const file=path.resolve(root,'.'+decodeURIComponent(request.url));
    if(!file.startsWith(root+'/scripts/')){response.writeHead(200,{'Content-Type':'text/html'});response.end('<html></html>');return;}
    try{response.writeHead(200,{'Content-Type':'text/javascript'});response.end(readFileSync(file));}catch{response.writeHead(404);response.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  try{
    const page=await browser.newPage({viewport:{width:1400,height:900}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin);
    await page.setContent(`<style>
      *{box-sizing:border-box}body{margin:0;font:14px Arial}
      .application{z-index:10;display:flex;flex-direction:column;position:absolute;left:20px;top:20px;width:1100px;height:480px;border:1px solid #888;background:#fff}
      .window-header{height:32px;flex-shrink:0}.window-content{flex:1;overflow:auto;padding:8px}
      button{cursor:pointer}textarea{font:inherit}input,select{height:28px}input[type=checkbox]{height:16px}
    </style>`);
    await page.addScriptTag({content:`
      let ready;const initCallbacks=[];let identity=0;const hookCallbacks=new Map();globalThis.notifyErrors=[];
      globalThis.nativeClicks=[];
      class ApplicationV2 {
        constructor(options={}){this.options=options;this.rendered=false;}
        async _onRender(){}
        async _onClose(){}
        async render(){
          if(!this.element){
            this.element=document.createElement('div');this.element.className='application '+this.constructor.DEFAULT_OPTIONS.classes.join(' ');this.element.id=this.constructor.DEFAULT_OPTIONS.id;this.element.style.width=this.constructor.DEFAULT_OPTIONS.position.width+'px';this.element.style.height=this.constructor.DEFAULT_OPTIONS.position.height+'px';
            this.element.innerHTML='<header class="window-header">Test ApplicationV2 frame</header><section class="window-content"></section>';
            document.body.append(this.element);
          }
          this._replaceHTML(await this._renderHTML(),this.element.querySelector('.window-content'));
          this.rendered=true;await this._onRender({},{});return this;
        }
        bringToFront(){}
        async close(){await this._onClose({});this.element.remove();this.rendered=false;}
      }
      globalThis.docs=new Map();
      for(const [uuid,name,type] of [['Scene.one','The Zone','Scene'],['Actor.one','Zone Ghoul','Actor'],['Item.one','Artifact','Item'],['JournalEntry.wind','Rot Wind','JournalEntry'],['JournalEntry.ruin','Hospital','JournalEntry'],['Compendium.world.items.Item.one','Compendium Artifact','Item']]){
        docs.set(uuid,{uuid,name,documentName:type,_onClickDocumentLink:async()=>nativeClicks.push(uuid)});
      }
      const editor={
        getDragEventData:event=>JSON.parse(event.dataTransfer.getData('text/plain')||'{}'),
        enrichHTML:async text=>{
          const uuid=text.slice(6,-1),doc=docs.get(uuid);
          const a=document.createElement('a');a.className='content-link';a.dataset.uuid=uuid;a.textContent=doc.name;
          const i=document.createElement('i');i.className='fa-solid fa-file';a.prepend(i);return a.outerHTML;
        }
      };
      globalThis.foundry={utils:{deepClone:value=>structuredClone(value),randomID:()=> 'identity'+(++identity)},applications:{api:{ApplicationV2,DialogV2:{confirm:async()=>true}},ux:{TextEditor:{implementation:editor}}}};
      globalThis.Hooks={once:(name,callback)=>{if(name==='ready')ready=callback;else initCallbacks.push(callback);},on:(name,callback)=>{if(!hookCallbacks.has(name))hookCallbacks.set(name,new Map());const id=++identity;hookCallbacks.get(name).set(id,callback);return id;},off:(name,id)=>hookCallbacks.get(name)?.delete(id),call:(name,...args)=>{for(const callback of hookCallbacks.get(name)?.values()||[])callback(...args);}};
      globalThis.fromUuid=async uuid=>docs.get(uuid);
      globalThis.ui={notifications:{info(){},warn(){},error:message=>notifyErrors.push(message)}};
      const data={version:1,nameOverride:false,code:'A2',status:'Explored',terrain:'Forest',rot:0,description:'Long description',notes:'GM notes',supplies:{cleanGrub:{quantity:2.75,collected:true}}};
      for(const key of ['locations','encounters','loot','effects','secrets','history'])data[key]=Array.from({length:20},(_,i)=>({title:'Entry '+(i+1),details:'Existing notes '+i,uuid:key==='locations'?'Scene.one':key==='encounters'?'Actor.one':key==='loot'?'Item.one':''}));
      globalThis.records=Array.from({length:70},(_,i)=>({id:'sector'+i,name:i===1?'A very long sector name that must wrap rather than being clipped':'Sector '+i,flags:structuredClone({...data,code:'A'+(i+1)}),getFlag(mod,key){return key==='sector'?this.flags:undefined;},async update(update){Object.assign(this,update);if(update['flags.myz-sector-manager.sector'])this.flags=structuredClone(update['flags.myz-sector-manager.sector']);},async setFlag(mod,key,flags){this.flags=structuredClone(flags);}}));
      records.get=id=>records.find(j=>j.id===id);
      const settings=new Map(),settingOptions=new Map();
      const journalFolders=[];globalThis.Folder={create:async data=>{const folder={...data,id:'folder'+journalFolders.length};journalFolders.push(folder);return folder;}};
      globalThis.game={folders:journalFolders,keybindings:{actions:new Map([['core.undo',{editable:[{key:'KeyZ',modifiers:['Control']}],reservedModifiers:['Shift']}]]),bindings:new Map(),register(module,id,options){this.actions.set(module+'.'+id,options);this.bindings.set(module+'.'+id,options.editable);},get(module,id){return this.bindings.get(module+'.'+id)||[];}},journal:records,user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}},scenes:new Map(),settings:{register:(mod,key,options)=>{settingOptions.set(key,options);if(!settings.has(key))settings.set(key,options.default);},get:(mod,key)=>settings.get(key),set:async(mod,key,value)=>{settings.set(key,value);settingOptions.get(key)?.onChange?.(value);}}};
      globalThis.JournalEntry={create:async data=>{
        const doc={id:'created'+(++identity),name:data.name,ownership:data.ownership,value:data.flags||{},getFlag(mod,key){return this.value[mod]?.[key];},async setFlag(mod,key,value){this.value[mod]??={};this.value[mod][key]=structuredClone(value);Hooks.call('updateJournalEntry',this);},async update(update){if(update.name)this.name=update.name;if(update.folder)this.folder=update.folder;if(update['flags.myz-sector-manager.sector']){this.value['myz-sector-manager'].sector=structuredClone(update['flags.myz-sector-manager.sector']);}Hooks.call('updateJournalEntry',this);}};
        records.push(doc);Hooks.call('createJournalEntry',doc);return doc;
      }};
      class Container{constructor(){this.children=[];}addChild(child){this.children.push(child);child.parent=this;return child;}removeChild(child){this.children=this.children.filter(item=>item!==child);child.parent=null;}destroy(){this.destroyed=true;for(const child of this.children)child.destroy?.();}}
      class Graphics extends Container{clear(){return this;}drawCircle(){return this;}lineStyle(){return this;}moveTo(){return this;}lineTo(){return this;}beginFill(){return this;}drawRect(){return this;}endFill(){return this;}}
      class Text extends Container{constructor(){super();this.position={set(){}};}}
      globalThis.PIXI={Container,Graphics,Text,Point:class{constructor(x,y){this.x=x;this.y=y;}}};
      const board=document.createElement('canvas');board.width=1400;board.height=900;board.style.cssText='position:fixed;left:0;top:0;width:1400px;height:900px';document.body.prepend(board);
      const stage=new Container();stage.zoom=1;stage.pan={x:0,y:0};stage.toLocal=point=>({x:(point.x-stage.pan.x)/stage.zoom,y:(point.y-stage.pan.y)/stage.zoom});
      globalThis.lastPan=null;globalThis.canvas={animatePan:async point=>{lastPan=point;},ready:false,scene:null,stage,app:{view:board,screen:{width:1400,height:900}}};
      for(const id of ['zone','combat']){
        const scene={id,name:id==='zone'?'Zone Map':'Combat Map',width:6000,height:6000,grid:{size:100},dimensions:{sceneRect:{x:0,y:0,width:6000,height:6000}},tokens:new Map(),async view(){if(canvas.ready)Hooks.call('canvasTearDown');canvas.ready=true;canvas.scene=this;Hooks.call('canvasReady');}};
        for(const [tokenId,name,x] of [['ark','Ark marker',10],['party','Expedition marker',600]])scene.tokens.set(tokenId,{id:tokenId,name,x,y:10,width:1,height:1,texture:{src:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'},parent:scene});
        game.scenes.set(id,scene);
      }
      globalThis.zoneState=()=>records.get(game.settings.get('myz-sector-manager','zoneConfigurationId'))?.getFlag('myz-sector-manager','zoneConfiguration');
    `});
    await page.addScriptTag({type:'module',url:origin+'/scripts/sector-manager.mjs'});
    await page.evaluate(async()=>{for(const callback of initCallbacks)callback();ready();globalThis.manager=await game.myzSectorManager.open('sector1');manager.element.style.width='1100px';manager.element.style.height='480px';});

    for(const tab of ['Overview','Find the Path','Locations','Encounters','Loot','Effects','Secrets','History']){
      await page.locator(`[data-tab="${tab}"]`).click();
      await page.waitForFunction(tab=>manager.tab===tab,tab);
      await page.locator('.sm-content').hover();await page.mouse.wheel(0,400);
      await page.waitForFunction(()=>document.querySelector('.sm-content').scrollTop>0);
      const geometry=await page.evaluate(()=>{
        const frame=manager.element.getBoundingClientRect(),tabs=manager.element.querySelector('.sm-tabs').getBoundingClientRect(),footer=manager.element.querySelector('.sm-footer').getBoundingClientRect();
        return {tabsInFrame:tabs.top>=frame.top&&tabs.bottom<=frame.bottom,footerInFrame:footer.bottom<=frame.bottom};
      });
      assert(geometry.tabsInFrame&&geometry.footerInFrame,`${tab}: tabs/footer remain visible`);
    }
    console.log('Mouse wheel works across all eight tabs; navigation/footer stay visible');
    const contentScroll=await page.locator('.sm-content').evaluate(el=>el.scrollTop);
    await page.locator('.sm-list').hover();await page.mouse.wheel(0,500);
    await page.waitForFunction(()=>document.querySelector('.sm-list').scrollTop>0);
    assert.equal(await page.locator('.sm-content').evaluate(el=>el.scrollTop),contentScroll);
    await page.evaluate(()=>{manager.element.querySelector('.sm-list').scrollTop=0;});
    const sidebar=await page.locator('[data-open="sector1"]').evaluate(el=>{
      const meta=el.querySelector('.sm-sector-meta');return {metaHeight:meta.getBoundingClientRect().height,strongY:meta.querySelector('strong').getBoundingClientRect().y,smallY:meta.querySelector('small').getBoundingClientRect().y,buttonHeight:el.getBoundingClientRect().height};
    });
    assert(Math.abs(sidebar.strongY-sidebar.smallY)<6);assert(sidebar.buttonHeight>0);
    console.log('Sidebar scrolls independently; coordinate/status share a line and long names wrap');

    await page.locator('[data-tab="Loot"]').click();await page.waitForSelector('.sm-consumables');
    const consumableRatio=()=>page.locator('.sm-consumables').evaluate(el=>el.getBoundingClientRect().width/el.closest('.sm-content').clientWidth);
    const wide=await consumableRatio();assert(wide>.85);
    assert.equal(await page.locator('[data-consumables-toggle]').getAttribute('aria-expanded'),'false');await page.locator('[data-consumables-toggle]').click();
    const tables=await page.locator('.sm-supplies').evaluateAll(items=>items.map(el=>({left:el.getBoundingClientRect().left,top:el.getBoundingClientRect().top})));assert(tables[1].left>tables[0].left);assert.equal(tables[0].top,tables[1].top);
    assert.equal(await page.locator('[name="supplies.cleanGrub.quantity"]').inputValue(),'2.75');
    assert(await page.locator('[name="supplies.cleanGrub.collected"]').isChecked());
    assert.equal(await page.locator('[name="supplies.cleanGrub.quantity"]').evaluate(el=>Math.round(el.getBoundingClientRect().width)),38);
    const grub=page.locator('[data-supply="cleanGrub"]'),collected=page.locator('[name="supplies.cleanGrub.collected"]');
    await collected.uncheck();assert(await grub.evaluate(el=>el.classList.contains('is-available')));
    await collected.check();assert.equal(await page.locator('[data-consumables-toggle]').getAttribute('aria-expanded'),'false');
    await page.locator('[data-consumables-toggle]').click();assert.equal(await page.locator('[data-consumables-toggle]').getAttribute('aria-expanded'),'true');
    await collected.uncheck();await page.locator('[name="supplies.cleanGrub.quantity"]').fill('0');assert.equal(await page.locator('[data-consumables-toggle]').getAttribute('aria-expanded'),'false');assert.equal(await grub.evaluate(el=>el.classList.contains('is-available')),false);
    await page.locator('[data-consumables-toggle]').click();await page.locator('[name="supplies.cleanGrub.quantity"]').fill('2.75');assert(await grub.evaluate(el=>el.classList.contains('is-available')));await collected.check();await page.locator('[data-consumables-toggle]').click();
    await page.evaluate(()=>{manager.element.style.width='600px';manager.element.style.height='360px';});
    await page.waitForFunction(()=>document.querySelector('.sm-consumables').getBoundingClientRect().width>document.querySelector('.sm-content').clientWidth*.85);
    assert(await consumableRatio()>.85);
    assert(await page.locator('.sm-content').evaluate(el=>el.scrollWidth<=el.clientWidth));
    const narrowTables=await page.locator('.sm-supplies').evaluateAll(items=>items.map(el=>({left:el.getBoundingClientRect().left,top:el.getBoundingClientRect().top})));assert.equal(narrowTables[0].left,narrowTables[1].left);assert(narrowTables[1].top>narrowTables[0].top);
    console.log('Consumables columns stack; highlighting, automatic collapse, manual overrides and original values pass');
    await page.evaluate(()=>{manager.element.style.width='1100px';manager.element.style.height='480px';});

    await page.locator('[data-tab="Locations"]').click();await page.waitForSelector('.sm-entry');
    const first=page.locator('.sm-entry').nth(0), second=page.locator('.sm-entry').nth(1);
    const firstId=await first.getAttribute('data-entry');
    await first.locator('input[name$=".title"]').fill('Unsaved edited factory');
    await first.locator('[data-entry-toggle]').click();
    assert.equal(await first.locator('[data-entry-toggle]').getAttribute('aria-expanded'),'false');
    assert(await first.locator('.sm-entry-body').isHidden());assert(await second.locator('.sm-entry-body').isVisible());
    await first.locator('[data-entry-toggle]').focus();await page.keyboard.press('Enter');
    assert.equal(await first.locator('[data-entry-toggle]').getAttribute('aria-expanded'),'true');
    assert.equal(await first.locator('input[name$=".title"]').inputValue(),'Unsaved edited factory');
    await page.locator('[data-collapse-all]').click();
    assert.equal(await page.locator('.sm-entry-body:visible').count(),0);
    await page.locator('[data-tab="Loot"]').click();await page.waitForSelector('.sm-consumables');
    assert.equal(await page.locator('.sm-entry-body:visible').count(),20);
    await page.locator('[data-tab="Locations"]').click();await page.waitForSelector('[data-collapse-all]');
    assert.equal(await page.locator('.sm-entry-body:visible').count(),0);
    await page.locator('[data-expand-all]').click();assert.equal(await page.locator('.sm-entry-body:visible').count(),20);
    assert.equal(await page.locator(`[data-entry="${firstId}"] input[name$=".title"]`).inputValue(),'Unsaved edited factory');
    console.log('Independent keyboard collapse and tab-scoped bulk controls preserve unsaved edits');

    const zone=first.locator('[data-reference]');
    await zone.locator('a.content-link').click();await page.waitForFunction(()=>nativeClicks.includes('Scene.one'));
    await zone.locator('a.content-link').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>nativeClicks.length===2);
    await zone.locator('[data-reference-clear]').click();assert.equal(await zone.locator('input').inputValue(),'');
    await zone.evaluate(el=>{const transfer=new DataTransfer();transfer.setData('text/plain',JSON.stringify({type:'Scene',uuid:'Scene.one'}));el.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));});
    await page.waitForFunction(()=>document.querySelector('[data-reference] input').value==='Scene.one');
    await zone.locator('a.content-link').waitFor();
    await page.evaluate(async()=>{docs.delete('Scene.one');await manager.render();});
    assert.match(await page.locator('[data-reference-link]').first().innerText(),/Missing reference/);
    assert.equal(await page.locator('[data-reference] input').first().inputValue(),'Scene.one');
    console.log('Enriched links support mouse/keyboard opening, removal, native drag payloads, and missing-document display');

    await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.dirty);
    const saved=await page.evaluate(()=>records.get('sector1').flags);
    assert.equal(saved.supplies.cleanGrub.quantity,2.75);assert(saved.supplies.cleanGrub.collected);
    assert.equal(saved.locations[0].title,'Unsaved edited factory');assert(!('id' in saved.locations[0]));
    await page.locator('.sm-entry').first().locator('[data-entry-toggle]').click();
    await page.evaluate(async()=>{await manager.close();globalThis.manager=await game.myzSectorManager.open('sector1');manager.tab='Locations';await manager.render();});
    assert.equal(await page.locator('.sm-entry').first().getAttribute('data-entry'),firstId);
    assert.equal(await page.locator('.sm-entry').first().locator('[data-entry-toggle]').getAttribute('aria-expanded'),'false');
    await page.locator('.sm-entry').first().locator('[data-remove]').click();
    await page.waitForFunction(()=>manager.draft.locations.length===19);
    assert.equal(await page.locator(`[data-entry="${firstId}"]`).count(),0);
    await page.locator('[data-action="add"]').click();await page.waitForFunction(()=>manager.draft.locations.length===20);
    assert.equal(await page.locator('.sm-entry').last().locator('[data-entry-toggle]').getAttribute('aria-expanded'),'true');
    console.log('Save/reopen retains data and session UI state; deletion cleans identity; new entries expand');

    await page.locator('[data-tab="Overview"]').click();
    assert.equal(await page.locator('[name="threatLevel"]').inputValue(),'1');
    await page.locator('[data-threat-step="-1"]').click();assert.equal(await page.locator('[name="threatLevel"]').inputValue(),'0');
    await page.locator('[data-threat-step="-1"]').click();assert.equal(await page.locator('[name="threatLevel"]').inputValue(),'0');
    await page.locator('[data-threat-step="1"]').click();assert.equal(await page.locator('[name="threatLevel"]').inputValue(),'1');
    for(const [value,label] of [['5','Central Zone'],['9','Unusually Dangerous Area'],['0','Fringe Zone']]){await page.locator('[name="threatLevel"]').fill(value);assert.equal(await page.locator('[data-threat-descriptor]').innerText(),label);}
    await page.locator('[name="threatLevel"]').fill('-2');await page.locator('[name="threatLevel"]').blur();assert.equal(await page.locator('[name="threatLevel"]').inputValue(),'0');
    assert.equal(await page.locator('[name="code"]').getAttribute('maxlength'),null);assert.equal(await page.locator('[name="code"]').locator('..').locator('span').innerText(),'Coordinates');
    assert.deepEqual(await page.locator('[name="rot"] option').allTextContents(),['0 - Rot Oasis','1 - Weak Rot','2 - Rot-Heavy Area','3 - Rot Hotspot']);
    assert.equal(await page.locator('[data-overview-section="mood"]').getAttribute('open'),null);
    assert.notEqual(await page.locator('[data-overview-section="description"]').getAttribute('open'),null);
    await page.locator('[data-overview-section="mood"] summary').click();await page.locator('[name="mood"]').fill('Custom mood');
    await page.locator('[data-overview-section="mood"] summary').click();await page.locator('[data-overview-section="mood"] summary').click();assert.equal(await page.locator('[name="mood"]').inputValue(),'Custom mood');
    await page.locator('[data-overview-section="description"] summary').click();assert.equal(await page.locator('[data-overview-section="mood"]').getAttribute('open'),'');
    for(const width of [1100,920,700,520]){
      await page.evaluate(width=>manager.element.style.width=width+'px',width);
      const layout=await page.locator('.sm-overview-grid').evaluate(grid=>({overflow:grid.scrollWidth>grid.clientWidth+1,boxes:[...grid.children].map(c=>({x:c.getBoundingClientRect().x,y:c.getBoundingClientRect().y,width:c.getBoundingClientRect().width}))}));
      assert.equal(layout.overflow,false);assert.equal(layout.boxes.length,6);
      if(width>=920){assert.equal(layout.boxes[0].y,layout.boxes[1].y);assert.equal(layout.boxes[1].y,layout.boxes[2].y);assert.equal(layout.boxes[3].y,layout.boxes[4].y);assert.equal(layout.boxes[4].y,layout.boxes[5].y);assert(layout.boxes[0].width>layout.boxes[1].width);assert(layout.boxes[0].width>layout.boxes[2].width);}
    }
    await page.evaluate(()=>manager.element.style.width='1100px');
    await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.dirty);
    await page.locator('[data-tab="Locations"]').click();await page.locator('[data-tab="Overview"]').click();assert.equal(await page.locator('[name="threatLevel"]').inputValue(),'0');assert.equal(await page.locator('[data-overview-section="description"]').getAttribute('open'),null);assert.equal(await page.locator('[name="description"]').inputValue(),'Long description');
    await page.locator('[data-overview-section="description"] summary').click();await page.locator('[data-tab="Locations"]').click();
    console.log('Overview zero/default Threat Level, steppers/descriptors, compact Rot/Coordinates, independent accordions and responsive three-column layout pass');

    // Search must restore all records even after a tab rerender under a filter.
    assert.equal(await page.locator('.sm-sidebar [data-action="new"]').count(),0);
    assert.equal(await page.locator('[data-action="delete"]').evaluate(el=>el.nextElementSibling.dataset.action),'new');
    await page.locator('[data-filter]').fill('A11 -');assert.equal(await page.locator('[data-open]:visible').count(),1);
    await page.locator('[data-tab="Effects"]').click();await page.waitForFunction(()=>manager.tab==='Effects');
    await page.locator('[data-filter]').fill('');assert.equal(await page.locator('[data-open]:visible').count(),70);
    await page.locator('[data-filter]').fill('not a sector');assert(await page.locator('[data-sector-empty]').isVisible());
    await page.locator('[data-filter]').fill('a2');assert(await page.locator('[data-open="sector1"]').isVisible());
    await page.locator('[data-filter]').fill('');
    const effect=page.locator('.sm-entry').first();
    await effect.locator('[data-reference]').evaluate(el=>{const transfer=new DataTransfer();transfer.setData('text/plain',JSON.stringify({type:'Actor',uuid:'Actor.one'}));el.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));});
    await effect.locator('a.content-link').waitFor();assert.equal(await effect.locator('input[name$=".uuid"]').inputValue(),'Actor.one');
    assert.equal(await effect.locator('select[name$=".category"]').inputValue(),'Weather');
    await effect.locator('[data-entry-toggle]').click();assert(await effect.locator('.sm-entry-body').isHidden());await effect.locator('[data-entry-toggle]').click();
    console.log('Sidebar search restores after rerenders; New Sector is beside Delete; Effects accepts native Actor references');
    for(const tab of ['Encounters','Effects']){
      await page.locator('[data-tab="'+tab+'"]').click();
      await page.locator('.sm-entry [data-reference]').first().evaluate(el=>{const transfer=new DataTransfer();transfer.setData('text/plain',JSON.stringify({type:'JournalEntry',uuid:'JournalEntry.wind'}));el.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));});
      await page.waitForFunction(()=>document.querySelector('.sm-entry input[name$=".uuid"]').value==='JournalEntry.wind');
      const link=page.locator('.sm-entry a.content-link').first();await link.focus();await page.keyboard.press('Enter');
      await page.waitForFunction(()=>nativeClicks.includes('JournalEntry.wind'));
    }
    console.log('Encounter and Effect Journal Entry drops and native keyboard links pass alongside existing Actor references');


    // Configure one Scene with multi-cell sectors and two different tracked tokens.
    await page.locator('.sm-zone-summary summary').click();
    await page.locator('[data-zone-config]').click();await page.waitForSelector('.zm-config');
    const dialog=page.locator('.myz-zone-configuration');
    await dialog.locator('[name="sceneId"]').selectOption('zone');
    await dialog.locator('[name="unit"]').selectOption('cells');
    await page.waitForFunction(()=>document.querySelector('.zm-config [name="width"]').value==='10');
    await dialog.locator('[name="width"]').fill('5');await dialog.locator('[name="height"]').fill('4');
    await dialog.locator('[name="arkCoordinate"]').fill('A1');
    await dialog.locator('[data-add-group]').click();await dialog.locator('[data-group]').waitFor();
    await dialog.locator('[name="group-name"]').fill('Expedition Alpha');await dialog.locator('[name="group-token"]').selectOption('party');
    await dialog.locator('.zm-actor').evaluate(el=>{const transfer=new DataTransfer();transfer.setData('text/plain',JSON.stringify({type:'Actor',uuid:'Actor.one'}));el.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));});
    await dialog.locator('.zm-actor a.content-link').waitFor();
    await dialog.locator('[data-save-zone]').click();await page.waitForFunction(()=>Boolean(zoneState()?.groups?.length));
    assert.deepEqual(await page.evaluate(()=>[zoneState().grid.width,zoneState().grid.height]),[500,400]);
    assert.equal(await page.evaluate(()=>zoneState().groups[0].actorUuid),'Actor.one');
    assert.equal(await page.evaluate(()=>records.get(game.settings.get('myz-sector-manager','zoneConfigurationId')).ownership.default),0);
    assert.equal(await page.evaluate(()=>game.myzSectorManager.zone.tracking()[1].coordinate),'B1');
    assert.equal(await page.evaluate(()=>game.myzSectorManager.zone.tracking()[1].live),false);
    await page.locator('[data-zone-view]').click();await page.waitForFunction(()=>canvas.scene?.id==='zone');
    await page.waitForFunction(()=>game.myzSectorManager.zone.tracking()[1].live);
    await page.locator('[data-zone-overlay]').click();await page.waitForFunction(()=>canvas.stage.children.some(child=>child.name==='myz-zone-overlay'));
    assert(await page.evaluate(()=>canvas.stage.children.every(child=>child.eventMode==='none'&&!child.interactiveChildren)));

    // Shortcut choice uses the loaded action registry (Ctrl+Shift+Z conflicts
    // with core undo's reserved Shift, so this fixture chooses Ctrl+Alt+Shift+Z).
    assert.deepEqual(await page.evaluate(()=>game.keybindings.get('myz-sector-manager','toggleZoneOverlay')[0].modifiers),['Control','Alt','Shift']);
    await page.evaluate(()=>game.keybindings.actions.get('myz-sector-manager.toggleZoneOverlay').onDown());
    await page.waitForFunction(()=>!zoneState().overlay.enabled);assert.equal(await page.evaluate(()=>canvas.stage.children.length),0);
    assert.match(await page.locator('[data-zone-overlay]').innerText(),/Show/);
    await page.evaluate(()=>game.keybindings.actions.get('myz-sector-manager.toggleZoneOverlay').onDown());await page.waitForFunction(()=>zoneState().overlay.enabled);
    assert.equal(await page.evaluate(()=>zoneState().arkCoordinate),'A1');
    assert.match(await page.locator('.zm-ark').innerText(),/1 sector \(1.6 km\)/);
    assert.doesNotMatch(await page.locator('.zm-group-location').innerText(),/sectors/);
    await page.locator('[data-zone-center] img').waitFor();
    const portrait=page.locator('[data-zone-center]').first();await portrait.click();
    assert.deepEqual(await page.evaluate(()=>lastPan),{x:650,y:60,duration:350});
    await page.evaluate(async()=>{await game.scenes.get('combat').view();});
    await page.locator('[data-zone-center]').first().focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>canvas.scene?.id==='zone');
    assert.deepEqual(await page.evaluate(()=>lastPan),{x:650,y:60,duration:350});
    console.log('Fixed Ark, distance row, conflict-aware shortcut synchronization, portraits and GM-local keyboard centering pass');

    await page.evaluate(async()=>{await game.scenes.get('combat').view();});
    await page.locator('[data-zone-ark]').click();await page.waitForFunction(()=>canvas.scene?.id==='zone'&&lastPan?.x===250);
    assert.deepEqual(await page.evaluate(()=>lastPan),{x:250,y:200,duration:350});
    await page.locator('[data-filter]').fill('');
    await page.locator('[data-open="sector2"]').dblclick();
    await page.waitForFunction(()=>manager.sectorId==='sector2'&&lastPan?.y===1000);
    assert.deepEqual(await page.evaluate(()=>lastPan),{x:250,y:1000,duration:350});
    await page.locator('[data-open="sector1"]').click();await page.waitForFunction(()=>manager.sectorId==='sector1');
    await page.locator('[data-tab="Find the Path"]').click();
    assert.equal(await page.locator('[name="pathStunts.safePath"]').isDisabled(),false);
    for(const name of ['pathStunts.artifact','pathStunts.halfTime','pathStunts.rush','pathStunts.saferRoute','travel.stalker','travel.rushed'])assert.equal(await page.locator(`[name="${name}"]`).isDisabled(),true);
    await page.locator('[name="pathStunts.safePath"]').check();await page.locator('[name="pathStunts.artifact"]').check();
    await page.waitForFunction(()=>records.get('sector1').getFlag('myz-sector-manager','sector').pathStunts?.artifact===true);
    await page.locator('[data-open="sector2"]').click();await page.waitForFunction(()=>manager.sectorId==='sector2');
    await page.locator('[data-tab="Find the Path"]').click();assert.equal(await page.locator('[name="pathStunts.artifact"]').isChecked(),false);
    await page.locator('[data-open="sector1"]').click();await page.waitForFunction(()=>manager.sectorId==='sector1');
    await page.locator('[data-tab="Find the Path"]').click();assert.equal(await page.locator('[name="pathStunts.artifact"]').isChecked(),true);
    await page.locator('[data-action="reset-stunts"]').click();await page.waitForFunction(()=>records.get('sector1').getFlag('myz-sector-manager','sector').pathStunts?.artifact===false);
    await page.locator('[data-tab="Overview"]').click();
    await page.locator('[name="terrain"]').fill('Custom terrain outside the tables');
    assert.equal(await page.locator('[data-open="sector1"] [data-sector-label]').innerText(),'A2 - Custom terrain outside the tables');
    await page.locator('[name="rot"]').selectOption('3');assert.equal(await page.locator('[data-icon-slot="rot"] svg').getAttribute('aria-label'),'Rot Level: 3');
    await page.locator('[name="status"]').selectOption('Scouted');assert.equal(await page.locator('[data-icon-slot="status"] svg').getAttribute('data-sector-icon'),'scouted');
    await page.locator('[name="status"]').selectOption('Explored');assert.equal(await page.locator('[data-icon-slot="status"] svg').getAttribute('data-sector-icon'),'explored');
    assert.match(await page.locator('[data-rot-exposure]').innerText(),/Localized Rot hotspot/);
    await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.dirty);
    assert.equal(await page.evaluate(()=>records.get('sector1').getFlag('myz-sector-manager','sector').rot),3);
    assert.equal(await page.evaluate(()=>records.get('sector1').getFlag('myz-sector-manager','sector').terrain),'Custom terrain outside the tables');
    console.log('Ark house and sidebar double-click center cell midpoints; single-click selection, stunt autosave/reset/isolation, custom terrain and Rot exposure pass');
    // Editable names synchronize draft labels, persist and reset to generated naming.
    await page.locator('[data-sector-name]').fill('The Last Tower');
    await page.locator('[name="code"]').fill('B7');assert.equal(await page.locator('[data-sector-name]').inputValue(),'The Last Tower');
    await page.locator('[name="code"]').fill('A2');
    await page.locator('[name="terrain"]').fill('Thick Woods');
    assert.equal(await page.locator('[data-sector-name]').inputValue(),'The Last Tower');
    assert.equal(await page.locator('[data-open="sector1"] [data-sector-label]').innerText(),'The Last Tower');
    await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.dirty);
    assert.equal(await page.evaluate(()=>records.get('sector1').name),'The Last Tower');
    await page.evaluate(async()=>{await manager.close();globalThis.manager=await game.myzSectorManager.open('sector1');});
    assert.equal(await page.locator('[data-sector-name]').inputValue(),'The Last Tower');
    await page.locator('[data-action="reset-name"]').click();
    assert.equal(await page.locator('[data-sector-name]').inputValue(),'A2 - Thick Woods');
    await page.locator('[name="terrain"]').fill('Custom terrain outside the tables');
    await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.dirty);
    await page.locator('[data-tab="Find the Path"]').click();
    assert.equal(await page.locator('[data-explore-time]').innerText(),'4 hours');
    assert.equal(await page.locator('[data-pass-time]').innerText(),'1 hour');
    await page.locator('[name="pathStunts.safePath"]').check();
    const otherBefore=await page.evaluate(()=>JSON.stringify(records.get('sector2').flags));
    assert.deepEqual(await page.locator('.sm-path h3').allTextContents(),['Find the Path Stunts','Exploration & Travel Time']);
    assert.equal(await page.locator('[name="pathStunts.saferRoute"]').count(),1);
    assert.deepEqual(await page.locator('.sm-modifier-columns > div').evaluateAll(columns=>columns.map(c=>[...c.querySelectorAll('input[type=checkbox]')].map(i=>i.name))),[['travel.rushed','travel.stalker','travel.open'],['travel.difficult','travel.night']]);
    await page.evaluate(()=>{const j=records.get('sector1'),original=j.setFlag.bind(j);globalThis.stuntWrites=0;j.setFlag=async(...args)=>{stuntWrites++;return original(...args);};});
    for(const [stunt,modifier,expected] of [['halfTime','stalker','2 hours'],['rush','rushed','1 hour']]){
      for(const source of [`pathStunts.${stunt}`,`travel.${modifier}`]){
        const before=await page.evaluate(()=>stuntWrites);
        await page.locator(`[name="${source}"]`).check();
        assert.equal(await page.locator(`[name="pathStunts.${stunt}"]`).isChecked(),true);assert.equal(await page.locator(`[name="travel.${modifier}"]`).isChecked(),true);
        assert.equal(await page.locator('[data-explore-time]').innerText(),expected);
        await page.waitForFunction(({before,stunt})=>stuntWrites===before+1&&records.get('sector1').flags.pathStunts[stunt],{before,stunt});
        await page.locator(`[name="${source}"]`).uncheck();
        assert.equal(await page.locator(`[name="pathStunts.${stunt}"]`).isChecked(),false);assert.equal(await page.locator(`[name="travel.${modifier}"]`).isChecked(),false);
        assert.equal(await page.locator('[data-explore-time]').innerText(),'4 hours');
        await page.waitForFunction(({before,stunt})=>stuntWrites===before+2&&!records.get('sector1').flags.pathStunts[stunt],{before,stunt});
      }
    }
    await page.locator('[name="pathStunts.saferRoute"]').check();
    await page.waitForFunction(()=>records.get('sector1').flags.pathStunts.saferRoute);
    await page.locator('[name="pathStunts.safePath"]').uncheck();await page.waitForFunction(()=>!records.get('sector1').flags.pathStunts.safePath);
    for(const name of ['pathStunts.artifact','pathStunts.halfTime','pathStunts.rush','pathStunts.saferRoute','travel.stalker','travel.rushed']){assert.equal(await page.locator(`[name="${name}"]`).isChecked(),false);assert.equal(await page.locator(`[name="${name}"]`).isDisabled(),true);}
    await page.locator('[name="pathStunts.safePath"]').check();await page.locator('[name="pathStunts.saferRoute"]').check();


    await page.locator('[name="travel.mode"][value="vehicle"]').check();
    await page.locator('[name="travel.rushed"]').check();await page.locator('[name="travel.stalker"]').check();await page.locator('[name="travel.open"]').check();
    assert.equal(await page.locator('[data-explore-time]').innerText(),'7.5 minutes');
    assert.equal(await page.locator('[data-pass-time]').innerText(),'30 minutes');
    await page.locator('[name="travel.difficult"]').check();assert.equal(await page.locator('[name="travel.open"]').isChecked(),false);
    await page.locator('[name="travel.difficulty"]').fill('3');assert.equal(await page.locator('[data-explore-time]').innerText(),'45 minutes');
    await page.locator('[name="travel.open"]').check();assert.equal(await page.locator('[name="travel.difficult"]').isChecked(),false);
    await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.dirty);
    await page.evaluate(async()=>{await manager.close();globalThis.manager=await game.myzSectorManager.open('sector1');manager.tab='Find the Path';await manager.render();});
    assert.equal(await page.locator('[data-explore-time]').innerText(),'7.5 minutes');
    assert.equal(await page.locator('[name="travel.difficulty"]').inputValue(),'3');
    for(const name of ['pathStunts.halfTime','pathStunts.rush','pathStunts.saferRoute','travel.rushed','travel.stalker'])assert.equal(await page.locator(`[name="${name}"]`).isChecked(),true);
    assert.equal(await page.evaluate(()=>records.get('sector1').flags.travel.rushed),undefined);
    assert.equal(await page.evaluate(()=>JSON.stringify(records.get('sector2').flags)),otherBefore);
    assert.deepEqual(await page.locator('.sm-stunt-columns > div').evaluateAll(columns=>columns.map(c=>[...c.querySelectorAll('input')].map(i=>i.name))),[['pathStunts.safePath','pathStunts.artifact','pathStunts.assessRot','pathStunts.bullets','pathStunts.grub'],['pathStunts.water','pathStunts.halfTime','pathStunts.rush','pathStunts.saferRoute']]);
    for(const width of [1100,520]){
      await page.evaluate(width=>manager.element.style.width=width+'px',width);
      for(const selector of ['.sm-stunt-columns > div','.sm-modifier-columns > div']){
      const boxes=await page.locator(selector).evaluateAll(columns=>columns.map(c=>({x:c.getBoundingClientRect().x,y:c.getBoundingClientRect().y,width:c.getBoundingClientRect().width})));
      if(width===1100){assert(boxes[1].x>boxes[0].x);assert(Math.abs(boxes[0].width-boxes[1].width)<1);}else{assert.equal(boxes[0].x,boxes[1].x);assert(boxes[1].y>boxes[0].y);}
      }
    }
    await page.evaluate(()=>manager.element.style.width='1100px');
    await page.locator('[data-tab="Overview"]').click();
    console.log('Custom names/reset, bidirectional stunt sync with one autosave per change, travel calculations, Rot Finder persistence, sector isolation and responsive stunt/modifier columns pass');


    // Generation uses fixture RollTables; these examples are not rulebook table data.
    await page.evaluate(async()=>{
      const {TABLE_UUIDS}=await import('/scripts/sector-randomizer.mjs');
      const texts={environment:'Overgrown Ruins, Ruin:Yes, Threat:Yes, Artifact:Yes',ruinsA:'Hospital',ruinsB:'Factory',rot:'Weak Rot',threatLevel:'2',threatType:'Phenomena',humanoid:'Humanoid fixture',encounter:'Wanderers',monster:'Monster fixture',phenomenon:'Fog fixture',artifact:'Artifact fixture',mood:'A distant howl',scrap:'Scrap fixture'};
      for(const [key,uuid] of Object.entries(TABLE_UUIDS))docs.set(uuid,{uuid,name:key,documentName:'RollTable',roll:async()=>({results:[{description:texts[key]}]})});
      docs.get(TABLE_UUIDS.ruinsA).roll=async()=>({results:[{documentUuid:'JournalEntry.ruin',description:'Hospital'}]});
      docs.get(TABLE_UUIDS.threatType).roll=async()=>({results:[{documentUuid:TABLE_UUIDS.phenomenon}]});
      docs.get(TABLE_UUIDS.phenomenon).roll=async()=>({results:[{documentUuid:'JournalEntry.wind',description:'Phenomenon label'}]});
      globalThis.Roll=class{constructor(formula){this.formula=formula;}async evaluate(){return {total:1,dice:[{results:this.formula==='2d6'?[{result:1,active:true},{result:6,active:true}]:[{result:1,active:true}]}]};}};
      await game.settings.set('myz-sector-manager','threatGenerationMode','core');
      globalThis.beforeRandomization=structuredClone(records.get('sector1').flags);
      foundry.applications.api.DialogV2.DEFAULT_OPTIONS={position:{width:800}};
      foundry.applications.api.DialogV2.wait=async options=>{globalThis.methodDialogOptions=options;return null;};
    });
    await page.locator('[data-action="randomize"]').click();await page.waitForFunction(()=>!manager.randomizing);
    assert.equal(await page.evaluate(()=>JSON.stringify(records.get('sector1').flags)===JSON.stringify(beforeRandomization)),true);
    await page.evaluate(()=>{foundry.applications.api.DialogV2.wait=async options=>options.buttons.find(button=>button.action==='randomize').callback(null,null,{element:{querySelector:()=>({value:'core'})}});foundry.applications.api.DialogV2.confirm=async()=>false;});
    await page.locator('[data-action="randomize"]').click();await page.waitForFunction(()=>!manager.randomizing);
    assert.equal(await page.evaluate(()=>JSON.stringify(records.get('sector1').flags)===JSON.stringify(beforeRandomization)),true);
    await page.evaluate(()=>{foundry.applications.api.DialogV2.confirm=async options=>{if(options.window?.title==='Save Randomized Sector?'){globalThis.generationPreview=options.content;globalThis.previewDialogOptions=options;}return true;};});
    await page.locator('[data-action="randomize"]').click();await page.waitForFunction(()=>!manager.randomizing&&manager.draft.randomization?.method==='core');
    assert.match(await page.evaluate(()=>generationPreview),/Threat Level: 2/);assert.match(await page.evaluate(()=>generationPreview),/Threat severity \(1s\): 1/);assert.match(await page.evaluate(()=>generationPreview),/Artifacts \(eligible 6s\): 1/);
    assert.equal(await page.evaluate(()=>manager.draft.effects.find(entry=>entry.generated?.threatCategory==='phenomenon').uuid),'JournalEntry.wind');
    assert.equal(await page.evaluate(()=>manager.draft.effects.find(entry=>entry.generated?.threatCategory==='phenomenon').title),'Rot Wind');
    assert.equal(await page.locator('[name="terrain"]').inputValue(),'Overgrown Ruins');assert.equal(await page.locator('[name="mood"]').inputValue(),'A distant howl');
    assert.equal(await page.evaluate(()=>records.get('sector1').flags.notes===beforeRandomization.notes),true);
    assert.equal(await page.evaluate(()=>manager.draft.locations.find(entry=>entry.generated).uuid),'JournalEntry.ruin');
    await page.locator('[data-tab="Locations"]').click();await page.locator('[data-reference]:has(input[value="JournalEntry.ruin"]) a').click();await page.waitForFunction(()=>nativeClicks.includes('JournalEntry.ruin'));
    assert.match(await page.evaluate(()=>generationPreview),/Components: 1/);
    await page.locator('[data-tab="Loot"]').click();
    assert.equal(await page.locator('[name="supplies.components.quantity"]').inputValue(),'1');
    const generatedIds=await page.evaluate(()=>manager.entryState('loot').entries.filter(e=>e.item.generated?.method==='core').map(e=>e.id));
    assert(generatedIds.length>0);for(const id of generatedIds)assert.equal(await page.locator(`[data-entry="${id}"] [data-entry-toggle]`).getAttribute('aria-expanded'),'false');
    await page.locator(`[data-entry="${generatedIds[0]}"] [data-entry-toggle]`).click();await page.locator('[data-tab="Overview"]').click();
    assert.equal(await page.locator('[name="threatLevel"]').inputValue(),'2');assert.equal(await page.evaluate(()=>manager.draft.randomization.numericThreatLevel),undefined);
    await page.locator('[data-tab="Loot"]').click();assert.equal(await page.locator(`[data-entry="${generatedIds[0]}"] [data-entry-toggle]`).getAttribute('aria-expanded'),'true');

    assert.equal(await page.locator('.sm-supplies tbody tr').last().locator('th').innerText(),'Components');
    assert.equal(await page.locator('.sm-supplies tbody tr').last().locator('input[type="number"]').evaluate(el=>Math.round(el.getBoundingClientRect().width)),38);
    assert.equal(await page.evaluate(()=>manager.draft.loot.some(entry=>['Clean Grub','Rot Grub','Clean Water','Rot Water','Bullets','Booze','COMPONENTS'].includes(entry.title))),false);
    await page.locator('[name="supplies.components.quantity"]').fill('2.75');await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.dirty);
    await page.evaluate(async()=>{await manager.close();globalThis.manager=await game.myzSectorManager.open('sector1');manager.element.style.width='1100px';manager.element.style.height='480px';});
    await page.locator('[data-tab="Loot"]').click();assert.equal(await page.locator('[name="supplies.components.quantity"]').inputValue(),'2.75');

    // Loot display metadata remains separate from the stored name.
    const lootCard=page.locator('.sm-entry').first();
    if(await lootCard.locator('[data-entry-toggle]').getAttribute('aria-expanded')==='false')await lootCard.locator('[data-entry-toggle]').click();
    await lootCard.locator('[name="loot.0.title"]').fill('Scrap Rifle');await lootCard.locator('[name="loot.0.quantity"]').fill('3');await lootCard.locator('[name="loot.0.type"]').selectOption('weapon');
    assert.equal(await lootCard.locator('[data-entry-title]').innerText(),'Scrap Rifle x 3 (weapon)');
    await lootCard.locator('[name="loot.0.quantity"]').fill('4');assert.equal(await lootCard.locator('[data-entry-title]').innerText(),'Scrap Rifle x 4 (weapon)');
    assert.equal(await lootCard.locator('[name="loot.0.status"]').count(),0);
    await page.evaluate(()=>{for(const [uuid,type] of [['Item.armor','armor'],['Compendium.myz.items.Item.chassis','chassis']])docs.set(uuid,{uuid,name:type,documentName:'Item',type,_onClickDocumentLink:async()=>nativeClicks.push(uuid)});});
    const dropLoot=async uuid=>lootCard.locator('[data-reference]').evaluate((el,uuid)=>{const transfer=new DataTransfer();transfer.setData('text/plain',JSON.stringify({type:'Item',uuid}));el.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));},uuid);
    await dropLoot('Item.armor');await page.waitForFunction(()=>manager.draft.loot[0].type==='armor');assert.equal(await lootCard.locator('[data-entry-title]').innerText(),'Scrap Rifle x 4 (armor)');
    await lootCard.locator('[name="loot.0.type"]').selectOption('gear');await dropLoot('Item.armor');assert.equal(await lootCard.locator('[name="loot.0.type"]').inputValue(),'gear');
    await dropLoot('Compendium.myz.items.Item.chassis');await page.waitForFunction(()=>manager.draft.loot[0].type==='chassis');
    await lootCard.locator('[name="loot.0.type"]').selectOption('artifact');
    await page.evaluate(()=>{globalThis.savedNotes=records.get('sector1').getFlag('myz-sector-manager','sector').notes;manager.draft.notes='Unrelated unsaved notes';});
    await lootCard.locator('[name="loot.0.collected"]').check();await page.waitForFunction(()=>records.get('sector1').getFlag('myz-sector-manager','sector').loot[0].collected===true);
    assert.equal(await lootCard.locator('[data-entry-toggle]').getAttribute('aria-expanded'),'false');assert.equal(await lootCard.locator('[data-entry-title]').evaluate(el=>getComputedStyle(el).textDecorationLine),'line-through');
    assert.equal(await page.evaluate(()=>records.get('sector1').flags.notes===savedNotes),true);
    await page.evaluate(async()=>{await manager.close();globalThis.manager=await game.myzSectorManager.open('sector1');manager.tab='Loot';await manager.render();});
    assert.equal(await lootCard.locator('[data-entry-title]').innerText(),'Scrap Rifle x 4 (artifact)');assert.equal(await lootCard.locator('[data-entry-toggle]').getAttribute('aria-expanded'),'false');
    await lootCard.locator('[data-entry-toggle]').focus();await page.keyboard.press('Enter');assert.equal(await lootCard.locator('[name="loot.0.collected"]').isChecked(),true);
    await lootCard.locator('[name="loot.0.collected"]').uncheck();await page.waitForFunction(()=>records.get('sector1').flags.loot[0].collected===false);
    assert.equal(await lootCard.locator('[data-entry-toggle]').getAttribute('aria-expanded'),'true');assert.equal(await lootCard.locator('[data-entry-title]').evaluate(el=>getComputedStyle(el).textDecorationLine),'none');
    assert.equal(await page.evaluate(()=>records.get('sector1').flags.loot[0].title),'Scrap Rifle');
    assert.equal(await page.evaluate(()=>records.get('sector1').flags.loot[0].uuid),'Compendium.myz.items.Item.chassis');
    console.log('Loot quantities/types, world and compendium detection, manual overrides, collection autosave/collapse/strike, reopening and keyboard reversal pass');

    await page.locator('[data-tab="Find the Path"]').click();
    for(const name of ['pathStunts.halfTime','pathStunts.rush','pathStunts.saferRoute','travel.rushed','travel.stalker'])assert.equal(await page.locator(`[name="${name}"]`).isChecked(),true);
    assert.equal(await page.locator('[data-tab="Find the Path"]').evaluate(el=>el.classList.contains('sm-tab-empty')),false);
    await page.locator('[data-action="reset-stunts"]').click();
    await page.waitForFunction(()=>!records.get('sector1').flags.pathStunts.halfTime&&!records.get('sector1').flags.pathStunts.rush);
    for(const name of ['pathStunts.halfTime','pathStunts.rush','pathStunts.saferRoute','travel.rushed','travel.stalker'])assert.equal(await page.locator(`[name="${name}"]`).isChecked(),false);
    assert.equal(await page.locator('[data-explore-time]').innerText(),'1 hour');
    assert(await page.locator('[data-tab="Find the Path"]').evaluate(el=>el.classList.contains('sm-tab-empty')));
    await page.locator('[name="pathStunts.safePath"]').check();await page.locator('[name="pathStunts.bullets"]').check();await page.waitForFunction(()=>!document.querySelector('[data-tab="Find the Path"]').classList.contains('sm-tab-empty'));
    await page.locator('[data-tab="Effects"]').click();assert.equal(await page.locator('[data-tab="Effects"]').evaluate(el=>el.classList.contains('sm-tab-empty')),false);
    await page.evaluate(async()=>{manager.draft.effects=[];await manager.render();});assert(await page.locator('[data-tab="Effects"]').evaluate(el=>el.classList.contains('sm-tab-empty')));
    await page.locator('[data-action="add"]').click();assert(await page.locator('[data-tab="Effects"]').evaluate(el=>el.classList.contains('sm-tab-empty')));
    await page.locator('[name="effects.0.title"]').fill('Meaningful effect');assert.equal(await page.locator('[data-tab="Effects"]').evaluate(el=>el.classList.contains('sm-tab-empty')),false);
    await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.dirty);
    await page.locator('[data-zone-coordinate]').first().click();await page.waitForFunction(()=>lastPan?.x===250&&lastPan?.y===600);
    assert.equal(await page.locator('.zm-selected button').first().innerText(),'A2');
    console.log('Generation cancellation/preview/persistence, preserved notes, live tab indicators, and selected-sector coordinate navigation pass');
    assert.match(await page.locator('.zm-ark .zm-original-distance').innerText(),/Party is 1 sector \(1.6 km\) from the Ark/);
    assert.match(await page.locator('.zm-ark .zm-selected').innerText(),/1 sector \(1.6 km\) from the Ark/);
    assert.match(await page.locator('.zm-positions .zm-selected').innerText(),/1 sector \(1.6 km\) from the Party/);
    await page.evaluate(()=>{const token=game.scenes.get('zone').tokens.get('party');token.x=1100;Hooks.call('updateToken',token,{x:1100});});
    await page.waitForFunction(()=>document.querySelector('.zm-ark .zm-original-distance').textContent.includes('Party is 2 sectors (3.2 km) from the Ark'));
    assert.match(await page.locator('.zm-positions .zm-selected').innerText(),/2 sectors \(3.2 km\) from the Party/);
    await page.evaluate(()=>{const token=game.scenes.get('zone').tokens.get('party');token.x=600;Hooks.call('updateToken',token,{x:600});});
    await page.waitForFunction(()=>document.querySelector('.zm-ark .zm-original-distance').textContent.includes('Party is 1 sector'));
    for(const width of [1100,920,700,520]){
      await page.evaluate(width=>{manager.element.style.width=width+'px';},width);
      const layout=await page.evaluate(()=>{
        const summary=document.querySelector('.sm-zone-summary'),ark=summary.querySelector('.zm-ark'),party=summary.querySelector('.zm-positions .zm-expedition');
        const selected=Array.from(summary.querySelectorAll('.zm-selected'));const labels=selected.map(el=>el.querySelector('span').getBoundingClientRect());
        return {overflow:summary.scrollWidth>summary.clientWidth+1,first:ark.children[1].getBoundingClientRect().width,central:ark.querySelector('.zm-original-distance').getBoundingClientRect(),labels:labels.map(rect=>({height:rect.height})),aligned:Math.abs(ark.querySelector('.zm-selected').getBoundingClientRect().left-party.querySelector('.zm-selected').getBoundingClientRect().left)<1};
      });
      assert.equal(layout.overflow,false,'tracking horizontal overflow at '+width);assert(layout.aligned);
      if(width>=920){assert(layout.first<=88);assert(layout.central.width>layout.first);assert(layout.central.height<24);assert(layout.labels.every(label=>label.height<24));}
    }
    await page.evaluate(()=>{manager.element.style.width='1100px';});
    console.log('Generated Consumables update immediately; Components decimals persist; desktop tracking distances stay on one line and narrow widths do not overflow');
    // Render the real generated dialog options/content in a simulated DialogV2 frame.
    // This verifies CSS geometry without claiming licensed Foundry dialog integration.
    for(const viewportWidth of [1400,360,280]){
      await page.setViewportSize({width:viewportWidth,height:900});
      const geometry=await page.evaluate(()=>{
        const measurements=[];
        for(const options of [methodDialogOptions,previewDialogOptions]){
          const frame=document.createElement('div');frame.className='application '+options.classes.join(' ');frame.style.cssText='left:12px;top:12px;width:'+options.position.width+'px;height:auto';
          frame.innerHTML='<header class="window-header">Randomize</header><section class="window-content"><div class="dialog-content">'+options.content+'</div><footer class="dialog-buttons"><button type="button">Cancel</button><button type="button">Confirm</button></footer></section>';
          document.body.append(frame);
          const content=frame.querySelector('.sm-randomize-content');const paragraph=document.createElement('p');paragraph.textContent='LongPreview'.repeat(4000);content.append(paragraph);
          const scroll=frame.querySelector('.dialog-content'),footer=frame.querySelector('footer');
          const select=frame.querySelector('select');if(select){select.value='core';if(select.value!=='core')throw new Error('Method dropdown unusable');}
          const rect=frame.getBoundingClientRect();measurements.push({target:options.position.width,width:rect.width,right:rect.right,bottom:rect.bottom,overflow:scroll.scrollWidth>scroll.clientWidth+1,scrollable:scroll.scrollHeight>scroll.clientHeight,buttons:footer.querySelectorAll('button').length});
          scroll.scrollTop=scroll.scrollHeight;if(scroll.scrollTop===0)throw new Error('Long preview cannot scroll');
          frame.remove();
        }
        return measurements;
      });
      for(const measurement of geometry){assert.equal(measurement.target,400);assert(measurement.width<=400);assert(measurement.right<=viewportWidth);assert(measurement.bottom<=900);assert.equal(measurement.overflow,false);assert(measurement.scrollable);assert.equal(measurement.buttons,2);}
    }
    await page.setViewportSize({width:1400,height:900});
    console.log('Origin labels update live with singular/plural wording; half-width method/preview dialogs wrap and scroll on desktop and narrow viewports');


    assert.match(await page.evaluate(()=>methodDialogOptions.content),/Threat Generation/);
    assert.match(await page.evaluate(()=>methodDialogOptions.content),/value="core" selected>Core Rulebook/);
    await page.evaluate(()=>{
      foundry.applications.api.DialogV2.wait=async options=>options.buttons.find(button=>button.action==='randomize').callback(null,null,{element:{querySelector:selector=>({value:selector.includes('threatGeneration')?'individual-d3':'core'})}});
      const prior=Roll;globalThis.Roll=class extends prior{async evaluate(){const result=await super.evaluate();if(this.formula==='1d3')result.total=3;return result;}};
    });
    await page.locator('[data-action="randomize"]').click();await page.waitForFunction(()=>!manager.randomizing&&manager.draft.randomization?.threatMode==='individual-d3');
    assert.equal(await page.evaluate(()=>manager.draft.randomization.threatCount),3);assert.equal(await page.evaluate(()=>manager.draft.randomization.artifactCount),1);assert.equal(await page.evaluate(()=>game.settings.get('myz-sector-manager','threatGenerationMode')),'individual-d3');
    assert.equal(await page.locator('[data-open="sector1"] [data-sector-label]').innerText(),'A2 - Overgrown Ruins');
    const report=await page.evaluate(()=>game.myzSectorManager.migrateJournals());assert.equal(report.updated,0);
    assert.equal(await page.evaluate(()=>game.folders.length),2);
    assert.equal(await page.evaluate(()=>records.get('sector1').folder),await page.evaluate(()=>game.folders.find(folder=>folder.name==='Sectors').id));
    console.log('Dialog threat mode reaches generator; artifacts remain fixed; migration folders and immediate standardized sidebar names pass');

    // Three clicks preview in Scene coordinates under zoom without saving.
    await page.evaluate(()=>{canvas.stage.zoom=2;canvas.stage.pan={x:100,y:100};});
    await page.locator('[data-zone-config]').click();await page.waitForSelector('.zm-config');
    await dialog.locator('[data-calibrate-grid]').click();await page.waitForSelector('.myz-zone-calibration');
    await page.mouse.click(100,780);await page.mouse.click(300,780);await page.mouse.click(100,850);
    await page.locator('[data-calibration-confirm]').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>zoneState().grid.width),500);
    await page.locator('[data-calibration-retry]').click();
    await page.mouse.click(120,780);await page.mouse.click(320,780);await page.mouse.click(120,860);
    await page.locator('[data-calibration-confirm]').click();
    await dialog.locator('[name="width"]').waitFor({state:'visible'});
    assert.equal(await dialog.locator('[name="width"]').inputValue(),'100');assert.equal(await dialog.locator('[name="height"]').inputValue(),'40');
    assert.equal(await page.evaluate(()=>zoneState().grid.width),500); // Confirm applies only to unsaved form.
    assert.equal(await page.locator('.myz-zone-calibration').count(),0);
    await dialog.locator('[data-cancel-zone]').click();
    await page.locator('[data-zone-config]').click();await page.waitForSelector('.zm-config');
    await dialog.locator('[data-calibrate-grid]').click();await page.waitForSelector('.myz-zone-calibration');
    await page.mouse.click(100,780);await page.keyboard.press('Escape');
    await dialog.locator('[name="width"]').waitFor({state:'visible'});assert.equal(await page.locator('.myz-zone-calibration').count(),0);
    assert.equal(await page.evaluate(()=>zoneState().overlay.enabled),true);assert.equal(await page.evaluate(()=>canvas.stage.children.length),1);
    await dialog.locator('[data-cancel-zone]').click();
    await page.locator('[data-zone-config]').click();await page.waitForSelector('.zm-config');
    await dialog.locator('[data-calibrate-grid]').click();await page.waitForSelector('.myz-zone-calibration');
    await page.mouse.click(100,780);await page.evaluate(async()=>{await game.scenes.get('combat').view();});
    await dialog.locator('[name="width"]').waitFor({state:'visible'});assert.equal(await page.locator('.myz-zone-calibration').count(),0);assert.equal(await page.evaluate(()=>canvas.stage.children.length),0);
    await dialog.locator('[data-cancel-zone]').click();await page.locator('[data-zone-view]').click();await page.waitForFunction(()=>canvas.scene?.id==='zone');
    console.log('Calibration preview/retry/confirm/Escape/Scene teardown restores visibility and leaves saved grid unchanged');

    // One-shot point selection uses canvas transforms, leaves normal controls alone,
    // and creates only the confirmed map cell rather than filling the whole map.
    await page.evaluate(()=>{canvas.stage.zoom=2;canvas.stage.pan={x:100,y:100};});
    await page.locator('[data-zone-config]').click();await page.waitForSelector('.zm-config');
    await dialog.locator('[data-pick-origin]').click();
    await page.mouse.click(1300,850); // outside both windows; local point is (600,375)
    assert.equal(await dialog.locator('[name="originX"]').inputValue(),'600');assert.equal(await dialog.locator('[name="originY"]').inputValue(),'375');
    await dialog.locator('[data-cancel-zone]').click(); // discard the origin preview without touching saved config
    // Pick cleanup was already one-shot; restore the configured origin and scale.
    await page.evaluate(()=>{canvas.stage.zoom=1;canvas.stage.pan={x:0,y:0};});
    await page.evaluate(()=>{foundry.applications.api.DialogV2.wait=async options=>{if(options.window.title!=='+New Sector')throw new Error('Expected New Sector dialog');if(!options.content.includes('value="C3"'))throw new Error('Coordinates not prefilled');return options.buttons.find(b=>b.action==='create').callback(null,null,{element:{querySelector:()=>({value:'C3'})}});};});
    await page.locator('[data-zone-select]').click();await page.mouse.click(1300,850); // C3: no existing record
    await page.waitForFunction(()=>manager.draft?.code==='C3');
    assert.equal(await page.evaluate(()=>records.filter(j=>j.getFlag('myz-sector-manager','sector')?.code==='C3').length),1);
    assert.equal(await page.evaluate(()=>records.filter(j=>j.getFlag('myz-sector-manager','sector')?.version===1).length),71);

    assert.equal(await page.locator('[data-action="randomize"]').isDisabled(),true);assert.equal(await page.locator('[data-action="randomize"]').getAttribute('title'),'Save this sector before randomizing.');
    await page.evaluate(async()=>{await manager.randomizeSector();const doc=manager.journal;globalThis.originalInitialUpdate=doc.update;doc.update=async()=>{throw new Error('Expected initial save failure');};});
    await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.busy);
    assert.equal(await page.locator('[data-action="randomize"]').isDisabled(),true);assert.equal(await page.evaluate(()=>manager.journal.getFlag('myz-sector-manager','sector').initialSavePending),true);
    assert.match(await page.evaluate(()=>notifyErrors.pop()),/Expected initial save failure/);
    await page.evaluate(()=>manager.journal.update=originalInitialUpdate);await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.busy&&!manager.dirty);
    assert.equal(await page.locator('[data-action="randomize"]').isDisabled(),false);
    console.log('New-sector Randomize stays blocked through programmatic attempts and failed saves; successful initial save enables it immediately');

    // Enabled overlay background clicks reuse the manager and open Overview.
    await page.evaluate(()=>{globalThis.beforeOverlaySelection=JSON.stringify(records.map(j=>({id:j.id,flags:j.flags,name:j.name})));globalThis.sameManager=manager;manager.tab='Loot';});
    await page.mouse.click(1300,850);await page.waitForFunction(()=>manager.tab==='Overview');
    assert.equal(await page.evaluate(()=>manager===sameManager),true);
    assert.equal(await page.evaluate(()=>JSON.stringify(records.map(j=>({id:j.id,flags:j.flags,name:j.name})))===beforeOverlaySelection),true);
    // Empty-square selection presents prefilled coordinates and cancellation creates nothing.
    await page.evaluate(()=>{globalThis.emptyDialogs=0;foundry.applications.api.DialogV2.wait=async options=>{if(options.window.title!=='+New Sector'||!options.content.includes('value="C2"'))throw new Error('Wrong empty-square dialog');emptyDialogs++;return null;};});
    await page.mouse.click(1300,650);await page.waitForFunction(()=>emptyDialogs===1);
    assert.equal(await page.evaluate(()=>records.some(j=>j.getFlag('myz-sector-manager','sector')?.code==='C2')),false);
    // A sector appearing while the dialog is open is selected rather than duplicated.
    await page.evaluate(()=>{foundry.applications.api.DialogV2.wait=async options=>{if(!options.content.includes('value="C2"'))throw new Error('Wrong duplicate-test dialog');records.get('sector2').flags.code='C2';return 'C2';};});
    await page.mouse.click(1300,650);await page.waitForFunction(()=>manager.draft?.code==='C2');
    assert.equal(await page.evaluate(()=>records.filter(j=>j.getFlag('myz-sector-manager','sector')?.code==='C2').length),1);
    assert.equal(await page.locator('.myz-sector-manager').count(),1);
    console.log('Overlay navigation reuses Overview without writes; empty-cell coordinates, cancellation and duplicate prevention pass');

    // Tracking operates without a Sector Manager window and never reads Combat tokens.
    await page.evaluate(async()=>{await manager.close();const token=game.scenes.get('zone').tokens.get('party');token.x=1200;Hooks.call('updateToken',token,{x:1200});});
    await page.waitForFunction(()=>zoneState().groups[0].lastKnown==='C1');
    await page.evaluate(async()=>{await game.scenes.get('combat').view();const token=game.scenes.get('combat').tokens.get('party');token.x=9000;Hooks.call('updateToken',token,{x:9000});});
    assert.equal(await page.evaluate(()=>zoneState().groups[0].lastKnown),'C1');assert.equal(await page.evaluate(()=>canvas.stage.children.length),0);
    await page.evaluate(async()=>{globalThis.manager=await game.myzSectorManager.open('sector1');});
    await page.waitForFunction(()=>document.querySelector('.zm-positions').textContent.includes('last known'));
    assert.match(await page.locator('.zm-positions').innerText(),/Expedition Alpha\s*C1/);
    await page.evaluate(async()=>{await game.scenes.get('zone').view();});await page.waitForFunction(()=>canvas.stage.children.length===1);
    await page.evaluate(()=>{const scene=game.scenes.get('zone'),token=scene.tokens.get('party');scene.tokens.delete('party');Hooks.call('deleteToken',token);});
    await page.waitForFunction(()=>zoneState().groups[0].location.status==='missing-token');
    assert.equal(await page.evaluate(()=>zoneState().groups[0].lastKnown),'C1');
    await page.evaluate(()=>{game.scenes.delete('zone');Hooks.call('deleteScene',{id:'zone'});});
    await page.waitForFunction(()=>document.querySelector('.sm-zone-summary').textContent.includes('Scene is missing'));
    assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>notifyErrors),[]);
    console.log('Zone dialog units/tokens/Actor links persist; origin picking respects zoom; confirmed map creation, overlay isolation, closed-window tracking and missing references pass');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
