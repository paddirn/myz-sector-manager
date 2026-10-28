// Real Chromium DOM/ApplicationV2-shaped integration; Foundry is not loaded.
const {chromium}=require('playwright');
const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const http=require('node:http');
(async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url));if(!file.startsWith(root+'/scripts/')){res.setHeader('Content-Type','text/html');res.end('<html><style>*{box-sizing:border-box}body{font:14px Arial}.application{width:680px;height:650px;display:flex;flex-direction:column;border:1px solid #999}.window-content{flex:1;overflow:auto}table{border-collapse:collapse}td,th{padding:5px;border:1px solid #999}</style></html>');return;}try{res.setHeader('Content-Type','text/javascript');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.MYZ_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async()=>{
   const {PlayerShopService}=await import('/scripts/player-shop-service.mjs'),{createPlayerShopClass}=await import('/scripts/player-shop-ui.mjs'),{hydrateArk}=await import('/scripts/settlement-ark.mjs');
   globalThis.hydrateArk=hydrateArk;
   class ApplicationV2{async _onRender(){}async render(){if(!this.element){this.element=document.createElement('div');this.element.className='application '+this.constructor.DEFAULT_OPTIONS.classes.join(' ');this.element.innerHTML='<section class="window-content"></section>';document.body.append(this.element);}this._replaceHTML(await this._renderHTML(),this.element.querySelector('.window-content'));await this._onRender({},{});this.rendered=true;return this;}}
   const gm={id:'gm',name:'GM',active:true,isGM:true},player={id:'player',name:'Player',active:true,isGM:false};globalThis.player=player;
   const users=[gm,player];users.activeGM=gm;
   globalThis.hero={documentName:'Actor',uuid:'Actor.hero',name:'Scout',type:'mutant',system:{resources:{bullets:{value:20},grub:{value:10.5},water:{value:10}}},flags:{},testUserPermission:u=>u.id==='player',getFlag:(m,k)=>hero.flags[k],update:async data=>{for(const [p,v] of Object.entries(data)){if(p.startsWith('system.'))hero.system.resources[p.split('.')[2]].value=v;else hero.flags.shopReceipts=v;}}};
   globalThis.ark={documentName:'Actor',type:'ark',uuid:'Actor.ark',name:'The Ark',system:{population:'42',coordinates:'C4',water_source:'Well',dev_levels:{food:{value:12,max:20}},bosses:{boss1:{name:'Raven',description:'Leader'}},description:'<p>Ark <strong>Info</strong></p>'},items:[{type:'project',name:'Farm',system:{completed:true}},{type:'artifact',name:'Generator'}],sheet:{render:()=>globalThis.arkOpened=true}};
   globalThis.sector={version:1,sectorType:'settlement',customName:'Harbor',settlement:{notes:'PRIVATE GM SECRET',arkUuid:ark.uuid,shop:{version:1,playerAccess:true,trading:{enabled:true,values:{bullets:3,cleanGrub:2,cleanWater:1}},groups:[{id:'g',name:'Tools',type:'general',entries:[{id:'rope',uuid:'Item.rope'},{id:'lamp',uuid:'Item.lamp'}]}]}}};
   globalThis.items={rope:{documentName:'Item',name:'Rope',system:{cost:'2',comment:'Visible comment <section class="secret">HIDDEN COMMENT SECRET</section>',description:'<p>Useful rope.</p><section class="secret"><p>HIDDEN ITEM SECRET</p></section><script>window.itemExecuted=true</script>'}},lamp:{documentName:'Item',name:'Lamp',system:{cost:'1–3',description:'Long description '.repeat(300)}}};
   globalThis.chat=[];const actors=[hero];actors.get=id=>id==='hero'?hero:null;globalThis.game={system:{id:'mutant-year-zero'},user:player,users,actors,journal:new Map()};
   const gmEnv={crypto,DOMParser,console,game:{...game,user:gm,journal:new Map([['market',{getFlag:()=>sector}]])},fromUuid:async id=>id===hero.uuid?hero:id===ark.uuid?ark:items[id.split('.').at(-1)],ChatMessage:{create:async data=>{chat.push(data);}}};
   globalThis.fromUuid=gmEnv.fromUuid;globalThis.foundry={applications:{api:{DialogV2:{confirm:async options=>{globalThis.confirmation=options;return globalThis.acceptTrade!==false;}}}}};
   const authority=new PlayerShopService(gmEnv);globalThis.payloads=[];
   const service={request:payload=>{payloads.push(payload);const task=authority.queue.then(()=>authority.execute(player,{...payload,id:crypto.randomUUID(),timestamp:Date.now()}));authority.queue=task.catch(()=>{});return task;}};
   const schedule=window.setInterval;globalThis.rateChecks=[];window.setInterval=(callback,delay)=>{const id=schedule(callback,delay);rateChecks.push({callback,delay,id});return id;};
   const Shop=createPlayerShopClass(ApplicationV2,service);globalThis.shop=new Shop('JournalEntry.market');await shop.refresh();
  });
  assert.equal(await page.locator('.myz-player-shop').count(),1);assert.equal(await page.locator('[data-tab], [data-shop-add-group], [data-shop-remove]').count(),0);assert.match(await page.locator('[data-balances]').innerText(),/Bullets: 20.*Clean Grub: 10.5/);assert(!await page.locator('.myz-player-shop').innerText().then(t=>t.includes('PRIVATE GM SECRET')||t.includes('HIDDEN ITEM SECRET')||t.includes('HIDDEN COMMENT SECRET')));assert.equal(await page.locator('.myz-player-shop script').count(),0);
  assert.equal(await page.locator('[data-item], [data-purchase], details, summary').count(),0);assert.doesNotMatch(await page.locator('.myz-player-shop').innerText(),/Request quantity|Description|remainder|rounded down/i);
  assert.equal(await page.locator('[data-quantity]').inputValue(),'1');assert.equal(await page.locator('[data-received]').innerText(),'1');
  await page.locator('[data-buy="rope"]').click();await page.waitForFunction(()=>chat.length===1);assert.match(await page.evaluate(()=>chat[0].content),/1 × Rope.*Total: 2 Bullets/);
  await page.locator('[data-buy="lamp"]').click();await page.waitForFunction(()=>chat.length===2);assert.match(await page.evaluate(()=>chat[1].content),/1 × Lamp.*Total unavailable/);
  assert.deepEqual(await page.evaluate(()=>payloads.filter(p=>p.action==='purchase').map(p=>p.items)),[[{id:'rope',quantity:1}],[{id:'lamp',quantity:1}]]);assert.equal(await page.evaluate(()=>hero.system.resources.bullets.value),20);
  await page.locator('[data-increase]').click();assert.equal(await page.locator('[data-quantity]').inputValue(),'2');assert.equal(await page.locator('[data-received]').innerText(),'3');
  await page.locator('[data-decrease]').click();assert.equal(await page.locator('[data-quantity]').inputValue(),'1');assert(await page.locator('[data-decrease]').isDisabled());assert.equal(await page.locator('[data-received]').innerText(),'1');
  await page.locator('[data-receive]').selectOption('cleanWater');await page.locator('[data-quantity]').fill('2');assert.match(await page.locator('[data-quote]').innerText(),/Deduct 2 Bullets; add 6 Clean Water/);
  await page.evaluate(()=>globalThis.acceptTrade=false);await page.locator('[data-trade]').click();assert.equal(await page.evaluate(()=>hero.system.resources.bullets.value),20);await page.evaluate(()=>globalThis.acceptTrade=true);
  await page.locator('[data-trade]').click();await page.waitForFunction(()=>hero.system.resources.bullets.value===18&&chat.length===3);assert.equal(await page.evaluate(()=>hero.system.resources.water.value),16);assert.match(await page.locator('[data-balances]').innerText(),/Bullets: 18/);assert.match(await page.evaluate(()=>confirmation.content),/deduct.*2 Bullets.*add.*6 Clean Water/);
  await page.locator('[data-quantity]').fill('0.5');assert(await page.locator('[data-trade]').isDisabled());await page.locator('[data-quantity]').fill('1');await page.locator('[data-receive]').selectOption('bullets');assert(await page.locator('[data-trade]').isDisabled());await page.locator('[data-receive]').selectOption('cleanWater');
  // Authority rejects a stale visible quote without touching resources.
  await page.evaluate(()=>sector.settlement.shop.trading.values.bullets=2);await page.locator('[data-trade]').click();await page.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('rates changed'));assert.equal(await page.evaluate(()=>hero.system.resources.bullets.value),18);await page.locator('[data-refresh]').click();await page.waitForFunction(()=>document.querySelector('[data-quote]').textContent.includes('Rate: 2 / 1'));
  // A fresh authoritative rate snapshot updates the visible amount without resetting the Give selection.
  await page.locator('[data-receive]').selectOption('cleanGrub');await page.locator('[data-quantity]').fill('3');assert.equal(await page.locator('[data-received]').innerText(),'3');
  await page.evaluate(()=>{sector.settlement.shop.trading.values.bullets=4;rateChecks.at(-1).callback();});await page.waitForFunction(()=>document.querySelector('[data-received]').textContent==='6'&&!shop.refreshing);assert.equal(await page.locator('[data-quantity]').inputValue(),'3');assert.equal(await page.locator('[data-received]').innerText(),'6');
  await page.locator('[data-quantity]').fill('99');assert(await page.locator('[data-trade]').isDisabled());await page.locator('[data-quantity]').fill('1');
  await page.evaluate(async()=>{sector.settlement.shop.groups[0].entries.push({id:'missing',uuid:'Item.missing'});await shop.refreshDisplayedRates();});assert(await page.locator('[data-buy="missing"]').isDisabled());
  await page.locator('[data-buy="rope"]').click();await page.waitForFunction(()=>chat.length===4);assert(await page.locator('[data-buy="missing"]').isDisabled());
  for(const width of [1100,520,360]){await page.setViewportSize({width,height:800});assert.equal(await page.locator('.myz-player-shop').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);const aligned=await page.evaluate(()=>{const a=document.querySelector('[data-give]').getBoundingClientRect(),b=document.querySelector('[data-receive]').getBoundingClientRect(),q=document.querySelector('.sm-exchange-quantity').getBoundingClientRect(),r=document.querySelector('[data-received]').getBoundingClientRect();return Math.abs(a.top-b.top)<1&&Math.abs(q.top-r.top)<1;});assert(aligned);}
  await page.screenshot({path:'/tmp/myz-player-shop.png',fullPage:true});
  await page.evaluate(async()=>{
    const {renderShop,bindCopyPlayerShopMacro}=await import('/scripts/settlement-shop-ui.mjs');
    const {normalizeShop}=await import('/scripts/settlement-shop.mjs');
    const host={sectorId:'actualSettlementId',data:{settlement:{shop:normalizeShop(sector.settlement.shop)}}};
    const root=document.createElement('section');root.id='gm-shop';root.innerHTML=renderShop(host);document.body.append(root);
    game.user={isGM:true};globalThis.copiedMacros=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{if(globalThis.clipboardFail)throw Error('Permission denied');copiedMacros.push(text);}}});
    bindCopyPlayerShopMacro(root);
  });
  await page.locator('#gm-shop > .sm-shop > details > summary').click();
  const macro=page.locator('[data-player-shop-macro]'),copy=page.locator('[data-copy-player-shop-macro]');await copy.click();await page.waitForFunction(()=>copiedMacros.length===1);assert.equal(await page.evaluate(()=>copiedMacros[0]),await macro.innerText());assert.equal(await macro.innerText(),'await game.myzSectorManager.openPlayerShop("JournalEntry.actualSettlementId");');assert.match(await page.locator('[data-player-shop-copy-status]').innerText(),/Copied/);
  // The displayed source is authoritative even if it gains additional arguments.
  await macro.evaluate(el=>el.textContent='await game.myzSectorManager.openPlayerShop("JournalEntry.changedId");');await copy.click();await page.waitForFunction(()=>copiedMacros.length===2);assert.equal(await page.evaluate(()=>copiedMacros[1]),await macro.innerText());
  await page.evaluate(()=>globalThis.clipboardFail=true);await copy.click();await page.waitForFunction(()=>document.querySelector('[data-player-shop-copy-status]').textContent.includes('Clipboard unavailable'));assert.equal(await page.evaluate(()=>getSelection().toString()),await macro.innerText());assert.equal(await copy.isDisabled(),false);
  await page.evaluate(()=>{game.user=player;});await copy.click();assert.equal(await page.evaluate(()=>copiedMacros.length),2);
  assert.equal(await page.evaluate(()=>rateChecks.at(-1).delay),10000);await page.evaluate(async()=>{await shop._onClose({});});assert.equal(await page.evaluate(()=>shop.rateTimer),undefined);
  // Hydrate the actual Ark projection, including edits and missing-reference recovery.
  await page.evaluate(async()=>{const root=document.createElement('section');root.id='ark-test';root.innerHTML='<h2>Ark</h2><div data-ark-information></div>';document.body.append(root);globalThis.host={data:{settlement:{arkUuid:'Actor.ark'}},element:root};game.user={isGM:true};await hydrateArk(host);});
  const ark=page.locator('#ark-test');assert.match(await ark.innerText(),/42.*Coordinates.*C4.*Water Source.*Well/s);assert.match(await ark.innerText(),/Farm \(completed\).*Generator.*Raven.*Ark Info/s);await ark.locator('button').click();assert.equal(await page.evaluate(()=>arkOpened),true);
  await page.evaluate(async()=>{globalThis.ark.system.population='50';await hydrateArk(host);});assert.match(await ark.innerText(),/50/);await page.evaluate(async()=>{host.data.settlement.arkUuid='Actor.missing';await hydrateArk(host);});assert.match(await ark.innerText(),/unavailable.*retained/);assert.equal(await page.evaluate(()=>host.data.settlement.arkUuid),'Actor.missing');
  assert.deepEqual(errors,[]);console.log('Standalone Shop single-unit Buy, aligned exchange controls/steppers, live received amounts/rates, exact GM Macro clipboard/failure handling, secret stripping, purchase requests, trade confirmation/cancellation, native resource updates, stale rates, responsive scrolling and live Ark projection pass. Foundry was not loaded.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
