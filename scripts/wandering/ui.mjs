import {styleMarker,markerMetadata} from './markers.mjs';
import {MODULE,SETTING,FLAG,wanderingDefaults,wanderingConfiguration,validateWandering,canModify,playerControlled} from './model.mjs';
export function addTokenWandering(app,html,runtime,env=globalThis){
 const root=html?.nodeType?html:html?.[0],token=app.document||app.token||app.object;
 if(!env.game.user.isGM||!root?.querySelector||root.querySelector('[data-wandering-token]')||!canModify(token,env)||token.parent?.documentName==='Actor')return;
 const identity=root.querySelector('section[data-tab="identity"], .tab[data-tab="identity"], [data-application-part="identity"]');if(!identity)return;
 const section=env.document.createElement('fieldset');section.dataset.wanderingToken='';section.innerHTML=`<legend>Sector Manager</legend><label><input type="checkbox" name="flags.${MODULE}.${FLAG}" data-dtype="Boolean"> Allow Random Wandering</label><p class="hint">Allow this token to be selected for automatic movement between Zone sectors.</p>`;
 const input=section.querySelector('input');input.checked=token.getFlag(MODULE,FLAG)===true;
 if(playerControlled(token,env)&&!input.checked){input.disabled=true;section.querySelector('.hint').textContent+=' Player-controlled tokens cannot wander.';}
 identity.append(section);
}
export function addWanderingHUD(app,html,runtime,env=globalThis){
 const root=html?.nodeType?html:html?.[0],token=app.document||app.object?.document||app.object;
 if(!env.game.user.isGM||!root?.querySelector||root.querySelector('[data-wandering-hud]')||!canModify(token,env))return;
 const button=env.document.createElement('button');button.type='button';button.className='control-icon';button.dataset.wanderingHud='';button.title='Toggle Random Wandering';button.setAttribute('aria-label','Toggle Random Wandering');
 const refresh=()=>{const enabled=token.getFlag(MODULE,FLAG)===true;button.classList.toggle('active',enabled);button.setAttribute('aria-pressed',String(enabled));button.innerHTML=`<i class="fa-solid ${enabled?'fa-shoe-prints':'fa-lock'}" aria-hidden="true"></i>`;};refresh();
 button.addEventListener('click',async event=>{event.preventDefault();event.stopPropagation();button.disabled=true;try{if(!canModify(token,env))throw new Error('Token update permission required.');const enabled=token.getFlag(MODULE,FLAG)!==true;if(enabled&&playerControlled(token,env))throw new Error('Player-controlled tokens cannot wander.');await token.setFlag(MODULE,FLAG,enabled);refresh();}catch(error){env.ui.notifications.warn(error.message);}finally{button.disabled=false;}});
 const column=root.querySelector('.col.right')||root.querySelector('[data-column="right"]')||root;column.append(button);
 for(const [action,label,icon] of [['clear','Clear Last Known Position','fa-eraser'],['reset','Reset Last Known Position','fa-location-crosshairs']]){
  const control=env.document.createElement('button');control.type='button';control.className='control-icon';control.dataset.wanderingMarker=action;control.title=label;control.setAttribute('aria-label',label);control.innerHTML=`<i class="fa-solid ${icon}" aria-hidden="true"></i>`;
  control.addEventListener('click',async event=>{event.preventDefault();event.stopPropagation();try{
   if(!canModify(token,env))throw new Error('Token update permission required.');
   if(action==='reset'&&!await env.foundry.applications.api.DialogV2.confirm({window:{title:label},content:'Clear the old marker and authorize a new player-visible marker at this token’s position on its next wandering move, even if the token is hidden? This does not reveal or move the token now.'}))return;
   if(env.canvas?.scene?.id!==token.parent.id)throw new Error('Scene changed; reopen the token HUD before managing markers.');
   await runtime.wandering.enqueue(()=>{if(env.canvas?.scene?.id!==token.parent.id)throw new Error('Scene changed before marker management.');return runtime.wandering.markers.clear(token,{reset:action==='reset'});});
  }catch(error){env.ui.notifications.warn(error.message);}});column.append(control);
 }
}
export function createWanderingSettings(ApplicationV2,runtime,env=globalThis){
 return class WanderingSettings extends ApplicationV2{
  static DEFAULT_OPTIONS={id:'myz-wandering-settings',window:{title:'Sector Manager — Wandering Tokens',resizable:true},position:{width:460,height:'auto'},classes:['myz-wandering-settings']};
  constructor(...args){super(...args);this.baseline=JSON.stringify(wanderingConfiguration(env));this.draft=wanderingConfiguration(env);}
  async _renderHTML(){if(!env.game.user.isGM)throw new Error('GM access required.');const root=env.document.createElement('div');root.style.cssText='overflow:auto;max-height:70vh;overflow-wrap:anywhere';root.innerHTML=`<p>NPCs move one calibrated Zone sector at a time. Each placed token is stationary until explicitly enabled. Party tokens and player-owned tokens never wander.</p><p><label><input type="checkbox" data-wandering="enabled" ${this.draft.enabled?'checked':''}> Enable Automatic Wandering</label></p><p><label>Maximum Tokens per Check <input type="number" data-wandering="maximum" min="1" max="6" step="1" value="${this.draft.maximum}"></label></p><p><label>Wandering Frequency <select data-wandering="frequency">${[['every','Every Party sector entry'],['quarter','25% chance per Party sector entry'],['manual','Manual only']].map(([value,label])=>`<option value="${value}" ${this.draft.frequency===value?'selected':''}>${label}</option>`).join('')}</select></label></p><p><label><input type="checkbox" data-wandering="allowSpecial" ${this.draft.allowSpecial?'checked':''}> Allow Entry into Special Sectors</label></p><fieldset><legend>Last Known Position Markers</legend>${[['markers','Enable Last Known Position Markers'],['grayscale','Use Grayscale Markers'],['autoHide','Automatically Hide Wandering Tokens']].map(([key,label])=>`<p><label><input type="checkbox" data-wandering="${key}" ${this.draft[key]?'checked':''}> ${label}</label></p>`).join('')}<p>Visible NPCs leave one persistent Tile before moving. Previously hidden NPCs leave no marker. With automatic hiding off, the real token remains visible. Clear and reset controls never reveal tokens.</p></fieldset><p>Uncreated sectors are valid destinations and are never created automatically. Markers disabled: token visibility is unchanged. No wall or tactical pathfinding checks are performed.</p><button type="button" data-wandering-save>Save Configuration</button><button type="button" data-wandering-cancel>Cancel</button>`;return root;}
  _replaceHTML(result,content){content.replaceChildren(result);}
  async _onRender(context,options){await super._onRender(context,options);this.element.querySelector('[data-wandering-save]').addEventListener('click',async()=>{try{if(!env.game.user.isGM)throw new Error('GM access required.');if(JSON.stringify(wanderingConfiguration(env))!==this.baseline)throw new Error('Wandering settings changed; reopen before saving.');const next={...this.draft};for(const key of ['enabled','allowSpecial','markers','grayscale','autoHide'])next[key]=this.element.querySelector(`[data-wandering="${key}"]`).checked;next.maximum=Number(this.element.querySelector('[data-wandering="maximum"]').value);next.frequency=this.element.querySelector('[data-wandering="frequency"]').value;await env.game.settings.set(MODULE,SETTING,validateWandering(next));await this.close();}catch(error){env.ui.notifications.error(error.message);}});this.element.querySelector('[data-wandering-cancel]').addEventListener('click',()=>this.close());}
 };
}
export function registerWandering(runtime,env=globalThis){
 env.game.settings.register(MODULE,SETTING,{scope:'world',config:false,restricted:true,type:Object,default:wanderingDefaults()});
 runtime.WanderingSettings=createWanderingSettings(env.foundry.applications.api.ApplicationV2,runtime,env);
 env.game.settings.registerMenu(MODULE,'wanderingTokens',{name:'Wandering Tokens',label:'Configure Wandering Tokens',hint:'Automatic cardinal NPC movement on the Zone sector grid.',icon:'fa-solid fa-shoe-prints',type:runtime.WanderingSettings,restricted:true});
 const lifecycle=task=>{if(runtime.store.authoritative)void runtime.wandering.enqueue(task).catch(error=>env.console?.error('MYZ Last Known Position lifecycle',error));};
 env.Hooks.on('drawTile',tile=>styleMarker(tile,env));
 env.Hooks.on('updateTile',tile=>{if(tile.object)styleMarker(tile.object,env);});
 env.Hooks.on('refreshTile',tile=>styleMarker(tile,env));
 env.Hooks.on('createTile',tile=>{const flag=markerMetadata(tile),token=tile.parent?.tokens?.get(flag?.sourceTokenId);if(flag&&token)lifecycle(()=>runtime.wandering.markers.reconcile(token));});
 env.Hooks.on('stopToken',token=>{if(token.getFlag?.(MODULE,'lastKnownPosition'))lifecycle(()=>runtime.wandering.markers.reconcile(token));});
 env.Hooks.on('deleteToken',token=>lifecycle(()=>runtime.wandering.markers.deletedToken(token)));
 env.Hooks.on('deleteTile',tile=>lifecycle(()=>runtime.wandering.markers.deletedTile(tile)));
 env.Hooks.on('createToken',token=>lifecycle(()=>runtime.wandering.markers.reconcile(token)));
 env.Hooks.on('canvasReady',canvas=>lifecycle(async()=>{const scene=canvas?.scene||env.canvas?.scene;await runtime.wandering.markers.sceneReady(scene);await runtime.wandering.alignment.clearOrphans(scene);}));
 env.Hooks.on('updateUser',()=>lifecycle(()=>runtime.wandering.markers.sceneReady(env.canvas?.scene)));
 env.Hooks.on('renderTokenConfig' ,(app,html)=>addTokenWandering(app,html,runtime,env));
 env.Hooks.on('renderTokenHUD',(app,html)=>addWanderingHUD(app,html,runtime,env));
}

export async function clearMarkerSelection(runtime,{all=false}={},env=globalThis){
 if(!runtime.store.isGM)throw new Error('GM access required.');const scene=env.canvas?.scene;if(!scene)throw new Error('View a Scene first.');const selected=(env.canvas.tokens?.controlled||[]).map(object=>object.document);
 if(all&&!await env.foundry.applications.api.DialogV2.confirm({window:{title:'Clear All Last Known Positions'},content:'Delete only MYZ Sector Manager Last Known Position Tiles on the currently viewed Scene? Token positions and visibility will be preserved.'}))return;
 return runtime.wandering.enqueue(async()=>{if(env.canvas?.scene?.id!==scene.id)throw new Error('Scene changed; repeat marker management on the intended Scene.');if(all)return runtime.wandering.markers.clearScene(scene);for(const token of selected)if(token.parent.id===scene.id&&canModify(token,env))await runtime.wandering.markers.clear(token);});
}
