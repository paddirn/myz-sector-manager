// Real Campaign Log DOM/edit commands; Foundry combat document hooks are simulated.
module.exports=async(page,assert)=>{
 const log=page.locator('.myz-campaign-log'),editor=page.locator('.myz-campaign-editor');
 await page.evaluate(async()=>{
  game.combats=new Map();
  globalThis.combat={id:'ambush',uuid:'Combat.ambush',name:'Ambush <script>doNotRun()</script>',scene:zone.store.scene,sceneId:'scene',round:0,combatants:new Map(),get started(){return this.round>0;}};
  const one={id:'one',parent:combat,name:'Scout <img onerror=doNotRun()>',defeated:false,actor:{uuid:'Actor.scout'}},two={id:'two',parent:combat,name:'Raider',defeated:true,actor:{uuid:'Actor.raider'}};combat.combatants.set(one.id,one);combat.combatants.set(two.id,two);game.combats.set(combat.id,combat);Hooks.call('createCombat',combat);combat.round=1;Hooks.call('updateCombat',combat,{round:1});await service.queue;
  Hooks.call('preDeleteCombatant',two);combat.combatants.delete(two.id);Hooks.call('deleteCombatant',two);await service.queue;
  service.combats.stop();service.combats.start();
  const late={id:'late',parent:combat,name:'Latecomer',defeated:false,actor:{uuid:'Actor.late'}};combat.combatants.set(late.id,late);Hooks.call('createCombatant',late);Hooks.call('preDeleteCombat',combat);Hooks.call('deleteCombat',combat,{},'gm');await service.queue;
 });
 await page.waitForFunction(()=>document.querySelector('.cl-note-text')?.textContent.includes('Latecomer'));
 let text=await log.locator('.cl-note-text').innerText();assert.match(text,/Combat Encounter: Ambush/);assert.match(text,/Raider — Defeated/);assert.match(text,/Scout/);assert.match(text,/Actor.scout/);assert.match(text,/Latecomer/);assert.equal(await log.locator('script').count(),0);assert.equal(await log.locator('img').count(),0);assert.equal(await log.locator('[data-session-notes]').count(),0);assert.equal(await log.locator('[data-note-edit]').count(),1);
 await log.locator('[data-note-edit]').click();assert.equal(await editor.locator('textarea').getAttribute('maxlength'),'1000000');await editor.locator('textarea').fill('Combat Encounter: GM renamed\nCorrected participants and commentary.');await editor.locator('[data-action="save"]').click();await page.waitForFunction(()=>document.querySelector('.cl-note-text')?.textContent.includes('GM renamed'));
 await page.evaluate(async()=>{Hooks.call('deleteCombat',combat,{},'gm');await service.queue;});assert.equal(await log.locator('[data-note-edit]').count(),1);assert.match(await log.locator('.cl-note-text').innerText(),/GM renamed/);
 await page.evaluate(async()=>{
  globalThis.remoteCombat={id:'remote',uuid:'Combat.remote',name:'Elsewhere',scene:{id:'battle',name:'Battle Scene'},sceneId:'battle',round:0,combatants:new Map(),get started(){return this.round>0;}};
  Hooks.call('createCombat',remoteCombat);remoteCombat.round=1;Hooks.call('updateCombat',remoteCombat,{round:1});await service.queue;Hooks.call('deleteCombat',remoteCombat,{},'gm');await service.queue;
 });
 await log.locator('[data-session-notes]').waitFor();assert.match(await log.locator('[data-session-notes]').innerText(),/not associated with a sector visit/);assert.match(await log.locator('[data-session-notes]').innerText(),/Elsewhere/);assert.match(await log.locator('[data-session-notes]').innerText(),/No combatants were observed/);
 await log.locator('[data-session-notes] [data-note-edit]').click();await editor.locator('textarea').fill('Session-level encounter correction');await editor.locator('[data-action="save"]').click();await page.waitForFunction(()=>document.querySelector('[data-session-notes]')?.textContent.includes('Session-level encounter correction'));
 await log.locator('[data-export]').click();const file=await page.evaluate(()=>JSON.parse(downloads.at(-1).data));assert.equal(file.sessions[0].notes[0].text,'Session-level encounter correction');assert.equal(file.sessions[0].notes[0].combatUuid,'Combat.remote');assert.equal(file.sessions[0].visits[0].notes[0].text,'Combat Encounter: GM renamed\nCorrected participants and commentary.');
 await page.evaluate(()=>{service.window.element.style.width='580px';});assert.equal(await log.evaluate(el=>el.scrollWidth<=el.clientWidth+2),true);await page.screenshot({path:'/tmp/myz-combat-log-browser.png'});
 await log.locator('[data-session-notes] [data-note-delete]').click();await page.waitForFunction(()=>!document.querySelector('[data-session-notes]'));await page.evaluate(async()=>{Hooks.call('deleteCombat',remoteCombat,{},'gm');await service.queue;});assert.equal(await log.locator('[data-session-notes]').count(),0);
 await log.locator('[data-note-delete]').click();await page.waitForFunction(()=>!document.querySelector('[data-note-edit]'));await page.evaluate(async()=>{Hooks.call('deleteCombat',combat,{},'gm');await service.queue;});assert.equal(await log.locator('[data-note-edit]').count(),0);
 await page.evaluate(()=>{service.window.element.style.width='580px';});assert.equal(await log.evaluate(el=>el.scrollWidth<=el.clientWidth+2),true);assert.deepEqual(await page.evaluate(()=>notices),[]);
 console.log('Combat browser: hook-driven note creation, persisted removed roster/reload, escaped text, visit/session scope, edit/delete/replay, export, one-note identity and narrow layout pass');
};
if(require.main===module){process.env.MYZ_COMBAT_ONLY='1';require('./campaign-log-browser.cjs');}
