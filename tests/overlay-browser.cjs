// Optional real PIXI/WebGL check, separate from simulated Foundry integration.
// Supply a trusted PIXI 7.4.x browser bundle with MYZ_PIXI_PATH (see README).
const {chromium}=require('playwright');
const {readFileSync,existsSync}=require('node:fs');
const assert=require('node:assert/strict');
const http=require('node:http');
const path=require('node:path');
(async()=>{
  const bundle=process.env.MYZ_PIXI_PATH||'/tmp/myz-pixi/package/dist/pixi.min.js';
  if(!existsSync(bundle))throw new Error('Set MYZ_PIXI_PATH to a trusted PIXI 7.4.x browser bundle; this check was not run.');
  const root=path.resolve(__dirname,'..');
  const server=http.createServer((req,res)=>{
    if(req.url==='/pixi.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(bundle));return;}
    const file=path.resolve(root,'.'+decodeURIComponent(req.url));
    if(!file.startsWith(root+'/scripts/')){res.setHeader('Content-Type','text/html');res.end('<html><style>body{margin:0}canvas{display:block}</style></html>');return;}
    try{res.setHeader('Content-Type','text/javascript');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,executablePath:process.env.MYZ_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:1000,height:650}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);await page.addScriptTag({url:'/pixi.js'});
    await page.evaluate(async()=>{
      const {ZoneOverlay}=await import('/scripts/zone/overlay.mjs');
      const {SECTOR_ICONS}=await import('/scripts/sector-icons.mjs');
      globalThis.app=new PIXI.Application({width:900,height:600,backgroundColor:0x303030,antialias:true});document.body.append(app.view);
      const scene={id:'zone',width:900,height:600,dimensions:{sceneRect:{x:0,y:0,width:900,height:600}}};
      globalThis.data={version:1,code:'A1',terrain:'Overgrown Ruins with a very long custom name that wraps',rot:0,status:'Scouted',encounters:[{title:'Mutants'}],effects:[{category:'Weather'},{category:'Phenomenon'}],loot:[{title:'Artifact'}]};
      globalThis.store={isGM:true,scene,get live(){return canvas.scene?.id==='zone';},config:{sceneId:'zone',grid:{reference:'A1',originX:20,originY:20,width:180,height:170,columns:4,rows:3,columnAxis:'x',columnDirection:1,rowDirection:1},overlay:{enabled:true,boundaries:true,labels:true,status:true}}};
      globalThis.nativeEvents={down:0,up:0,right:0,wheel:0};globalThis.selected=[];globalThis.notifyErrors=[];
      globalThis.canvas={app,stage:app.stage,ready:true,scene,tokens:{placeables:[]}};
      globalThis.game={scenes:new Map([['zone',scene]]),journal:[{getFlag:()=>data}]};globalThis.ui={notifications:{info(){},error:message=>notifyErrors.push(message)}};
      globalThis.overlay=new ZoneOverlay(store);overlay.onSelect=async code=>selected.push(code);overlay.draw();
      for(const [event,key] of [['pointerdown','down'],['pointerup','up'],['contextmenu','right'],['wheel','wheel']])app.view.addEventListener(event,e=>{nativeEvents[key]++;if(e.defaultPrevented)throw new Error('Foundry event cancelled');});
      globalThis.greenPixels=()=>{const pixels=app.renderer.extract.pixels(app.stage);let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+1]>pixels[i]+20&&pixels[i+1]>pixels[i+2]+20)count++;return count;};
      globalThis.baseline=greenPixels();
      if(!Object.keys(SECTOR_ICONS).length)throw new Error('Missing icons');
    });
    await page.mouse.move(80,100);await page.waitForFunction(()=>overlay.hoverCode==='A1');
    assert(await page.evaluate(()=>greenPixels()>baseline+10000));
    const tooltip=page.locator('.myz-sector-overlay-tooltip');assert.match(await tooltip.innerText(),/Rot Level: 0/);assert.match(await tooltip.innerText(),/1 Encounter/);assert.match(await tooltip.innerText(),/1 Phenomenon/);assert.equal(await tooltip.evaluate(e=>getComputedStyle(e).pointerEvents),'none');
    await page.mouse.click(80,100);await page.waitForFunction(()=>selected.length===1);assert.deepEqual(await page.evaluate(()=>selected),['A1']);
    await page.mouse.click(80,100,{button:'right'});await page.mouse.move(80,100);await page.mouse.down();await page.mouse.move(130,140);await page.mouse.move(80,100);await page.mouse.up();assert.equal(await page.evaluate(()=>selected.length),1);
    await page.evaluate(()=>canvas.tokens.placeables=[{visible:true,bounds:new PIXI.Rectangle(20,20,180,170)}]);await page.mouse.click(80,100);assert.equal(await page.evaluate(()=>selected.length),1);await page.evaluate(()=>canvas.tokens.placeables=[]);
    // Native DOM controls above the canvas do not navigate.
    await page.evaluate(()=>{const b=document.createElement('button');b.id='ui';b.style.cssText='position:absolute;left:45px;top:55px';b.textContent='Foundry toolbar';document.body.append(b);});await page.locator('#ui').click();assert.equal(await page.evaluate(()=>selected.length),1);await page.locator('#ui').evaluate(e=>e.remove());
    // Every indicator is a real PIXI vector and every cell clips its own content.
    const details=await page.evaluate(()=>{const c=overlay.cells.get('A1');return {icons:c.root.children.filter(v=>v.sectorIcon).map(v=>v.sectorIcon),mask:!!c.root.mask,bounds:c.root.getBounds().toString()};});assert.deepEqual(details.icons,['rot','encounters','phenomena','loot','scouted']);assert(details.mask);
    await page.screenshot({path:'/tmp/myz-interactive-overlay.png'});
    // Updating one sector preserves other cells and the overall stage object.
    await page.evaluate(()=>{globalThis.oldRoot=overlay.root;globalThis.oldEmpty=overlay.cells.get('B1').root;data.rot=2;data.loot[0].status='Collected';data.status='Explored';overlay.draw();});
    assert(await page.evaluate(()=>overlay.root===oldRoot&&overlay.cells.get('B1').root===oldEmpty));
    await page.mouse.move(81,101);assert.match(await tooltip.innerText(),/Rot Level: 2/);assert.doesNotMatch(await tooltip.innerText(),/Uncollected Loot Available/);
    // Panning and zooming use the actual PIXI inverse world transform.
    await page.evaluate(()=>{app.stage.scale.set(.8);app.stage.position.set(100,50);overlay.draw();});
    await page.mouse.click(300,130);await page.waitForFunction(()=>selected.length===2);assert.equal(await page.evaluate(()=>selected.at(-1)),'B1');
    await page.mouse.wheel(0,20);assert.equal(await page.evaluate(()=>nativeEvents.wheel),1);
    // Toggle off, scene changes and teardown remove visuals and observers.
    await page.evaluate(()=>{store.config.overlay.enabled=false;overlay.draw();});await page.mouse.click(300,130);assert.equal(await page.evaluate(()=>selected.length),2);assert.equal(await tooltip.count(),0);
    await page.evaluate(()=>{store.config.overlay.enabled=true;overlay.draw();canvas.scene={id:'combat'};overlay.draw();});await page.mouse.click(300,130);assert.equal(await page.evaluate(()=>selected.length),2);
    await page.evaluate(()=>{canvas.scene=game.scenes.get('zone');overlay.draw();overlay.stop();});await page.mouse.click(300,130);assert.equal(await page.evaluate(()=>selected.length),2);assert.equal(await page.evaluate(()=>app.stage.children.length),0);
    const native=await page.evaluate(()=>nativeEvents);assert(native.down>=7&&native.up>=7&&native.right>=1);assert.deepEqual(await page.evaluate(()=>notifyErrors),[]);assert.deepEqual(errors,[]);
    console.log('Real PIXI/WebGL rendering, masks, shared vector icons, hover pixels/tooltips, transformed navigation, token/UI/drag/right-click safeguards, native events, live updates and cleanup pass. Foundry itself was not loaded.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
