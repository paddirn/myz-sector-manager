import {characterResources,RESOURCES,tradeQuote} from './settlement-trading.mjs';
import {escapeHTML as esc} from './travel/model.mjs';
export function eligibleShopCharacters(env=globalThis){return Array.from(env.game.actors).filter(actor=>{try{characterResources(actor,env.game.user,env);return true;}catch{return false;}}).sort((a,b)=>a.name.localeCompare(b.name));}
export function playerShopContent(snapshot,actors,actorUuid){
 const opts=Object.entries(RESOURCES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('');
 return `<style>
 .myz-player-shop{max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);min-width:0}
 .myz-player-shop .window-content{overflow:auto;min-height:0}.myz-player-shop section{overflow-wrap:anywhere}
 .myz-player-shop table{width:100%;table-layout:fixed}.myz-player-shop td{vertical-align:middle;overflow-wrap:anywhere}
 .myz-player-shop th:last-child{width:76px}.myz-player-shop label{display:block;margin:6px 0}
 .myz-player-shop select{width:100%;min-width:0;max-width:100%}.myz-player-shop fieldset{min-width:0}
 .myz-player-shop .sm-exchange-columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}
 .myz-player-shop .sm-exchange-column{min-width:0}.myz-player-shop .sm-exchange-quantity{display:flex;align-items:center;gap:4px;height:36px}
 .myz-player-shop .sm-exchange-quantity button{flex:0 0 28px;width:28px;padding:0;height:32px}
 .myz-player-shop .sm-exchange-quantity input{width:100%;min-width:0;height:32px;text-align:center}
 .myz-player-shop [data-received]{display:flex;align-items:center;min-height:36px;font-size:1.5em;font-weight:bold;font-variant-numeric:tabular-nums}
 @media(max-width:400px){.myz-player-shop .sm-exchange-columns{gap:8px}.myz-player-shop .sm-exchange-quantity{gap:2px}.myz-player-shop .sm-exchange-quantity button{flex-basis:24px;width:24px}}
 </style><section><h2>${esc(snapshot.name)} — Shop</h2><p>Purchase requests are informational. No stock is tracked, and Items and resources are not transferred by purchases.</p>
 <label>Character<select data-character>${actors.map(a=>`<option value="${esc(a.uuid)}" ${a.uuid===actorUuid?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label><p data-balances></p>
 ${!actors.length?'<p role="alert">No owned MYZ character with valid resources is available.</p>':''}
 ${snapshot.groups.map(g=>`<h3>${esc(g.name)}</h3><table><thead><tr><th>Item</th><th>Price</th><th>Buy</th></tr></thead><tbody>${g.entries.map(i=>`<tr><td>${esc(i.name)}</td><td>${esc(i.cost??'—')}</td><td><button type="button" data-buy="${esc(i.id)}" aria-label="Buy ${esc(i.name)}" ${i.unavailable||!actors.length?'disabled':''}>Buy</button></td></tr>`).join('')}</tbody></table>`).join('')}
 <fieldset><legend>Resource Trading</legend>${snapshot.trading.enabled?`<div class="sm-exchange-columns"><div class="sm-exchange-column"><label>Give<select data-give>${opts}</select></label><div class="sm-exchange-quantity"><button type="button" data-decrease aria-label="Decrease Give quantity">−</button><input data-quantity aria-label="Quantity to give" type="number" min="1" max="1000000" step="1" value="1"><button type="button" data-increase aria-label="Increase Give quantity">+</button></div></div><div class="sm-exchange-column"><label>Receive<select data-receive>${opts}</select></label><output data-received aria-label="Quantity to receive" aria-live="polite">—</output></div></div><p data-quote role="status"></p><button type="button" data-trade>Review and Confirm Trade</button>`:'<p>Resource trading is disabled at this Settlement.</p>'}</fieldset>
 <p data-status role="status"></p><button type="button" data-refresh>Refresh Shop</button></section>`;
}
export function createPlayerShopClass(ApplicationV2,service,env=globalThis){
 return class PlayerSettlementShop extends ApplicationV2 {
  static DEFAULT_OPTIONS={window:{title:'Settlement Shop',resizable:true},position:{width:680,height:680},classes:['myz-player-shop']};
  constructor(id){super();this.settlement=id;this.actorUuid=env.game.user.character?.uuid;this.busy=false;this.tradeSelection={give:'bullets',receive:'cleanGrub',quantity:'1'};}
  async refresh(){this.snapshot=await service.request({action:'browse',settlement:this.settlement});this.loadError=false;return this.render(true);}
  async _renderHTML(){const root=env.document.createElement('div');this.actors=eligibleShopCharacters(env);if(!this.actors.some(a=>a.uuid===this.actorUuid))this.actorUuid=this.actors[0]?.uuid;root.innerHTML=playerShopContent(this.snapshot,this.actors,this.actorUuid);return root;}
  _replaceHTML(result,content){content.replaceChildren(result);}
  async _onClose(options){
   if(this.actorHook!==undefined)env.Hooks?.off('updateActor',this.actorHook);this.actorHook=undefined;
   clearInterval(this.rateTimer);this.rateTimer=undefined;await super._onClose?.(options);
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
   const update=()=>{
    const locked=this.busy||this.refreshing||this.uncertain||this.loadError;
    let balances;
    try{balances=characterResources(actor(),env.game.user,env);control('balances').textContent=Object.entries(RESOURCES).map(([k,v])=>`${v.label}: ${balances[k]}`).join(' · ');}
    catch(error){control('balances').textContent=error.message;}
    for(const button of root.querySelectorAll('[data-buy]')){const item=this.snapshot.groups.flatMap(g=>g.entries).find(i=>i.id===button.dataset.buy);button.disabled=Boolean(locked||!balances||!item||item.unavailable);}
    control('refresh').disabled=Boolean(this.busy||this.refreshing);
    if(!control('quantity'))return;
    for(const key of ['give','receive','quantity'])this.tradeSelection[key]=control(key).value;
    const quantity=Number(control('quantity').value);
    control('decrease').disabled=Boolean(this.busy||this.refreshing||quantity<=1);
    control('increase').disabled=Boolean(this.busy||this.refreshing||quantity>=1000000);
    try{const q=quote();control('received').textContent=String(q.amount);control('quote').textContent=`Deduct ${q.quantity} ${RESOURCES[q.give].label}; add ${q.amount} ${RESOURCES[q.receive].label}. Rate: ${q.rate}.`;control('trade').disabled=Boolean(locked||!balances||balances[q.give]<q.quantity);}
    catch(error){control('received').textContent='—';control('quote').textContent=error.message;control('trade').disabled=true;}
   };
   this.updateShopControls=update;
   for(const key of ['give','receive','quantity'])if(control(key))control(key).value=this.tradeSelection[key];
   if(this.actorHook!==undefined)env.Hooks?.off('updateActor',this.actorHook);this.actorHook=env.Hooks?.on('updateActor',doc=>{if(doc.uuid===actor()?.uuid)update();});
   control('character').addEventListener('change',()=>{this.actorUuid=control('character').value;update();});
   for(const key of ['give','receive','quantity'])control(key)?.addEventListener('input',update);
   for(const [name,step] of [['decrease',-1],['increase',1]])control(name)?.addEventListener('click',()=>{const value=Number(control('quantity').value);control('quantity').value=String(Math.max(1,Math.min(1000000,(Number.isFinite(value)?value:1)+step)));update();});
   update();
   const run=async action=>{if(this.busy||this.refreshing)return;this.busy=true;update();try{await action();}catch(error){if(/timed out/.test(error.message))this.uncertain=true;status(error.message);}finally{this.busy=false;this.updateShopControls?.();}};
   control('refresh').addEventListener('click',()=>void run(async()=>{await this.refresh();this.uncertain=false;}));
   for(const button of root.querySelectorAll('[data-buy]'))button.addEventListener('click',()=>void run(async()=>{
    const item=this.snapshot.groups.flatMap(g=>g.entries).find(i=>i.id===button.dataset.buy);if(!item||item.unavailable)return;
    const result=await service.request({action:'purchase',settlement:this.settlement,revision:this.snapshot.revision,actor:actor()?.uuid,items:[{id:item.id,quantity:1}]});status(result.chatWarning||result.message);
   }));
   control('trade')?.addEventListener('click',()=>void run(async()=>{
    const q=quote(),chosen=actor(),expected=characterResources(chosen,env.game.user,env),revision=this.snapshot.revision;
    const confirmed=await env.foundry.applications.api.DialogV2.confirm({window:{title:'Confirm Resource Trade'},content:`<p>${esc(chosen.name)}: deduct <strong>${q.quantity} ${RESOURCES[q.give].label}</strong> and add <strong>${q.amount} ${RESOURCES[q.receive].label}</strong>.</p><p>Rate ${q.rate}.</p>`});if(!confirmed)return;
    const result=await service.request({action:'trade',settlement:this.settlement,revision,actor:chosen.uuid,expected,give:q.give,receive:q.receive,quantity:q.quantity});status(result.chatWarning||result.message);
   }));
   clearInterval(this.rateTimer);this.rateTimer=setInterval(()=>void this.refreshDisplayedRates(),10000);
  }
 };
}
