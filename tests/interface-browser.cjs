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
    if(['/test-wide.svg','/test-tall.svg'].includes(request.url)){response.setHeader('Content-Type','image/svg+xml');response.end(`<svg xmlns="http://www.w3.org/2000/svg" width="${request.url.includes('wide')?600:100}" height="${request.url.includes('wide')?100:600}"><rect width="100%" height="100%" fill="orange"/></svg>`);return;}
    if(request.url==='/missing.png'){response.writeHead(404);response.end();return;}
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
      let ready;const initCallbacks=[];let identity=0;const hookCallbacks=new Map();globalThis.notifyErrors=[];globalThis.notifyWarnings=[];
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
          if(!text.startsWith('@UUID['))return text;
          const uuid=text.slice(6,-1),doc=docs.get(uuid);
          const a=document.createElement('a');a.className='content-link';a.dataset.uuid=uuid;a.textContent=doc.name;
          const i=document.createElement('i');i.className='fa-solid fa-file';a.prepend(i);return a.outerHTML;
        }
      };
      globalThis.foundry={utils:{deepClone:value=>structuredClone(value),randomID:()=> 'identity'+(++identity)},applications:{api:{ApplicationV2,DialogV2:{confirm:async()=>true}},ux:{TextEditor:{implementation:editor}}}};
      // Older workflow checks choose discard unless the focused Phase 3 suite
      // installs interactive dialogs; every assigned wait handler remains usable.
      let waitDialog=async()=>null;
      Object.defineProperty(foundry.applications.api.DialogV2,'wait',{configurable:true,get:()=>options=>options.window?.title==='Unsaved Changes'&&!globalThis.interactiveUnsaved?Promise.resolve(globalThis.unsavedChoice||'discard'):waitDialog(options),set:value=>{waitDialog=value;}});
      globalThis.Hooks={once:(name,callback)=>{if(name==='ready')ready=callback;else initCallbacks.push(callback);},on:(name,callback)=>{if(!hookCallbacks.has(name))hookCallbacks.set(name,new Map());const id=++identity;hookCallbacks.get(name).set(id,callback);return id;},off:(name,id)=>hookCallbacks.get(name)?.delete(id),call:(name,...args)=>{for(const callback of hookCallbacks.get(name)?.values()||[])callback(...args);}};
      globalThis.fromUuid=async uuid=>docs.get(uuid);
      globalThis.ui={notifications:{info(){},warn:message=>notifyWarnings.push(message),error:message=>notifyErrors.push(message)}};
      const data={version:1,nameOverride:false,code:'A2',status:'Explored',terrain:'Forest',rot:0,description:'Long description',notes:'GM notes',supplies:{cleanGrub:{quantity:2.75,collected:true}}};
      for(const key of ['locations','encounters','loot','effects','secrets','history'])data[key]=Array.from({length:20},(_,i)=>({title:'Entry '+(i+1),details:'Existing notes '+i,uuid:key==='locations'?'Scene.one':key==='encounters'?'Actor.one':key==='loot'?'Item.one':''}));
      globalThis.records=Array.from({length:70},(_,i)=>({id:'sector'+i,name:i===1?'A very long sector name that must wrap rather than being clipped':'Sector '+i,flags:structuredClone({...data,code:'A'+(i+1)}),getFlag(mod,key){return key==='sector'?this.flags:this.extraFlags?.[key];},async update(update){Object.assign(this,update);if(update['flags.myz-sector-manager.sector'])this.flags=structuredClone(update['flags.myz-sector-manager.sector']);},async setFlag(mod,key,flags){if(key==='sector')this.flags=structuredClone(flags);else{this.extraFlags??={};this.extraFlags[key]=structuredClone(flags);}}}));
      records.get=id=>records.find(j=>j.id===id);
      const settings=new Map(),settingOptions=new Map();
      const journalFolders=[];globalThis.Folder={create:async data=>{const folder={...data,id:'folder'+journalFolders.length};journalFolders.push(folder);return folder;}};
      globalThis.game={modules:new Map([['myz-sector-manager',{version:'0.1.36'}]]),folders:journalFolders,keybindings:{actions:new Map([['core.undo',{editable:[{key:'KeyZ',modifiers:['Control']}],reservedModifiers:['Shift']}]]),bindings:new Map(),register(module,id,options){this.actions.set(module+'.'+id,options);this.bindings.set(module+'.'+id,options.editable);},get(module,id){return this.bindings.get(module+'.'+id)||[];}},journal:records,user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}},scenes:new Map(),settings:{registerMenu:(mod,key,options)=>{globalThis.referenceMenu=options;},register:(mod,key,options)=>{settingOptions.set(key,options);if(!settings.has(key))settings.set(key,options.default);},get:(mod,key)=>settings.get(key),set:async(mod,key,value)=>{settings.set(key,value);settingOptions.get(key)?.onChange?.(value);}}};
      globalThis.JournalEntry={create:async data=>{
        const doc={id:'created'+(++identity),name:data.name,ownership:data.ownership,value:data.flags||{},getFlag(mod,key){return this.value[mod]?.[key];},async setFlag(mod,key,value){this.value[mod]??={};this.value[mod][key]=structuredClone(value);Hooks.call('updateJournalEntry',this);},async update(update){if(update.name)this.name=update.name;if(update.folder)this.folder=update.folder;if(update['flags.myz-sector-manager.sector']){this.value['myz-sector-manager'].sector=structuredClone(update['flags.myz-sector-manager.sector']);}Hooks.call('updateJournalEntry',this);}};
        records.push(doc);Hooks.call('createJournalEntry',doc);return doc;
      }};
      class Container{constructor(){this.children=[];}addChild(child){this.children.push(child);child.parent=this;return child;}removeChild(child){this.children=this.children.filter(item=>item!==child);child.parent=null;}destroy(){this.destroyed=true;for(const child of this.children)child.destroy?.();}}
      class Graphics extends Container{clear(){return this;}drawCircle(){return this;}lineStyle(){return this;}moveTo(){return this;}lineTo(){return this;}beginFill(){return this;}drawRect(){return this;}endFill(){return this;}}
      class Text extends Container{constructor(text,style){super();this.text=text;this.width=String(text).length*style.fontSize*.5;this.height=style.fontSize;this.scale={set:v=>{this.width*=v;this.height*=v;}};this.position={set:(x,y)=>{this.x=x;this.y=y;}};}}
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
    await page.evaluate(async()=>{for(const callback of initCallbacks)callback();const {REFERENCE_DEFINITIONS}=await import('/scripts/document-references.mjs');await game.settings.set('myz-sector-manager','documentReferences',{formatVersion:1,references:Object.fromEntries(REFERENCE_DEFINITIONS.filter(def=>def.legacyUuid).map(def=>[def.key,{mode:'custom',uuid:def.legacyUuid}])),migration:{version:1,outcomes:[]}});await game.settings.set('myz-sector-manager','travelEventsConfiguration',{enabled:false});await ready();globalThis.manager=await game.myzSectorManager.open('sector1');manager.element.style.width='1100px';manager.element.style.height='480px';});

    if(process.env.MYZ_PHASE4B_ONLY){await require('./ui-phase4b-browser.cjs')(page,assert);return;}
    if(process.env.MYZ_PHASE3_ONLY){await require('./ui-phase3-browser.cjs')(page,assert);return;}

    assert.equal(await page.locator('[data-action="new"] + [data-action="campaign-log"]').count(),1);
    assert.equal(await page.locator('[data-action="campaign-log"] + .sm-settings').count(),1);

    // Phase 2 regression: selecting a visible sector must not rebuild the sidebar at zero.
    const sidebarPosition=await page.evaluate(()=>{const list=manager.element.querySelector('.sm-list');list.scrollTop=Math.floor((list.scrollHeight-list.clientHeight)*.55);const bounds=list.getBoundingClientRect(),button=[...list.querySelectorAll('[data-open]')].find(el=>{const r=el.getBoundingClientRect();return r.top>=bounds.top&&r.bottom<=bounds.bottom&&el.dataset.open!==manager.sectorId;});return {top:list.scrollTop,id:button.dataset.open};});
    assert(sidebarPosition.top>100);await page.locator(`[data-open="${sidebarPosition.id}"]`).click();await page.waitForFunction(id=>document.querySelector(`[data-open="${id}"]`)?.classList.contains('selected'),sidebarPosition.id);assert.equal(await page.locator('.sm-list').evaluate(el=>el.scrollTop),sidebarPosition.top);
    await page.evaluate(async()=>{await manager.navigate('sector1');});

    // Capture at replacement time: scrolling during awaited reference hydration wins.
    const scrollChecks=await page.evaluate(async()=>{
      const check=(value,message)=>{if(!value)throw Error(message);};
      manager.tab='Encounters';await manager.render();
      let list=manager.element.querySelector('.sm-list');list.scrollTop=list.scrollHeight-list.clientHeight;const bottom=list.scrollTop;
      const original=fromUuid;let release;const gate=new Promise(resolve=>release=resolve);globalThis.fromUuid=async uuid=>{await gate;return original(uuid);};
      const rendering=manager.render();list.scrollTop=bottom-90;const latest=list.scrollTop;release();await rendering;globalThis.fromUuid=original;
      check(manager.element.querySelector('.sm-list').scrollTop===latest,'newest sidebar scroll during hydration');
      let content=manager.element.querySelector('.sm-content');content.scrollTop=600;const top=content.scrollTop;await manager.render();check(manager.element.querySelector('.sm-content').scrollTop===top,'ordinary editor rerender');
      const keeper=manager.scrollKeeper;const source=manager.element.querySelector('.sm-root');keeper.capture(source);const anchor=manager.element.querySelector('.sm-content [data-entry]'),wasCollapsed=anchor.classList.contains('is-collapsed');manager.setCollapsed('encounters',anchor.dataset.entry,false);check(manager.element.querySelector('.sm-content').scrollTop>0,'expand does not reset');manager.setCollapsed('encounters',anchor.dataset.entry,true);manager.setCollapsed('encounters',anchor.dataset.entry,wasCollapsed);
      await manager.action('save');check(manager.element.querySelector('.sm-content').scrollTop>0,'save preserves editor');
      manager.tab='Locations';await manager.render();check(manager.element.querySelector('.sm-list').scrollTop===latest,'tabs preserve sidebar');
      manager.tab='Overview';await manager.render();return true;
    });assert(scrollChecks);

    assert.equal(await page.evaluate(()=>typeof game.myzSectorManager.toggleCampaignSession),'function');
    await page.locator('[data-action="campaign-log"]').click();
    await page.waitForSelector('.myz-campaign-log');
    await page.evaluate(()=>game.myzSectorManager.openCampaignLog());
    assert.equal(await page.locator('.myz-campaign-log').count(),1);
    assert.equal(await page.locator('.myz-sector-manager').count(),1);
    await page.waitForFunction(()=>Boolean(game.settings.get('myz-sector-manager','campaignLogJournalId')));
    await page.evaluate(async()=>{const {applyCommand,emptyLog}=await import('/scripts/campaign/model.mjs');const doc=game.journal.get(game.settings.get('myz-sector-manager','campaignLogJournalId'));const {log}=applyCommand(emptyLog(),{action:'start',groupId:'test',durationMinutes:150},{location:()=>({groupId:'test',sceneId:'zone',tokenId:'party',coordinate:'A2'}),id:()=>foundry.utils.randomID()});await doc.setFlag('myz-sector-manager','campaignLog',log);});
    await page.waitForSelector('.sm-header-buttons .sm-log-recording');
    assert.equal(await page.locator('[data-action="campaign-log"]').getAttribute('aria-label'),'Log (recording)');
    await page.evaluate(async()=>{const {emptyLog}=await import('/scripts/campaign/model.mjs');await game.journal.get(game.settings.get('myz-sector-manager','campaignLogJournalId')).setFlag('myz-sector-manager','campaignLog',emptyLog());});
    await page.waitForFunction(()=>!document.querySelector('.sm-log-recording'));
    await page.evaluate(()=>game.myzSectorManager.openCampaignLog().then(log=>log.close()));

    for(const tab of ['Overview','Find the Path','Locations','Encounters','Loot','Effects','History']){
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
    console.log('Mouse wheel works across all seven Normal tabs; navigation/footer stay visible');
    const contentScroll=await page.locator('.sm-content').evaluate(el=>el.scrollTop);
    await page.locator('.sm-list').hover();await page.mouse.wheel(0,500);
    await page.waitForFunction(()=>document.querySelector('.sm-list').scrollTop>0);
    assert.equal(await page.locator('.sm-content').evaluate(el=>el.scrollTop),contentScroll);
    await page.evaluate(()=>{manager.element.querySelector('.sm-list').scrollTop=0;});
    const sidebar=await page.locator('[data-open="sector1"]').evaluate(el=>{
      const meta=el.querySelector('.sm-sector-meta');return {metaHeight:meta.getBoundingClientRect().height,strongY:meta.querySelector('strong').getBoundingClientRect().y,smallY:meta.querySelector('small').getBoundingClientRect().y,buttonHeight:el.getBoundingClientRect().height};
    });
    assert(sidebar.smallY>sidebar.strongY+10);assert(sidebar.buttonHeight>0);assert.match(await page.locator('[data-open="sector1"] small').innerText(),/Unexplored|Explored/);assert(!(await page.locator('[data-open="sector1"] small').innerText()).startsWith(' ·'));
    console.log('Sidebar scrolls independently; names and metadata occupy separate lines and long names wrap');

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
    await first.locator('[data-entry-toggle]').focus();await page.keyboard.press('Space');assert.equal(await first.locator('[data-entry-toggle]').getAttribute('aria-expanded'),'false');await page.keyboard.press('Space');assert.equal(await first.locator('[data-entry-toggle]').getAttribute('aria-expanded'),'true');
    await first.evaluate(card=>{const header=card.querySelector('[data-entry-header]');for(const tag of ['input','select','button','a']){const el=document.createElement(tag);el.dataset.phase1Action=tag;if(tag==='a'){el.href='#';el.textContent='Test link';el.addEventListener('click',event=>event.preventDefault());}if(tag==='button'){el.type='button';el.textContent='Test action';}header.append(el);}});
    for(const tag of ['input','select','button','a']){await first.locator(`[data-phase1-action="${tag}"]`).click();assert.equal(await first.locator('[data-entry-toggle]').getAttribute('aria-expanded'),'true');}await first.locator('[data-phase1-action]').evaluateAll(elements=>elements.forEach(el=>el.remove()));
    await first.locator('input[name$=".title"]').focus();await page.evaluate(id=>manager.setCollapsed('locations',id,true),firstId);assert.equal(await first.locator('[data-entry-toggle]').evaluate(el=>el===document.activeElement),true);await first.locator('[data-entry-toggle]').click();

    await page.locator('[data-collapse-all]').click();
    assert.equal(await page.locator('.sm-entry-body:visible').count(),0);
    await page.locator('[data-tab="Loot"]').click();await page.waitForSelector('.sm-consumables');
    assert.equal(await page.locator('.sm-entry-body:visible').count(),20);
    await page.locator('[data-tab="Locations"]').click();await page.waitForSelector('[data-collapse-all]');
    assert.equal(await page.locator('.sm-entry-body:visible').count(),0);
    await page.locator('[data-expand-all]').click();assert.equal(await page.locator('.sm-entry-body:visible').count(),20);
    assert.equal(await page.locator(`[data-entry="${firstId}"] input[name$=".title"]`).inputValue(),'Unsaved edited factory');
    console.log('Independent keyboard collapse and tab-scoped bulk controls preserve unsaved edits');

    const zone=first.locator('[data-reference]:not([data-type="Macro"])');
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
    assert.equal(await page.locator('.sm-entry').last().locator('[data-entry-toggle]').getAttribute('aria-expanded'),'false');
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
    await effect.locator('[data-reference]:not([data-type="Macro"])').evaluate(el=>{const transfer=new DataTransfer();transfer.setData('text/plain',JSON.stringify({type:'Actor',uuid:'Actor.one'}));el.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));});
    await effect.locator('a.content-link').waitFor();assert.equal(await effect.locator('input[name$=".uuid"]').inputValue(),'Actor.one');
    assert.equal(await effect.locator('select[name$=".category"]').inputValue(),'Weather');
    await effect.locator('[data-entry-toggle]').click();assert(await effect.locator('.sm-entry-body').isHidden());await effect.locator('[data-entry-toggle]').click();
    console.log('Sidebar search restores after rerenders; New Sector is beside Delete; Effects accepts native Actor references');
    await page.evaluate(()=>{for(const uuid of ['JournalEntry.world.JournalEntryPage.page','Compendium.myz.pages.JournalEntry.parent.JournalEntryPage.page'])docs.set(uuid,{uuid,name:'ACID RAIN',documentName:'JournalEntryPage',_onClickDocumentLink:async()=>nativeClicks.push(uuid)});});
    for(const tab of ['Encounters','Effects'])for(const uuid of ['JournalEntry.world.JournalEntryPage.page','Compendium.myz.pages.JournalEntry.parent.JournalEntryPage.page']){
      await page.locator('[data-tab="'+tab+'"]').click();
      await page.locator('.sm-entry [data-reference]').first().evaluate((el,uuid)=>{const transfer=new DataTransfer();transfer.setData('text/plain',JSON.stringify({type:'JournalEntryPage',uuid}));el.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));},uuid);
      await page.waitForFunction(uuid=>document.querySelector('.sm-entry input[name$=".uuid"]').value===uuid,uuid);
      await page.locator('.sm-entry a.content-link').first().click();await page.waitForFunction(uuid=>nativeClicks.includes(uuid),uuid);
    }
    for(const tab of ['Encounters','Effects']){
      await page.locator('[data-tab="'+tab+'"]').click();
      await page.locator('.sm-entry [data-reference]').first().evaluate(el=>{const transfer=new DataTransfer();transfer.setData('text/plain',JSON.stringify({type:'JournalEntry',uuid:'JournalEntry.wind'}));el.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));});
      await page.waitForFunction(()=>document.querySelector('.sm-entry input[name$=".uuid"]').value==='JournalEntry.wind');
      const link=page.locator('.sm-entry a.content-link').first();await link.focus();await page.keyboard.press('Enter');
      await page.waitForFunction(()=>nativeClicks.includes('JournalEntry.wind'));
    }
    console.log('Encounter and Effect Journal Entry drops and native keyboard links pass alongside existing Actor references');


    // Configure one Scene with multi-cell sectors and two different tracked tokens.
    await page.locator('[data-sm-settings]').click();
    if(!await page.locator('[data-sm-settings-menu]').isVisible())await page.locator('[data-sm-settings]').click();await page.locator('[data-zone-config]').click();await page.waitForSelector('.zm-config');
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
    if(!await page.locator('[data-sm-settings-menu]').isVisible())await page.locator('[data-sm-settings]').click();await page.locator('[data-zone-view]').click();await page.waitForFunction(()=>canvas.scene?.id==='zone');
    await page.waitForFunction(()=>game.myzSectorManager.zone.tracking()[1].live);
    if(!await page.locator('[data-sm-settings-menu]').isVisible())await page.locator('[data-sm-settings]').click();await page.locator('[data-zone-overlay]').click();await page.waitForFunction(()=>canvas.stage.children.some(child=>child.name==='myz-zone-overlay'));
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
    assert.equal(await page.locator('[data-open="sector1"] [data-sector-label]').innerText(),'A2 - The Last Tower');
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
      for(const [key,uuid] of Object.entries(TABLE_UUIDS))docs.set(uuid,{uuid,name:key,documentName:'RollTable',roll:async()=>({results:[{range:key==='artifact'?[111,111]:undefined,description:texts[key]}]})});
      docs.get(TABLE_UUIDS.ruinsA).roll=async()=>({results:[{documentUuid:'JournalEntry.ruin',description:'Hospital'}]});
      globalThis.artifactAttempts=0;docs.get(TABLE_UUIDS.artifact).roll=async()=>({results:[++artifactAttempts===1?{range:[643,666],documentUuid:'Item.excludedMissing'}:{range:[111,111],description:'Artifact fixture'}]});
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
    assert.equal(await page.evaluate(()=>artifactAttempts),2);
    await page.evaluate(()=>{foundry.applications.api.DialogV2.confirm=async options=>{if(options.window?.title==='Save Randomized Sector?'){globalThis.generationPreview=options.content;globalThis.previewDialogOptions=options;}return true;};});
    await page.locator('[data-action="randomize"]').click();await page.waitForFunction(()=>!manager.randomizing&&manager.draft.randomization?.method==='core');
    assert.match(await page.evaluate(()=>generationPreview),/Threat Level: 2/);assert.match(await page.evaluate(()=>generationPreview),/Threat severity \(1s\): 1/);assert.match(await page.evaluate(()=>generationPreview),/Artifacts \(eligible 6s\): 1/);
    assert.equal(await page.evaluate(()=>manager.draft.effects.find(entry=>entry.generated?.threatCategory==='phenomenon').uuid),'JournalEntry.wind');
    assert.equal(await page.evaluate(()=>manager.draft.effects.find(entry=>entry.generated?.threatCategory==='phenomenon').title),'Rot Wind');
    assert.equal(await page.locator('[name="terrain"]').inputValue(),'Overgrown Ruins');assert.equal(await page.locator('[name="mood"]').inputValue(),'A distant howl');
    assert.equal(await page.evaluate(()=>records.get('sector1').flags.notes===beforeRandomization.notes),true);
    assert.equal(await page.evaluate(()=>manager.draft.locations.find(entry=>entry.generated).uuid),'JournalEntry.ruin');
    await page.locator('[data-tab="Locations"]').click();await page.locator('.sm-entry:has(input[value="JournalEntry.ruin"]) [data-entry-toggle]').click();await page.locator('[data-reference]:has(input[value="JournalEntry.ruin"]) a').click();await page.waitForFunction(()=>nativeClicks.includes('JournalEntry.ruin'));
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
    const dropLoot=async uuid=>lootCard.locator('[data-reference]:not([data-type="Macro"])').evaluate((el,uuid)=>{const transfer=new DataTransfer();transfer.setData('text/plain',JSON.stringify({type:'Item',uuid}));el.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));},uuid);
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
    await page.locator('[data-action="add"]').click();await page.waitForFunction(()=>manager.draft.effects.length===1);assert.equal(await page.locator('[data-tab="Effects"]').evaluate(el=>el.classList.contains('sm-tab-empty')),false);await page.locator('.sm-entry [data-entry-toggle]').click();
    await page.locator('[name="effects.0.title"]').fill('Meaningful effect');assert.equal(await page.locator('[data-tab="Effects"]').evaluate(el=>el.classList.contains('sm-tab-empty')),false);
    await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.dirty);
    await page.locator('[data-zone-coordinate]').first().click();await page.waitForFunction(()=>lastPan?.x===250&&lastPan?.y===600);
    assert.equal(await page.locator('.zm-shared-selected').innerText(),'A2');assert.equal(await page.locator('[data-zone-coordinate]').count(),1);
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
        return {overflow:summary.scrollWidth>summary.clientWidth+1,first:ark.children[1].getBoundingClientRect().width,central:ark.querySelector('.zm-original-distance').getBoundingClientRect(),labels:labels.map(rect=>({height:rect.height})),shared:summary.querySelector('.zm-shared-selected').getBoundingClientRect().height,span:Math.max(...labels.map(r=>r.bottom))-Math.min(...labels.map(r=>r.top)),aligned:Math.abs(ark.querySelector('.zm-selected').getBoundingClientRect().left-party.querySelector('.zm-selected').getBoundingClientRect().left)<1};
      });
      assert.equal(layout.overflow,false,'tracking horizontal overflow at '+width);assert(layout.aligned);assert(layout.shared>=layout.span-1);
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

    // Context buttons generate actual document-backed entries, append only, and start collapsed.
    await page.evaluate(async()=>{
      const {TABLE_UUIDS}=await import('/scripts/sector-randomizer.mjs');const {EVENT_TABLES}=await import('/scripts/entry-generation.mjs');
      for(const [uuid,documentName,name] of [['Actor.context','Actor','Context Actor'],['Compendium.myz.journal.JournalEntry.context.JournalEntryPage.page','JournalEntryPage','Context Journal']])docs.set(uuid,{uuid,documentName,name,_onClickDocumentLink:async()=>nativeClicks.push(uuid)});
      globalThis.manualCategories=['phenomenon','humanoid','monster','encounter'];globalThis.contextCalls={top:0,phenomenon:0,zone:0,ark:0};
      docs.get(TABLE_UUIDS.threatType).roll=async()=>{contextCalls.top++;const category=manualCategories.shift()||'monster';return {results:[{documentUuid:TABLE_UUIDS[category],range:category==='phenomenon'?[6,6]:category==='humanoid'?[1,1]:category==='encounter'?[2,2]:[3,5]}]};};
      for(const category of ['humanoid','monster','encounter','phenomenon','ruinsA','ruinsB'])docs.get(TABLE_UUIDS[category]).roll=async()=>{if(category==='phenomenon')contextCalls.phenomenon++;return {results:[{documentUuid:['humanoid','monster'].includes(category)?'Actor.context':'Compendium.myz.journal.JournalEntry.context.JournalEntryPage.page'}]};};
      docs.get(TABLE_UUIDS.scrap).roll=async()=>({results:[{description:'Context Scrap, Quantity:3'}]});
      for(const key of ['zone','ark'])docs.set(EVENT_TABLES[key],{uuid:EVENT_TABLES[key],name:key,documentName:'RollTable',roll:async()=>{contextCalls[key]++;return {results:[{documentUuid:'Compendium.myz.journal.JournalEntry.context.JournalEntryPage.page'}]};}});
    });
    await page.locator('[data-tab="Encounters"]').click();
    for(const expected of ['Humanoid','Monster','Encounter']){
      const before=await page.evaluate(()=>manager.draft.encounters.length);await page.locator('[data-action="add"]').click();await page.waitForFunction(before=>!manager.addingEntry&&manager.draft.encounters.length===before+1,before);
      const card=page.locator('[data-entry]').filter({has:page.locator(`[name="encounters.${before}.type"]`)});assert.equal(await card.locator('[data-entry-toggle]').getAttribute('aria-expanded'),'false');await card.locator('[data-entry-toggle]').click();assert.equal(await card.locator('select[name$=".type"]').inputValue(),expected);assert.deepEqual(await card.locator('select[name$=".status"] option').allTextContents(),['Active','Resolved','Defeated','Hidden']);
    }
    assert.equal(await page.evaluate(()=>contextCalls.top),4);assert.equal(await page.evaluate(()=>contextCalls.phenomenon),0);
    const lastEncounterIndex=await page.evaluate(()=>manager.draft.encounters.length-1);await page.locator(`[name="encounters.${lastEncounterIndex}.type"]`).selectOption('Humanoid');await page.locator(`[name="encounters.${lastEncounterIndex}.status"]`).selectOption('Defeated');
    await page.locator('[data-tab="Loot"]').click();const lootBefore=await page.evaluate(()=>manager.draft.loot.length);await page.locator('[data-action="add"]').click();await page.waitForFunction(n=>manager.draft.loot.length===n+1,lootBefore);
    assert.equal(await page.locator('.sm-entry').last().locator('[data-entry-title]').innerText(),'Context Scrap x 3 (scrap)');assert.equal(await page.locator('.sm-entry').last().locator('[data-entry-toggle]').getAttribute('aria-expanded'),'false');
    await page.locator('[data-tab="Effects"]').click();const effectsBefore=await page.evaluate(()=>manager.draft.effects.length);await page.locator('[data-action="add"]').click();await page.waitForFunction(n=>manager.draft.effects.length===n+1,effectsBefore);assert.equal(await page.locator('.sm-entry').last().locator('[data-entry-title]').innerText(),'Context Journal');assert.equal(await page.evaluate(()=>contextCalls.phenomenon),1);
    await page.locator('[data-tab="History"]').click();const eventsBefore=await page.evaluate(()=>manager.draft.history.length);await page.locator('[data-action="add-event"]').click();await page.waitForFunction(n=>manager.draft.history.length===n+1,eventsBefore);assert.equal(await page.evaluate(()=>contextCalls.zone),1);assert.equal(await page.evaluate(()=>contextCalls.ark),0);
    await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.dirty);
    await page.evaluate(async()=>{await manager.close();globalThis.manager=await game.myzSectorManager.open('sector0');manager.tab='History';await manager.render();});
    const arkBefore=await page.evaluate(()=>manager.draft.history.length);await page.locator('[data-action="add-event"]').click();await page.waitForFunction(n=>manager.draft.history.length===n+1,arkBefore);assert.equal(await page.evaluate(()=>contextCalls.ark),1);
    await page.locator('[data-action="add"]').click();await page.waitForFunction(n=>manager.draft.history.length===n+2,arkBefore);assert.equal(await page.locator('.sm-entry').last().locator('[data-entry-toggle]').getAttribute('aria-expanded'),'false');
    // Save the Ark record before returning; the selected record stays stable.
    await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.dirty);
    await page.evaluate(async()=>{await manager.close();globalThis.manager=await game.myzSectorManager.open('sector1');});
    assert.equal(await page.evaluate(()=>manager.draft.encounters.at(-1).type),'Humanoid');assert.equal(await page.evaluate(()=>manager.draft.encounters.at(-1).status),'Defeated');assert.equal(await page.evaluate(()=>manager.draft.encounters.at(-1).uuid),'Compendium.myz.journal.JournalEntry.context.JournalEntryPage.page');
    // Confirm a newly generated Actor also persists through the normal save mechanism.
    // Re-add one Encounter and save it, then reopen to verify classification and UUID.
    await page.locator('[data-tab="Encounters"]').click();await page.locator('[data-action="add"]').click();await page.waitForFunction(()=>!manager.addingEntry);await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.dirty);
    await page.evaluate(async()=>{await manager.close();globalThis.manager=await game.myzSectorManager.open('sector1');manager.tab='Encounters';await manager.render();});
    assert.equal(await page.evaluate(()=>manager.draft.encounters.at(-1).uuid),'Actor.context');assert.equal(await page.evaluate(()=>manager.draft.encounters.at(-1).type),'Monster');
    await page.locator('[data-tab="Overview"]').click();await page.locator('[name="terrain"]').fill('Derelict Industries');await page.locator('[data-tab="Locations"]').click();const locationsBefore=await page.evaluate(()=>manager.draft.locations.length);await page.locator('[data-action="add"]').click();await page.waitForFunction(n=>manager.draft.locations.length===n+1,locationsBefore);assert.equal(await page.locator('.sm-entry').last().locator('[data-entry-title]').innerText(),'Context Journal');assert.equal(await page.locator('.sm-entry').last().locator('[data-entry-toggle]').getAttribute('aria-expanded'),'false');
    await page.locator('[data-tab="Overview"]').click();await page.locator('[name="terrain"]').fill('Overgrown Ruins');await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.dirty);
    await page.locator('[data-tab="Effects"]').click();
    const pageEffect=page.locator('.sm-entry').last();await pageEffect.locator('[data-entry-toggle]').click();
    await pageEffect.locator('[data-reference] a').click();
    await page.waitForFunction(()=>nativeClicks.includes('Compendium.myz.journal.JournalEntry.context.JournalEntryPage.page'));
    assert.equal(await page.evaluate(()=>manager.draft.effects.at(-1).uuid),'Compendium.myz.journal.JournalEntry.context.JournalEntryPage.page');
    console.log('Context Encounter categories, exact Status/Type controls, Scrap quantities, Effects, Ark/Zone events, collapsed entries and saved references pass');

    // Three clicks preview in Scene coordinates under zoom without saving.
    await page.evaluate(()=>{canvas.stage.zoom=2;canvas.stage.pan={x:100,y:100};});
    if(!await page.locator('[data-sm-settings-menu]').isVisible())await page.locator('[data-sm-settings]').click();await page.locator('[data-zone-config]').click();await page.waitForSelector('.zm-config');
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
    if(!await page.locator('[data-sm-settings-menu]').isVisible())await page.locator('[data-sm-settings]').click();await page.locator('[data-zone-config]').click();await page.waitForSelector('.zm-config');
    await dialog.locator('[data-calibrate-grid]').click();await page.waitForSelector('.myz-zone-calibration');
    await page.mouse.click(100,780);await page.keyboard.press('Escape');
    await dialog.locator('[name="width"]').waitFor({state:'visible'});assert.equal(await page.locator('.myz-zone-calibration').count(),0);
    assert.equal(await page.evaluate(()=>zoneState().overlay.enabled),true);assert.equal(await page.evaluate(()=>canvas.stage.children.length),1);
    await dialog.locator('[data-cancel-zone]').click();
    if(!await page.locator('[data-sm-settings-menu]').isVisible())await page.locator('[data-sm-settings]').click();await page.locator('[data-zone-config]').click();await page.waitForSelector('.zm-config');
    await dialog.locator('[data-calibrate-grid]').click();await page.waitForSelector('.myz-zone-calibration');
    await page.mouse.click(100,780);await page.evaluate(async()=>{await game.scenes.get('combat').view();});
    await dialog.locator('[name="width"]').waitFor({state:'visible'});assert.equal(await page.locator('.myz-zone-calibration').count(),0);assert.equal(await page.evaluate(()=>canvas.stage.children.length),0);
    await dialog.locator('[data-cancel-zone]').click();if(!await page.locator('[data-sm-settings-menu]').isVisible())await page.locator('[data-sm-settings]').click();await page.locator('[data-zone-view]').click();await page.waitForFunction(()=>canvas.scene?.id==='zone');
    console.log('Calibration preview/retry/confirm/Escape/Scene teardown restores visibility and leaves saved grid unchanged');

    // One-shot point selection uses canvas transforms, leaves normal controls alone,
    // and creates only the confirmed map cell rather than filling the whole map.
    await page.evaluate(()=>{canvas.stage.zoom=2;canvas.stage.pan={x:100,y:100};});
    if(!await page.locator('[data-sm-settings-menu]').isVisible())await page.locator('[data-sm-settings]').click();await page.locator('[data-zone-config]').click();await page.waitForSelector('.zm-config');
    await dialog.locator('[data-pick-origin]').click();
    await page.mouse.click(1300,850); // outside both windows; local point is (600,375)
    assert.equal(await dialog.locator('[name="originX"]').inputValue(),'600');assert.equal(await dialog.locator('[name="originY"]').inputValue(),'375');
    await dialog.locator('[data-cancel-zone]').click(); // discard the origin preview without touching saved config
    // Pick cleanup was already one-shot; restore the configured origin and scale.
    await page.evaluate(()=>{canvas.stage.zoom=1;canvas.stage.pan={x:0,y:0};});
    await page.evaluate(()=>{foundry.applications.api.DialogV2.wait=async options=>{if(options.window.title!=='Create New Sector')throw new Error('Expected New Sector dialog');if(!options.content.includes('value="C3"'))throw new Error('Coordinates not prefilled');return options.buttons.find(b=>b.action==='create').callback(null,null,{element:{querySelector:selector=>({value:selector.includes('newSectorType')?'normal':'C3'})}});};});
    if(!await page.locator('[data-sm-settings-menu]').isVisible())await page.locator('[data-sm-settings]').click();await page.locator('[data-zone-select]').click();await page.mouse.click(1300,850); // C3: no existing record
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
    await page.evaluate(()=>{globalThis.emptyDialogs=0;foundry.applications.api.DialogV2.wait=async options=>{if(options.window.title!=='Create New Sector'||!options.content.includes('value="C2"'))throw new Error('Wrong empty-square dialog');emptyDialogs++;return null;};});
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
    await page.evaluate(()=>{globalThis.lastZoneScene=game.scenes.get('zone');game.scenes.delete('zone');Hooks.call('deleteScene',{id:'zone'});});
    await page.waitForFunction(()=>document.querySelector('.sm-zone-summary').textContent.includes('Scene is missing'));
    // Author a complete Special sector, then convert it repeatedly without losing hidden data.
    await page.evaluate(()=>docs.set('Scene.one',{uuid:'Scene.one',name:'World Scene',documentName:'Scene',_onClickDocumentLink:async()=>nativeClicks.push('Scene.one')}));
    const tabs=()=>page.locator('[data-tab]').evaluateAll(nodes=>nodes.map(node=>node.dataset.tab));
    const saveSpecial=async()=>{await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.busy&&(!manager.dirty||manager.saveNote?.startsWith('Save failed')));assert.equal(await page.evaluate(()=>manager.dirty),false,JSON.stringify(await page.evaluate(()=>({note:manager.saveNote,baseline:manager.saveBaseline?.record,current:manager.journal.getFlag('myz-sector-manager','sector')}))));};
    const dropSpecial=async(zone,uuid)=>{await zone.evaluate((el,uuid)=>{const transfer=new DataTransfer();transfer.setData('text/plain',JSON.stringify({uuid}));el.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));},uuid);await page.waitForFunction(uuid=>Array.from(document.querySelectorAll('[data-reference] input')).some(input=>input.value===uuid),uuid);};
    await page.evaluate(()=>{globalThis.newDialogChecks=0;foundry.applications.api.DialogV2.wait=async options=>{if(options.window.title!=='Create New Sector')throw new Error('Wrong creation title');const element=document.createElement('div');element.innerHTML=options.content;if(element.querySelector('[name="newSectorType"]:checked').value!=='normal')throw new Error('Normal must be default');newDialogChecks++;return null;};});
    const recordsBefore=await page.evaluate(()=>records.length);await page.locator('[data-action="new"]').click();await page.waitForFunction(()=>newDialogChecks===1);assert.equal(await page.evaluate(()=>records.length),recordsBefore);
    await page.evaluate(()=>{foundry.applications.api.DialogV2.wait=async options=>{const element=document.createElement('div');element.innerHTML=options.content;element.querySelector('[name="newSectorType"][value="special"]').checked=true;element.querySelector('[name="newSectorCode"]').value='Z99';return options.buttons.find(button=>button.action==='create').callback(null,null,{element});};});
    await page.locator('[data-action="new"]').click();await page.waitForFunction(()=>manager.draft?.code==='Z99');
    const specialId=await page.evaluate(()=>manager.sectorId);
    assert.deepEqual(await tabs(),['Overview','Locations','Inhabitants','Gear & Artifacts','Events','Images','Find the Path','History']);
    assert.equal(await page.locator('[data-action="randomize"]').count(),0);assert.equal(await page.evaluate(()=>manager.draft.initialSavePending),true);
    await page.locator('[data-sector-name]').fill('The Doom Sphere');assert.equal(await page.locator('[data-sector-heading]').innerText(),'Z99 - The Doom Sphere');
    await page.locator('[name="code"]').fill('Z100');assert.equal(await page.locator('[data-sector-heading]').innerText(),'Z100 - The Doom Sphere');
    assert.equal(await page.locator(`[data-open="${specialId}"] [data-sector-label]`).innerText(),'Z100 - The Doom Sphere');
    assert(await page.locator(`[data-open="${specialId}"]`).evaluate(el=>el.classList.contains('sm-sector-special')));
    await page.locator('[name="terrain"]').fill('Custom special terrain');await page.locator('[name="rot"]').selectOption('2');await page.locator('[name="threatLevel"]').fill('0');await page.locator('[name="status"]').selectOption('Scouted');
    const longSpecialText=('Published introduction\n\nAnother paragraph with details.\n').repeat(100);
    await page.locator('[name="special.source"]').fill('Custom Adventure – Test');await page.locator('[name="special.overview"]').fill(longSpecialText);
    await dropSpecial(page.locator('[data-reference]:not([data-type="Macro"])'),'Scene.one');await page.locator('[data-reference] a').click();await page.waitForFunction(()=>nativeClicks.includes('Scene.one'));
    await page.locator('[data-reference-clear]').click();assert.equal(await page.locator('[name="special.sceneUuid"]').inputValue(),'');
    await page.evaluate(()=>{for(const [uuid,documentName,name,type] of [['Compendium.myz.scenes.Scene.special','Scene','Published Scene'],['Compendium.myz.actors.Actor.special','Actor','Published Actor'],['JournalEntry.special','JournalEntry','World event'],['JournalEntry.special.JournalEntryPage.page','JournalEntryPage','World page'],['Compendium.myz.events.JournalEntry.special.JournalEntryPage.page','JournalEntryPage','Published page']])docs.set(uuid,{uuid,documentName,name,type,_onClickDocumentLink:async()=>nativeClicks.push(uuid)});for(const type of ['armor','artifact','chassis','gear','weapon','unknown']){const uuid='Compendium.myz.gear.Item.'+type;docs.set(uuid,{uuid,documentName:'Item',name:'Published '+type,type,_onClickDocumentLink:async()=>nativeClicks.push(uuid)});}});
    await dropSpecial(page.locator('[data-reference]:not([data-type="Macro"])'),'Compendium.myz.scenes.Scene.special');
    await page.locator('[data-tab="Overview"]').click();await page.locator('[name="special.situation"]').fill('Conflict\n\nMotivations and developments');
    await page.locator('[data-tab="Inhabitants"]').click();
    for(const uuid of ['Actor.one','Compendium.myz.actors.Actor.special',null]){
      const index=await page.evaluate(()=>manager.draft.special.inhabitants.length);await page.locator('[data-action="add"]').click();const card=page.locator('[data-entry]').filter({has:page.locator(`[name="special.inhabitants.${index}.title"]`)});assert.equal(await card.locator('[data-entry-toggle]').getAttribute('aria-expanded'),'false');await card.locator('[data-entry-toggle]').click();
      if(uuid){await dropSpecial(card.locator('[data-reference]:not([data-type="Macro"])'),uuid);await page.waitForFunction(()=>manager.draft.special.inhabitants.at(-1).title.length>0);await card.locator('[data-reference] a').click();await page.waitForFunction(uuid=>nativeClicks.includes(uuid),uuid);}else{await card.locator('[name$=".title"]').fill('The Factory Workers');await card.locator('textarea').fill('A group with no Actor\n\nCustom motivations');}
    }
    await page.locator('.sm-entry').first().locator('[name$=".title"]').fill('Manual actor name');await dropSpecial(page.locator('.sm-entry').first().locator('[data-reference]:not([data-type="Macro"])'),'Compendium.myz.actors.Actor.special');assert.equal(await page.locator('.sm-entry').first().locator('[name$=".title"]').inputValue(),'Manual actor name');
    await page.locator('[data-action="add"]').click();await page.locator('[data-entry]').filter({has:page.locator('[name="special.inhabitants.3.title"]')}).locator('[data-remove]').click();await page.waitForFunction(()=>manager.draft.special.inhabitants.length===3);
    await page.locator('[data-tab="Gear & Artifacts"]').click();
    for(const type of ['armor','artifact','chassis','gear','weapon','unknown']){
      await page.locator('[data-action="add"]').click();const card=page.locator('.sm-entry').last();assert.equal(await card.locator('[data-entry-toggle]').getAttribute('aria-expanded'),'false');await card.locator('[data-entry-toggle]').click();
      await dropSpecial(card.locator('[data-reference]:not([data-type="Macro"])'),'Compendium.myz.gear.Item.'+type);await page.waitForFunction(type=>manager.draft.special.gear.at(-1).type===(type==='unknown'?'scrap':type),type);
      await card.locator('[name$=".quantity"]').fill('3');await card.locator('textarea').fill('Item notes\n\nPublished description');assert.match(await card.locator('[data-entry-title]').innerText(),new RegExp(' x 3 \\('+(type==='unknown'?'scrap':type)+'\\)'));
    }
    assert.equal(await page.locator('[name$=".collected"]').count(),0);const firstGear=page.locator('.sm-entry').first();await firstGear.locator('select').selectOption('artifact');await page.locator('[data-tab="Overview"]').click();await page.locator('[data-tab="Gear & Artifacts"]').click();assert.equal(await page.locator('.sm-entry').first().locator('select').inputValue(),'artifact');
    await page.locator('[data-tab="Events"]').click();
    for(const uuid of ['JournalEntry.special','JournalEntry.special.JournalEntryPage.page','Compendium.myz.events.JournalEntry.special.JournalEntryPage.page',null]){
      await page.locator('[data-action="add"]').click();const card=page.locator('.sm-entry').last();assert.equal(await card.locator('[data-entry-toggle]').getAttribute('aria-expanded'),'false');await card.locator('[data-entry-toggle]').click();await card.locator('[name$=".title"]').fill('Published Event');await card.locator('textarea').fill('Event description\n\nSecond paragraph');
      if(uuid){await dropSpecial(card.locator('[data-reference]:not([data-type="Macro"])'),uuid);await card.locator('[data-reference] a').click();await page.waitForFunction(uuid=>nativeClicks.includes(uuid),uuid);}
    }
    await page.locator('[data-tab="Find the Path"]').click();await page.locator('[name="pathStunts.safePath"]').check();await page.locator('[name="pathStunts.assessRot"]').check();await page.evaluate(()=>manager.stuntWrite);
    await page.locator('[data-tab="History"]').click();await page.locator('[data-action="add"]').click();await page.locator('.sm-entry').last().locator('[data-entry-toggle]').click();await page.locator('.sm-entry').last().locator('[name$=".title"]').fill('Shared visit');await saveSpecial();
    const authored=await page.evaluate(()=>structuredClone(manager.journal.getFlag('myz-sector-manager','sector')));
    await page.evaluate(async()=>{await manager.navigate('sector1');});await page.evaluate(async id=>{await manager.navigate(id);},specialId);
    assert.deepEqual(await page.evaluate(()=>manager.draft.special),authored.special);assert.equal(await page.locator('[name="special.overview"]').inputValue(),longSpecialText);
    const specialBefore=await page.evaluate(()=>JSON.stringify(manager.draft));await page.evaluate(async()=>{await manager.randomizeSector();});assert.equal(await page.evaluate(()=>JSON.stringify(manager.draft)),specialBefore);
    await page.evaluate(()=>{foundry.applications.api.DialogV2.wait=async()=>manager.draft.sectorType==='special'?'normal':'special';foundry.applications.api.DialogV2.confirm=async()=>false;});await page.locator('[data-action="change-type"]').click();assert.equal(await page.evaluate(()=>manager.draft.sectorType),'special');
    await page.evaluate(()=>{foundry.applications.api.DialogV2.confirm=async()=>true;});await page.locator('[data-tab="Events"]').click();await page.locator('[data-action="change-type"]').click();await page.waitForFunction(()=>manager.draft.sectorType==='normal');
    assert.deepEqual(await tabs(),['Overview','Locations','Encounters','Loot','Effects','Find the Path','History']);assert.equal(await page.evaluate(()=>manager.tab),'Overview');assert.equal(await page.locator(`[data-open="${specialId}"].sm-sector-special`).count(),0);
    await page.evaluate(()=>{manager.draft.description='Preserved normal description';manager.draft.secrets=[{title:'Legacy secret'}];manager.draft.locations=[{title:'Normal ruin'}];manager.draft.encounters=[{title:'Normal encounter'}];manager.draft.loot=[{title:'Normal loot',quantity:2,type:'scrap'}];manager.draft.effects=[{title:'Normal effect'}];});await saveSpecial();
    const normalContent=await page.evaluate(()=>Object.fromEntries(['description','secrets','locations','encounters','loot','effects'].map(key=>[key,structuredClone(manager.draft[key])])));
    for(const type of ['special','normal','special']){await page.locator('[data-action="change-type"]').click();await page.waitForFunction(type=>manager.draft.sectorType===type,type);await saveSpecial();assert.deepEqual(await page.evaluate(()=>manager.draft.special),authored.special);assert.deepEqual(await page.evaluate(()=>Object.fromEntries(['description','secrets','locations','encounters','loot','effects'].map(key=>[key,structuredClone(manager.draft[key])]))),normalContent);}
    assert.deepEqual(await page.evaluate(()=>manager.draft.history),authored.history);assert.deepEqual(await page.evaluate(()=>manager.draft.pathStunts),authored.pathStunts);assert.equal(await page.evaluate(()=>manager.draft.threatLevel),0);assert.equal(await page.evaluate(()=>manager.draft.code),'Z100');
    // A full window close/reopen simulates rebuilding the draft rather than reusing it.
    await page.evaluate(async()=>{await manager.close();});await page.evaluate(async id=>{globalThis.manager=await game.myzSectorManager.open(id);},specialId);assert.deepEqual(await page.evaluate(()=>manager.draft.special),authored.special);
    await page.evaluate(async()=>{manager.draft.special.sceneUuid='Scene.missing';await manager.render();});assert.match(await page.locator('[data-reference-link]').innerText(),/Missing reference/);await page.locator('[data-reference-clear]').click();await saveSpecial();
    await page.evaluate(()=>manager.element.style.width='600px');
    assert(await page.locator('.sm-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    await page.locator('[data-tab="Overview"]').click();assert.equal(await page.locator('[name="special.situation"]').getAttribute('rows'),'7');
    assert(await page.locator('.sm-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    console.log('Special creation, full authoring, world/compendium references, manual item types, multiline persistence, shared stunts/history and repeated lossless conversion pass');

    // Image assets are served by this fixture; no licensed Foundry instance is loaded.
    await page.evaluate(async()=>{
      game.scenes.set('zone',lastZoneScene);await lastZoneScene.view();manager.element.style.width='920px';
      class Picker{constructor(options){globalThis.filePickerOptions=options;}async render(){globalThis.filePickerOpens=(globalThis.filePickerOpens||0)+1;filePickerOptions.callback(globalThis.pickedImagePath);}}
      foundry.applications.apps={FilePicker:{implementation:Picker}};globalThis.pickedImagePath='/test-wide.svg';
      for(const [uuid,documentName,name,type,src] of [['Actor.drop','Actor','World drop Actor'],['Compendium.myz.actors.Actor.drop','Actor','Pack drop Actor'],['Item.drop','Item','World drop Weapon','weapon'],['Compendium.myz.items.Item.drop','Item','Pack drop Armor','armor'],['JournalEntry.images.JournalEntryPage.wide','JournalEntryPage','Wide Illustration','image','/test-wide.svg'],['Compendium.myz.images.JournalEntry.book.JournalEntryPage.tall','JournalEntryPage','Tall Illustration','image','/test-tall.svg'],['JournalEntry.images.JournalEntryPage.text','JournalEntryPage','Text Page','text','/test-wide.svg']])docs.set(uuid,{uuid,documentName,name,type,src,_onClickDocumentLink:async()=>nativeClicks.push(uuid)});
    });
    await page.locator('[data-tab="Overview"]').click();await page.locator('[name="code"]').fill('B2');await saveSpecial();
    const overlayChildren=()=>page.evaluate(()=>canvas.stage.children.flatMap(root=>root.children||[]).flatMap(root=>root.children||[]).map(child=>({name:child.name,text:child.text})));
    await page.waitForFunction(()=>canvas.stage.children.some(root=>root.children.some(cell=>cell.children?.some(child=>child.name==='special-sector-highlight'))));
    await page.locator('[data-overlay-image-pick]').click();await page.waitForFunction(()=>manager.draft.special.overlayImage==='/test-wide.svg');assert.equal(await page.evaluate(()=>filePickerOptions.type),'image');
    await page.waitForFunction(()=>document.querySelector('[data-overlay-preview] img')?.naturalWidth===600);
    await page.locator('[name="terrain"]').fill('Live Special Terrain');assert((await overlayChildren()).some(child=>child.name==='special-sector-terrain'&&child.text==='Live Special Terrain'));
    await page.evaluate(()=>pickedImagePath='/test-tall.svg');await page.locator('[data-overlay-image-pick]').click();assert.equal(await page.evaluate(()=>filePickerOptions.current),'/test-wide.svg');await page.waitForFunction(()=>manager.draft.special.overlayImage==='/test-tall.svg');
    await page.locator('[data-overlay-image-clear]').click();assert.equal(await page.evaluate(()=>manager.draft.special.overlayImage),'');assert.equal(await page.locator('[data-overlay-preview] img').count(),0);
    await page.evaluate(()=>pickedImagePath='/missing.png');await page.locator('[data-overlay-image-pick]').click();await page.waitForFunction(()=>document.querySelector('[data-overlay-preview]').textContent.includes('missing'));
    await page.evaluate(()=>pickedImagePath='/test-wide.svg');await page.locator('[data-overlay-image-pick]').click();await saveSpecial();assert.equal(await page.evaluate(()=>manager.journal.getFlag('myz-sector-manager','sector').special.overlayImage),'/test-wide.svg');
    await page.locator('[data-tab="Overview"]').click();const situation=page.locator('[data-autosize]');
    await situation.fill('');const minimum=await situation.evaluate(el=>({height:el.offsetHeight,line:parseFloat(getComputedStyle(el).lineHeight)}));assert(minimum.height>=minimum.line*7);
    const situationLong=Array.from({length:45},(_,i)=>'Situation line '+i).join('\n');await situation.fill(situationLong);const expanded=await situation.evaluate(el=>({height:el.offsetHeight,scroll:el.scrollHeight,client:el.clientHeight}));assert(expanded.height>minimum.height*3);assert(expanded.scroll<=expanded.client+1);
    await situation.fill('Short\nTwo lines');assert(await situation.evaluate(el=>el.offsetHeight)<expanded.height);await situation.fill(situationLong);await saveSpecial();await page.locator('[data-tab="Overview"]').click();await page.locator('[data-tab="Overview"]').click();assert(await page.locator('[data-autosize]').evaluate(el=>el.offsetHeight)>minimum.height*3);
    const blankDrop=async(uuid,type,twice=false)=>{await page.locator('.sm-content').evaluate((el,{uuid,type,twice})=>{const transfer=new DataTransfer();transfer.setData('text/plain',JSON.stringify({uuid,type}));const event=new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true});el.dispatchEvent(event);if(twice)el.dispatchEvent(event);},{uuid,type,twice});await page.waitForFunction(()=>!manager.droppingEntry&&!manager.droppingInhabitant);};
    await page.locator('[data-tab="Inhabitants"]').click();const inhabitantCount=await page.locator('.sm-entry').count();
    await page.evaluate(()=>{manager.journal.getFlag('myz-sector-manager','sector').initialSavePending=true;});await blankDrop('Actor.drop','Actor');assert.equal(await page.locator('.sm-entry').count(),inhabitantCount);assert.match(await page.evaluate(()=>notifyErrors.pop()),/Save this sector/);await page.evaluate(()=>{manager.journal.getFlag('myz-sector-manager','sector').initialSavePending=false;});
    await page.locator('.sm-content').evaluate(el=>{const transfer=new DataTransfer();transfer.setData('text/plain',JSON.stringify({uuid:'Actor.drop',type:'Actor'}));el.dispatchEvent(new DragEvent('dragover',{dataTransfer:transfer,bubbles:true,cancelable:true}));});assert(await page.locator('.sm-content').evaluate(el=>el.classList.contains('sm-drop-hover')));
    await blankDrop('Actor.drop','Actor',true);assert.equal(await page.locator('.sm-entry').count(),inhabitantCount+1);assert.equal(await page.locator('[data-entry]').filter({has:page.locator('input[name$=".uuid"][value="Actor.drop"]')}).locator('[data-entry-toggle]').getAttribute('aria-expanded'),'false');assert.equal(await page.evaluate(()=>manager.journal.getFlag('myz-sector-manager','sector').special.inhabitants.at(-1).uuid),'Actor.drop');
    await blankDrop('Compendium.myz.actors.Actor.drop','Actor');assert.equal(await page.locator('.sm-entry').count(),inhabitantCount+2);
    const droppedActor=page.locator('.sm-entry').last();await droppedActor.locator('[data-entry-toggle]').click();await dropSpecial(droppedActor.locator('[data-reference]:not([data-type="Macro"])'),'Actor.drop');assert.equal(await page.locator('.sm-entry').count(),inhabitantCount+2);await saveSpecial();
    await blankDrop('Item.drop','Item');assert.equal(await page.locator('.sm-entry').count(),inhabitantCount+2);assert.match(await page.evaluate(()=>notifyErrors.pop()),/Drop an Actor/);
    await page.locator('[data-tab="Gear & Artifacts"]').click();const gearCount=await page.locator('.sm-entry').count();for(const [uuid,type] of [['Item.drop','weapon'],['Compendium.myz.items.Item.drop','armor']]){await blankDrop(uuid,'Item');assert.equal(await page.locator('.sm-entry').last().locator('[data-entry-toggle]').getAttribute('aria-expanded'),'false');assert.equal(await page.evaluate(()=>manager.journal.getFlag('myz-sector-manager','sector').special.gear.at(-1).type),type);assert.equal(await page.evaluate(()=>manager.draft.special.gear.at(-1).quantity),1);}assert.equal(await page.locator('.sm-entry').count(),gearCount+2);
    await page.locator('[data-tab="Images"]').click();assert.equal(await page.locator('.sm-entry').count(),0);
    for(const uuid of ['JournalEntry.images.JournalEntryPage.wide','Compendium.myz.images.JournalEntry.book.JournalEntryPage.tall'])await blankDrop(uuid,'JournalEntryPage');
    assert.equal(await page.locator('.sm-entry').count(),2);assert.equal(await page.locator('[data-image-preview] img').count(),2);assert.equal(await page.locator('[data-image-metadata][open]').count(),0);await page.waitForFunction(()=>document.querySelector('[data-image-preview] img')?.naturalWidth===600);
    await blankDrop('JournalEntry.images.JournalEntryPage.text','JournalEntryPage');assert.equal(await page.locator('.sm-entry').count(),2);assert.match(await page.evaluate(()=>notifyWarnings.at(-1)),/Image-type Journal page/);
    await page.locator('[data-action="add"]').click();assert.equal(await page.locator('.sm-entry').count(),3);const manualImage=page.locator('.sm-entry').last();assert.match(await manualImage.locator('[data-image-preview]').innerText(),/Assign an Image-type/);await manualImage.locator('summary').click();await dropSpecial(manualImage.locator('[data-reference]:not([data-type="Macro"])'),'JournalEntry.images.JournalEntryPage.wide');await manualImage.locator('[data-reference] a').click();await page.waitForFunction(()=>nativeClicks.includes('JournalEntry.images.JournalEntryPage.wide'));
    await manualImage.locator('[name$=".title"]').fill('Manual image title');await manualImage.locator('textarea').fill('Image notes\n\nSecond paragraph');await page.evaluate(()=>globalThis.galleryImage=document.querySelectorAll('[data-image-preview] img')[2]);await manualImage.locator('textarea').fill('Updated notes\n\nSecond paragraph');assert(await page.evaluate(()=>galleryImage===document.querySelectorAll('[data-image-preview] img')[2]));
    await saveSpecial();const savedGallery=await page.evaluate(()=>structuredClone(manager.journal.getFlag('myz-sector-manager','sector').special));
    await page.evaluate(async()=>{await manager.navigate('sector1');});await page.evaluate(async id=>{await manager.navigate(id);},specialId);await page.locator('[data-tab="Images"]').click();assert.equal(await page.locator('[data-image-preview] img').count(),3);assert.deepEqual(await page.evaluate(()=>manager.draft.special),savedGallery);
    await page.locator('[data-action="change-type"]').click();await page.waitForFunction(()=>manager.draft.sectorType==='normal');assert.equal(await page.locator('[data-tab="Images"]').count(),0);await saveSpecial();await page.locator('[data-action="change-type"]').click();await page.waitForFunction(()=>manager.draft.sectorType==='special');await saveSpecial();assert.deepEqual(await page.evaluate(()=>manager.draft.special),savedGallery);
    await page.locator('[data-tab="Images"]').click();await page.evaluate(async()=>{manager.draft.special.images[0].uuid='JournalEntry.missing.JournalEntryPage.page';await manager.render();});assert.match(await page.locator('[data-image-preview]').first().innerText(),/missing or unavailable/);const broken=page.locator('.sm-entry').first();await broken.locator('summary').click();await broken.locator('[data-reference-clear]').click();assert.match(await broken.locator('[data-image-preview]').innerText(),/Assign an Image-type/);await saveSpecial();
    await page.evaluate(async()=>{await manager.close();});await page.evaluate(async id=>{globalThis.manager=await game.myzSectorManager.open(id);},specialId);await page.locator('[data-tab="Overview"]').click();assert.equal(await page.locator('[data-autosize]').inputValue(),situationLong);assert(await page.locator('[data-autosize]').evaluate(el=>el.scrollHeight<=el.clientHeight+1));
    console.log('FilePicker overlay previews/persistence/live Terrain, seven-line Situation growth/shrink, blank-area autosaved drops, reference isolation, gallery previews/page sources and conversion persistence pass');

    await page.locator('[data-tab="Overview"]').click();
    const overviewOrder=await page.evaluate(()=>{const notes=document.querySelector('[name="notes"]').closest('label'),overlay=document.querySelector('[data-overlay-image-pick]').closest('section'),content=document.querySelector('.sm-content');return {after:Boolean(notes.compareDocumentPosition(overlay)&Node.DOCUMENT_POSITION_FOLLOWING),last:content.lastElementChild===overlay};});assert(overviewOrder.after&&overviewOrder.last);
    await page.evaluate(()=>{for(const [uuid,name,img] of [['Actor.uiPortrait','World Portrait','/test-wide.svg'],['Compendium.myz.actors.Actor.uiPortrait','Pack Portrait','/test-tall.svg'],['Actor.badPortrait','Missing Portrait','/missing.png']])docs.set(uuid,{uuid,name,img,documentName:'Actor',_onClickDocumentLink:async()=>nativeClicks.push(uuid)});});
    await page.locator('[data-tab="Inhabitants"]').click();const portraitCard=page.locator('.sm-entry').first();if(await portraitCard.locator('[data-entry-toggle]').getAttribute('aria-expanded')==='false')await portraitCard.locator('[data-entry-toggle]').click();
    await dropSpecial(portraitCard.locator('[data-reference]:not([data-type="Macro"])'),'Actor.uiPortrait');await page.waitForFunction(()=>document.querySelector('[data-inhabitant-avatar] img')?.naturalWidth===600);
    await portraitCard.locator('[name$=".title"]').fill('A very long Inhabitant heading that must remain left aligned and wrap naturally across multiple lines '.repeat(3));
    const alignment=await portraitCard.locator('[data-entry-toggle]').evaluate(button=>{const avatar=button.querySelector('[data-inhabitant-avatar]').getBoundingClientRect(),title=button.querySelector('[data-entry-title]').getBoundingClientRect(),arrow=button.querySelector('[data-chevron]').getBoundingClientRect(),box=button.getBoundingClientRect(),image=button.querySelector('img');return {left:avatar.x-box.x,titleAfter:title.x>=avatar.right,arrowAfter:arrow.x>=title.right,right:box.right-arrow.right,align:getComputedStyle(button).textAlign,fit:getComputedStyle(image).objectFit,size:image.getBoundingClientRect().width};});assert(alignment.left<7&&alignment.titleAfter&&alignment.arrowAfter&&alignment.right<7);assert.equal(alignment.align,'left');assert.equal(alignment.fit,'contain');assert(alignment.size>=32&&alignment.size<=40);
    const clicksBeforeAvatar=await page.evaluate(()=>nativeClicks.length);await portraitCard.locator('[data-inhabitant-avatar]').click();assert.equal(await portraitCard.locator('[data-entry-toggle]').getAttribute('aria-expanded'),'false');assert.equal(await page.evaluate(()=>nativeClicks.length),clicksBeforeAvatar);await portraitCard.locator('[data-inhabitant-avatar]').click();
    await dropSpecial(portraitCard.locator('[data-reference]:not([data-type="Macro"])'),'Compendium.myz.actors.Actor.uiPortrait');await page.waitForFunction(()=>document.querySelector('[data-inhabitant-avatar] img')?.naturalHeight===600);
    await dropSpecial(portraitCard.locator('[data-reference]:not([data-type="Macro"])'),'Actor.badPortrait');await page.waitForFunction(()=>document.querySelector('[data-reference] a')?.dataset.uuid==='Actor.badPortrait'&&document.querySelector('[data-inhabitant-avatar] img')?.getAttribute('src')==='/test-wide.svg');
    await portraitCard.locator('[data-reference-clear]').click();assert.equal(await portraitCard.locator('[data-inhabitant-avatar] img').getAttribute('src'),'/test-wide.svg');assert.equal(await portraitCard.locator('[data-inhabitant-portrait-path]').inputValue(),'/test-wide.svg');
    await dropSpecial(portraitCard.locator('[data-reference]:not([data-type="Macro"])'),'Compendium.myz.actors.Actor.uiPortrait');await saveSpecial();
    await page.locator('[data-tab="Events"]').click();const eventHeading=page.locator('[data-entry-toggle]').first();const eventAlignment=await eventHeading.evaluate(button=>{const title=button.querySelector('[data-entry-title]').getBoundingClientRect(),arrow=button.querySelector('[data-chevron]').getBoundingClientRect(),box=button.getBoundingClientRect();return {left:title.x-box.x,right:box.right-arrow.right,ordered:arrow.x>=title.right,align:getComputedStyle(button).textAlign};});assert(eventAlignment.left<7&&eventAlignment.right<7&&eventAlignment.ordered);assert.equal(eventAlignment.align,'left');const eventOpen=await eventHeading.getAttribute('aria-expanded');await eventHeading.click();assert.notEqual(await eventHeading.getAttribute('aria-expanded'),eventOpen);
    await page.locator('[data-tab="Images"]').click();assert.deepEqual(await page.locator('.sm-entry-controls button').allTextContents(),['Expand All','Collapse All','+ Add Image']);
    const imageCount=await page.locator('.sm-entry').count();assert(imageCount>=2);assert.equal(await page.locator('[data-image-body]:visible').count(),imageCount);
    if(await page.locator('.sm-entry').last().locator('[data-image-metadata]').getAttribute('open')===null)await page.locator('.sm-entry').last().locator('summary').click();await page.locator('.sm-entry').last().locator('textarea').fill('Unsaved image notes preserved through bulk collapse');
    const beforeBulk=await page.evaluate(()=>{globalThis.beforeBulkImageNodes=Array.from(document.querySelectorAll('[data-image-preview] img'));return {draft:JSON.stringify(manager.draft),flags:JSON.stringify(manager.journal.getFlag('myz-sector-manager','sector')),dirty:manager.dirty};});
    await page.locator('[data-collapse-all]').click();assert.equal(await page.locator('[data-image-preview]:visible').count(),0);assert.equal(await page.locator('[data-image-body]:visible').count(),0);assert.equal(await page.locator('[data-image-metadata][open]').count(),0);
    await page.locator('[data-expand-all]').click();assert.equal(await page.locator('[data-image-preview]:visible').count(),imageCount);assert.equal(await page.locator('[data-image-metadata][open]').count(),imageCount);
    assert(await page.evaluate(()=>beforeBulkImageNodes.every((node,i)=>node===document.querySelectorAll('[data-image-preview] img')[i])));assert.equal(await page.evaluate(()=>JSON.stringify(manager.draft)),beforeBulk.draft);assert.equal(await page.evaluate(()=>JSON.stringify(manager.journal.getFlag('myz-sector-manager','sector'))),beforeBulk.flags);assert.equal(await page.evaluate(()=>manager.dirty),beforeBulk.dirty);
    await page.locator('[data-image-toggle]').first().click();assert.equal(await page.locator('[data-image-body]:visible').count(),imageCount-1);await page.locator('[data-image-toggle]').first().click();assert.equal(await page.locator('[data-image-body]:visible').count(),imageCount);
    await page.locator('[data-action="add"]').click();const newGalleryEntry=page.locator('.sm-entry').last();assert.equal(await newGalleryEntry.locator('[data-image-toggle]').getAttribute('aria-expanded'),'true');assert.equal(await newGalleryEntry.locator('[data-image-metadata]').getAttribute('open'),null);await newGalleryEntry.locator('[data-remove]').click();assert.equal(await page.locator('.sm-entry').count(),imageCount);
    await page.locator('[data-collapse-all]').click();await saveSpecial();
    await page.evaluate(()=>{const other=records.get('sector3');other.flags={...other.flags,sectorType:'special',special:{images:[{title:'Another sector image',uuid:'JournalEntry.images.JournalEntryPage.wide'}]}};});const galleryOtherBefore=await page.evaluate(()=>JSON.stringify(records.get('sector3').flags));
    await page.evaluate(async()=>{await manager.navigate('sector3');});await page.locator('[data-tab="Images"]').click();assert.equal(await page.locator('[data-image-body]:visible').count(),1);await page.locator('[data-collapse-all]').click();assert.equal(await page.locator('[data-image-body]:visible').count(),0);assert.equal(await page.evaluate(()=>JSON.stringify(records.get('sector3').flags)),galleryOtherBefore);
    await page.evaluate(async id=>{await manager.navigate(id);},specialId);await page.locator('[data-tab="Images"]').click();assert.equal(await page.locator('[data-image-body]:visible').count(),0);await page.locator('[data-expand-all]').click();assert.equal(await page.locator('[data-image-body]:visible').count(),imageCount);
    await page.evaluate(async()=>{await manager.close();});await page.evaluate(async id=>{globalThis.manager=await game.myzSectorManager.open(id);},specialId);assert(await page.evaluate(()=>document.querySelector('.sm-content').lastElementChild.contains(document.querySelector('[data-overlay-image-pick]'))));await page.locator('[data-tab="Inhabitants"]').click();await page.waitForFunction(()=>document.querySelector('[data-inhabitant-avatar] img')?.naturalHeight===600);assert.equal(await page.evaluate(()=>docs.get('Compendium.myz.actors.Actor.uiPortrait').img),'/test-tall.svg');
    console.log('Bottom Overview image controls, world/compendium Actor avatars/fallbacks, left-aligned headings and sector-local Images bulk/individual toggles preserve image DOM, notes, references and defaults');

    {
    await page.locator('[data-tab="Overview"]').click();
    const imagePanelRatio=()=>page.locator('.sm-overlay-image-control').evaluate(el=>{const parent=el.parentElement,style=getComputedStyle(parent);return el.getBoundingClientRect().width/(parent.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight));});
    assert(Math.abs(await imagePanelRatio()-.5)<.03);const pathBeforeLayout=await page.evaluate(()=>manager.draft.special.overlayImage);
    await page.evaluate(()=>manager.element.style.width='650px');assert(Math.abs(await imagePanelRatio()-1)<.03);assert(await page.locator('.sm-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await page.evaluate(()=>manager.element.style.width='920px');assert.equal(await page.evaluate(()=>manager.draft.special.overlayImage),pathBeforeLayout);
    await page.evaluate(async()=>{await manager.navigate('sector1');});assert.equal(await page.locator('[data-tab="Encounters"]').innerText(),'Inhabitants');assert.equal(await page.locator('[data-tab="Loot"]').innerText(),'Gear & Artifacts');
    for(const tab of ['Locations','Encounters','Loot','Effects','History']){await page.locator('[data-tab="'+tab+'"]').click();if(await page.locator('[data-entry-toggle]').count()){const heading=page.locator('[data-entry-toggle]').first();const geometry=await heading.evaluate(button=>{const title=button.querySelector('[data-entry-title]').getBoundingClientRect(),arrow=button.querySelector('[data-chevron]').getBoundingClientRect(),box=button.getBoundingClientRect();return {left:(button.querySelector('[data-inhabitant-avatar]')||button.querySelector('[data-entry-title]')).getBoundingClientRect().x-box.x,right:box.right-arrow.right,align:getComputedStyle(button).textAlign};});assert(geometry.left<7&&geometry.right<7,tab);assert.equal(geometry.align,'left');}}
    await page.evaluate(async()=>{
      const {journalBodyText}=await import('/scripts/location-text.mjs');const {TABLE_UUIDS}=await import('/scripts/sector-randomizer.mjs');
      const extracted=journalBodyText('<h2>Room &trade;</h2><p>First &Auml; &amp; &#x1f9ed;<br>Second line</p><img src="image.png"><video><p>Not a description</p></video><iframe>Not copied</iframe><script>globalThis.unsafeExtraction=true</script><style>.x{color:red}</style><p>Last paragraph</p>');
      if(extracted!=='Room ™\n\nFirst Ä & 🧭\nSecond line\n\nLast paragraph'||globalThis.unsafeExtraction)throw new Error('Unsafe or incorrectly separated journal text: '+extracted);
      const first={type:'text',sort:10,text:{content:'<p>First room &amp; corridor.</p><p>More details.<img src="ignored.png"></p>'}},second={type:'text',sort:20,text:{content:'<p>Second page.</p>'}},image={type:'image',sort:0,src:'image.png',text:{content:'Do not copy image-page data'}};
      docs.set('JournalEntry.locationBody',{documentName:'JournalEntry',uuid:'JournalEntry.locationBody',name:'Hospital Narrative',pages:new Map([['second',second],['image',image],['first',first]])});
      docs.set('Compendium.myz.ruins.JournalEntry.book.JournalEntryPage.description',{documentName:'JournalEntryPage',uuid:'Compendium.myz.ruins.JournalEntry.book.JournalEntryPage.description',name:'Factory Narrative',type:'text',text:{content:'<p>Factory description.</p><p>Another paragraph.</p>'}});
      docs.get(TABLE_UUIDS.ruinsA).roll=async()=>({results:[{documentUuid:'JournalEntry.locationBody'}]});docs.get(TABLE_UUIDS.ruinsB).roll=async()=>({results:[{documentUuid:'Compendium.myz.ruins.JournalEntry.book.JournalEntryPage.description'}]});
    });
    await page.locator('[data-tab="Overview"]').click();await page.locator('[name="terrain"]').fill('Overgrown Ruins');await page.locator('[data-tab="Locations"]').click();const locationsBefore=await page.locator('.sm-entry').count();await page.locator('[data-action="add"]').click();await page.waitForFunction(n=>manager.draft.locations.length===n+1,locationsBefore);assert.equal(await page.evaluate(()=>manager.draft.locations.at(-1).details),'First room & corridor.\n\nMore details.\n\nSecond page.');assert.equal(await page.evaluate(()=>manager.draft.locations.at(-1).uuid),'JournalEntry.locationBody');await saveSpecial();
    await page.evaluate(async()=>{
      const {generateSector,saveGeneratedSector,TABLE_UUIDS}=await import('/scripts/sector-randomizer.mjs');
      docs.get(TABLE_UUIDS.environment).roll=async()=>({results:[{description:'Derelict Industries'}]});docs.get(TABLE_UUIDS.threatLevel).roll=async()=>({results:[{description:'0'}]});
      const expected=structuredClone(manager.journal.getFlag('myz-sector-manager','sector'));globalThis.existingLocationNotes=structuredClone(expected.locations.filter(entry=>entry.generated?.method!=='core'));
      const next=await generateSector(expected,{env:globalThis,roll:async()=>10000,rollBaseDice:async()=>[]});const entry=next.locations.at(-1);if(entry.details!=='Factory description.\n\nAnother paragraph.'||entry.uuid!=='Compendium.myz.ruins.JournalEntry.book.JournalEntryPage.description')throw new Error('Full generation did not snapshot the specific journal page');
      await saveGeneratedSector(manager.journal,expected,next);manager.draft=manager.loadDraft(manager.journal.getFlag('myz-sector-manager','sector'));manager.tab='Locations';await manager.render();
    });
    assert.deepEqual(await page.evaluate(()=>manager.draft.locations.filter(entry=>entry.generated?.method!=='core')),await page.evaluate(()=>existingLocationNotes));
    const generatedLocation=page.locator('.sm-entry').last();if(await generatedLocation.locator('[data-entry-toggle]').getAttribute('aria-expanded')==='false')await generatedLocation.locator('[data-entry-toggle]').click();await generatedLocation.locator('textarea').fill('GM edited snapshot\n\nKeep independent of the journal');await saveSpecial();
    await page.evaluate(()=>docs.get('Compendium.myz.ruins.JournalEntry.book.JournalEntryPage.description').text.content='<p>Source changed later.</p>');await page.evaluate(async id=>{await manager.navigate(id);},specialId);await page.evaluate(async()=>{await manager.navigate('sector1');});assert.equal(await page.evaluate(()=>manager.draft.locations.at(-1).details),'GM edited snapshot\n\nKeep independent of the journal');
    console.log('Normal display labels retain tab IDs/data, shared headings align, image controls respond at half/full width, and safe Journal/Page body snapshots persist independently of later source edits');

    }
    {
      await page.evaluate(async id=>{await manager.navigate(id);manager.tab='Overview';await manager.render();},specialId);
      const overview=page.locator('[data-overview-section="special.overview"]'),situationSection=page.locator('[data-overview-section="special.situation"]');
      assert(await overview.evaluate(el=>el.open));assert(await situationSection.evaluate(el=>el.open));
      await page.locator('[name="special.overview"]').fill('Unsaved Special overview');await page.locator('[name="special.situation"]').fill('Unsaved situation\n\nLonger text');
      await overview.locator('summary').click();assert(!(await overview.evaluate(el=>el.open)));assert(await situationSection.evaluate(el=>el.open));
      await situationSection.locator('summary').click();await overview.locator('summary').click();await situationSection.locator('summary').click();assert.equal(await page.locator('[name="special.overview"]').inputValue(),'Unsaved Special overview');assert.equal(await page.locator('[name="special.situation"]').inputValue(),'Unsaved situation\n\nLonger text');
      const hiddenLocations=await page.evaluate(()=>JSON.stringify(manager.draft.locations));await page.locator('[data-tab="Locations"]').click();await page.locator('[data-action="add"]').click();assert.equal(await page.evaluate(()=>manager.draft.special.locations.at(-1).details),'');
      const location=page.locator('.sm-entry').last();assert.equal(await location.locator('[data-entry-toggle]').getAttribute('aria-expanded'),'false');await location.locator('[data-entry-toggle]').click();await location.locator('[name$=".title"]').fill('Manual Special Location');await location.locator('textarea').fill('Handwritten\n\nLocation notes');
      await page.evaluate(()=>{for(const uuid of ['JournalEntry.locationBody','Compendium.myz.ruins.JournalEntry.book.JournalEntryPage.description'])docs.get(uuid)._onClickDocumentLink=async()=>nativeClicks.push(uuid);});
      for(const uuid of ['JournalEntry.locationBody','Compendium.myz.ruins.JournalEntry.book.JournalEntryPage.description','Scene.one']){await dropSpecial(location.locator('[data-reference]'),uuid);assert.equal(await location.locator('input[type="hidden"]').inputValue(),uuid);await location.locator('a.content-link').click();await location.locator('[data-reference-clear]').click();assert.equal(await location.locator('input[type="hidden"]').inputValue(),'');}
      await dropSpecial(location.locator('[data-reference]'),'Compendium.myz.ruins.JournalEntry.book.JournalEntryPage.description');await saveSpecial();assert.equal(await page.evaluate(()=>JSON.stringify(manager.draft.locations)),hiddenLocations);
      await page.evaluate(async()=>{await manager.navigate('sector1');});await page.evaluate(async id=>{await manager.navigate(id);},specialId);assert.equal(await page.evaluate(()=>manager.draft.special.locations.at(-1).details),'Handwritten\n\nLocation notes');
      await page.evaluate(async()=>{await manager.navigate('sector1');manager.tab='Effects';await manager.render();docs.set('Macro.entryTest',{documentName:'Macro',uuid:'Macro.entryTest',name:'Entry Test',sheet:{render:async()=>nativeClicks.push('Macro.entryTest.editor')},_onClickDocumentLink:()=>{throw Error('Native Macro link must not execute');},execute:()=>{throw Error('Must not execute on assignment');}});});
      const effect=page.locator('.sm-entry').first();if(await effect.locator('[data-entry-toggle]').getAttribute('aria-expanded')==='false')await effect.locator('[data-entry-toggle]').click();const originalRef=await effect.locator('[data-reference]:not([data-type="Macro"]) input').inputValue();const macro=effect.locator('[data-type="Macro"]');
      await dropSpecial(macro,'Macro.entryTest');assert.equal(await macro.locator('input').inputValue(),'Macro.entryTest');assert.match(await macro.innerText(),/Entry Test/);await macro.locator('a').click();await effect.locator('[name$=".macroRunOnce"]').check();await saveSpecial();assert(await page.evaluate(()=>Boolean(manager.draft.effects[0].triggerId)));assert.equal(await effect.locator('[data-reference]:not([data-type="Macro"]) input').inputValue(),originalRef);
      const identity=await page.evaluate(()=>manager.draft.effects[0].triggerId);await macro.locator('[data-reference-clear]').click();assert.equal(await macro.locator('input').inputValue(),'');await dropSpecial(macro,'Macro.entryTest');assert.equal(await page.evaluate(()=>manager.draft.effects[0].triggerId),identity);await saveSpecial();await page.locator('[data-tab="Overview"]').click();await page.locator('[data-tab="Effects"]').click();assert.equal(await page.locator('[data-type="Macro"] input').first().inputValue(),'Macro.entryTest');
      await page.evaluate(async()=>{const effect=manager.draft.effects[0];await manager.journal.setFlag('myz-sector-manager','entryTriggers',{records:[{triggerId:effect.triggerId,tokenUuid:'Scene.zone.Token.party',status:'failed',error:'Test failure'}]});await manager.render();});
      await page.locator('.sm-entry').first().locator('textarea').fill('Unsaved Effects notes retained through reset');
      await page.locator('[data-reset-trigger]').first().click();await page.waitForFunction(()=>manager.journal.getFlag('myz-sector-manager','entryTriggers').records.length===0);assert.equal(await page.locator('.sm-entry').first().locator('textarea').inputValue(),'Unsaved Effects notes retained through reset');assert.equal(await page.locator('[data-type="Macro"] input').first().inputValue(),'Macro.entryTest');
      await page.evaluate(async()=>{await manager.journal.setFlag('myz-sector-manager','entryTriggers',{records:[{triggerId:'another',tokenUuid:'Scene.zone.Token.party',status:'completed'}]});});await page.locator('[data-reset-all-triggers]').click();await page.waitForFunction(()=>manager.journal.getFlag('myz-sector-manager','entryTriggers').records.length===0);await saveSpecial();
      const runOnceControl=page.locator('.sm-entry').first().locator('[name$=".macroRunOnce"]');assert.equal(await runOnceControl.isChecked(),true);assert.match(await page.locator('.sm-entry').first().innerText(),/Run Once \(First Entry Only\)/);await runOnceControl.uncheck();await saveSpecial();await page.locator('[data-tab="Overview"]').click();await page.locator('[data-tab="Effects"]').click();assert.equal(await page.locator('.sm-entry').first().locator('[name$=".macroRunOnce"]').isChecked(),false);await page.locator('.sm-entry').first().locator('[name$=".macroDisabled"]').check();await saveSpecial();assert.equal(await page.evaluate(()=>manager.journal.getFlag('myz-sector-manager','sector').effects[0].macroDisabled),true);assert.equal(await page.evaluate(()=>manager.journal.getFlag('myz-sector-manager','sector').effects[0].macroRunOnce),false);
      console.log('Special Locations blank authoring, exact Journal/Page/Scene references, save/reload and hidden Normal preservation; independent Overview accordions and optional Macro assignment/link/clear/enable persistence pass');
    }
    // Settlement editor shares the real manager shell and handlers used above.
    assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>notifyErrors),[]);
    await page.evaluate(async()=>{
      manager.dirty=false;globalThis.originalSectorSnapshot=JSON.stringify(records.get('sector1').flags);
      foundry.applications.api.DialogV2.confirm=async()=>true;
      foundry.applications.api.DialogV2.wait=async options=>{
        const element=document.createElement('div');element.innerHTML=options.content;
        if(options.window.title==='Create New Sector'){
          element.querySelector('[name="newSectorType"][value="settlement"]').checked=true;element.querySelector('[name="newSectorCode"]').value='F6';
          return options.buttons.find(b=>b.action==='create').callback(null,null,{element});
        }
        return null;
      };
      game.scenes.set('zone',lastZoneScene);game.system={id:'mutant-year-zero',version:'14.0.4'};
      globalThis.projectSheets=[];globalThis.sourceMutations=[];
      for(const uuid of ['Item.watchtower','Compendium.myz.projects.Item.watchtower'])docs.set(uuid,{uuid,pack:uuid.startsWith('Compendium')?'myz.projects':'',documentName:'Item',type:'project',name:'Watchtower',img:'/test-wide.svg',system:{description:'<p>Keep watch</p>',DEV_Requirement:'Warfare 10',other_requirements:'Scrap',skills:'Force',work_points:'20',DEV_Bonus:'Warfare +1',special:'Spot threats',food:0,culture:0,technology:0,warfare:1,completed:false},_onClickDocumentLink:async()=>projectSheets.push(uuid),sheet:{render:async()=>projectSheets.push(uuid)},update:()=>sourceMutations.push('update'),delete:()=>sourceMutations.push('delete')});
      docs.set('Actor.ark',{uuid:'Actor.ark',name:'Home Ark',documentName:'Actor',type:'ark',_onClickDocumentLink:async()=>nativeClicks.push('Actor.ark')});
      globalThis.projectsSnapshot=JSON.stringify([...docs.values()].filter(d=>d.type==='project'));
      await manager.promptNewSector('F6');globalThis.settlementId=manager.sectorId;
    });
    assert.deepEqual(await tabs(),['Overview','Projects','Inhabitants','Factions','Events','Threads','Shop']);
    assert.equal(await page.locator('[data-action="randomize"]').count(),0);
    assert.equal(await page.evaluate(()=>manager.journal.getFlag('myz-sector-manager','sector').sceneId),'zone');
    assert.equal(await page.locator('[data-sector-name]').inputValue(),'');
    await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>notifyErrors.length===1);assert.match(await page.evaluate(()=>notifyErrors.pop()),/Settlement Name/);
    await page.locator('[data-sector-name]').fill('Harbor Ark');
    await page.locator('[name="settlement.type"]').selectOption('Ark');await page.locator('[name="settlement.disposition"]').selectOption('Friendly');
    await page.locator('[name="settlement.population"]').fill('About 40');await page.locator('[name="settlement.leadership"]').fill('The Council');await page.locator('[name="terrain"]').fill('Trading shore');
    const settlementDescription=('First paragraph\n\nSecond paragraph\n').repeat(200);await page.locator('[name="settlement.description"]').fill(settlementDescription);
    await page.locator('[name="settlement.notes"]').fill('Private settlement notes');await page.locator('summary').filter({hasText:'Additional overview'}).click();
    for(const key of ['history','situation','defenses','resources','economy'])await page.locator(`[name="settlement.${key}"]`).fill('Saved '+key);
    await dropSpecial(page.locator('[data-reference]').filter({has:page.locator('[name="settlement.arkUuid"]')}),'Actor.ark');
    await page.evaluate(()=>{foundry.applications.apps.FilePicker.implementation=class{constructor(options){this.options=options;}async render(){this.options.callback('/test-wide.svg');}};});
    await page.locator('[data-settlement-image="settlement.image"]').click();await page.waitForFunction(()=>manager.draft.settlement.image==='/test-wide.svg');await saveSpecial();
    assert.equal(await page.locator(`[data-open="${await page.evaluate(()=>settlementId)}"].sm-sector-settlement`).count(),1);
    assert.equal(await page.locator('.sm-sector-settlement').first().evaluate(el=>getComputedStyle(el).borderLeftStyle),'solid');assert.equal(await page.locator('.sm-sector-settlement').first().evaluate(el=>getComputedStyle(el).borderLeftWidth),'4px');
    await page.locator('[data-tab="Projects"]').click();
    assert.match(await page.locator('.sm-content').innerText(),/No projects have been added/);
    // Blank-area world/Compendium project drops remain draft-only until Save Sector.
    for(const uuid of ['Item.watchtower','Compendium.myz.projects.Item.watchtower']){
      await dropSpecial(page.locator('.sm-content'),uuid);await page.waitForFunction(()=>manager.draft.settlement.projects.length>0);
    }
    assert.equal(await page.locator('[data-project-view]').count(),2);
    assert.match(await page.locator('[data-project-view]').first().innerText(),/Warfare 10/);assert.match(await page.locator('[data-project-view]').first().innerText(),/20/);
    assert.equal(await page.locator('[data-project-view] button').filter({hasText:'Open Ark Project'}).count(),0);await page.locator('[name="settlement.projects.0.uuid"]').locator('..').locator('a.content-link').click();assert.deepEqual(await page.evaluate(()=>projectSheets),['Item.watchtower']);
    const setProjectStatus=async(index,status)=>{await page.locator(`[data-project-status="${index}"]`).selectOption(status);await page.evaluate(()=>manager.projectWrite);};
    await setProjectStatus(0,'Completed');await page.evaluate(()=>manager.draft.settlement.projects[0].progress='20 of 20');await page.locator('[name="settlement.projects.0.completedAt"]').fill('Session 12');await page.locator('[name="settlement.projects.0.notes"]').fill('Built by guards');
    assert.equal(await page.locator('[data-project-status="1"]').inputValue(),'Not completed');
    const invalidProjectDrop=async target=>target.evaluate(el=>{const transfer=new DataTransfer();transfer.setData('text/plain',JSON.stringify({uuid:'Item.one'}));el.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));});
    const projectCount=await page.evaluate(()=>manager.draft.settlement.projects.length);await invalidProjectDrop(page.locator('.sm-content'));await page.waitForFunction(()=>notifyErrors.length===1);assert.match(await page.evaluate(()=>notifyErrors.pop()),/Ark Project Item/);assert.equal(await page.evaluate(()=>manager.draft.settlement.projects.length),projectCount);
    // Invalid assignment into an existing card also leaves its UUID untouched.
    await invalidProjectDrop(page.locator('[data-reference]').first());await page.waitForFunction(()=>notifyErrors.length===1);assert.match(await page.evaluate(()=>notifyErrors.pop()),/Ark Project Item/);assert.equal(await page.locator('[name="settlement.projects.0.uuid"]').inputValue(),'Item.watchtower');await saveSpecial();
    await page.evaluate(async()=>{docs.delete('Item.watchtower');await manager.render();});assert.match(await page.locator('[data-project-view="0"]').innerText(),/unavailable.*Assignment and progress retained/s);assert.equal(await page.locator('[data-project-status="0"]').inputValue(),'Completed');
    await page.locator('[data-tab="Factions"]').click();await page.locator('[data-action="add"]').click();
    await page.locator('[name="settlement.factions.0.title"]').fill('The Guards');await page.locator('[name="settlement.factions.0.info"]').fill('Faction notes\nIndependent faction description\nFaction GM notes');
    const factionId=await page.evaluate(()=>manager.draft.settlement.factions[0].id);
    await page.locator('[data-tab="Inhabitants"]').click();await page.locator('[data-action="add"]').click();await page.locator('[name="settlement.inhabitants.0.title"]').fill('Mara');await page.locator('[name="settlement.inhabitants.0.role"]').fill('Custom occupation');await page.locator('[name="settlement.inhabitants.0.factionId"]').selectOption(factionId);await page.locator('[name="settlement.inhabitants.0.disposition"]').selectOption('Unfriendly');await page.locator('[name="settlement.inhabitants.0.details"]').fill('Descriptive NPC without creating an Actor');await page.locator('[name="settlement.inhabitants.0.notes"]').fill('NPC private notes');
    await page.locator('[data-inhabitant-portrait-pick]').click();await dropSpecial(page.locator('[data-reference]'),'Actor.one');await saveSpecial();
    await page.locator('[data-tab="Factions"]').click();await page.locator('[data-remove]').click();await page.waitForFunction(()=>manager.draft.settlement.factions.length===0);await page.locator('[data-tab="Inhabitants"]').click();assert.match(await page.locator('[name="settlement.inhabitants.0.factionId"] option:checked').innerText(),/Missing faction/);assert.equal(await page.locator('[name="settlement.inhabitants.0.title"]').inputValue(),'Mara');
    for(const [tab,key,status,extra] of [['Events','events','Active',['trigger','outcomes','related']],['Threads','threads','In Progress',['npcs','factions','clues','developments','resolution']]]){
      await page.locator(`[data-tab="${tab}"]`).click();await page.locator('[data-action="add"]').click();await page.locator(`[name="settlement.${key}.0.title"]`).fill('Authored '+tab);await page.locator(`[name="settlement.${key}.0.details"]`).fill(settlementDescription);await page.locator(`[name="settlement.${key}.0.status"]`).selectOption(status);await page.locator(`[name="settlement.${key}.0.notes"]`).fill('GM '+tab);for(const field of extra)await page.locator(`[name="settlement.${key}.0.${field}"]`).fill('Saved '+field);
    }
    await page.evaluate(async()=>{
      for(const [uuid,type,name,cost,requirement] of [['Item.shopGear','gear','Rope','3 bullets','Technology 10 and a very long requirement that must remain available in its tooltip'],['Compendium.myz.items.Item.shopArtifact','artifact','Ancient Battery','Rare','Technology 20'],['Item.shopSecond','gear','Tools','5 bullets','Culture 5'],['Item.shopReplacement','artifact','Replacement','Barter','Warfare 10']])docs.set(uuid,{uuid,type,name,documentName:'Item',system:{cost,requirement:type==='artifact'?'Wrong Gear Requirement':requirement,dev_requirement:type==='artifact'?requirement:'Wrong Artifact Requirement',weight:'0.50',comment:'Original comment\nSecond line'},_onClickDocumentLink:async()=>nativeClicks.push(uuid),update:()=>sourceMutations.push('update Item'),delete:()=>sourceMutations.push('delete Item')});
      globalThis.legacyShopBackup=[{id:'legacy-shop1',title:'Scrap Market',proprietor:'Trader',notes:'Preserve private notes',inventory:[{id:'legacy1',uuid:'Item.shopGear',price:'Old barter',quantity:'Several crates'},{id:'legacy2',title:'Repair service',details:'No source Item',price:'A favor'}]},{id:'legacy-shop2',title:'Water Trader',inventory:[{id:'legacy3',uuid:'Compendium.myz.items.Item.shopArtifact'},{id:'legacy4',uuid:'Item.shopGear',notes:'Duplicate source, preserve notes'}]}];
      manager.capture();const saved=structuredClone(manager.journal.getFlag('myz-sector-manager','sector'));saved.settlement.shops=structuredClone(legacyShopBackup);delete saved.settlement.shop;await manager.journal.setFlag('myz-sector-manager','sector',saved);manager.draft=manager.loadDraft(saved);manager.dirty=false;manager.tab='Shop';await manager.render();
    });
    const shopDrop=async(target,uuid)=>{await target.evaluate((el,uuid)=>{const transfer=new DataTransfer();transfer.setData('text/plain',JSON.stringify({uuid,type:'Item'}));el.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));},uuid);await page.waitForFunction(()=>!manager.droppingShop);};
    assert.deepEqual(await page.locator('.sm-shop-table').first().locator('th').allTextContents(),['Item','Cost','Req.','Weight','Comment']);assert.equal(await page.locator('[data-action="add"]').count(),0);assert.equal(await page.locator('[data-settlement-inventory-add]').count(),0);
    assert.equal(await page.locator('[data-shop-group]').count(),2);assert.equal(await page.locator('[data-shop-entry]').count(),2);assert.deepEqual(await page.evaluate(()=>manager.draft.settlement.shops),await page.evaluate(()=>legacyShopBackup));
    await page.locator('summary').filter({hasText:'Player Shop and Resource Trading'}).click();
    assert.equal(await page.locator('[name="settlement.shop.trading.values.bullets"]').getAttribute('inputmode'),'decimal');
    for(const [key,value] of [['bullets','.5'],['cleanGrub','0.25'],['cleanWater','1.5'],['booze','2.750000000000000001']])await page.locator(`[name="settlement.shop.trading.values.${key}"]`).fill(value);
    await page.locator('[data-rate-key="booze"][data-rate-step="1"]').click();assert.equal(await page.locator('[name="settlement.shop.trading.values.booze"]').inputValue(),'3.750000000000000001');await page.locator('[data-rate-key="booze"][data-rate-step="-1"]').click();assert.equal(await page.locator('[name="settlement.shop.trading.values.booze"]').inputValue(),'2.750000000000000001');assert(await page.locator('[data-rate-key="bullets"][data-rate-step="-1"]').isDisabled());
    assert(await page.locator('.sm-shop-rates label').evaluateAll(labels=>labels.every(label=>Math.abs(label.getBoundingClientRect().top-labels[0].getBoundingClientRect().top)<1)));
    await saveSpecial();assert.deepEqual(await page.evaluate(()=>manager.journal.getFlag('myz-sector-manager','sector').settlement.shop.trading.values),{bullets:'0.5',cleanGrub:'0.25',cleanWater:'1.5',booze:'2.750000000000000001'});

    const gearRow=page.locator('[data-shop-entry]').first();assert.equal(await gearRow.locator('[data-shop-link]').innerText(),'Rope');assert.equal(await gearRow.locator('[data-shop-link]').evaluate(td=>td.children.length===2&&td.firstElementChild.tagName==='A'&&!td.querySelector('i,svg,img')),true);assert.equal(await gearRow.locator('[data-shop-cost]').innerText(),'3 bullets');assert.equal(await gearRow.locator('[data-shop-weight]').innerText(),'0.50');assert.equal(await gearRow.locator('[data-shop-requirement]').getAttribute('title'),'Technology 10 and a very long requirement that must remain available in its tooltip');assert.equal(await page.locator('[data-shop-entry]').last().locator('[data-shop-requirement]').innerText(),'Technology 20');assert.match(await gearRow.locator('[data-shop-comment]').innerText(),/Original comment\nSecond line/);
    await gearRow.locator('a').click();await gearRow.locator('a').press('Enter');assert.equal(await page.evaluate(()=>nativeClicks.filter(uuid=>uuid==='Item.shopGear').length),2);
    await page.locator('summary').filter({hasText:'Previous Shop data'}).click();const backupDownload=page.waitForEvent('download');await page.locator('[data-shop-backup]').click();const backup=await backupDownload;assert.deepEqual(JSON.parse(readFileSync(await backup.path(),'utf8')),await page.evaluate(()=>legacyShopBackup));await page.locator('summary').filter({hasText:'Previous Shop data'}).click();
    await page.locator('[data-shop-add-group]').click();await page.locator('[name="settlement.shop.groups.2.name"]').fill('Custom Tools');await page.locator('[name="settlement.shop.groups.2.name"]').press('Tab');await page.waitForFunction(()=>manager.draft.settlement.shop.groups[2].name==='Custom Tools');
    const toolsId=await page.evaluate(()=>manager.draft.settlement.shop.groups[2].id),firstGroupId=await page.evaluate(()=>manager.draft.settlement.shop.groups[0].id);
    await shopDrop(page.locator('.sm-content'),'Item.shopSecond');assert.equal(await page.evaluate(id=>manager.draft.settlement.shop.groups.find(g=>g.id===id).entries[0].uuid,toolsId),'Item.shopSecond');
    // Native v14 resolver path, successive drops through rerenders/type/collapse/reopen.
    await page.evaluate(()=>{globalThis.shopDropCalls=[];globalThis.CONFIG??={};CONFIG.Item={documentClass:{fromDropData:async data=>{shopDropCalls.push(data);return docs.get(data.uuid||`Item.${data.id}`);}}};for(let i=0;i<6;i++)docs.set(`Item.repeat${i}`,{uuid:`Item.repeat${i}`,name:`Repeated ${i}`,documentName:'Item',type:'custom',system:{}});});
    const repeatDrop=async(i,target)=>{await shopDrop(target,`Item.repeat${i}`);assert.equal(await page.evaluate(i=>manager.draft.settlement.shop.groups.flatMap(g=>g.entries).filter(e=>e.uuid===`Item.repeat${i}`).length,i),1);};
    await repeatDrop(0,page.locator(`[data-shop-group="${toolsId}"] .sm-shop-sticky`));
    await repeatDrop(1,page.locator(`[data-shop-group="${toolsId}"] .sm-shop-body-table`));
    await page.locator(`[data-shop-group-type="${toolsId}"]`).selectOption('weapons');
    await repeatDrop(2,page.locator(`[data-shop-group="${toolsId}"] .sm-shop-sticky`));
    await page.locator(`[data-shop-toggle="${toolsId}"]`).click();await page.locator(`[data-shop-toggle="${toolsId}"]`).click();
    await repeatDrop(3,page.locator(`[data-shop-group="${firstGroupId}"] .sm-shop-sticky`));
    await saveSpecial();await page.evaluate(async()=>{const id=manager.sectorId;await manager.close();globalThis.manager=await game.myzSectorManager.open(id);manager.tab='Shop';await manager.render();});
    await repeatDrop(4,page.locator(`[data-shop-group="${toolsId}"] .sm-shop-sticky`));
    await page.locator(`[data-shop-group="${toolsId}"] .sm-shop-sticky`).evaluate(el=>{const transfer=new DataTransfer();transfer.setData('text/plain',JSON.stringify({type:'Item',id:'repeat5'}));el.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));});await page.waitForFunction(()=>!manager.droppingShop);
    assert.equal(await page.evaluate(()=>shopDropCalls.length),6);
    assert.equal(await page.evaluate(id=>manager.draft.settlement.shop.groups.find(g=>g.id===id).entries.filter(e=>e.uuid.startsWith('Item.repeat')).length,toolsId),5);
    const repeatCount=await page.locator('[data-shop-entry]').count();
    await shopDrop(page.locator('.sm-content'),'Compendium.missing.items.Item.absent');assert.match(await page.evaluate(()=>notifyErrors.pop()),/missing or inaccessible/);assert.equal(await page.locator('[data-shop-entry]').count(),repeatCount);
    await page.locator('.sm-content').evaluate(el=>{const transfer=new DataTransfer();transfer.setData('text/plain','{broken');el.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));});await page.waitForFunction(()=>!manager.droppingShop);assert.match(await page.evaluate(()=>notifyErrors.pop()),/Invalid drag data/);
    // Remove only test references, leaving the established Shop regression scenario intact.
    await page.evaluate(async()=>{for(const group of manager.draft.settlement.shop.groups)group.entries=group.entries.filter(e=>!e.uuid.startsWith('Item.repeat'));await manager.render();});
    // Cross-group drops move a UUID without duplication; same-group drops select it.
    await shopDrop(page.locator(`[data-shop-group="${toolsId}"] .sm-shop-body-table`),'Item.shopGear');assert.equal(await page.evaluate(()=>manager.draft.settlement.shop.groups.flatMap(g=>g.entries).filter(e=>e.uuid==='Item.shopGear').length),1);assert.equal(await page.evaluate(id=>manager.draft.settlement.shop.groups.find(g=>g.id===id).entries.length,firstGroupId),0);
    await shopDrop(page.locator(`[data-shop-group="${toolsId}"] .sm-shop-body-table`),'Item.shopGear');assert.equal(await page.locator('[data-shop-entry]').count(),3);
    await shopDrop(page.locator('.sm-content'),'Compendium.myz.projects.Item.watchtower');assert.equal(await page.locator('[data-shop-entry]').count(),4);await page.locator('[data-shop-remove]').click();await page.waitForFunction(()=>document.querySelectorAll('[data-shop-entry]').length===3);await shopDrop(page.locator('.sm-content'),'Actor.one');assert.match(await page.evaluate(()=>notifyErrors.pop()),/Item document/);assert.equal(await page.locator('[data-shop-entry]').count(),3);
    // Group ordering and explicit Item moves retain entry identity.
    await page.locator(`[data-shop-group-up="${toolsId}"]`).click();await page.waitForFunction(id=>manager.draft.settlement.shop.groups[1].id===id,toolsId);
    const tools=page.locator(`[data-shop-group="${toolsId}"]`),ropeId=await page.evaluate(id=>manager.draft.settlement.shop.groups.find(g=>g.id===id).entries.find(e=>e.uuid==='Item.shopGear').id,toolsId);
    await page.locator('[data-shop-choice]').selectOption(ropeId);await page.locator('[data-shop-entry-up]').click();await page.waitForFunction(({toolsId,ropeId})=>manager.draft.settlement.shop.groups.find(g=>g.id===toolsId).entries[0].id===ropeId,{toolsId,ropeId});await page.locator('[data-shop-move]').selectOption(firstGroupId);await page.waitForFunction(id=>manager.draft.settlement.shop.groups.find(g=>g.id===id).entries.length===1,firstGroupId);
    assert.equal(await page.locator(`[data-shop-delete-group="${firstGroupId}"]`).count(),0);await tools.locator('[data-shop-toggle]').click();assert.equal(await tools.locator('.sm-shop-body-table').isVisible(),false);await tools.locator('[data-shop-toggle]').click();assert.equal(await tools.locator('.sm-shop-body-table').isVisible(),true);
    await page.evaluate(()=>{docs.get('Item.shopGear').name='Renamed Rope';docs.get('Item.shopGear').system.cost='7 bullets';docs.get('Item.shopGear').system.comment='<b>Literal source text</b>\nStill a StringField';});await page.locator('[data-shop-refresh]').click();await page.waitForFunction(()=>document.querySelector('[data-shop-cost]')?.textContent==='7 bullets');assert.equal(await page.locator('[data-shop-link]').first().innerText(),'Renamed Rope');assert.equal(await page.locator('[data-shop-comment]').first().locator('b').count(),0);assert.match(await page.locator('[data-shop-comment]').first().innerText(),/<b>Literal source text<\/b>/);
    await page.evaluate(()=>docs.delete('Item.shopGear'));await page.locator('[data-shop-refresh]').click();await page.waitForFunction(()=>document.querySelector('[data-shop-link]')?.textContent==='Missing Item');assert.equal(await page.evaluate(()=>manager.draft.settlement.shop.groups.flatMap(g=>g.entries).some(e=>e.uuid==='Item.shopGear')),true);
    const missingGroup=page.locator(`[data-shop-group="${firstGroupId}"]`);await page.locator('[data-shop-replace]').click();await page.waitForFunction(()=>Boolean(manager.shopStates.get(manager.sectorId).replace));await shopDrop(page.locator('.sm-content'),'Item.shopReplacement');assert.equal(await page.evaluate(({firstGroupId,ropeId})=>manager.draft.settlement.shop.groups.find(g=>g.id===firstGroupId).entries[0].id===ropeId&&manager.draft.settlement.shop.groups.find(g=>g.id===firstGroupId).entries[0].uuid==='Item.shopReplacement',{firstGroupId,ropeId}),true);
    await page.evaluate(()=>{foundry.applications.api.DialogV2.confirm=async()=>false;});await page.locator('[data-shop-remove]').click();assert.equal(await missingGroup.locator('[data-shop-entry]').count(),1);await page.evaluate(()=>{foundry.applications.api.DialogV2.confirm=async()=>true;});await page.locator('[data-shop-remove]').click();await page.waitForFunction(id=>manager.draft.settlement.shop.groups.find(g=>g.id===id).entries.length===0,firstGroupId);await page.locator(`[data-shop-delete-group="${firstGroupId}"]`).click();await page.waitForFunction(id=>!manager.draft.settlement.shop.groups.some(g=>g.id===id),firstGroupId);await saveSpecial();
    assert.deepEqual(await page.evaluate(()=>manager.draft.settlement.shops),await page.evaluate(()=>legacyShopBackup));assert.deepEqual(await page.evaluate(()=>sourceMutations),[]);await page.screenshot({path:'/tmp/myz-single-shop.png'});
    const savedSettlement=await page.evaluate(()=>structuredClone(manager.journal.getFlag('myz-sector-manager','sector').settlement));
    await page.locator('[data-tab="Overview"]').click();assert.equal(await page.locator('[name="settlement.description"]').inputValue(),settlementDescription);
    await page.locator('[name="settlement.leadership"]').fill('Unsaved change');await page.evaluate(()=>{globalThis.unsavedChoice='cancel';foundry.applications.api.DialogV2.confirm=async()=>false;});await page.evaluate(()=>manager.close());assert.equal(await page.evaluate(()=>manager.rendered),true);
    await page.evaluate(()=>{globalThis.unsavedChoice='discard';foundry.applications.api.DialogV2.confirm=async()=>true;});await page.evaluate(()=>manager.close());await page.evaluate(async()=>{manager=await game.myzSectorManager.open(settlementId);});assert.deepEqual(await page.evaluate(()=>manager.draft.settlement),savedSettlement);
    // Type conversion preserves both authored and inactive content through all three types.
    for(const type of ['normal','special','settlement']){
      await page.evaluate(type=>{foundry.applications.api.DialogV2.wait=async()=>type;},type);await page.locator('[data-action="change-type"]').click();await page.waitForFunction(type=>manager.draft.sectorType===type,type);await saveSpecial();assert.deepEqual(await page.evaluate(()=>manager.draft.settlement),savedSettlement);
    }
    // Switching the configured Zone Scene refreshes the sidebar scope without leaking same-coordinate content.
    await page.evaluate(async()=>{globalThis.settlementZoneConfig=structuredClone(zoneState());const next={...structuredClone(settlementZoneConfig),sceneId:'combat',groups:[]};const doc=records.get(game.settings.get('myz-sector-manager','zoneConfigurationId'));await doc.setFlag('myz-sector-manager','zoneConfiguration',next);});
    await page.waitForFunction(()=>!document.querySelector('[data-open="'+settlementId+'"]'));
    await page.evaluate(async()=>{await manager.newSector('F6',()=>true,'settlement');globalThis.combatSettlementId=manager.sectorId;});await page.locator('[data-sector-name]').fill('Combat Scene Village');await saveSpecial();
    assert.equal(await page.evaluate(()=>manager.draft.sceneId),'combat');
    await page.evaluate(async()=>{await records.get(game.settings.get('myz-sector-manager','zoneConfigurationId')).setFlag('myz-sector-manager','zoneConfiguration',settlementZoneConfig);});
    await page.waitForFunction(()=>Boolean(document.querySelector('[data-open="'+settlementId+'"]'))&&!document.querySelector('[data-open="'+combatSettlementId+'"]'));
    await page.evaluate(async()=>{await manager.navigate(settlementId);});assert.deepEqual(await page.evaluate(()=>manager.draft.settlement),savedSettlement);
    // A second Settlement can reference the same Compendium project independently.
    await page.evaluate(async()=>{await manager.newSector('F7',()=>true,'settlement');});await page.locator('[data-sector-name]').fill('Outpost');await saveSpecial();const secondSettlementId=await page.evaluate(()=>manager.sectorId);await page.locator('[data-tab="Projects"]').click();await dropSpecial(page.locator('.sm-content'),'Compendium.myz.projects.Item.watchtower');assert.equal(await page.locator('[data-project-status="0"]').inputValue(),'Not completed');await saveSpecial();
    await page.evaluate(async id=>{await manager.navigate(id);},await page.evaluate(()=>settlementId));await page.locator('[data-tab="Projects"]').click();assert.equal(await page.locator('[data-project-status="0"]').inputValue(),'Completed');
    await page.locator('[data-remove]').last().click();await page.waitForFunction(()=>manager.draft.settlement.projects.length===1);assert.deepEqual(await page.evaluate(()=>sourceMutations),[]);await saveSpecial();
    // Long content and large lists stay within the same scrollable/resizable shell.
    await page.evaluate(async()=>{manager.draft.settlement.inhabitants=Array.from({length:50},(_,i)=>({...manager.draft.settlement.inhabitants[0],id:'large-npc-'+i,title:'Resident '+i}));manager.dirty=true;manager.tab='Inhabitants';await manager.render();manager.element.style.width='760px';manager.element.style.height='420px';});
    assert.equal(await page.locator('[data-entry]').count(),50);await page.locator('[data-collapse-all]').click();await page.locator('[data-expand-all]').click();assert.equal(await page.locator('[data-entry-toggle][aria-expanded="true"]').count(),50);
    assert(await page.locator('.sm-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await page.locator('.sm-content').hover();await page.mouse.wheel(0,500);await page.waitForFunction(()=>document.querySelector('.sm-content').scrollTop>0);await saveSpecial();
    await page.evaluate(async id=>{await manager.navigate(id);manager.journal.delete=async()=>{const i=records.indexOf(manager.journal);records.splice(i,1);};},secondSettlementId);await page.locator('[data-action="delete"]').click();await page.waitForFunction(()=>manager.sectorId===null);assert.equal(await page.evaluate(id=>Boolean(records.get(id)),secondSettlementId),false);
    await page.evaluate(async()=>{await manager.navigate(settlementId);manager.tab='Overview';manager.element.style.width='920px';manager.element.style.height='730px';await manager.render();});await page.screenshot({path:'/tmp/myz-settlement-editor.png'});
    assert.equal(await page.evaluate(()=>JSON.stringify(records.get('sector1').flags)===originalSectorSnapshot),true);assert.deepEqual(await page.evaluate(()=>sourceMutations),[]);
    // Type-specific columns, a single anchored toolbar, and real sticky/scroll geometry.
    await page.evaluate(async()=>{
      await manager.navigate(settlementId);manager.tab='Shop';manager.element.style.width='920px';manager.element.style.height='730px';
      const types=['general','weapons','armor','vehicles','services'];globalThis.typedGroupIds={};
      manager.draft.settlement.shop.groups=types.map((type,groupIndex)=>{
        const group={id:'typed-'+type,name:'Custom '+type,type,metadata:{keep:true},entries:[]};typedGroupIds[type]=group.id;
        for(let i=0;i<32;i++){
          const uuid='Item.long-'+type+'-'+i,id='entry-'+type+'-'+i,system={cost:'3 bullets',requirement:'Custom requirement',weight:'0.50',comment:'Stock '+i};let itemType='compatible-module-item';
          if(type==='weapons'){itemType='weapon';Object.assign(system,{damage:2,range:'range_near',bonus:{value:1,max:3},dev_requirement:'Warfare 10'});}
          if(type==='armor'){itemType='armor';Object.assign(system,{rating:{value:3,max:4},rot:{value:0,max:2}});}
          if(type==='vehicles')Object.assign(system,{passengers:i===0?4:undefined,travelType:i===0?'Water':undefined});
          docs.set(uuid,{uuid,name:type+' Item '+i,type:itemType,documentName:'Item',system,_onClickDocumentLink:async()=>nativeClicks.push(uuid),update:()=>sourceMutations.push('typed update'),delete:()=>sourceMutations.push('typed delete')});group.entries.push({id,uuid});
        }return group;
      });
      globalThis.vehicleSourceBefore=structuredClone(docs.get('Item.long-vehicles-0').system);game.i18n={localize:key=>key==='MYZ.RANGE_NEAR'?'Near':key};manager.dirty=true;await manager.render();
    });
    const typedColumns={general:['Item','Cost','Req.','Weight','Comment'],weapons:['Item','Cost','Damage','Range','Bonus','Weight','Comment'],armor:['Item','Cost','Rating','Rot Prot.','Weight','Comment'],vehicles:['Vehicle','Cost','Gear Bonus','Armor','Resilience','Occupants'],services:['Item','Cost','Req.','Comment']};
    for(const [type,labels] of Object.entries(typedColumns))assert.deepEqual(await page.locator(`[data-shop-group="typed-${type}"] .sm-shop-column-table th`).allTextContents(),labels);
    const weaponRow=page.locator('[data-shop-entry="entry-weapons-0"]'),armorRow=page.locator('[data-shop-entry="entry-armor-0"]');assert.equal(await weaponRow.locator('[data-shop-damage]').innerText(),'2');assert.equal(await weaponRow.locator('[data-shop-range]').innerText(),'Near');assert.equal(await weaponRow.locator('[data-shop-bonus]').innerText(),'1 / 3');assert.equal(await armorRow.locator('[data-shop-rating]').innerText(),'3 / 4');assert.equal(await armorRow.locator('[data-shop-rot]').innerText(),'0 / 2');
    for(const type of Object.keys(typedColumns))assert.equal(await page.locator(`[data-shop-group="typed-${type}"] .sm-shop-column-table th`).first().evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');
    assert.equal(await page.locator('[data-shop-toolbar]').count(),1);assert.equal(await page.locator('[data-shop-group] [data-shop-toolbar]').count(),0);assert.equal(await page.locator('[data-shop-delete-group]').count(),0);assert.equal(await page.locator('[data-shop-toggle]').first().innerText(),'▼');assert.equal(await page.locator('[data-shop-group="typed-general"] .sm-shop-heading').innerText().then(text=>text.includes('Group name')),false);assert.equal(await page.locator('[data-shop-group="typed-general"] .sm-shop-name').inputValue(),'Custom general');
    const normalToolbar=await page.locator('[data-shop-toolbar]').evaluate(el=>{const box=el.getBoundingClientRect();return {width:el.clientWidth,scroll:el.scrollWidth,ys:[...el.children].map(child=>child.getBoundingClientRect().top),height:box.height};});assert(normalToolbar.scroll<=normalToolbar.width+1);assert(Math.max(...normalToolbar.ys)-Math.min(...normalToolbar.ys)<8,'Toolbar is one compact row at normal editor width');
    assert.deepEqual(await page.locator('[data-shop-toolbar]>label').evaluateAll(labels=>labels.map(label=>label.firstChild.textContent.trim())),['Selection','Move']);assert.equal(await page.locator('[data-shop-replace]').innerText(),'Replace');assert.equal(await page.locator('[data-shop-remove]').innerText(),'Remove');
    const inventory=page.locator('[data-shop-inventory]'),toolbarBefore=await page.locator('[data-shop-toolbar]').boundingBox();await inventory.evaluate(el=>el.scrollTop=150);assert.equal(await page.locator('.sm-content').evaluate(el=>el.scrollTop),0);const stickyFirst=await page.evaluate(()=>{const view=document.querySelector('[data-shop-inventory]').getBoundingClientRect(),sticky=document.querySelector('[data-shop-group="typed-general"] .sm-shop-sticky').getBoundingClientRect(),columns=document.querySelector('[data-shop-group="typed-general"] [data-shop-columns]').getBoundingClientRect();return {view:view.top,heading:sticky.top,columns:columns.top,bottom:sticky.bottom};});assert(Math.abs(stickyFirst.heading-stickyFirst.view)<3);assert(stickyFirst.columns>=stickyFirst.heading&&stickyFirst.columns<stickyFirst.bottom);
    // The next group's combined wrapper pushes out the old heading/columns as one unit.
    const weaponsStart=await page.evaluate(()=>{const view=document.querySelector('[data-shop-inventory]'),next=document.querySelector('[data-shop-group="typed-weapons"]');return next.getBoundingClientRect().top-view.getBoundingClientRect().top+view.scrollTop;});
    await inventory.evaluate((el,top)=>el.scrollTop=top-25,weaponsStart);const push=await page.evaluate(()=>{const first=document.querySelector('[data-shop-group="typed-general"] .sm-shop-sticky').getBoundingClientRect(),next=document.querySelector('[data-shop-group="typed-weapons"] .sm-shop-sticky').getBoundingClientRect();return {first:first.bottom,next:next.top};});assert(push.first<=push.next+1);
    await inventory.evaluate((el,top)=>el.scrollTop=top+90,weaponsStart);const stuckWeapons=await page.evaluate(()=>{const v=document.querySelector('[data-shop-inventory]').getBoundingClientRect(),s=document.querySelector('[data-shop-group="typed-weapons"] .sm-shop-sticky').getBoundingClientRect();return Math.abs(v.top-s.top);});assert(stuckWeapons<3);const toolbarAfter=await page.locator('[data-shop-toolbar]').boundingBox();assert(Math.abs(toolbarAfter.y-toolbarBefore.y)<1);
    // Global selection works across groups and survives scrolling; reorder retains actual row DOM.
    await page.locator('[data-shop-choice]').selectOption('entry-weapons-20');await page.evaluate(()=>{globalThis.reorderRow=document.querySelector('[data-shop-entry="entry-weapons-20"]');});const beforeReorder=await inventory.evaluate(el=>el.scrollTop);assert(beforeReorder>0);
    await page.locator('[data-shop-toggle="typed-armor"]').click();
    for(let i=0;i<5;i++){await page.locator('[data-shop-entry-up]').click();assert.equal(await page.locator('[data-shop-choice]').inputValue(),'entry-weapons-20');assert(await page.evaluate(()=>reorderRow===document.querySelector('[data-shop-entry="entry-weapons-20"]')));const visible=await page.evaluate(()=>{const v=document.querySelector('[data-shop-inventory]').getBoundingClientRect(),r=reorderRow.getBoundingClientRect(),sticky=reorderRow.closest('[data-shop-group]').querySelector('.sm-shop-sticky').getBoundingClientRect();return r.top>=v.top+sticky.height-1&&r.bottom<=v.bottom+1;});assert(visible);}
    await page.locator('[data-shop-entry-down]').click();assert.equal(await page.locator('[data-shop-toggle="typed-armor"]').getAttribute('aria-expanded'),'false');assert(await inventory.evaluate(el=>el.scrollTop)>0);assert.equal(await page.locator('[data-shop-group="typed-armor"] [data-shop-columns]').isVisible(),false);
    const beforeRefreshScroll=await inventory.evaluate(el=>el.scrollTop);await page.locator('[data-shop-refresh]').click();await page.waitForFunction(()=>document.querySelector('[data-shop-choice]').value==='entry-weapons-20');assert(Math.abs(await inventory.evaluate(el=>el.scrollTop)-beforeRefreshScroll)<2);assert.equal(await page.locator('[data-shop-toggle="typed-armor"]').getAttribute('aria-expanded'),'false');
    // Type changes preserve names, IDs, order and metadata while replacing only the displayed columns.
    const generalBefore=await page.evaluate(()=>structuredClone(manager.draft.settlement.shop.groups[0]));await page.locator('[data-shop-group-type="typed-general"]').selectOption('services');assert.deepEqual(await page.locator('[data-shop-group="typed-general"] .sm-shop-column-table th').allTextContents(),typedColumns.services);assert.deepEqual(await page.evaluate(()=>manager.draft.settlement.shop.groups[0].entries),generalBefore.entries);assert.equal(await page.locator('[data-shop-group="typed-general"] .sm-shop-name').inputValue(),generalBefore.name);await page.locator('[data-shop-group-type="typed-general"]').selectOption('general');
    // Vehicles use entry-local travel modes and no invented passenger values.
    // Legacy Vehicle Item references are retained visibly without editable passenger/travel controls.
    await page.locator('[data-shop-choice]').selectOption('entry-vehicles-0');assert.equal(await page.locator('[data-shop-passenger-value], [data-shop-travel]').count(),0);assert.match(await page.locator('[data-shop-entry="entry-vehicles-0"]').innerText(),/Legacy Item reference retained/);
    await page.evaluate(()=>{const vehicle={documentName:'Actor',type:'vehicle',uuid:'Actor.shopVehicle',name:'Zone Truck',system:{cost:50,movementBonus:{current:2,max:3},vehicleArmor:{current:4,max:5},resilience:{current:6,max:7},occupantsCount:8},_onClickDocumentLink:()=>nativeClicks.push('Actor.shopVehicle')};docs.set(vehicle.uuid,vehicle);});
    await page.locator('[data-shop-reference="entry-vehicles-0"]').fill('Actor.shopVehicle');await page.locator('[data-shop-reference="entry-vehicles-0"]').press('Tab');await page.waitForFunction(()=>manager.draft.settlement.shop.groups.find(g=>g.id==='typed-vehicles').entries[0].uuid==='Actor.shopVehicle');await page.waitForFunction(()=>document.querySelector('[data-shop-entry="entry-vehicles-0"] [data-shop-occupants]')?.textContent==='8');assert.deepEqual(await page.locator('[data-shop-entry="entry-vehicles-0"] [data-shop-field]').allTextContents(),['Zone Truck','50','2 / 3','4 / 5','6 / 7','8']);assert.deepEqual(await page.evaluate(()=>docs.get('Item.long-vehicles-0').system),await page.evaluate(()=>vehicleSourceBefore));
    await page.locator('[data-shop-choice]').selectOption('');assert.equal(await page.locator('[data-shop-replace]').isDisabled(),true);assert.equal(await page.locator('[data-shop-remove]').isDisabled(),true);assert.equal(await page.locator('[data-shop-move]').isDisabled(),true);await page.locator('[data-shop-choice]').selectOption('entry-services-12');assert.equal(await page.locator('[data-shop-remove]').isDisabled(),false);
    await page.evaluate(()=>manager.element.style.width='610px');const narrowShop=await page.locator('[data-shop-toolbar]').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,children:[...el.children].map(node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};})}));assert(narrowShop.scroll<=narrowShop.width+1);assert(await inventory.evaluate(el=>el.scrollWidth<=el.clientWidth+1));await page.evaluate(()=>manager.element.style.width='920px');await saveSpecial();
    const typedSaved=await page.evaluate(()=>structuredClone(manager.draft.settlement.shop));await page.evaluate(async()=>{await manager.close();manager=await game.myzSectorManager.open(settlementId);manager.tab='Shop';await manager.render();});assert.deepEqual(await page.evaluate(()=>manager.draft.settlement.shop),typedSaved);assert.equal(await page.locator('[data-shop-reference="entry-vehicles-0"]').inputValue(),'Actor.shopVehicle');await page.locator('[data-shop-choice]').selectOption('entry-weapons-20');await page.screenshot({path:'/tmp/myz-shop-types.png'});
    console.log('Compact headings/empty-only Delete, single global bottom toolbar, actual sticky header handoff, responsive layout, all five types and any Item source, entry-local vehicle modes and repeated DOM-preserving reorder/scroll checks pass');
    await page.evaluate(()=>{
      globalThis.actorSideEffects=0;
      for(const [uuid,type,name,description] of [['Actor.infoImport','mutant','Info Scout','<p>A <strong>watchful</strong> scout.</p><p>Background paragraph.</p><script>actorSideEffects++</script><img src=x onerror="actorSideEffects++">'],['Compendium.myz.actors.Actor.infoImport','npc','Compendium Guard','<p>A <em>quiet</em> guard.</p>'],['Actor.emptyInfo','npc','Unnamed Wanderer',''],['Actor.manualLink','human','Linked Actor','<p>Do not overwrite existing notes.</p>']])docs.set(uuid,{uuid,type,name,documentName:'Actor',img:'/test-tall.svg',system:{description,notes:'<p>Private narrative notes</p>',myHome:'North Tower',party:[{value:'Finn',isBuddy:true}],hate:'Slavers',protect:'The weak',dream:'A safer Zone',attributes:{strength:99}},_onClickDocumentLink:async()=>nativeClicks.push(uuid),update:()=>sourceMutations.push('Actor update'),delete:()=>sourceMutations.push('Actor delete')});
    });
    for(const [sectorId,tab,key] of [[await page.evaluate(()=>records.get('sector1').id),'Encounters','encounters'],[specialId,'Inhabitants','special.inhabitants'],[await page.evaluate(()=>settlementId),'Inhabitants','settlement.inhabitants']]){
      await page.evaluate(async id=>{await manager.navigate(id);},sectorId);await page.locator(`[data-tab="${tab}"]`).click();
      const originalManual=await page.evaluate(key=>JSON.stringify(key.split('.').reduce((value,k)=>value[k],manager.draft)),key),count=await page.locator('[data-entry]').count();
      await blankDrop('Actor.infoImport','Actor',true);assert.equal(await page.locator('[data-entry]').count(),count+1);
      let card=page.locator('[data-entry]').filter({has:page.locator('input[name$=".uuid"][value="Actor.infoImport"]')});if(await card.locator('[data-entry-toggle]').getAttribute('aria-expanded')==='false')await card.locator('[data-entry-toggle]').click();assert.equal(await card.locator('[name$=".title"]').inputValue(),'Info Scout');assert.match(await card.locator('textarea[name$=".details"]').inputValue(),/<strong>watchful<\/strong>/);assert.match(await card.locator('[data-inhabitant-preview]').innerText(),/Relationships[\s\S]*Finn \(Buddy\)[\s\S]*North Tower[\s\S]*Background paragraph[\s\S]*Private narrative notes/);assert.equal(await card.locator('[data-inhabitant-preview] strong').innerText(),'watchful');assert.equal(await page.evaluate(()=>actorSideEffects),0);assert.doesNotMatch(await card.locator('textarea[name$=".details"]').inputValue(),/onerror|<script|strength/);
      assert.equal(await page.evaluate(key=>key.split('.').reduce((value,k)=>value[k],manager.draft).at(-1).portrait,key),'/test-tall.svg');await card.locator('[data-reference]:not([data-type="Macro"]) a').click();assert.equal(await page.evaluate(()=>nativeClicks.at(-1)),'Actor.infoImport');
      await card.locator('textarea[name$=".details"]').fill('Local campaign detail <em>only here</em>');await saveSpecial();await page.evaluate(async()=>{docs.get('Actor.infoImport').system.description='<p>Source description changed later.</p>';await manager.render();});assert.equal(await page.locator('[data-entry]').filter({has:page.locator('input[name$=".uuid"][value="Actor.infoImport"]')}).locator('textarea[name$=".details"]').inputValue(),'Local campaign detail <em>only here</em>');
      await blankDrop('Actor.infoImport','Actor');assert.equal(await page.locator('[data-entry]').count(),count+1);assert.equal(await page.locator('[data-entry]').filter({has:page.locator('input[name$=".uuid"][value="Actor.infoImport"]')}).locator('textarea[name$=".details"]').inputValue(),'Local campaign detail <em>only here</em>');
      await blankDrop('Compendium.myz.actors.Actor.infoImport','Actor');assert.equal(await page.locator('[data-entry]').count(),count+2);card=page.locator('[data-entry]').filter({has:page.locator('input[name$=".uuid"][value="Compendium.myz.actors.Actor.infoImport"]')});if(await card.locator('[data-entry-toggle]').getAttribute('aria-expanded')==='false')await card.locator('[data-entry-toggle]').click();assert.match(await card.locator('textarea[name$=".details"]').inputValue(),/<em>quiet<\/em>/);assert.doesNotMatch(await card.locator('textarea[name$=".details"]').inputValue(),/North Tower|Private narrative notes/);
      await blankDrop('Actor.emptyInfo','Actor');assert.equal(await page.locator('[data-entry]').count(),count+3);card=page.locator('[data-entry]').filter({has:page.locator('input[name$=".uuid"][value="Actor.emptyInfo"]')});if(await card.locator('[data-entry-toggle]').getAttribute('aria-expanded')==='false')await card.locator('[data-entry-toggle]').click();assert.equal(await card.locator('textarea[name$=".details"]').inputValue(),'');
      // Attach an Actor to an existing descriptive entry without overwriting unrelated fields.
      await page.evaluate(async key=>{key.split('.').reduce((value,k)=>value[k],manager.draft).push({id:foundry.utils.randomID(),title:'Custom name',titleOverride:true,details:'Keep manual description',role:'Mechanic',disposition:'Hostile',factionId:'existing-faction',notes:'Private GM notes',portrait:'/test-wide.svg',status:'Hidden',type:'Humanoid',uuid:''});manager.dirty=true;await manager.render();},key);card=page.locator('[data-entry]').filter({has:page.locator('[name$=".title"][value="Custom name"]')});if(await card.locator('[data-entry-toggle]').getAttribute('aria-expanded')==='false')await card.locator('[data-entry-toggle]').click();await dropSpecial(card.locator('[data-reference]:not([data-type="Macro"])'),'Actor.manualLink');await saveSpecial();
      const manual=await page.evaluate(key=>key.split('.').reduce((value,k)=>value[k],manager.draft).at(-1),key);for(const [name,value] of Object.entries({title:'Custom name',details:'Keep manual description',role:'Mechanic',disposition:'Hostile',factionId:'existing-faction',notes:'Private GM notes',portrait:'/test-wide.svg'}))assert.equal(manual[name],value);
      // Shared portrait editor is draft-only in all three real application branches.
      assert.equal(await card.locator('[data-inhabitant-avatar]').count(),1);assert.equal(await card.locator('[data-inhabitant-portrait-preview]').count(),1);
      await card.locator('[data-inhabitant-portrait-path]').fill('/test-tall.svg');assert.equal(await page.evaluate(key=>key.split('.').reduce((value,k)=>value[k],manager.draft).find(e=>e.title==='Custom name').portrait,key),'/test-tall.svg');
      assert.equal(await page.evaluate(({sectorId,key})=>key.split('.').reduce((value,k)=>value[k],game.journal.get(sectorId).getFlag('myz-sector-manager','sector')).find(e=>e.title==='Custom name').portrait,{sectorId,key}),'/test-wide.svg');
      const field=card.locator('textarea[name$=".details"]');await field.focus();
      const imageFocus=await page.evaluate(()=>{globalThis.manualActorImage=docs.get('Actor.manualLink').img;const content=manager.element.querySelector('.sm-content'),before=content.scrollTop,field=document.activeElement;docs.get('Actor.manualLink').img='/test-tall.svg';Hooks.call('updateActor',docs.get('Actor.manualLink'));return {before,after:content.scrollTop,focused:document.activeElement===field};});assert(imageFocus.focused);assert.equal(imageFocus.after,imageFocus.before);
      assert.equal(await card.locator('[data-inhabitant-avatar] img').getAttribute('src'),'/test-tall.svg');assert.equal(await card.locator('[data-inhabitant-portrait-preview] img').getAttribute('src'),'/test-tall.svg');
      await page.evaluate(()=>{docs.get('Actor.manualLink').img=manualActorImage;Hooks.call('updateActor',docs.get('Actor.manualLink'));});
      await saveSpecial();await page.evaluate(async()=>{await manager.render();});card=page.locator('[data-entry]').filter({has:page.locator('[name$=".title"][value="Custom name"]')});assert.equal(await card.locator('[data-inhabitant-portrait-path]').inputValue(),'/test-tall.svg');assert.equal(await card.locator('textarea[name$=".details"]').inputValue(),'Keep manual description');
      assert.equal(await page.evaluate(({key,count})=>JSON.stringify(key.split('.').reduce((value,k)=>value[k],manager.draft).slice(0,count)),{key,count}),originalManual);
      await page.evaluate(async()=>{await manager.close();});await page.evaluate(async({sectorId,tab})=>{manager=await game.myzSectorManager.open(sectorId);manager.tab=tab;await manager.render();},{sectorId,tab});assert.equal(await page.evaluate(key=>key.split('.').reduce((value,k)=>value[k],manager.draft).find(e=>e.uuid==='Actor.infoImport').details,key),'Local campaign detail <em>only here</em>');
      await page.evaluate(()=>{docs.get('Actor.infoImport').system.description='<p>A <strong>watchful</strong> scout.</p><p>Background paragraph.</p>';});
    }
    assert.equal(await page.evaluate(()=>actorSideEffects),0);assert.deepEqual(await page.evaluate(()=>sourceMutations),[]);
    console.log('Single Shop tables, exact source fields/native links, group CRUD/order/moves/collapse, live refresh/missing replacement, deduplication and lossless merchant backup migration; centralized rich Actor Info imports across all three interfaces, duplicates, empty Info and editable snapshots pass');
    console.log('Settlement seven-tab authoring, world/Compendium Projects, independent progress, invalid/missing references, portraits, relationships, Shops/inventory, save/reopen, discard protection, lossless conversion, deletion and long-list layout pass');
    // New Settlement workflows, exercised in the real DOM with simulated Foundry APIs.
    await page.evaluate(async()=>{
      await manager.navigate(settlementId);manager.tab='Projects';
      const project=(uuid,name)=>({uuid,name,documentName:'Item',type:'project',system:{description:'Project description'},_onClickDocumentLink:async()=>nativeClicks.push(uuid)});
      docs.set('Item.projectZ',project('Item.projectZ','zebra Project'));docs.set('Item.projectA',project('Item.projectA','Alpha Project'));
      manager.draft.settlement.projects=[{id:'projectZ',uuid:'Item.projectZ',referenceName:'Old Z',status:'Completed',progress:'Z progress',notes:'Z notes'},{id:'projectA',uuid:'Item.projectA',referenceName:'Old A',status:'Planned',progress:'A progress'}];
      await manager.render();
    });
    const projectOrder=async()=> (await page.locator('.sm-content [data-project-index] [data-entry-title]').allTextContents()).map(title=>title.replace(/ \(\d+\/(?:\d+|\?)\)$/,''));
    assert.deepEqual(await projectOrder(),['Alpha Project','zebra Project']);assert.equal(await page.locator('[data-project-view] button').filter({hasText:'Open Ark Project'}).count(),0);
    const projectIdsBefore=await page.evaluate(()=>manager.draft.settlement.projects.map(p=>p.id));
    await setProjectStatus(0,'Not completed');await setProjectStatus(1,'Not completed');assert.deepEqual(await projectOrder(),['Alpha Project','zebra Project']);assert.equal(await page.locator('.sm-project-not-started').count(),2);assert.equal(await page.locator('.sm-project-incomplete').count(),0);
    assert.equal(await page.locator('.sm-projects-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),2);
    await setProjectStatus(0,'Completed');assert.deepEqual(await projectOrder(),['Alpha Project','zebra Project']);assert.equal(await page.locator('.sm-project-not-started').count(),1);await setProjectStatus(1,'Completed');assert.deepEqual(await projectOrder(),['Alpha Project','zebra Project']);assert.equal(await page.locator('.sm-project-incomplete').count(),0);assert.deepEqual(await page.evaluate(()=>manager.draft.settlement.projects.map(p=>p.id)),projectIdsBefore);
    await setProjectStatus(0,'Not available');await setProjectStatus(1,'Not available');

    await page.locator('[data-project-points="0"]').fill('3');await page.locator('[data-project-points="0"]').press('Tab');await page.evaluate(()=>manager.projectWrite);assert.equal(await page.evaluate(()=>manager.draft.settlement.projects[0].id),'projectZ');assert.equal(await page.evaluate(()=>manager.draft.settlement.projects[0].progress),'Z progress');assert.match(await page.locator('[data-project-diagnostic="0"]').innerText(),/system.work_points/);assert.equal(await page.evaluate(()=>manager.draft.settlement.projects[1].progress),'A progress');
    await page.evaluate(()=>{docs.get('Item.projectZ').name='Aardvark Project';Hooks.call('updateItem',docs.get('Item.projectZ'));});await page.waitForFunction(()=>document.querySelector('.sm-content [data-project-index] [data-entry-title]')?.textContent?.startsWith('Aardvark Project'));assert.deepEqual(await projectOrder(),['Aardvark Project','Alpha Project']);await page.locator('[name="settlement.projects.0.uuid"]').locator('..').locator('a').click();assert.equal(await page.evaluate(()=>nativeClicks.at(-1)),'Item.projectZ');
    await page.evaluate(async()=>{docs.delete('Item.projectZ');await manager.render();});assert.match(await page.locator('[data-project-view="0"]').innerText(),/unavailable/);assert.equal(await page.evaluate(()=>manager.draft.settlement.projects[0].progress),'Z progress');assert.match(await page.locator('[data-project-diagnostic="0"]').innerText(),/system.work_points/);
    await saveSpecial();
    for(const [sectorId,tab,key] of [['sector1','Encounters','encounters'],[specialId,'Inhabitants','special.inhabitants'],[await page.evaluate(()=>settlementId),'Inhabitants','settlement.inhabitants']]){
      await page.evaluate(async({sectorId,tab,key})=>{await manager.navigate(sectorId);manager.tab=tab;const parts=key.split('.');let owner=manager.draft;for(const part of parts.slice(0,-1))owner=owner[part];owner[parts.at(-1)]=[{id:'inh-z',title:'zulu',details:'Z notes',uuid:'Actor.one',factionId:'faction-kept',status:'Active',type:'Encounter'},{id:'inh-a',title:'Alpha',details:'A notes',uuid:'',status:'Active',type:'Encounter'}];await manager.render();},{sectorId,tab,key});
      const names=()=>page.locator('.sm-content>[data-entry] input[name$=".title"]').evaluateAll(els=>els.map(el=>el.value));assert.deepEqual(await names(),['Alpha','zulu']);
      await page.locator('[data-expand-all]').click();const z=page.locator(`[name="${key}.0.title"]`);await z.fill('aardvark');assert.deepEqual(await names(),['aardvark','Alpha']);await page.locator(`[name="${key}.1.details"]`).fill('Edited Alpha');
      const original=await page.evaluate(key=>structuredClone(key.split('.').reduce((o,k)=>o[k],manager.draft)),key);assert.equal(original[0].factionId,'faction-kept');assert.equal(original[0].details,'Z notes');assert.equal(original[1].details,'Edited Alpha');
      const alpha=page.locator('[data-entry]').filter({has:page.locator(`[name="${key}.1.title"]`)});await alpha.locator('[data-remove]').click();await page.waitForFunction(key=>key.split('.').reduce((o,k)=>o[k],manager.draft).length===1,key);assert.equal(await page.locator(`input[name="${key}.0.title"]`).inputValue(),'aardvark');await saveSpecial();
      await page.evaluate(async({sectorId,tab})=>{await manager.close();manager=await game.myzSectorManager.open(sectorId);manager.tab=tab;await manager.render();},{sectorId,tab});assert.deepEqual(await names(),['aardvark']);
    }
    // Legacy migration, scoped native Actor drops, independent collapse, and association-only removal.
    await page.evaluate(async()=>{
      await manager.navigate(settlementId);const {normalizeSettlement}=await import('/scripts/settlement.mjs');
      manager.draft.settlement=normalizeSettlement({...manager.draft.settlement,factions:[{id:'legacy-faction',title:'Council',leader:'Elder',details:'Old description',notes:'Secret note',actorUuids:['Actor.missing']},{id:'new-faction',title:'Traders'}]});manager.tab='Factions';await manager.render();
      CONFIG.Actor={documentClass:{fromDropData:async payload=>docs.get(payload.uuid||'Actor.infoImport')}};
    });
    const legacyFaction=page.locator('[data-faction-id="legacy-faction"]');assert.match(await legacyFaction.locator('textarea').inputValue(),/Leader: Elder/);assert.match(await legacyFaction.locator('textarea').inputValue(),/GM Notes: Secret note/);assert.equal(await legacyFaction.locator('[data-member-name]').innerText(),'Missing Actor');
    const factionHeading=await legacyFaction.locator('.sm-entry-head').evaluate(el=>{const arrow=el.querySelector('[data-entry-toggle]').getBoundingClientRect(),name=el.querySelector('input').getBoundingClientRect();return {arrowWidth:arrow.width,gap:name.left-arrow.right};});assert(factionHeading.arrowWidth<40);assert(factionHeading.gap<20);
    await legacyFaction.locator('.sm-faction-name').fill('Renamed Council');assert.equal(await legacyFaction.locator('[data-entry-toggle]').getAttribute('aria-expanded'),'true');await legacyFaction.locator('[data-entry-toggle]').click();assert.equal(await legacyFaction.locator('.sm-entry-body').isVisible(),false);await legacyFaction.locator('[data-entry-toggle]').click();
    await legacyFaction.locator('summary').click();assert.equal(await legacyFaction.locator('[data-faction-drop]').isVisible(),false);await legacyFaction.locator('summary').click();
    const factionDrop=async(selector,payload)=>{await page.locator(selector).evaluate((el,payload)=>{const transfer=new DataTransfer();transfer.setData('text/plain',JSON.stringify(payload));el.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));},payload);await page.waitForFunction(()=>!manager.droppingFaction);};
    const factionTarget='[data-faction-drop="legacy-faction"]';await factionDrop(factionTarget,{type:'Actor',uuid:'Actor.infoImport'});await factionDrop(factionTarget,{type:'Actor',uuid:'Compendium.myz.actors.Actor.infoImport'});assert.equal(await legacyFaction.locator('[data-faction-member]').count(),3);
    await factionDrop(factionTarget,{type:'Actor',uuid:'Actor.infoImport'});assert.equal(await legacyFaction.locator('[data-faction-member]').count(),3);
    await factionDrop('[data-faction-drop="new-faction"]',{type:'Actor',data:{_id:'infoImport'}});assert.equal(await page.locator('[data-faction-id="new-faction"] [data-faction-member]').count(),1);
    const member=legacyFaction.locator('[data-member-link][data-uuid="Actor.infoImport"]');await member.click();await member.locator('[data-member-name]').click();assert.equal(await page.evaluate(()=>nativeClicks.at(-1)),'Actor.infoImport');const thumb=await member.locator('img').boundingBox();assert.equal(thumb.width,100);assert.equal(thumb.height,100);
    await factionDrop(factionTarget,{type:'Item',uuid:'Item.one'});assert.match(await page.evaluate(()=>notifyErrors.pop()),/Actor/);assert.equal(await legacyFaction.locator('[data-faction-member]').count(),3);
    const missing=legacyFaction.locator('[data-faction-member]').filter({hasText:'Missing Actor'});await missing.locator('[data-member-remove]').click();await page.waitForFunction(()=>manager.draft.settlement.factions[0].members.length===2);
    await legacyFaction.locator('textarea').fill('Edited Faction Info\nSecond line');await saveSpecial();const factionSaved=await page.evaluate(()=>structuredClone(manager.draft.settlement.factions));await page.evaluate(async()=>{await manager.close();manager=await game.myzSectorManager.open(settlementId);manager.tab='Factions';await manager.render();});assert.deepEqual(await page.evaluate(()=>manager.draft.settlement.factions),factionSaved);assert.equal(await legacyFaction.locator('.sm-faction-name').inputValue(),'Renamed Council');assert.equal(await legacyFaction.locator('textarea').inputValue(),'Edited Faction Info\nSecond line');assert.equal(await page.evaluate(()=>manager.draft.settlement.factions[0].leader),'Elder');await page.screenshot({path:'/tmp/myz-faction-gallery.png'});
    // Dialog controls are real DOM nodes. No live Foundry installation is loaded.
    await page.evaluate(async()=>{
      const actorUuid='Actor.infoImport';await game.settings.set('myz-sector-manager','partyRoster',{version:1,members:[{actorUuid,enabled:true,lead:false,eligibility:'auto',groupId:''}]});globalThis.purchaseMessages=[];globalThis.purchaseRolls=[];globalThis.ChatMessage={create:async message=>purchaseMessages.push(message)};globalThis.Roll=class{constructor(formula){purchaseRolls.push(formula);}async evaluate(){return {total:4};}};
      docs.get('Item.long-weapons-0').system.cost='3–6';manager.tab='Shop';await manager.render();
      foundry.applications.api.DialogV2.wait=options=>new Promise(resolve=>{
        const frame=document.createElement('div');frame.className='application myz-shop-purchase';frame.style.width='440px';frame.style.height='auto';frame.innerHTML='<header class="window-header"><button data-close-dialog aria-label="Close">X</button></header><section class="window-content">'+options.content+'</section><footer class="dialog-buttons"></footer>';document.body.append(frame);const dialog={element:frame};const close=value=>{frame.remove();resolve(value);};frame.querySelector('[data-close-dialog]').onclick=()=>close(options.close());
        for(const definition of options.buttons){const button=document.createElement('button');button.dataset.action=definition.action;button.textContent=definition.label;button.disabled=!!definition.disabled;button.addEventListener('click',async event=>{try{close(await definition.callback(event,button,dialog));}catch(error){notifyErrors.push(error.message);}});frame.querySelector('footer').append(button);}options.render?.(null,dialog);
      });
    });
    assert.equal(await page.locator('.sm-shop-top').innerText().then(t=>t.includes('Drop group')),false);await page.locator('[data-shop-choice]').selectOption('');assert.equal(await page.locator('[data-shop-buy]').isDisabled(),true);await page.locator('[data-shop-choice]').selectOption('entry-weapons-0');assert.equal(await page.locator('[data-shop-buy]').isDisabled(),false);
    await page.locator('[data-shop-buy]').click();const purchase=page.locator('.myz-shop-purchase');await purchase.waitFor();assert.equal(await purchase.locator('[data-action="buy"]').isDisabled(),true);assert.match(await purchase.innerText(),/Damage/);assert.match(await purchase.innerText(),/3–6/);await purchase.locator('[name="purchaser"]').selectOption('Actor.infoImport');assert.equal(await purchase.locator('[data-action="buy"]').isDisabled(),false);assert.equal(await page.evaluate(()=>purchaseRolls.length),0);await purchase.locator('[data-action="cancel"]').click();await page.waitForFunction(()=>!manager.buyingShop);assert.equal(await page.evaluate(()=>purchaseMessages.length),0);
    await page.locator('[data-shop-buy]').click();await purchase.locator('[data-close-dialog]').click();await page.waitForFunction(()=>!manager.buyingShop);assert.equal(await page.evaluate(()=>purchaseMessages.length),0);
    const stockBefore=await page.evaluate(()=>JSON.stringify(manager.draft.settlement.shop));await page.locator('[data-shop-buy]').click();await purchase.locator('[name="purchaser"]').selectOption('Actor.infoImport');await page.screenshot({path:'/tmp/myz-shop-buy.png'});await purchase.locator('[data-action="buy"]').click();await page.waitForFunction(()=>!manager.buyingShop);assert.equal(await page.evaluate(()=>purchaseMessages.length),1);assert.equal(await page.evaluate(()=>purchaseRolls.length),1);assert.deepEqual(await page.evaluate(()=>purchaseMessages[0].whisper),[]);assert.match(await page.evaluate(()=>purchaseMessages[0].content),/4 Bullets/);assert.match(await page.evaluate(()=>purchaseMessages[0].content),/clean Grub.*Scrap/);assert.equal(await page.evaluate(()=>JSON.stringify(manager.draft.settlement.shop)),stockBefore);
    await page.evaluate(()=>docs.get('Item.long-weapons-0').system.cost='Barter only');await page.locator('[data-shop-buy]').click();assert.match(await purchase.innerText(),/Barter only.*integer Bullet cost/);await purchase.locator('[name="purchaser"]').selectOption('Actor.infoImport');assert.equal(await purchase.locator('[data-action="buy"]').isDisabled(),true);await purchase.locator('[data-action="cancel"]').click();await page.waitForFunction(()=>!manager.buyingShop);
    console.log('Settlement enhancement checks pass: presentation-only Project/Inhabitant sorting with stable edit/delete identity, Faction legacy migration/gallery/collapse/native links/removal/reopen, and roster-driven public Buy dialog with Cancel/X, single price roll, invalid-cost protection and unchanged inventory');

    // Settings popover uses the browser's top layer, native dismissal, scoped keyboard navigation.
    await saveSpecial();await page.evaluate(async()=>{await game.scenes.get('zone').view();});
    const gear=page.locator('[data-sm-settings]'),settingsMenu=page.locator('[data-sm-settings-menu]');
    assert.equal(await page.locator('.sm-header-buttons [data-action="new"]').evaluate(el=>el.nextElementSibling?.dataset.action==='campaign-log'&&el.nextElementSibling.nextElementSibling?.classList.contains('sm-settings')),true);assert.equal(await page.locator('.sm-zone-summary details').count(),0);
    await gear.click();assert.equal(await settingsMenu.isVisible(),true);assert.deepEqual(await settingsMenu.locator('button').allTextContents(),['Configure / Tracking','View Zone','Select on map','Hide overlay','Wander Now','Wandering Tokens','Enable Wandering for Selected Tokens','Disable Wandering for Selected Tokens','Import Sector','Export Sector']);
    await page.waitForFunction(()=>document.activeElement.hasAttribute('data-zone-config'));await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-sector-export')),true);await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-zone-config')),true);await page.keyboard.press('Escape');assert.equal(await settingsMenu.isVisible(),false);
    await gear.click();await gear.click();assert.equal(await settingsMenu.isVisible(),false);await gear.click();await page.mouse.click(500,30);assert.equal(await settingsMenu.isVisible(),false);
    await gear.click();await page.evaluate(()=>{manager.element.style.left='70px';manager._onPosition({});});const menuBox=await settingsMenu.boundingBox(),gearBox=await gear.boundingBox();assert(menuBox.x>=0&&menuBox.x+menuBox.width<=1400);assert(menuBox.y>=gearBox.y+gearBox.height);await page.keyboard.press('Escape');await page.evaluate(()=>manager.element.style.left='20px');
    // Correct physical Columns/Rows under vertical letter orientation; save/reopen retains stored meaning.
    await gear.click();await page.locator('[data-zone-config]').click();await page.locator('.zm-config').waitFor();
    await dialog.locator('[name="columns"]').fill('12');await dialog.locator('[name="rows"]').fill('8');await dialog.locator('[name="columnAxis"]').selectOption('y');await dialog.locator('[data-save-zone]').click();await page.waitForFunction(()=>zoneState().grid.columnAxis==='y'&&zoneState().grid.columns===8&&zoneState().grid.rows===12);
    const savedGrid=await page.evaluate(()=>structuredClone(zoneState().grid));await gear.click();await page.locator('[data-zone-config]').click();await dialog.waitFor();assert.equal(await dialog.locator('[name="columns"]').inputValue(),'12');assert.equal(await dialog.locator('[name="rows"]').inputValue(),'8');assert.match(await dialog.locator('label').filter({has:page.locator('[name="columns"]')}).innerText(),/horizontal squares/);await dialog.locator('[data-save-zone]').click();await page.waitForFunction(()=>!document.querySelector('.myz-zone-configuration'));assert.deepEqual(await page.evaluate(()=>zoneState().grid),savedGrid);
    // Simulated DialogV2 with real local file inputs, preview buttons, and explicit replacement confirmation.
    await page.evaluate(()=>{
      foundry.applications.api.DialogV2.wait=options=>{
        if(options.window?.title==='Create New Sector')return Promise.resolve(null);
        return new Promise(resolve=>{
          const frame=document.createElement('div');frame.className='application myz-test-transfer '+(options.classes||[]).join(' ');frame.style.width=(options.position?.width||460)+'px';frame.style.height='auto';frame.innerHTML='<header class="window-header"><strong>'+options.window.title+'</strong><button data-dialog-x>X</button></header><section class="window-content">'+options.content+'</section><footer></footer>';document.body.append(frame);const dialog={element:frame},close=value=>{frame.remove();resolve(value);};frame.querySelector('[data-dialog-x]').onclick=()=>close(options.close?.());
          for(const definition of options.buttons){const button=document.createElement('button');button.dataset.action=definition.action;button.textContent=definition.label;button.disabled=!!definition.disabled;button.addEventListener('click',async event=>{try{close(await definition.callback(event,button,dialog));}catch(error){notifyErrors.push(error.message);}});frame.querySelector('footer').append(button);}options.render?.(null,dialog);
        });
      };
      foundry.applications.api.DialogV2.confirm=options=>foundry.applications.api.DialogV2.wait({...options,buttons:[{action:'cancel',label:'Cancel',default:true,callback:()=>false},{action:'replace',label:'Replace Existing Sector',callback:()=>true}],close:()=>false});
    });
    // Export reads persisted content and produces a real downloadable versioned JSON file.
    const exportPromise=page.waitForEvent('download');await gear.click();await page.locator('[data-sector-export]').click();const exportedDownload=await exportPromise;await page.waitForFunction(()=>!manager.transferringSector);const exportedFile=JSON.parse(readFileSync(await exportedDownload.path(),'utf8'));assert.equal(exportedFile.format,'myz-sector-manager');assert.equal(exportedFile.exportedBy.version,'0.1.36');assert.equal(exportedFile.sector.sectorType,'settlement');assert.equal(exportedFile.sector.code,undefined);assert.equal(exportedFile.sector.settlement.shop.groups.length,5);assert.equal(exportedFile.sector.settlement.factions[0].info,'Edited Faction Info\nSecond line');
    const sourceBefore=await page.evaluate(()=>JSON.stringify(manager.journal.getFlag('myz-sector-manager','sector')));await page.locator('[data-tab="Overview"]').click();await page.locator('[name="settlement.notes"]').fill('UNSAVED EXPORT NOTE');await gear.click();await page.locator('[data-sector-export]').click();await page.locator('.myz-test-transfer [data-action="cancel"]').click();await page.waitForFunction(()=>!manager.transferringSector);assert.equal(await page.evaluate(()=>JSON.stringify(manager.journal.getFlag('myz-sector-manager','sector'))),sourceBefore);await saveSpecial();
    // Select an empty Zone square through the existing map tool. Cancel new creation, then import there.
    await page.evaluate(()=>{canvas.stage.zoom=.1;canvas.stage.pan={x:1000,y:700};});const destinationPoint=await page.evaluate(()=>{const b=game.myzSectorManager.zone.sectorBounds('E3');return {x:1000+(b.x+b.width/2)*.1,y:700+(b.y+b.height/2)*.1};});await gear.click();await page.locator('[data-zone-select]').click();await page.mouse.click(destinationPoint.x,destinationPoint.y);await page.waitForFunction(()=>document.querySelector('[data-zone-selection]')?.textContent==='E3');
    const transfer=page.locator('.myz-test-transfer');const startImport=async value=>{await gear.click();await page.locator('[data-sector-import]').click();await transfer.locator('input[type=file]').setInputFiles({name:'sector.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});await transfer.locator('[data-action="preview"]').click();await transfer.locator('[data-action="import"]').waitFor();};
    await startImport(exportedFile);assert.match(await transfer.innerText(),/Empty square/);assert.match(await transfer.innerText(),/E3/);await transfer.locator('[data-action="cancel"]').click();await page.waitForFunction(()=>!manager.transferringSector);assert.equal(await page.evaluate(()=>game.journal.filter(j=>j.getFlag('myz-sector-manager','sector')?.code==='E3').length),0);
    await startImport(exportedFile);await transfer.locator('[data-action="import"]').click();await page.waitForFunction(()=>!manager.transferringSector&&manager.draft.code==='E3');const importedId=await page.evaluate(()=>manager.sectorId);assert.equal(await page.evaluate(()=>manager.draft.placement.sceneId),'zone');assert.equal(await page.locator('[data-tab]').count(),7);assert.equal(await page.evaluate(()=>manager.draft.settlement.factions[0].info),'Edited Faction Info\nSecond line');
    // Existing Journal mock models Foundry's recursive merge/deletion operators for replacement.
    await page.evaluate(()=>{
      const merge=(prior,next)=>{const result=structuredClone(prior||{});for(const [key,value] of Object.entries(next)){if(key.startsWith('-=')){delete result[key.slice(2)];continue;}result[key]=value&&typeof value==='object'&&!Array.isArray(value)?merge(result[key],value):structuredClone(value);}return result;};
      const journal=manager.journal;globalThis.importOriginalUpdate=journal.update.bind(journal);journal.update=async data=>{if(!data['flags.myz-sector-manager.lastSectorImport'])return importOriginalUpdate(data);journal.name=data.name;journal.value['myz-sector-manager'].sector=merge(journal.getFlag('myz-sector-manager','sector'),data['flags.myz-sector-manager.sector']);journal.value['myz-sector-manager'].lastSectorImport=merge(journal.getFlag('myz-sector-manager','lastSectorImport'),data['flags.myz-sector-manager.lastSectorImport']);delete journal.value['myz-sector-manager'].entryTriggers;Hooks.call('updateJournalEntry',journal);};
    });
    const importedBefore=await page.evaluate(()=>JSON.stringify(manager.journal.getFlag('myz-sector-manager','sector'))),replacementFile={format:'myz-sector-manager',formatVersion:1,schemaVersion:1,sector:{sectorType:'normal',nameOverride:true,customName:'Replacement & <safe>',description:'<script>globalThis.importExecuted=true</script><p>Descriptive content.</p>',encounters:[{id:'missing-actor',title:'Missing guard',uuid:'Actor.importMissing'}],customFuture:{keep:'unknown'}}};
    await startImport(replacementFile);assert.match(await transfer.innerText(),/Occupied/);assert.match(await transfer.innerText(),/Actor.importMissing/);assert.match(await transfer.innerText(),/unknown field/);assert.equal(await transfer.locator('script').count(),0);await transfer.locator('[data-action="import"]').click();await transfer.locator('[data-action="cancel"]').click();await page.waitForFunction(()=>!manager.transferringSector);assert.equal(await page.evaluate(()=>JSON.stringify(manager.journal.getFlag('myz-sector-manager','sector'))),importedBefore);
    await startImport(replacementFile);await transfer.locator('[data-action="import"]').click();await transfer.locator('[data-action="replace"]').click();await page.waitForFunction(()=>!manager.transferringSector&&manager.draft.sectorType==='normal');assert.equal(await page.evaluate(()=>manager.sectorId),importedId);assert.equal(await page.evaluate(()=>manager.journal.getFlag('myz-sector-manager','sector').settlement),undefined);assert.equal(await page.evaluate(()=>manager.journal.getFlag('myz-sector-manager','lastSectorImport').sector.sectorType),'settlement');assert.equal(await page.evaluate(()=>manager.draft.encounters[0].uuid),'Actor.importMissing');assert.equal(await page.evaluate(()=>manager.draft.customFuture),undefined);assert.equal(await page.evaluate(()=>manager.draft.portableExtensions.unknown[0].value.keep),'unknown');assert.equal(await page.evaluate(()=>Boolean(globalThis.importExecuted)),false);
    // A changed destination cancels the final commit, even after a valid preview.
    await startImport(exportedFile);await page.evaluate(async()=>{await game.scenes.get('combat').view();});await transfer.locator('[data-action="import"]').click();await page.waitForFunction(()=>!manager.transferringSector);assert.match(await page.evaluate(()=>notifyErrors.pop()),/changed/);assert.equal(await page.evaluate(()=>manager.journal.getFlag('myz-sector-manager','sector').sectorType),'normal');await page.evaluate(async()=>{await game.scenes.get('zone').view();});
    await gear.click();await page.screenshot({path:'/tmp/myz-settings-portable.png'});await page.keyboard.press('Escape');assert.deepEqual(await page.evaluate(()=>sourceMutations),[]);
    console.log('Settings gear/top-layer dismissal/keyboard/movement, preserved Zone actions, physical Columns/Rows in vertical orientation, real JSON download/file-input preview, all Settlement tabs, empty import, Cancel/explicit atomic replacement, missing/unknown preservation, inert HTML and Scene-change guards pass');

    // Linked Ark population and Projects in the actual Sector Manager editor.
    await page.evaluate(async()=>{
      globalThis.arkProjectOpens=[];
      const source=docs.get('Actor.ark');Object.assign(source,{system:{population:'42',coordinates:'B2',dev_levels:{food:{value:11,max:0}},bosses:{},description:'Ark info'},items:[]});
      const item={documentName:'Item',type:'project',id:'embeddedFarm',uuid:'Actor.ark.Item.embeddedFarm',name:'Ark Farm',system:{description:'Source description',work_points:'5 / 12',completed:false,comment:'Source note'},sheet:{render:()=>arkProjectOpens.push('farm')}};
      item.parent=source;source.items=[item];docs.set(item.uuid,item);
      await manager.navigate(settlementId);manager.tab='Overview';await manager.render();
      globalThis.arkSavedBefore=JSON.stringify(manager.journal.getFlag('myz-sector-manager','sector'));
      globalThis.populationBefore=manager.draft.settlement.population;globalThis.placementBefore=manager.draft.code;
    });
    assert.equal(await page.locator('[data-ark-population]').inputValue(),'42');assert(await page.locator('[data-ark-population]').isDisabled());assert.equal(await page.locator('[name="settlement.population"]').count(),0);assert.equal(await page.locator('[data-ark-coordinates]').inputValue(),'B2');assert.equal(await page.locator('.sm-overview-grid label').filter({hasText:/^Coordinates$/}).count(),1);assert.equal(await page.locator('[name="code"]').getAttribute('type'),'hidden');
    await page.evaluate(()=>manager.capture());assert.equal(await page.evaluate(()=>manager.draft.settlement.population===populationBefore&&manager.draft.code===placementBefore),true);
    await page.evaluate(()=>{docs.get('Actor.ark').system.population='50';Hooks.call('updateActor',docs.get('Actor.ark'));});await page.waitForFunction(()=>document.querySelector('[data-ark-population]')?.value==='50');
    await page.locator('[data-tab="Projects"]').click();const linkedArkCard=page.locator('[data-entry]').filter({hasText:'Ark-linked Project'});assert.equal(await linkedArkCard.count(),1);assert.equal(await linkedArkCard.locator('[data-remove]').count(),0);assert.match(await linkedArkCard.innerText(),/5 \/ 12/);await linkedArkCard.locator('button').filter({hasText:'Open Ark Project'}).click();assert.deepEqual(await page.evaluate(()=>arkProjectOpens),['farm']);
    const syncedArkId=await page.evaluate(()=>manager.draft.settlement.projects.find(p=>p.arkSource).id);
    // Checked native source writes, local metadata, connection changes and display-only grouping.
    const linkedIndex=await page.evaluate(()=>manager.draft.settlement.projects.findIndex(p=>p.arkSource));
    await page.evaluate(async()=>{const source=docs.get('Actor.ark'),item=source.items[0];item.id='embeddedFarm';item.system.work_points='2 x number of PCs';source.testUserPermission=()=>true;globalThis.arkCheckboxWrites=[];source.updateEmbeddedDocuments=async(type,updates)=>{arkCheckboxWrites.push(structuredClone(updates));for(const update of updates){if(update._id!==item.id)throw Error('Wrong source Project');item.system.completed=update['system.completed'];Hooks.call('updateItem',item);}};globalThis.savedUsers=game.users;const users=[{id:'gm',isGM:true,role:4,active:true},{id:'assistant',isGM:false,role:3,active:true},...Array.from({length:4},(_,i)=>({id:'player'+i,role:1,active:true,isGM:false}))];users.activeGM=savedUsers.activeGM;game.users=users;await manager.render();});
    const setPoints=async value=>{await page.locator(`[data-project-points="${linkedIndex}"]`).fill(String(value));await page.locator(`[data-project-points="${linkedIndex}"]`).press('Tab');await page.evaluate(()=>manager.projectWrite);};
    await setProjectStatus(linkedIndex,'Not completed');assert.equal(await page.locator(`[data-project-index="${linkedIndex}"]`).evaluate(el=>el.closest('[data-project-group]').dataset.projectGroup),'Not started');await setPoints(5);assert.equal(await page.locator(`[data-project-index="${linkedIndex}"]`).evaluate(el=>el.closest('[data-project-group]').dataset.projectGroup),'Not completed');await setPoints(0);assert.equal(await page.locator(`[data-project-index="${linkedIndex}"]`).evaluate(el=>el.closest('[data-project-group]').dataset.projectGroup),'Not started');await page.locator(`[data-project-step="1"][data-project-number="${linkedIndex}"]`).click();await page.evaluate(()=>manager.projectWrite);assert.equal(await page.locator(`[data-project-points="${linkedIndex}"]`).inputValue(),'1');await page.locator(`[data-project-step="-1"][data-project-number="${linkedIndex}"]`).click();await page.evaluate(()=>manager.projectWrite);assert.equal(await page.locator(`[data-project-points="${linkedIndex}"]`).inputValue(),'0');assert(await page.locator(`[data-project-step="-1"][data-project-number="${linkedIndex}"]`).isDisabled());await setPoints(5);assert.equal(await page.locator(`[data-project-total="${linkedIndex}"]`).innerText(),'8');
    await page.evaluate(()=>{game.users.find(u=>u.id==='player2').active=false;game.users.find(u=>u.id==='player3').active=false;Hooks.call('userConnected',game.users.find(u=>u.id==='player3'),false);});await page.waitForFunction(index=>document.querySelector(`[data-project-total="${index}"]`)?.textContent==='4',linkedIndex);assert.equal(await page.locator(`[data-project-status="${linkedIndex}"]`).inputValue(),'Not completed');assert.equal(await page.locator(`[data-project-points="${linkedIndex}"]`).inputValue(),'5');
    await setProjectStatus(linkedIndex,'Not available');await setPoints(4);await setProjectStatus(linkedIndex,'Not completed');assert.equal(await page.locator(`[data-project-status="${linkedIndex}"]`).inputValue(),'Not completed');await setPoints(3);await page.locator(`[data-project-step="1"][data-project-number="${linkedIndex}"]`).click();await page.evaluate(()=>manager.projectWrite);assert.equal(await page.locator(`[data-project-status="${linkedIndex}"]`).inputValue(),'Not completed');assert(await page.locator(`[data-project-ready="${linkedIndex}"]`).isVisible());assert.equal(await page.evaluate(()=>docs.get('Actor.ark').items[0].system.completed),false);assert.equal(await page.evaluate(()=>arkCheckboxWrites.length),0);await setPoints(12);assert.equal(await page.locator(`[data-project-points="${linkedIndex}"]`).inputValue(),'12');assert.equal(await page.locator(`[data-project-status="${linkedIndex}"]`).inputValue(),'Not completed');await setProjectStatus(linkedIndex,'Completed');assert.equal(await page.evaluate(()=>docs.get('Actor.ark').items[0].system.completed),true);assert.equal(await page.evaluate(()=>arkCheckboxWrites.length),1);assert.match(await page.locator('.sm-footer [role="status"]').innerText(),/Native Ark Project updated.*Discard cannot undo/);
    await setProjectStatus(linkedIndex,'Not available');assert.equal(await page.evaluate(()=>docs.get('Actor.ark').items[0].system.completed),false);await setPoints(3);await setPoints(4);assert.equal(await page.locator(`[data-project-status="${linkedIndex}"]`).inputValue(),'Not available');
    const notAvailable=page.locator('[data-project-group="Not Available"]');await notAvailable.locator('summary').click();await page.evaluate(()=>manager.render());assert.equal(await notAvailable.getAttribute('open'),null);await notAvailable.locator('summary').click();
    await page.locator('[data-collapse-all]').click();const collapsedProject=await page.locator(`[data-project-index="${linkedIndex}"]`).boundingBox();await page.locator(`[data-project-index="${linkedIndex}"] [data-entry-toggle]`).click();const expandedProject=await page.locator(`[data-project-index="${linkedIndex}"]`).boundingBox();assert(expandedProject.width>collapsedProject.width*1.8);await page.locator(`[data-project-index="${linkedIndex}"] [data-entry-toggle]`).click();assert(Math.abs((await page.locator(`[data-project-index="${linkedIndex}"]`).boundingBox()).width-collapsedProject.width)<2);await page.locator('[data-expand-all]').click();
    await page.evaluate(async()=>{game.users=savedUsers;await manager.render();});

    await page.evaluate(()=>{const item=docs.get('Actor.ark.Item.embeddedFarm');item.name='Improved Farm';item.system.completed=true;item.system.work_points='12 / 12';Hooks.call('updateItem',item);});await page.waitForFunction(()=>manager.draft.settlement.projects.some(p=>p.arkSource&&p.title==='Improved Farm'&&p.status==='Completed'));
    await page.evaluate(async()=>{await manager.render();await manager.render();});assert.equal(await page.evaluate(()=>manager.draft.settlement.projects.filter(p=>p.arkSource).length),1);assert.equal(await page.evaluate(()=>manager.draft.settlement.projects.find(p=>p.arkSource).id),syncedArkId);
    assert.equal(await page.evaluate(()=>JSON.stringify(manager.journal.getFlag('myz-sector-manager','sector'))===arkSavedBefore),true);
    await page.evaluate(()=>{const item=docs.get('Actor.ark.Item.embeddedFarm');docs.get('Actor.ark').items=[];docs.delete(item.uuid);Hooks.call('deleteItem',item.parent?item:{...item,parent:docs.get('Actor.ark')});});await page.waitForFunction(()=>manager.draft.settlement.projects.some(p=>p.arkSource?.missing));assert.match(await linkedArkCard.innerText(),/source missing|Source unavailable/);
    await page.locator('[data-tab="Overview"]').click();await page.locator('[name="settlement.arkUuid"]').fill('Actor.missing');await page.locator('[name="settlement.arkUuid"]').press('Tab');await page.waitForFunction(()=>document.querySelector('[data-ark-population]')?.value==='Unavailable');assert.equal(await page.evaluate(()=>manager.draft.settlement.population===populationBefore),true);
    await page.locator('[name="settlement.arkUuid"]').fill('');await page.locator('[name="settlement.arkUuid"]').press('Tab');await page.waitForFunction(()=>Boolean(document.querySelector('[name="settlement.population"]')));assert.equal(await page.locator('[name="settlement.population"]').inputValue(),await page.evaluate(()=>populationBefore));
    console.log('Linked Ark population/coordinates read-only display, native Project source opening, idempotent draft synchronization/update/deletion, preserved manual population/placement and zero automatic Journal writes pass');
    assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>notifyErrors),[]);
    console.log('Zone dialog units/tokens/Actor links persist; origin picking respects zoom; confirmed map creation, overlay isolation, closed-window tracking and missing references pass');
    await saveSpecial();
    await page.evaluate(async()=>{await manager.navigate('sector1');manager.draft.status='Mapped <custom> & "safe"';manager.tab='Overview';await manager.render();});
    const customStatus=page.locator('[name="status"]');assert.equal(await customStatus.inputValue(),'Mapped <custom> & "safe"');assert.match(await customStatus.locator('option:checked').innerText(),/Legacy\/custom value/);await page.locator('[name="notes"]').fill('Unrelated Phase 1 change');await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.dirty);assert.equal(await page.evaluate(()=>manager.journal.getFlag('myz-sector-manager','sector').status),'Mapped <custom> & "safe"');
    await customStatus.selectOption('Explored');await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.dirty);assert.equal(await page.evaluate(()=>manager.journal.getFlag('myz-sector-manager','sector').status),'Explored');
    await page.evaluate(async()=>{manager.draft.effects[0].category='Ion Storm';manager.draft.effects[0].status='Waiting';manager.tab='Effects';await manager.render();});assert.equal(await page.locator('[name="effects.0.category"]').inputValue(),'Ion Storm');assert.equal(await page.locator('[name="effects.0.status"]').inputValue(),'Waiting');await page.evaluate(()=>manager.capture());await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.dirty);assert.equal(await page.evaluate(()=>manager.journal.getFlag('myz-sector-manager','sector').effects[0].category),'Ion Storm');
    await page.evaluate(async id=>{await manager.navigate(id);manager.draft.settlement.disposition='Cautiously Welcoming';manager.draft.settlement.type='Floating City';manager.tab='Overview';await manager.render();},await page.evaluate(()=>settlementId));assert.equal(await page.locator('[name="settlement.disposition"]').inputValue(),'Cautiously Welcoming');assert.match(await page.locator('[name="settlement.disposition"] option:checked').innerText(),/Legacy\/custom value/);assert.equal(await page.locator('[name="settlement.type"]').inputValue(),'Floating City');await page.locator('[name="settlement.notes"]').fill('Unrelated option preservation');await page.locator('[data-action="save"]').click();await page.waitForFunction(()=>!manager.dirty);assert.equal(await page.evaluate(()=>manager.journal.getFlag('myz-sector-manager','sector').settlement.disposition),'Cautiously Welcoming');
    console.log('Phase 1: shared header controls ignore inputs/actions/links, Space and focus restoration toggle once, and custom dropdowns survive unrelated saves across Normal and Settlement');

  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
