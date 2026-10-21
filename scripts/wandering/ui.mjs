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
 (root.querySelector('.col.right')||root.querySelector('[data-column="right"]')||root).append(button);
}
export function createWanderingSettings(ApplicationV2,runtime,env=globalThis){
 return class WanderingSettings extends ApplicationV2{
  static DEFAULT_OPTIONS={id:'myz-wandering-settings',window:{title:'Sector Manager — Wandering Tokens',resizable:true},position:{width:460,height:'auto'},classes:['myz-wandering-settings']};
  constructor(...args){super(...args);this.baseline=JSON.stringify(wanderingConfiguration(env));this.draft=wanderingConfiguration(env);}
  async _renderHTML(){if(!env.game.user.isGM)throw new Error('GM access required.');const root=env.document.createElement('div');root.style.cssText='overflow:auto;max-height:70vh;overflow-wrap:anywhere';root.innerHTML=`<p>NPCs move one calibrated Zone sector at a time. Each placed token is stationary until explicitly enabled. Party tokens and player-owned tokens never wander.</p><p><label><input type="checkbox" data-wandering="enabled" ${this.draft.enabled?'checked':''}> Enable Automatic Wandering</label></p><p><label>Maximum Tokens per Check <input type="number" data-wandering="maximum" min="1" max="6" step="1" value="${this.draft.maximum}"></label></p><p><label>Wandering Frequency <select data-wandering="frequency">${[['every','Every Party sector entry'],['quarter','25% chance per Party sector entry'],['manual','Manual only']].map(([value,label])=>`<option value="${value}" ${this.draft.frequency===value?'selected':''}>${label}</option>`).join('')}</select></label></p><p><label><input type="checkbox" data-wandering="allowSpecial" ${this.draft.allowSpecial?'checked':''}> Allow Entry into Special / Settlement Sectors</label></p><p>Uncreated sectors are valid destinations and are never created automatically. Hidden NPCs keep their visibility. No wall or tactical pathfinding checks are performed.</p><button type="button" data-wandering-save>Save Configuration</button><button type="button" data-wandering-cancel>Cancel</button>`;return root;}
  _replaceHTML(result,content){content.replaceChildren(result);}
  async _onRender(context,options){await super._onRender(context,options);this.element.querySelector('[data-wandering-save]').addEventListener('click',async()=>{try{if(!env.game.user.isGM)throw new Error('GM access required.');if(JSON.stringify(wanderingConfiguration(env))!==this.baseline)throw new Error('Wandering settings changed; reopen before saving.');const next={...this.draft};for(const key of ['enabled','allowSpecial'])next[key]=this.element.querySelector(`[data-wandering="${key}"]`).checked;next.maximum=Number(this.element.querySelector('[data-wandering="maximum"]').value);next.frequency=this.element.querySelector('[data-wandering="frequency"]').value;await env.game.settings.set(MODULE,SETTING,validateWandering(next));await this.close();}catch(error){env.ui.notifications.error(error.message);}});this.element.querySelector('[data-wandering-cancel]').addEventListener('click',()=>this.close());}
 };
}
export function registerWandering(runtime,env=globalThis){
 env.game.settings.register(MODULE,SETTING,{scope:'world',config:false,restricted:true,type:Object,default:wanderingDefaults()});
 runtime.WanderingSettings=createWanderingSettings(env.foundry.applications.api.ApplicationV2,runtime,env);
 env.game.settings.registerMenu(MODULE,'wanderingTokens',{name:'Wandering Tokens',label:'Configure Wandering Tokens',hint:'Automatic cardinal NPC movement on the Zone sector grid.',icon:'fa-solid fa-shoe-prints',type:runtime.WanderingSettings,restricted:true});
 env.Hooks.on('renderTokenConfig',(app,html)=>addTokenWandering(app,html,runtime,env));
 env.Hooks.on('renderTokenHUD',(app,html)=>addWanderingHUD(app,html,runtime,env));
}
