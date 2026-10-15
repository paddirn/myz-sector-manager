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
      for(const [uuid,name,type] of [['Scene.one','The Zone','Scene'],['Actor.one','Zone Ghoul','Actor'],['Item.one','Artifact','Item'],['Compendium.world.items.Item.one','Compendium Artifact','Item']]){
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
      const data={version:1,code:'A2',status:'Explored',terrain:'Forest',rot:0,description:'Long description',notes:'GM notes',supplies:{cleanGrub:{quantity:2.75,collected:true}}};
      for(const key of ['locations','encounters','loot','effects','secrets','history'])data[key]=Array.from({length:20},(_,i)=>({title:'Entry '+(i+1),details:'Existing notes '+i,uuid:key==='locations'?'Scene.one':key==='encounters'?'Actor.one':key==='loot'?'Item.one':''}));
      globalThis.records=Array.from({length:70},(_,i)=>({id:'sector'+i,name:i===1?'A very long sector name that must wrap rather than being clipped':'Sector '+i,flags:structuredClone({...data,code:'A'+(i+1)}),getFlag(mod,key){return key==='sector'?this.flags:undefined;},async update(update){this.name=update.name;},async setFlag(mod,key,flags){this.flags=structuredClone(flags);}}));
      records.get=id=>records.find(j=>j.id===id);
      const settings=new Map(),settingOptions=new Map();
      globalThis.game={keybindings:{actions:new Map([['core.undo',{editable:[{key:'KeyZ',modifiers:['Control']}],reservedModifiers:['Shift']}]]),bindings:new Map(),register(module,id,options){this.actions.set(module+'.'+id,options);this.bindings.set(module+'.'+id,options.editable);},get(module,id){return this.bindings.get(module+'.'+id)||[];}},journal:records,user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}},scenes:new Map(),settings:{register:(mod,key,options)=>{settingOptions.set(key,options);if(!settings.has(key))settings.set(key,options.default);},get:(mod,key)=>settings.get(key),set:async(mod,key,value)=>{settings.set(key,value);settingOptions.get(key)?.onChange?.(value);}}};
      globalThis.JournalEntry={create:async data=>{
        const doc={id:'created'+(++identity),name:data.name,ownership:data.ownership,value:data.flags||{},getFlag(mod,key){return this.value[mod]?.[key];},async setFlag(mod,key,value){this.value[mod]??={};this.value[mod][key]=structuredClone(value);Hooks.call('updateJournalEntry',this);},async update(update){this.name=update.name;}};
        records.push(doc);Hooks.call('createJournalEntry',doc);return doc;
      }};
      class Container{constructor(){this.children=[];}addChild(child){this.children.push(child);child.parent=this;return child;}removeChild(child){this.children=this.children.filter(item=>item!==child);child.parent=null;}destroy(){this.destroyed=true;for(const child of this.children)child.destroy?.();}}
      class Graphics extends Container{lineStyle(){return this;}moveTo(){return this;}lineTo(){return this;}beginFill(){return this;}drawRect(){return this;}endFill(){return this;}}
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
    assert(Math.abs(sidebar.strongY-sidebar.smallY)<6);assert(sidebar.metaHeight<30);assert(sidebar.buttonHeight>60);
    console.log('Sidebar scrolls independently; coordinate/status share a line and long names wrap');

    await page.locator('[data-tab="Loot"]').click();await page.waitForSelector('.sm-consumables');
    const consumableRatio=()=>page.locator('.sm-consumables').evaluate(el=>el.getBoundingClientRect().width/el.closest('.sm-content').clientWidth);
    const wide=await consumableRatio();assert(wide>.4&&wide<.55);
    assert.equal(await page.locator('[name="supplies.cleanGrub.quantity"]').inputValue(),'2.75');
    assert(await page.locator('[name="supplies.cleanGrub.collected"]').isChecked());
    assert.equal(await page.locator('[name="supplies.cleanGrub.quantity"]').evaluate(el=>Math.round(el.getBoundingClientRect().width)),38);
    await page.evaluate(()=>{manager.element.style.width='600px';manager.element.style.height='360px';});
    await page.waitForFunction(()=>document.querySelector('.sm-consumables').getBoundingClientRect().width>document.querySelector('.sm-content').clientWidth*.85);
    assert(await consumableRatio()>.85);
    assert(await page.locator('.sm-content').evaluate(el=>el.scrollWidth<=el.clientWidth));
    console.log('Consumables adapt from half to full width with 38px centered decimal inputs and preserved collected state');
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

    // Search must restore all records even after a tab rerender under a filter.
    assert.equal(await page.locator('.sm-sidebar [data-action="new"]').count(),0);
    assert.equal(await page.locator('[data-action="delete"]').evaluate(el=>el.nextElementSibling.dataset.action),'new');
    await page.locator('[data-filter]').fill('SECTOR 10');assert.equal(await page.locator('[data-open]:visible').count(),1);
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
    assert.match(await page.locator('.zm-positions').innerText(),/1 sectors \(1.6 km\)/);
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
    await page.locator('[name="pathStunts.artifact"]').check();
    await page.waitForFunction(()=>records.get('sector1').getFlag('myz-sector-manager','sector').pathStunts?.artifact===true);
    await page.locator('[data-open="sector2"]').click();await page.waitForFunction(()=>manager.sectorId==='sector2');
    await page.locator('[data-tab="Find the Path"]').click();assert.equal(await page.locator('[name="pathStunts.artifact"]').isChecked(),false);
    await page.locator('[data-open="sector1"]').click();await page.waitForFunction(()=>manager.sectorId==='sector1');
    await page.locator('[data-tab="Find the Path"]').click();assert.equal(await page.locator('[name="pathStunts.artifact"]').isChecked(),true);
    await page.locator('[data-action="reset-stunts"]').click();await page.waitForFunction(()=>records.get('sector1').getFlag('myz-sector-manager','sector').pathStunts?.artifact===false);
    await page.locator('[data-tab="Overview"]').click();
    await page.locator('[name="terrain"]').fill('Custom terrain outside the tables');
    await page.locator('[name="rot"]').selectOption('3');assert.match(await page.locator('[data-rot-exposure]').innerText(),/Localized Rot hotspot/);
    await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.dirty);
    assert.equal(await page.evaluate(()=>records.get('sector1').getFlag('myz-sector-manager','sector').rot),3);
    assert.equal(await page.evaluate(()=>records.get('sector1').getFlag('myz-sector-manager','sector').terrain),'Custom terrain outside the tables');
    console.log('Ark house and sidebar double-click center cell midpoints; single-click selection, stunt autosave/reset/isolation, custom terrain and Rot exposure pass');

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
    await page.locator('[data-zone-select]').click();await page.mouse.click(1300,850); // C3: no existing record
    await page.waitForFunction(()=>manager.draft?.code==='C3');
    assert.equal(await page.evaluate(()=>records.filter(j=>j.getFlag('myz-sector-manager','sector')?.code==='C3').length),1);
    assert.equal(await page.evaluate(()=>records.filter(j=>j.getFlag('myz-sector-manager','sector')?.version===1).length),71);

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
