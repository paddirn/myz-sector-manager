// Optional layout/interaction smoke test: requires Playwright and Chromium.
// This models the documented ApplicationV2 content slot and native APIs;
// it does not load Foundry or prove live v14 integration.
const {chromium}=require('playwright');
const {readFileSync,existsSync}=require('node:fs');
const assert=require('node:assert/strict');

(async()=>{
  const executablePath=process.env.MYZ_CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
  const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:1400,height:900}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.setContent(`<style>
      *{box-sizing:border-box}body{margin:0;font:14px Arial}
      .application{display:flex;flex-direction:column;position:absolute;left:20px;top:20px;width:1100px;height:480px;border:1px solid #888;background:#fff}
      .window-header{height:32px;flex-shrink:0}.window-content{flex:1;overflow:auto;padding:8px}
      button{cursor:pointer}textarea{font:inherit}input,select{height:28px}input[type=checkbox]{height:16px}
    </style>`);
    await page.addScriptTag({content:`
      let ready;
      globalThis.nativeClicks=[];
      class ApplicationV2 {
        constructor(options={}){this.options=options;this.rendered=false;}
        async _onRender(){}
        async render(){
          if(!this.element){
            this.element=document.createElement('div');this.element.className='application myz-sector-manager';
            this.element.innerHTML='<header class="window-header">Test ApplicationV2 frame</header><section class="window-content"></section>';
            document.body.append(this.element);
          }
          this._replaceHTML(await this._renderHTML(),this.element.querySelector('.window-content'));
          this.rendered=true;await this._onRender({},{});return this;
        }
        bringToFront(){}
        async close(){this.element.remove();this.rendered=false;}
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
      globalThis.foundry={utils:{deepClone:value=>structuredClone(value)},applications:{api:{ApplicationV2,DialogV2:{confirm:async()=>true}},ux:{TextEditor:{implementation:editor}}}};
      globalThis.Hooks={once:(name,callback)=>ready=callback};
      globalThis.fromUuid=async uuid=>docs.get(uuid);
      globalThis.ui={notifications:{info(){},warn(){},error:message=>{throw new Error(message)}}};
      const data={version:1,code:'A2',status:'Explored',terrain:'Forest',rot:0,description:'Long description',notes:'GM notes',supplies:{cleanGrub:{quantity:2.75,collected:true}}};
      for(const key of ['locations','encounters','loot','effects','secrets','history'])data[key]=Array.from({length:20},(_,i)=>({title:'Entry '+(i+1),details:'Existing notes '+i,uuid:key==='locations'?'Scene.one':key==='encounters'?'Actor.one':key==='loot'?'Item.one':''}));
      globalThis.records=Array.from({length:70},(_,i)=>({id:'sector'+i,name:i===1?'A very long sector name that must wrap rather than being clipped':'Sector '+i,flags:structuredClone({...data,code:'A'+(i+1)}),getFlag(){return this.flags;},async update(update){this.name=update.name;},async setFlag(mod,key,flags){this.flags=structuredClone(flags);}}));
      records.get=id=>records.find(j=>j.id===id);
      globalThis.game={journal:records,user:{isGM:true}};
    `});
    await page.addScriptTag({content:readFileSync(require.resolve('../scripts/sector-manager.mjs'),'utf8')});
    await page.evaluate(async()=>{ready();globalThis.manager=await game.myzSectorManager.open('sector1');});

    for(const tab of ['Overview','Locations','Encounters','Loot','Effects','Secrets','History']){
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
    console.log('Mouse wheel works across all seven tabs; navigation/footer stay visible');
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
    assert.equal(await page.locator('[name="supplies.cleanGrub.quantity"]').evaluate(el=>Math.round(el.getBoundingClientRect().width)),65);
    await page.evaluate(()=>{manager.element.style.width='600px';manager.element.style.height='360px';});
    await page.waitForFunction(()=>document.querySelector('.sm-consumables').getBoundingClientRect().width>document.querySelector('.sm-content').clientWidth*.85);
    assert(await consumableRatio()>.85);
    assert(await page.locator('.sm-content').evaluate(el=>el.scrollWidth<=el.clientWidth));
    console.log('Consumables adapt from half to full width with 65px decimal inputs and preserved collected state');
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
    assert.deepEqual(errors,[]);
    console.log('Save/reopen retains data and session UI state; deletion cleans identity; new entries expand; no browser errors');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
