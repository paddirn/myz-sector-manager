import {partyResultCard} from './party-skill-results.mjs';
import {partyRoster,escapeHTML as esc} from './travel/model.mjs';
import {imagePath} from './sector-images.mjs';
export const PARTY_MODULE='myz-sector-manager',REQUEST_FLAG='partySkillRequests',RESPONSE_FLAG='partySkillResponses';
const idValid=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(id);
const publishedRequests=gm=>{const value=gm?.getFlag?.(PARTY_MODULE,REQUEST_FLAG);return Array.isArray(value)&&value.length<=50?value:[];};
const actorValid=uuid=>typeof uuid==='string'&&/^Actor\.[A-Za-z0-9_-]+$/.test(uuid);
export const PARTY_SKILLS=Object.freeze([
 ['ENDURE','Endure','OVERLOAD','Overload'],['FORCE','Force','FORCE','Force'],['FIGHT','Fight','ASSAULT','Assault'],['SNEAK','Sneak','INFILTRATE','Infiltrate'],['MOVE','Move','MOVE','Move'],['SHOOT','Shoot','SHOOT','Shoot'],['SCOUT','Scout','SCAN','Scan'],['COMPREHEND','Comprehend','DATAMINE','Datamine'],['KNOWTHEZONE','Know the Zone','ANALYZE','Analyze'],['SENSEEMOTION','Sense Emotion','QUESTION','Question'],['MANIPULATE','Manipulate',null,null],['HEAL','Heal',null,null]
].map(([key,label,robotKey,robotLabel])=>Object.freeze({key,label,robotKey,robotLabel})));
export function resolvePartySkill(actor,key){
 const mapping=PARTY_SKILLS.find(s=>s.key===key);if(!mapping)throw new Error('Unsupported basic skill.');
 if(!['mutant','human','animal','robot'].includes(actor?.type)||actor.documentName!=='Actor')throw new Error('Choose an official MYZ character Actor.');
 const robot=actor.type==='robot',actualKey=robot?mapping.robotKey:mapping.key;
 if(!actualKey)throw new Error(`${mapping.label} has no verified Robot equivalent in this feature.`);
 const skills=Array.from(actor.items?.values?.()||actor.items||[]).filter(i=>i.type==='skill'&&i.system?.skillKey===actualKey);
 if(skills.length!==1)throw new Error(skills.length?`Multiple embedded ${actualKey} skills; repair the Actor before requesting.`:`Missing embedded ${actualKey} skill.`);
 return {item:skills[0],key:actualKey,label:robot?mapping.robotLabel:mapping.label};
}
export function partySkillPool(actor,key,modifier=0){
 if(!Number.isSafeInteger(modifier)||Math.abs(modifier)>100)throw new Error('Modifier must be a whole number from -100 to 100.');
 const resolved=resolvePartySkill(actor,key),data=actor.getRollData?.(),attribute=resolved.item.system.attribute,base=data?.attributeDiceTotals?.[attribute],skill=data?.skillDiceTotals?.[resolved.key];
 const pool={base:base?.baseDiceTotal,skill:typeof skill?.skillDiceTotal==='number'?skill.skillDiceTotal+modifier:NaN,gear:skill?.gearDiceTotal};
 if(!attribute||!Object.values(pool).every(n=>Number.isSafeInteger(n)&&Math.abs(n)<=200)||pool.base<0||pool.gear<0)throw new Error('Unsupported native MYZ attribute/skill/gear totals.');
 return {...pool,attribute,skillKey:resolved.key,skillUuid:resolved.item.uuid,label:resolved.label,modifier,modifiers:{base:structuredClone(base.modifiersToAttributes||[]),skill:structuredClone(skill.modifiersToSkill||[]),gear:structuredClone(skill.modifiersToGear||[])}};
}
export const partyGM=env=>env.game.users.activeGM||Array.from(env.game.users).filter(u=>u.active&&u.isGM).sort((a,b)=>a.id.localeCompare(b.id))[0];
function authority(env){if(env.game.system?.id!=='mutant-year-zero'||!env.game.user.isGM||partyGM(env)?.id!==env.game.user.id)throw new Error('Only the active GM can request or evaluate party rolls.');}
function authorized(actor,user,env){
 if(!actorValid(actor?.uuid)||!['mutant','animal','human','robot'].includes(actor.type)||actor.documentName!=='Actor'||!actor.testUserPermission?.(user,'OWNER')||!partyRoster(env).members.some(m=>m.actorUuid===actor.uuid))throw new Error('The character is not an owned, authorized Party Roster Actor.');
}
export async function partyRecipients(env=globalThis){
 const actors=[];for(const uuid of new Set(partyRoster(env).members.map(m=>m.actorUuid))){try{const actor=await env.fromUuid(uuid);if(actor)actors.push(actor);}catch{/* roster entries remain available for repair */}}
 return Array.from(env.game.users).filter(u=>!u.isGM&&(u.role===undefined||u.role<(env.CONST?.USER_ROLES?.ASSISTANT??3))).map(user=>{
  const eligible=actors.filter(actor=>{try{authorized(actor,user,env);return true;}catch{return false;}}).sort((a,b)=>a.name.localeCompare(b.name));
  const assigned=eligible.find(a=>a.uuid===user.character?.uuid);
  // Only this client's controlled tokens are observable; remote ambiguity is reviewed explicitly by the GM.
  const hint=user.getFlag?.(PARTY_MODULE,'partySkillControl');
  const controlled=user.id===env.game.user.id?[...new Set((env.canvas?.tokens?.controlled||[]).map(t=>t.actor?.uuid))].map(uuid=>eligible.find(a=>a.uuid===uuid)).filter(Boolean):eligible.filter(actor=>actor.uuid===hint?.actorUuid);
  return {user,actors:eligible,preferred:assigned?.uuid||(controlled.length===1?controlled[0].uuid:eligible.length===1?eligible[0].uuid:'')};
 });
}
export async function rollPartySkill(actor,key,modifier,env=globalThis){
 authority(env);const pool=partySkillPool(actor,key,modifier),parser=env.game.myz?.DiceRoller;
 if(typeof parser?.ParseResults!=='function'||typeof parser?.CountSuccesses!=='function')throw new Error('The official MYZ result parser is unavailable.');
 // Evaluate only on the GM; never Item.roll, DiceRoller.Roll/SendToChat, toMessage or dice3d.
 const formula=`${pool.base}db + ${Math.abs(pool.skill)}ds + ${pool.gear}dg`,roll=await new env.Roll(formula).evaluate();authority(env);
 const dice=await parser.ParseResults(roll,pool.skill),successes=parser.CountSuccesses(dice);
 if(!Array.isArray(dice)||!Number.isFinite(successes))throw new Error('Invalid MYZ result.');
 return {pool,formula,dice:structuredClone(dice),successes};
}
export class PartySkillService {
 constructor(env=globalThis){this.env=env;this.requests=new Map();this.listeners=new Set();this.dialogs=new Map();this.answered=new Set();this.responses=Promise.resolve();this.publication=Promise.resolve();}
 isGM(){return this.env.game.user.isGM&&partyGM(this.env)?.id===this.env.game.user.id;}
 changed(){for(const fn of this.listeners)try{fn();}catch(error){this.env.console?.error('Party skill summary update failed',error);}}
 subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
 async publish(){
  const task=this.publication.catch(()=>{}).then(async()=>{authority(this.env);const now=Date.now();const publicRequests=Array.from(this.requests.values()).filter(r=>r.expires>now).map(r=>({id:r.id,gmId:r.gmId,key:r.key,modifier:r.modifier,expires:r.expires,targets:r.targets.map(t=>({userId:t.userId,actorUuid:t.actorUuid,token:t.token,state:t.state}))}));await this.env.game.user.setFlag(PARTY_MODULE,REQUEST_FLAG,publicRequests);});this.publication=task;return task;
 }
 async create(key,modifier,selections){
  authority(this.env);if(!PARTY_SKILLS.some(s=>s.key===key)||!Number.isSafeInteger(modifier)||Math.abs(modifier)>100)throw new Error('Choose a supported basic skill and integer modifier (-100 to 100).');
  if(!Array.isArray(selections)||selections.length>100||Array.from(this.requests.values()).filter(r=>r.expires>Date.now()).length>=50)throw new Error('Too many outstanding requests. Reload the GM to clear old sessions.');
  for(const [id,old] of this.requests)if(old.expires<=Date.now())this.requests.delete(id);
  const recipients=await partyRecipients(this.env),targets=[],seen=new Set();
  for(const selection of selections){if(seen.has(selection.userId))throw new Error('Only one character per player may be targeted.');seen.add(selection.userId);const row=recipients.find(r=>r.user.id===selection.userId),actor=row?.actors.find(a=>a.uuid===selection.actorUuid);if(!row?.user.active||!actor)throw new Error('Recipient changed, disconnected or unauthorized. Review the list again.');const actual=resolvePartySkill(actor,key);partySkillPool(actor,key,modifier);targets.push({userId:row.user.id,actorUuid:actor.uuid,name:actor.name,portrait:imagePath(actor.img),robot:actor.type==='robot',skill:actual.label,token:this.env.crypto.randomUUID(),state:'pending',result:null,error:null});}
  if(!targets.length)throw new Error('Select at least one supported connected recipient.');authority(this.env);
  const request={id:this.env.crypto.randomUUID(),gmId:this.env.game.user.id,key,modifier,expires:Date.now()+30*60*1000,targets};this.requests.set(request.id,request);
  try{await this.publish();}catch(error){this.requests.delete(request.id);throw error;}this.changed();return request;
 }
 complete(requestId,actorUuid,token,result){
  authority(this.env);const request=this.requests.get(requestId),target=request?.targets.find(t=>t.actorUuid===actorUuid&&t.token===token);
  if(!target||request.expires<=Date.now()||target.state!=='rolling')return false;
  if(!result||!Number.isFinite(result.successes)||!Array.isArray(result.dice))throw new Error('Cannot complete an unrecorded roll.');
  target.result={...result,requestId,actorUuid};target.state='completed';this.changed();return true;
 }
 async receive(user,response){
  authority(this.env);if(!Array.from(this.env.game.users).some(u=>u===user)||!user.active||user.isGM||!idValid(response?.requestId)||!idValid(response?.token)||!['roll','cancel'].includes(response?.choice)||!actorValid(response?.actorUuid))return;
  const request=this.requests.get(response.requestId),target=request?.targets.find(t=>t.userId===user.id&&t.token===response.token&&t.actorUuid===response.actorUuid);
  if(!request||request.expires<=Date.now()||!target||target.state!=='pending')return;
  target.state=response.choice==='cancel'?'canceled':'rolling';this.changed();
  // Persist a neutral consumed state before evaluation so reconnect/replayed flags cannot resubmit.
  try{await this.publish();if(response.choice==='cancel')return;authority(this.env);const actor=await this.env.fromUuid(target.actorUuid);authorized(actor,user,this.env);const result=await rollPartySkill(actor,request.key,request.modifier,this.env);authority(this.env);
   const recipients=Array.from(this.env.game.users).filter(u=>u.isGM).map(u=>u.id);if(!recipients.length)throw new Error('No GM recipients.');
   // No rolls array or native MYZ dice flags: dice visualizers have no result payload to broadcast.
   target.name=actor.name;target.portrait=imagePath(actor.img);target.robot=actor.type==='robot';target.skill=result.pool.label;target.result=result;const message=await this.env.ChatMessage.create({user:this.env.game.user.id,whisper:recipients,blind:true,content:partyResultCard({name:target.name,portrait:actor.img,robot:actor.type==='robot',result})});
   if(!message?.uuid)throw new Error('GM-only result chat was not recorded.');
   if(!this.complete(request.id,target.actorUuid,target.token,{...result,messageUuid:message.uuid}))throw new Error('Authoritative request changed before completion was recorded.');
  }catch(error){target.state='failed';target.error=error.message;}
  finally{this.changed();await this.publish().catch(error=>this.env.console?.error('Party skill status publication failed',error));}
 }
 start(){
  const {env}=this;
  env.Hooks.on('updateUser',(user,changes)=>{
   if(changes.flags?.[PARTY_MODULE]?.[RESPONSE_FLAG]&&this.isGM()){
    const responses=user.getFlag(PARTY_MODULE,RESPONSE_FLAG);if(Array.isArray(responses)&&responses.length<=100)for(const response of responses){const task=this.receive(user,response);void task.catch(error=>env.console?.error('Party skill request rejected',error));}
   }
   if(changes.flags?.[PARTY_MODULE]?.[REQUEST_FLAG])void this.syncPlayer();this.changed();
  });
  env.Hooks.on('canvasReady',()=>{void this.publishPresence();});
  env.Hooks.on('controlToken',()=>{void this.publishPresence();});
  env.Hooks.on('userConnected',()=>{this.changed();void this.syncPlayer();});
  if(this.isGM()&&typeof env.game.user.setFlag==='function')this.publication=env.game.user.setFlag(PARTY_MODULE,REQUEST_FLAG,[]).catch(error=>env.console?.error('Party skill startup',error));
  else{void this.publishPresence();void this.syncPlayer();}
  this.timer=setInterval(()=>{void this.tick().catch(error=>env.console?.error('Party skill expiry',error));},15000);this.timer.unref?.();
 }
 async tick(){
  if(this.isGM()){let changed=false;for(const request of this.requests.values())if(request.expires<=Date.now())for(const target of request.targets)if(['pending','rolling'].includes(target.state)){target.state='failed';target.error='Request expired before completion.';changed=true;}if(changed){this.changed();await this.publish();}}else await this.syncPlayer();
 }
 stop(){clearInterval(this.timer);this.timer=undefined;}
 async publishPresence(){
  const {env}=this;if(env.game.user.isGM||typeof env.game.user.setFlag!=='function')return;
  const actors=[...new Set((env.canvas?.tokens?.controlled||[]).map(t=>t.actor))].filter(actor=>{try{authorized(actor,env.game.user,env);return true;}catch{return false;}}),actorUuid=actors.length===1?actors[0].uuid:'';
  const task=(this.presence||Promise.resolve()).catch(()=>{}).then(()=>env.game.user.setFlag(PARTY_MODULE,'partySkillControl',{actorUuid}));this.presence=task;await task.catch(error=>env.console?.error('Party skill character hint',error));
 }
 async sendResponse(request,target,choice){
  const {env}=this;if(env.game.user.isGM||target.userId!==env.game.user.id)throw new Error('This roll request belongs to another player.');
  const task=this.responses.catch(()=>{}).then(async()=>{const gm=partyGM(env),current=publishedRequests(gm).find(r=>r?.id===request.id&&r.gmId===request.gmId),pending=current?.targets?.find(t=>t?.token===target.token&&t.userId===env.game.user.id&&t.actorUuid===target.actorUuid);if(!gm?.active||gm.id!==request.gmId||!current||current.expires<=Date.now()||pending?.state!=='pending')throw new Error('The roll request expired or is no longer pending.');
   const previous=env.game.user.getFlag(PARTY_MODULE,RESPONSE_FLAG)||[];const responses=Array.isArray(previous)?previous.filter(r=>r.requestId!==request.id).slice(-99):[];responses.push({requestId:request.id,token:target.token,actorUuid:target.actorUuid,choice});await env.game.user.setFlag(PARTY_MODULE,RESPONSE_FLAG,responses);this.answered.add(`${request.id}:${target.token}`);});this.responses=task;return task;
 }
 async syncPlayer(){
  const {env}=this;if(env.game.user.isGM)return;const gm=partyGM(env);let requests=gm?.isGM&&gm.active?publishedRequests(gm):[];
  if(!Array.isArray(requests)||requests.length>50)requests=[];
  const current=new Set();
  for(const request of requests){if(!request||typeof request!=='object'||!idValid(request.id)||request.gmId!==gm.id||!PARTY_SKILLS.some(s=>s.key===request.key)||!Number.isSafeInteger(request.modifier)||Math.abs(request.modifier)>100||!Number.isFinite(request.expires)||request.expires<Date.now()||!Array.isArray(request.targets)||request.targets.length>100)continue;
   const target=request.targets.find(t=>t?.userId===env.game.user.id);if(!target||!idValid(target.token)||!actorValid(target.actorUuid)||target.state!=='pending')continue;
   const previous=env.game.user.getFlag(PARTY_MODULE,RESPONSE_FLAG);if(this.answered.has(`${request.id}:${target.token}`)||Array.isArray(previous)&&previous.some(r=>r?.requestId===request.id&&r.token===target.token&&r.actorUuid===target.actorUuid&&['roll','cancel'].includes(r.choice)))continue;
   current.add(request.id);if(this.dialogs.has(request.id)){const existing=this.dialogs.get(request.id);if(existing===null||existing.element?.isConnected)continue;this.dialogs.delete(request.id);}
   // Reserve before async document resolution so duplicate update events cannot open duplicates.
   this.dialogs.set(request.id,null);void this.openPlayer(request,target).catch(error=>{this.dialogs.delete(request.id);env.ui?.notifications?.warn(`Party skill request: ${error.message}`);});
  }
  for(const [id,dialog] of this.dialogs)if(!current.has(id)&&dialog){dialog.partyRetired=true;dialog.close();this.dialogs.delete(id);}
 }
 async openPlayer(request,target){
  const {env}=this,actor=await env.fromUuid(target.actorUuid);authorized(actor,env.game.user,env);const skill=resolvePartySkill(actor,request.key),portrait=imagePath(actor.img);const currentGM=partyGM(env),latest=publishedRequests(currentGM).find(r=>r?.id===request.id)?.targets?.find(t=>t?.token===target.token);if(currentGM?.id!==request.gmId||!currentGM?.active||!latest||latest.state!=='pending'||request.expires<=Date.now()){this.dialogs.delete(request.id);return;}let sent=false;
  const dialog=new env.foundry.applications.api.DialogV2({window:{title:'GM Requests a Blind Skill Roll'},position:{width:400},content:`<div data-party-player-request="${esc(request.id)}">${portrait?`<img src="${esc(portrait)}" alt="" style="width:80px;height:80px;object-fit:contain">`:''}<h3>${esc(actor.name)}</h3><p>Skill: ${esc(skill.label)}</p><p>Modifier: ${request.modifier}</p><p data-party-confirmation role="status"></p></div>`,buttons:[{action:'roll',label:`Roll ${skill.label}`,callback:async()=>{if(sent)return;sent=true;try{await this.sendResponse(request,target,'roll');env.ui?.notifications?.info('Roll submitted');}catch(error){sent=false;throw error;}}},{action:'cancel',label:'Cancel',callback:async()=>{if(!sent){sent=true;await this.sendResponse(request,target,'cancel');}}}]});
  dialog.addEventListener('close',()=>{if(!sent&&!dialog.partyRetired){sent=true;void this.sendResponse(request,target,'cancel').catch(error=>env.ui?.notifications?.error(error.message));}});
  this.dialogs.set(request.id,dialog);dialog.render({force:true});
 }
}
