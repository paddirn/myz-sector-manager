// Focused real-DOM component tests; Foundry documents are simulated.
const {chromium}=require('playwright');
const {readFileSync,existsSync}=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{
  if(['/live.svg','/saved.svg','/new.svg'].includes(req.url)){res.setHeader('Content-Type','image/svg+xml');return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="400"><rect width="200" height="400" fill="orange"/></svg>');}
  if(req.url.startsWith('/scripts/')){try{res.setHeader('Content-Type','text/javascript');return res.end(readFileSync(path.join(root,req.url)));}catch{}}
  res.writeHead(req.url==='/'?200:404);res.end('<html></html>');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.MYZ_CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
  const result=await page.evaluate(async()=>{
   const {InhabitantPortraits,avatarMarkup,portraitFields}=await import('/scripts/ui/inhabitant-portraits.mjs');
   const {ScrollKeeper}=await import('/scripts/ui/scroll.mjs');
   const check=(v,m)=>{if(!v)throw Error(m);};
   const events=new Map();let hookId=0;const hooks={on(n,fn){const id=++hookId;events.set(id,{n,fn});return id;},off(n,id){events.delete(id);},call(n,a){for(const item of events.values())if(item.n===n)item.fn(a);}};
   const loaded=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const wait=async predicate=>{for(let i=0;i<120;i++){if(predicate())return;await loaded();}throw Error('image did not settle');};
   let writes=0;
   for(const [sectorType,tab,key] of [['normal','Encounters','encounters'],['special','Inhabitants','special.inhabitants'],['settlement','Inhabitants','settlement.inhabitants']]){
    const entry={id:'stable',uuid:'Actor.test',title:'Manual name',details:'Manual description',portrait:'/saved.svg'};
    const data={sectorType};if(key.includes('.'))data[key.split('.')[0]]={inhabitants:[entry]};else data.encounters=[entry];
    const host={data,draft:data,tab,rendered:true,entryState:()=>({entries:[{id:'stable',item:entry}]}),capture(){entry.portrait=card.querySelector('input').value;},markDirty(){this.dirty=true;},renderReference(){controller.reference(card.querySelector('[data-reference]'),null);}};
    const view=document.createElement('div');view.innerHTML=`<article data-entry="stable">${avatarMarkup()}<div data-reference></div>${portraitFields('portrait',entry.portrait)}<textarea>Keep focus</textarea></article>`;document.body.append(view);const card=view.firstElementChild;
    const env={document,game:{user:{isGM:true}},Hooks:hooks,ui:{notifications:{warn:()=>{},error:()=>{}}}},actor={uuid:'Actor.test',documentName:'Actor',img:'/live.svg',testUserPermission:()=>true,update(){writes++;}};
    const controller=new InhabitantPortraits(host,env);controller.prepare(view);controller.reference(card.querySelector('[data-reference]'),actor);controller.bind(view);
    const images=()=>[...card.querySelectorAll('img')];
    await wait(()=>images().length===2&&images().every(i=>i.naturalWidth===200));check(images().every(i=>i.getAttribute('src')==='/live.svg'),key+' Actor priority');check(entry.portrait==='/saved.svg','saved path untouched');
    const focus=card.querySelector('textarea');focus.focus();const before=card;actor.img='/new.svg';hooks.call('updateActor',actor);await wait(()=>images().every(i=>i.getAttribute('src')==='/new.svg'&&i.naturalWidth===200));check(document.activeElement===focus&&card===before,'targeted update focus/DOM');check(entry.details==='Manual description'&&entry.title==='Manual name','snapshot unchanged');
    actor.img='/missing.svg';hooks.call('updateActor',actor);await wait(()=>images().length===2&&images().every(i=>i.getAttribute('src')==='/saved.svg'&&i.naturalWidth===200));
    actor.img='icons/svg/mystery-man.svg';hooks.call('updateActor',actor);check(images().every(i=>i.getAttribute('src')==='/saved.svg'),'default Actor image falls back');
    const input=card.querySelector('input');input.value='/new.svg';host.capture();input.dispatchEvent(new Event('input',{bubbles:true}));await wait(()=>images().every(i=>i.getAttribute('src')==='/new.svg'&&i.naturalWidth===200));
    let picker;env.foundry={applications:{apps:{FilePicker:{implementation:class{constructor(options){picker=options;}render(){}}}}}};card.querySelector('button').click();picker.callback('/saved.svg');check(host.dirty&&entry.portrait==='/saved.svg','picker edits draft');
    hooks.call('deleteActor',actor);await wait(()=>images().every(i=>i.getAttribute('src')==='/saved.svg'&&i.naturalWidth===200));check(entry.uuid==='Actor.test','deleted UUID retained');
    entry.portrait='/missing.svg';controller.reference(card.querySelector('[data-reference]'),null);await wait(()=>images().length===0);check(card.querySelectorAll('svg').length===2,'same silhouette in header/preview');
    entry.portrait='/saved.svg';actor.img='/live.svg';hooks.call('updateActor',actor);const stale=images()[0];actor.img='/new.svg';hooks.call('updateActor',actor);stale.dispatchEvent(new Event('error'));check(images().every(i=>i.getAttribute('src')==='/new.svg'),'stale error ignored');
    card.remove();picker.callback('/new.svg');check(entry.portrait==='/saved.svg','stale picker ignored');controller.stop();check(events.size===0,'hooks removed on close');view.remove();
   }
   check(writes===0,'no Actor writes');
   // Replacement-time scroll snapshots, nested semantic identity, clamping,
   // anchor adjustment, hidden panels, and newer user-scroll protection.
   const keeper=new ScrollKeeper(globalThis),slot=document.createElement('section');document.body.append(slot);
   const make=()=>{const v=document.createElement('div');v.dataset.scrollScope='["sector","Encounters"]';v.innerHTML='<div class="sm-list" style="height:100px;width:180px;overflow:auto"><div style="height:1400px;width:500px"></div></div><div class="sm-content" style="height:120px;overflow:auto"></div>';const content=v.querySelector('.sm-content');for(let i=0;i<30;i++){const card=document.createElement('article');card.dataset.entry='id'+i;card.style.height='80px';card.textContent='Entry '+i;content.append(card);}const area=document.createElement('textarea');area.name='encounters.0.details';area.style.cssText='height:50px;width:100px;white-space:pre;overflow:auto';area.value=('long line '.repeat(40)+'\n').repeat(30);content.firstElementChild.append(area);return v;};
   let view=make();slot.replaceChildren(view);const list=view.querySelector('.sm-list'),content=view.querySelector('.sm-content'),area=view.querySelector('textarea');list.scrollTop=800;list.scrollLeft=150;content.scrollTop=620;area.scrollTop=200;area.scrollLeft=120;keeper.capture(view);
   const next=make();slot.replaceChildren(next);keeper.restore(next);check(next.querySelector('.sm-list').scrollTop===800&&next.querySelector('.sm-list').scrollLeft===150,'sidebar x/y');check(next.querySelector('.sm-content').scrollTop===620,'main position');check(next.querySelector('textarea').scrollTop===200&&next.querySelector('textarea').scrollLeft===120,'nested textarea x/y');
   keeper.capture(next);const removed=make();removed.querySelector('[data-entry="id1"]').remove();slot.replaceChildren(removed);keeper.restore(removed);check(removed.querySelector('.sm-content').scrollTop===540,'entry anchor follows removal above viewport');
   const text=removed.querySelector('textarea');text.name='encounters.9.details';text.focus({preventScroll:true});text.setSelectionRange(3,7);keeper.capture(removed);const reindexed=make();reindexed.querySelector('textarea').name='encounters.15.details';reindexed.querySelector('[data-entry="id1"]').remove();slot.replaceChildren(reindexed);keeper.restore(reindexed);check(reindexed.querySelector('textarea').scrollTop===200,'stable entry field survives reindexing');check(document.activeElement===reindexed.querySelector('textarea')&&document.activeElement.selectionStart===3&&document.activeElement.selectionEnd===7,'stable field focus and caret survive reindexing');
   keeper.capture(reindexed);const otherTab=make();otherTab.dataset.scrollScope='["sector","Effects"]';slot.replaceChildren(otherTab);keeper.restore(otherTab);check(otherTab.querySelector('.sm-list').scrollTop===800&&otherTab.querySelector('.sm-content').scrollTop===0,'sidebar global; unseen tab independent');
   keeper.capture(next);const shorter=make();shorter.querySelector('.sm-list').firstElementChild.style.height='200px';for(const card of [...shorter.querySelector('.sm-content').children].slice(4))card.remove();slot.replaceChildren(shorter);keeper.restore(shorter);check(shorter.querySelector('.sm-list').scrollTop===100,'shorter clamp');check(shorter.querySelector('.sm-content').scrollTop<=shorter.querySelector('.sm-content').scrollHeight-shorter.querySelector('.sm-content').clientHeight,'main clamp');
   keeper.capture(next);const hidden=make();hidden.querySelector('.sm-list').style.display='none';slot.replaceChildren(hidden);keeper.restore(hidden);const hiddenList=hidden.querySelector('.sm-list');check(keeper.pending.has(hiddenList),'hidden panel pending');hiddenList.style.display='block';keeper.settle();check(hiddenList.scrollTop===800,'visible panel restored');
   keeper.capture(hidden);const delayed=make();delayed.querySelector('.sm-list').style.display='none';slot.replaceChildren(delayed);keeper.restore(delayed);const delayedList=delayed.querySelector('.sm-list');delayedList.dispatchEvent(new WheelEvent('wheel',{bubbles:true}));delayedList.style.display='block';delayedList.scrollTop=35;keeper.settle();check(delayedList.scrollTop===35,'new user scroll wins');keeper.disconnect();slot.remove();
   return 'All three portrait modes, loading failures/stale results, picker/update/delete/focus/no writes; scroll x/y, nested fields, clamping, hidden panels and user intent passed';
  });
  console.log(result);assert(result.includes('passed'));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
