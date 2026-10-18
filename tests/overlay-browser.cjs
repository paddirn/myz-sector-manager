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
    if(req.url==='/test-wide.svg'){res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="100"><rect width="600" height="100" fill="orange"/></svg>');return;}
    if(req.url==='/missing.png'){res.writeHead(404);res.end();return;}
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
      globalThis.game={scenes:new Map([['zone',scene]]),journal:[{id:'sector',getFlag:()=>data}]};globalThis.ui={notifications:{info(){},error:message=>notifyErrors.push(message)}};
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
    // Special decoration stays inside the existing passive overlay and keeps normal cells intact.
    await page.evaluate(()=>{globalThis.textureLoads=0;globalThis.foundry={canvas:{loadTexture:path=>{textureLoads++;return PIXI.Assets.load(path);}}};globalThis.normalCell=overlay.cells.get('B1').root;data.sectorType='special';data.special={overlayImage:'/test-wide.svg'};data.terrain='Special Terrain';overlay.draw();});
    await page.waitForFunction(()=>overlay.cells.get('A1').root.children.some(child=>child.name==='special-sector-image'));
    const special=await page.evaluate(()=>{const cell=overlay.cells.get('A1'),image=cell.root.children.find(child=>child.name==='special-sector-image'),terrain=cell.root.children.find(child=>child.name==='special-sector-terrain'),highlight=cell.root.children.find(child=>child.name==='special-sector-highlight');return {normalUnchanged:overlay.cells.get('B1').root===normalCell,image:{x:image.x,y:image.y,width:image.width,height:image.height},bounds:cell.bounds,terrain:{text:terrain.text,x:terrain.x,y:terrain.y,width:terrain.width,height:terrain.height},purple:highlight.geometry.graphicsData.some(part=>part.lineStyle.color===0x9563c9),passive:image.eventMode==='none'&&cell.root.eventMode==='none'};});
    assert(special.normalUnchanged&&special.purple&&special.passive);assert.equal(special.terrain.text,'Special Terrain');assert(Math.abs(special.image.width/special.image.height-6)<.001);assert(special.image.y>=special.bounds.y&&special.image.y+special.image.height<=special.bounds.y+special.bounds.height/3+.01);assert(Math.abs(special.image.x+special.image.width/2-special.bounds.x-special.bounds.width/2)<.01);assert(special.terrain.y>=special.bounds.y+special.bounds.height*.75);
    await page.evaluate(()=>{const draft=structuredClone(data);draft.terrain='Live draft Terrain';overlay.setDraft('sector',draft);});assert.equal(await page.evaluate(()=>overlay.cells.get('A1').root.children.find(child=>child.name==='special-sector-terrain').text),'Live draft Terrain');
    await page.evaluate(()=>overlay.clearDraft());assert.equal(await page.evaluate(()=>overlay.cells.get('A1').root.children.find(child=>child.name==='special-sector-terrain').text),'Special Terrain');
    await page.evaluate(()=>{store.config.grid.width=220;store.config.grid.height=190;app.stage.scale.set(.6);overlay.draw();});await page.waitForFunction(()=>overlay.cells.get('A1').root.children.some(child=>child.name==='special-sector-image'));assert.equal(await page.evaluate(()=>textureLoads),1);
    await page.evaluate(()=>{store.config.overlay.labels=false;overlay.draw();});await page.waitForFunction(()=>overlay.cells.get('A1').root.children.some(child=>child.name==='special-sector-image'));assert(await page.evaluate(()=>overlay.cells.get('A1').root.children.some(child=>child.name==='special-sector-highlight')));
    await page.evaluate(async()=>{data.special.overlayImage='/missing.png';overlay.draw();await overlay.imageLoads.get('/missing.png');});assert.equal(await page.evaluate(()=>overlay.cells.get('A1').root.children.some(child=>child.name==='special-sector-image')),false);
    await page.evaluate(()=>{data.special.overlayImage='';overlay.draw();store.config.overlay.labels=true;app.renderer.background.color=0xffffff;app.renderer.render(app.stage);});assert(await page.evaluate(()=>overlay.cells.get('A1').root.children.some(child=>child.name==='special-sector-highlight')));
    const specialPoint=await page.evaluate(()=>{const b=overlay.cells.get('A1').bounds,p=app.stage.toGlobal(new PIXI.Point(b.x+b.width/2,b.y+b.height/2));return {x:p.x,y:p.y};});
    await page.mouse.move(specialPoint.x,specialPoint.y);await page.waitForFunction(()=>overlay.hoverCode==='A1');await page.mouse.click(specialPoint.x,specialPoint.y);await page.waitForFunction(()=>selected.length===3);assert.equal(await page.evaluate(()=>selected.at(-1)),'A1');
    // Toggle off, scene changes and teardown remove visuals and observers.
    await page.evaluate(()=>{store.config.overlay.enabled=false;overlay.draw();});await page.mouse.click(300,130);assert.equal(await page.evaluate(()=>selected.length),3);assert.equal(await tooltip.count(),0);
    await page.evaluate(()=>{store.config.overlay.enabled=true;overlay.draw();canvas.scene={id:'combat'};overlay.draw();});await page.mouse.click(300,130);assert.equal(await page.evaluate(()=>selected.length),3);
    await page.evaluate(()=>{canvas.scene=game.scenes.get('zone');overlay.draw();overlay.stop();});await page.mouse.click(300,130);assert.equal(await page.evaluate(()=>selected.length),3);assert.equal(await page.evaluate(()=>app.stage.children.length),0);
    const native=await page.evaluate(()=>nativeEvents);assert(native.down>=7&&native.up>=7&&native.right>=1);assert.deepEqual(await page.evaluate(()=>notifyErrors),[]);assert.deepEqual(errors,[]);
    console.log('Real PIXI/WebGL rendering, masks, shared vector icons, hover pixels/tooltips, transformed navigation, token/UI/drag/right-click safeguards, native events, live updates and cleanup pass. Foundry itself was not loaded.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
