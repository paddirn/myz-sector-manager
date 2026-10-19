import {MODULE,travelConfiguration} from './model.mjs';
const snapshot=token=>{const data=token.toObject?token.toObject():token;return {x:data.x,y:data.y,width:data.width,height:data.height};};
// No private sector/roster data is exposed. Only the originating token owner can
// retain raw completed moves while no active GM exists; the GM validates later.
export class MovementRecovery {
 constructor(env=globalThis,{suppressed=()=>false}={}){this.env=env;this.suppressed=suppressed;this.positions=new Map();this.pending=new Map();this.hooks=[];this.queue=Promise.resolve();}
 key(token){return token.uuid||`${token.parent?.id}.${token.id}`;}
 prime(){this.positions.clear();this.pending.clear();for(const scene of this.env.game.scenes.values())for(const token of scene.tokens.values())this.positions.set(this.key(token),snapshot(token));}
 start(){if(this.hooks.length)return;this.prime();const on=(name,fn)=>this.hooks.push([name,this.env.Hooks.on(name,fn)]);
  on('updateToken',(token,changes,options,userId)=>{if(['x','y'].some(key=>key in changes))this.updated(token,userId);});
  on('moveToken',(token,movement,options,user)=>this.updated(token,user?.id));
  on('stopToken',token=>{const source=this.pending.get(this.key(token));if(source)this.completed(token,source);});
  on('canvasReady',()=>this.prime());
 }
 stop(){for(const [name,id] of this.hooks)this.env.Hooks.off(name,id);this.hooks=[];this.positions.clear();this.pending.clear();}
 updated(token,userId){const key=this.key(token);if(['pending','paused'].includes(token.movement?.state)){if(userId)this.pending.set(key,userId);return;}this.completed(token,userId||this.pending.get(key));}
 completed(token,userId){
  const key=this.key(token),from=this.positions.get(key),to=snapshot(token);this.positions.set(key,to);this.pending.delete(key);
  if(!from||from.x===to.x&&from.y===to.y||this.env.game.users.activeGM||userId!==this.env.game.user.id||!token.isOwner||this.suppressed(token))return;
  try{const config=travelConfiguration(this.env);if(!config.enabled||!config.normalEntry)return;}catch{return;}
  const entry={id:this.env.foundry.utils.randomID(),timestamp:Date.now(),from,to};
  const write=this.queue.then(async()=>{const state=structuredClone(token.getFlag(MODULE,'pendingTravelEntries')||{version:1,entries:[],overflow:0});if(state.entries.length>=50)state.overflow=(state.overflow||0)+1;else state.entries.push(entry);await token.setFlag(MODULE,'pendingTravelEntries',state);});
  this.queue=write.catch(error=>this.env.console?.warn('MYZ pending travel move could not be retained; native Token permissions were respected.',error));
 }
}
