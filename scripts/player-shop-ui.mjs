import {shopColumns} from './settlement-shop.mjs';
import {imagePath} from './sector-images.mjs';
import {characterResources,RESOURCES,tradeQuote,tradeRatio} from './settlement-trading.mjs';
import {escapeHTML as esc} from './travel/model.mjs';
export function eligibleShopCharacters(env=globalThis){return Array.from(env.game.actors).filter(actor=>{try{characterResources(actor,env.game.user,env);return true;}catch{return false;}}).sort((a,b)=>a.name.localeCompare(b.name));}
export function preferredShopCharacter(actors,env=globalThis){
 const assigned=env.game.user.character?.uuid;if(actors.some(a=>a.uuid===assigned))return assigned;
 const controlled=[...new Set((env.canvas?.tokens?.controlled||[]).map(t=>t.actor?.uuid).filter(uuid=>actors.some(a=>a.uuid===uuid)))];
 return controlled.length===1?controlled[0]:actors[0]?.uuid;
}
export function characterEncumbrance(actor){
 const value=actor?.system?.encumbrance;
 if(!Number.isFinite(value?.itemsWeight)||!Number.isFinite(value?.encumbranceMax))return null;
 return {current:value.itemsWeight,maximum:value.encumbranceMax,encumbered:value.itemsWeight>value.encumbranceMax};
}
let characterPickerSequence=0;
export const PLAYER_SHOP_INTRO=Object.freeze([
 "The lists below contain items and services commonly traded in the Ark. The cost (in bullets) is only a guideline – remember, there are no set prices in the Ark. Requirement tells you what projects need to be completed in the Ark for the item to be generally available. Weight tells you how many lines on you gear list that the item requires.",
 "Individual tiny items don't take up space. However, more than 10 of a tiny item counts as a light item, more than 20 as a regular item and more than 40 as a heavy item.",
 "Prices below can be paid either bullets or in pieces of scrap, round up if cost is a fraction (you can't pay in fractions of bullets)."
]);
const avatar=actor=>{const src=imagePath(actor?.img);return `${src?`<img class="sm-character-image" src="${esc(src)}" alt="" loading="lazy">`:''}<span class="sm-character-fallback" ${src?'hidden':''} aria-hidden="true">♟</span><span><span data-character-name>${esc(actor?.name||'No eligible character')}</span><small data-balances></small></span>`;};
export function playerShopContent(snapshot,actors,actorUuid){
 const opts=Object.entries(RESOURCES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join(''),selected=actors.find(a=>a.uuid===actorUuid),listId=`sm-character-list-${++characterPickerSequence}`;
 const inventory=snapshot.groups.map(g=>{const columns=shopColumns(g);return `<h3 class="sm-shop-section-heading">${esc(g.name)}</h3><div class="sm-player-inventory" tabindex="0" aria-label="${esc(g.name)} inventory"><table style="min-width:${columns.length*90+76}px"><thead><tr>${columns.map(c=>`<th>${esc(c.label)}</th>`).join('')}<th>Buy</th></tr></thead><tbody>${g.entries.map(i=>`<tr>${columns.map(c=>`<td>${esc(c.key==='link'?i.name+(i.legacyVehicle?' (legacy Item reference)':''):i.fields?.[c.label]??(c.key==='cost'?i.cost:'')??'')}</td>`).join('')}<td><button type="button" data-buy="${esc(i.id)}" aria-label="Buy ${esc(i.name)}" ${i.unavailable||!actors.length?'disabled':''}>Buy</button></td></tr>`).join('')}</tbody></table></div>`;}).join('');
 const trading=`<section data-resource-trading><h3 class="sm-shop-section-heading">Resource Trading</h3>${snapshot.trading.enabled?`<div class="sm-exchange-columns"><div class="sm-exchange-column"><label>Give<select data-give>${opts}</select></label><div class="sm-exchange-quantity"><button type="button" data-decrease aria-label="Decrease Give quantity">−</button><input data-quantity aria-label="Quantity to give" type="number" min="1" max="1000000" step="1" value="1"><button type="button" data-increase aria-label="Increase Give quantity">+</button></div></div><div class="sm-exchange-column"><label>Receive<select data-receive>${opts}</select></label><output data-received aria-label="Quantity to receive" aria-live="polite">—</output></div><div class="sm-exchange-summary"><div data-quote role="status"><div data-offer></div><div data-rate></div></div></div><div class="sm-exchange-action"><button type="button" data-trade>Request Trade</button></div></div>`:'<p>Resource trading is disabled at this Settlement.</p>'}</section><hr class="sm-shop-divider">`;
 return `<style>
 .myz-player-shop{max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);min-width:0}
 .myz-player-shop .window-content{overflow:auto;min-height:0}.myz-player-shop section{overflow-wrap:anywhere}
 .myz-player-shop table{width:100%;table-layout:fixed}.myz-player-shop td{vertical-align:middle;overflow-wrap:anywhere}
 .myz-player-shop th:last-child{width:76px}.myz-player-shop label{display:block;margin:6px 0}
 .myz-player-shop select{width:100%;min-width:0;max-width:100%}.myz-player-shop fieldset{min-width:0}
 .myz-player-shop .sm-exchange-columns{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
 .myz-player-shop .sm-exchange-column{min-width:0}.myz-player-shop .sm-exchange-column label,.myz-player-shop .sm-exchange-column select{text-align:center;overflow-wrap:normal;word-break:normal}.myz-player-shop .sm-exchange-summary{min-width:0;overflow-wrap:normal;word-break:normal;align-self:center}.myz-player-shop .sm-exchange-action{display:flex;align-items:center;justify-content:center;min-width:0}.myz-player-shop [data-trade]{flex:0 1 auto;width:auto}.myz-player-shop .sm-exchange-quantity{display:flex;align-items:center;gap:4px;height:36px;justify-content:center}
 .myz-player-shop .sm-exchange-quantity button{flex:0 0 28px;width:28px;padding:0;height:32px}
 .myz-player-shop .sm-exchange-quantity input{flex:0 0 4ch;width:4ch;min-width:4ch;padding:2px;height:32px;text-align:center}
 .myz-player-shop [data-received]{display:flex;align-items:center;justify-content:center;min-height:36px;font-size:1.5em;font-weight:bold;font-variant-numeric:tabular-nums}
 @media(max-width:400px){.myz-player-shop .sm-exchange-columns{gap:8px}.myz-player-shop .sm-exchange-quantity{gap:2px}.myz-player-shop .sm-exchange-quantity button{flex-basis:24px;width:24px}}

 .myz-player-shop .sm-player-inventory{max-width:100%;overflow-x:auto}.myz-player-shop .sm-player-inventory table{table-layout:auto}.myz-player-shop .sm-player-inventory td{white-space:pre-wrap}
 .myz-player-shop .sm-character-picker{position:relative;margin:8px 0}.myz-player-shop [data-character-toggle],.myz-player-shop [data-character-choice]{display:flex;align-items:center;gap:8px;width:100%;text-align:left;height:auto;min-height:40px}
 .myz-player-shop .sm-character-image[hidden],.myz-player-shop .sm-character-fallback[hidden]{display:none}
 .myz-player-shop .sm-character-image{width:96px;height:120px;object-fit:contain;flex:0 0 96px}.myz-player-shop .sm-character-fallback{display:inline-flex;width:96px;flex:0 0 96px;font-size:2em;justify-content:center}
 .myz-player-shop [data-character-list]{position:absolute;z-index:5;inset-inline:0;max-height:220px;overflow:auto;padding:4px;background:var(--color-cool-5,#252830);color:var(--color-light-1,#fff);border:1px solid currentColor}
 .myz-player-shop [data-character-choice][aria-selected=true],.myz-player-shop [data-character-choice].is-active{outline:2px solid var(--color-warm-2,#d49a3d);outline-offset:-2px}
.myz-player-shop{container-type:inline-size}
 .myz-player-shop .sm-shop-welcome{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:20px;align-items:start}
 .myz-player-shop .sm-character-arrow{margin-inline-start:auto;flex:none}.myz-player-shop .sm-encumbered{color:var(--color-level-error,#d32222);font-weight:bold}
 .myz-player-shop [data-balances]{display:block;font-weight:normal;white-space:pre-line;line-height:1.5}
 .myz-player-shop .sm-player-inventory th{white-space:nowrap;overflow-wrap:normal;word-break:normal;min-width:70px}
 .myz-player-shop .sm-shop-divider{width:100%;border:0;border-top:1px solid var(--color-border-light-primary,#888);margin:16px 0}
 @container(max-width:560px){.myz-player-shop .sm-shop-welcome{grid-template-columns:1fr}.myz-player-shop .sm-exchange-columns{grid-template-columns:repeat(2,minmax(0,1fr))}.myz-player-shop .sm-exchange-summary,.myz-player-shop .sm-exchange-action{grid-column:auto}}
</style><section><h2>${esc(snapshot.name)} - Gear and Services</h2><div class="sm-shop-welcome"><div class="sm-character-picker"><span id="${listId}-label">Character</span><input type="hidden" data-character value="${esc(selected?.uuid||'')}"><button type="button" data-character-toggle role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="${listId}" aria-labelledby="${listId}-label" ${actors.length?'':'disabled'}>${avatar(selected)}<span class="sm-character-arrow" aria-hidden="true">▾</span></button><div data-character-list id="${listId}" role="listbox" aria-label="Roster characters" hidden>${actors.map((actor,i)=>`<button type="button" tabindex="-1" role="option" id="${listId}-${i}" data-character-choice="${esc(actor.uuid)}" aria-selected="${actor.uuid===selected?.uuid}">${avatar(actor)}</button>`).join('')}</div><div data-encumbrance aria-live="polite"></div></div><section data-gear-introduction>${PLAYER_SHOP_INTRO.map(p=>`<p>${esc(p)}</p>`).join('')}</section></div>${!actors.length?'<p role="alert">No eligible Party Roster character is available. Ask the GM to configure the roster and character ownership.</p>':''}${trading}${inventory}<p data-status role="status"></p><button type="button" data-refresh>Refresh Shop</button></section>`;
}
export function bindCharacterPicker(root,env=globalThis){
 const button=root.querySelector('[data-character-toggle]'),list=root.querySelector('[data-character-list]'),input=root.querySelector('[data-character]'),choices=Array.from(list.querySelectorAll('[data-character-choice]'));
 let active=Math.max(0,choices.findIndex(c=>c.dataset.characterChoice===input.value));
 const close=()=>{list.hidden=true;button.setAttribute('aria-expanded','false');button.removeAttribute('aria-activedescendant');};
 const highlight=()=>{choices.forEach((c,i)=>c.classList.toggle('is-active',i===active));if(choices[active]){button.setAttribute('aria-activedescendant',choices[active].id);choices[active].scrollIntoView?.({block:'nearest'});}};
 const open=()=>{if(!choices.length)return;list.hidden=false;button.setAttribute('aria-expanded','true');highlight();};
 const choose=index=>{const option=choices[index];if(!option)return;input.value=option.dataset.characterChoice;const arrow=button.querySelector('.sm-character-arrow');button.replaceChildren(...Array.from(option.childNodes).map(n=>n.cloneNode(true)));if(arrow)button.append(arrow);choices.forEach(c=>c.setAttribute('aria-selected',String(c===option)));active=index;close();button.focus();input.dispatchEvent(new env.Event('change',{bubbles:true}));};
 button.addEventListener('click',()=>list.hidden?open():close());choices.forEach((c,i)=>c.addEventListener('click',()=>choose(i)));
 button.addEventListener('keydown',event=>{
  if(event.key==='Escape'){if(!list.hidden){event.preventDefault();event.stopPropagation();}close();return;}if(event.key==='Tab'){close();return;}
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();if(list.hidden)open();else active=event.key==='Home'?0:event.key==='End'?choices.length-1:(active+(event.key==='ArrowDown'?1:-1)+choices.length)%choices.length;highlight();}
  else if(['Enter',' '].includes(event.key)){event.preventDefault();list.hidden?open():choose(active);}
  else if(event.key.length===1&&!event.ctrlKey&&!event.metaKey){const start=active+1;for(let n=0;n<choices.length;n++){const i=(start+n)%choices.length;if((choices[i].querySelector('[data-character-name]')?.textContent||'').trim().toLowerCase().startsWith(event.key.toLowerCase())){active=i;open();break;}}}
 });
 const outside=event=>{if(!event.target.closest?.('.sm-character-picker'))close();};env.document.addEventListener('pointerdown',outside);
 const imageError=event=>{const img=event.target;if(img.matches?.('.sm-character-image')){img.hidden=true;img.nextElementSibling.hidden=false;}};root.addEventListener('error',imageError,true);
 return ()=>{env.document.removeEventListener('pointerdown',outside);root.removeEventListener('error',imageError,true);};
}
export function createPlayerShopClass(ApplicationV2,service,env=globalThis){
 return class PlayerSettlementShop extends ApplicationV2 {
  static DEFAULT_OPTIONS={window:{title:'Settlement Shop',resizable:true},position:{width:840,height:680},classes:['myz-player-shop']};
  get title(){return `${this.snapshot?.name||'Settlement'} - Gear and Services`;}
  constructor(id){super();this.settlement=id;this.actorUuid=undefined;this.busy=false;this.tradeSelection={give:'bullets',receive:'cleanGrub',quantity:'1'};}
  async refresh(){this.snapshot=await service.request({action:'browse',settlement:this.settlement});this.loadError=false;return this.render(true);}
  async _renderHTML(){const root=env.document.createElement('div');this.actors=eligibleShopCharacters(env);if(!this.actors.some(a=>a.uuid===this.actorUuid))this.actorUuid=preferredShopCharacter(this.actors,env);root.innerHTML=playerShopContent(this.snapshot,this.actors,this.actorUuid);return root;}
  _replaceHTML(result,content){content.replaceChildren(result);}
  async _onClose(options){
   this.unbindCharacterPicker?.();
   if(this.actorHook!==undefined)env.Hooks?.off('updateActor',this.actorHook);this.actorHook=undefined;
   for(const hook of this.inventoryHooks||[])env.Hooks?.off(hook.name,hook.id);this.inventoryHooks=[];
   if(this.rosterHook!==undefined)env.Hooks?.off('updateSetting',this.rosterHook);this.rosterHook=undefined;clearInterval(this.rateTimer);this.rateTimer=undefined;await super._onClose?.(options);
  }
  // Reuse the existing GM-filtered browse API; players never read private Journals.
  async refreshDisplayedRates(){
   if(!this.rendered||this.busy||this.refreshing||service.pending?.size)return;
   this.refreshing=true;this.updateShopControls?.();
   try{
    const snapshot=await service.request({action:'browse',settlement:this.settlement});
    if(!this.rendered)return;
    this.loadError=false;
    if(snapshot.revision!==this.snapshot.revision){this.snapshot=snapshot;await this.render();}
   }catch(error){if(this.rendered){this.loadError=true;const status=this.element.querySelector('[data-status]');if(status)status.textContent=error.message;}}
   finally{this.refreshing=false;this.updateShopControls?.();}
  }
  async _onRender(context,options){
   await super._onRender(context,options);const root=this.element;
   const control=name=>root.querySelector(`[data-${name}]`),status=message=>{control('status').textContent=message;};
   const actor=()=>env.game.actors.get((control('character').value||'').split('.').at(-1));
   const quote=()=>tradeQuote(this.snapshot.trading,control('give').value,control('receive').value,Number(control('quantity').value));
   const update=(adjustMinimum=false)=>{
    const locked=this.busy||this.refreshing||this.uncertain||this.loadError;
    let balances;
    for(const choice of root.querySelectorAll('[data-character-choice], [data-character-toggle]')){
     const id=choice.dataset.characterChoice||control('character').value,chosen=env.game.actors.get(id.split('.').at(-1)),output=choice.querySelector('[data-balances]');
     try{const values=characterResources(chosen,env.game.user,env);output.textContent=Object.entries(RESOURCES).map(([k,v])=>`${v.label}: ${values[k]}`).join('\n');}catch(error){output.textContent=error.message;}
    }
    try{balances=characterResources(actor(),env.game.user,env);}catch{}
    const weight=characterEncumbrance(actor());control('encumbrance').innerHTML=weight?`Weight: ${weight.current} / ${weight.maximum}${weight.encumbered?'<div class="sm-encumbered" role="status"><span aria-hidden="true">⚠</span> Encumbered!</div>':''}`:'Weight: unavailable';
    for(const button of root.querySelectorAll('[data-buy]')){const item=this.snapshot.groups.flatMap(g=>g.entries).find(i=>i.id===button.dataset.buy);button.disabled=Boolean(locked||!balances||!item||item.unavailable);}
    control('refresh').disabled=Boolean(this.busy||this.refreshing);
    if(!control('quantity'))return;
    for(const key of ['give','receive','quantity'])this.tradeSelection[key]=control(key).value;
    const maximum=Math.min(1000000,Math.floor(balances?.[control('give').value]??0));
    let minimum=1;
    try{minimum=tradeRatio(this.snapshot.trading,control('give').value,control('receive').value).minimum;}catch{/* Quote reports a single validation message below. */}
    control('quantity').max=String(maximum);control('quantity').min=String(maximum>=minimum?minimum:0);
    let quantity=Number(control('quantity').value);
    if(Number.isFinite(quantity))quantity=Math.max(0,Math.min(maximum,quantity));
    if(maximum===0)quantity=0;
    else if(adjustMinimum&&quantity<minimum)quantity=Math.min(maximum,minimum);
    if(Number.isFinite(quantity)&&control('quantity').value!=='')control('quantity').value=String(quantity);
    this.tradeSelection.quantity=control('quantity').value;
    control('decrease').disabled=Boolean(this.busy||this.refreshing||!balances||quantity<=minimum);
    control('increase').disabled=Boolean(this.busy||this.refreshing||!balances||quantity>=maximum);
    try{
     if(maximum===0)throw new Error('No available units of the selected Give resource.');
     const q=quote();control('received').textContent=String(q.amount);control('offer').textContent=`Offer ${q.quantity} ${RESOURCES[q.give].label} for ${q.amount} ${RESOURCES[q.receive].label}`;control('rate').textContent=`Rate: ${q.rate}`;control('trade').disabled=Boolean(locked||!balances||balances[q.give]<q.quantity);
    }catch(error){control('received').textContent=maximum===0?'0':'—';control('offer').textContent=control('give').value===control('receive').value?'Choose two different resources':error.message;control('rate').textContent='';control('trade').disabled=true;}

   };
   this.unbindCharacterPicker?.();this.unbindCharacterPicker=bindCharacterPicker(root,env);
   this.updateShopControls=update;
   for(const key of ['give','receive','quantity'])if(control(key))control(key).value=this.tradeSelection[key];
   if(this.actorHook!==undefined)env.Hooks?.off('updateActor',this.actorHook);this.actorHook=env.Hooks?.on('updateActor',()=>update());
   if(this.rosterHook!==undefined)env.Hooks?.off('updateSetting',this.rosterHook);this.rosterHook=env.Hooks?.on('updateSetting',setting=>{if(setting.key==='myz-sector-manager.partyRoster'&&!this.busy)void this.render();});
   for(const hook of this.inventoryHooks||[])env.Hooks?.off(hook.name,hook.id);this.inventoryHooks=['createItem','updateItem','deleteItem'].map(name=>({name,id:env.Hooks?.on(name,()=>update())}));
   control('character').addEventListener('change',()=>{this.actorUuid=control('character').value;update();});
   control('give')?.addEventListener('input',()=>{try{control('quantity').value=String(Math.min(1000000,Math.floor(characterResources(actor(),env.game.user,env)[control('give').value])));}catch{control('quantity').value='0';}update();});control('receive')?.addEventListener('input',()=>update(true));control('quantity')?.addEventListener('input',()=>update());
   for(const [name,step] of [['decrease',-1],['increase',1]])control(name)?.addEventListener('click',()=>{if(control(name).disabled)return;const value=Number(control('quantity').value);control('quantity').value=String(Math.max(Number(control('quantity').min)||1,Math.min(1000000,Math.floor(characterResources(actor(),env.game.user,env)[control('give').value]),(Number.isFinite(value)?Math.trunc(value):1)+step)));update();});
   update(true);
   const run=async action=>{if(this.busy||this.refreshing)return;this.busy=true;update();try{await action();}catch(error){if(/timed out/.test(error.message))this.uncertain=true;status(error.message);}finally{this.busy=false;this.updateShopControls?.();}};
   control('refresh').addEventListener('click',()=>void run(async()=>{await this.refresh();this.uncertain=false;}));
   for(const button of root.querySelectorAll('[data-buy]'))button.addEventListener('click',()=>void run(async()=>{
    const item=this.snapshot.groups.flatMap(g=>g.entries).find(i=>i.id===button.dataset.buy);if(!item||item.unavailable)return;
    const result=await service.request({action:'purchase',settlement:this.settlement,revision:this.snapshot.revision,actor:actor()?.uuid,items:[{id:item.id,quantity:1}]});if(result.chatWarning)status(result.chatWarning);
   }));
   control('trade')?.addEventListener('click',()=>void run(async()=>{
    const q=quote(),chosen=actor(),revision=this.snapshot.revision;characterResources(chosen,env.game.user,env);
    const confirmed=await env.foundry.applications.api.DialogV2.confirm({window:{title:'Confirm Trade Request'},content:`<p>${esc(chosen.name)} wants to trade at ${esc(this.snapshot.name)}: <strong>${q.quantity} ${RESOURCES[q.give].label}</strong> for <strong>${q.amount} ${RESOURCES[q.receive].label}</strong>.</p><p>Rate ${q.rate}.</p>`});if(!confirmed)return;
    if(characterResources(chosen,env.game.user,env)[q.give]<q.quantity)throw new Error('Available resources changed. Review the updated quantity before requesting a trade.');
    const result=await service.request({action:'trade',settlement:this.settlement,revision,actor:chosen.uuid,give:q.give,receive:q.receive,quantity:q.quantity});if(result.chatWarning)status(result.chatWarning);
   }));
   clearInterval(this.rateTimer);this.rateTimer=setInterval(()=>void this.refreshDisplayedRates(),10000);
  }
 };
}
