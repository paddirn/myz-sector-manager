import {MODULE} from '../zone/store.mjs';
import {coordinateToBounds,positionToCoordinate,tokenCenter,sceneCellSize} from '../zone/grid.mjs';
import {canModify,playerControlled} from '../wandering/model.mjs';
import {PATROL_FLAG,emptyRoutes,validateRoutes,validateGeometry,periodMilliseconds,clockMilliseconds,advanceRoute,repositionRoute,tokenKey,gridKey} from './model.mjs';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export class PatrolRoutes {
 constructor(store,env=globalThis){this.store=store;this.env=env;this.hooks=[];this.listeners=new Set();this.busy=new Set();}
 get authoritative(){return this.store.authoritative;}
 get now(){return clockMilliseconds(this.env.game.time?.worldTime);}
 read(){if(!this.store.isGM)throw Error('GM access only.');return validateRoutes(structuredClone(this.store.document?.getFlag(MODULE,PATROL_FLAG)||emptyRoutes()));}
 subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
 emit(){if(!this.store.isGM)this.store.patrolTokens=new Set();else try{this.store.patrolTokens=new Set(this.read().routes.flatMap(r=>r.assignments.map(tokenKey)));}catch{this.store.patrolTokens=new Set();}for(const fn of this.listeners)fn();}
 report(error){this.env.console?.error('MYZ Patrol Routes',error);if(this.store.isGM&&this.lastError!==error.message){this.lastError=error.message;this.env.ui.notifications.warn(`Patrols / Trade Routes: ${error.message}`);}}
 enqueue(task){return this.store.enqueue(async()=>{if(!this.authoritative)throw Error('Only the active GM can edit or advance patrol routes.');return task();});}
 async write(state){validateRoutes(state);if(!this.authoritative)throw Error('Active GM changed. Check route state before retrying.');if(state.revision>=Number.MAX_SAFE_INTEGER)throw Error('Route revision limit reached.');state.revision++;const doc=await this.store.ensureDocument();const users=Array.from(this.env.game.users.values?.()||this.env.game.users||[]);if(Number(doc.ownership?.default||0)>0||users.some(u=>!u.isGM&&(Number(doc.ownership?.[u.id]||0)>0||doc.testUserPermission?.(u,'LIMITED')===true)))throw Error('Configuration Journal must be GM-private before storing routes.');if(!this.authoritative)throw Error('Active GM changed.');await doc.setFlag(MODULE,PATROL_FLAG,state);this.emit();return state;}
 start(){
  if(!this.store.isGM||this.hooks.length)return;
  const run=task=>{void Promise.resolve().then(task).catch(error=>this.report(error));};
  const on=(name,fn)=>this.hooks.push([name,this.env.Hooks.on(name,fn)]);
  on('updateWorldTime',seconds=>{if(this.authoritative)run(()=>this.tick(clockMilliseconds(seconds)));});
  on('updateToken',(token,changes,options={})=>{if(options.myzPatrol||this.busy.has(tokenKey({sceneId:token.parent?.id,tokenId:token.id})))return;if(['x','y','width','height','hidden'].some(k=>Object.hasOwn(changes,k))&&this.authoritative&&!['pending','paused','moving','planned'].includes(token.movement?.state))run(()=>this.manual(token));});
  on('stopToken',token=>{if(this.authoritative&&!this.busy.has(`${token.parent?.id}.${token.id}`))run(()=>this.manual(token));});
  on('deleteToken',token=>{if(this.authoritative)run(()=>this.missing(token));});
  on('updateJournalEntry',doc=>{if(doc.id===this.store.documentId)this.emit();});
  const refresh=()=>{this.emit();if(this.authoritative)run(()=>this.tick(this.now));};
  on('updateUser',refresh);on('userConnected',refresh);this.unsubscribe=this.store.subscribe(refresh);refresh();
 }
 stop(){for(const [name,id] of this.hooks)this.env.Hooks.off(name,id);this.hooks=[];this.unsubscribe?.();}
 context(route){
  if(route.sceneId!==this.store.config.sceneId||route.gridKey!==gridKey(this.store.config))throw Error('Zone Scene/grid changed. Edit the route against the current grid before resuming.');
  validateGeometry(route,this.store.config.grid);
  const scene=this.env.game.scenes.get(route.sceneId);if(!scene)throw Error('Route Scene is unavailable.');
  const a=route.assignments[0],token=a&&scene.tokens.get(a.tokenId);if(!token)throw Error('Assigned token is missing. Assign a replacement token.');
  if(!canModify(token,this.env)||playerControlled(token,this.env))throw Error('Use a GM-controlled, non-player-owned token that the active GM can update.');
  if(this.store.config.groups.some(g=>g.sceneId===scene.id&&g.tokenId===token.id)||this.store.config.ark?.sceneId===scene.id&&this.store.config.ark?.tokenId===token.id)throw Error('Party/Expedition and Ark tokens cannot be assigned to routes.');
  return {scene,token};
 }
 target(route,token,scene){
  const b=coordinateToBounds(route.waypoints[route.index],this.store.config.grid),size=sceneCellSize(scene),width=token.width*size.width,height=token.height*size.height;
  if(!b||![width,height].every(n=>Number.isFinite(n)&&n>0)||width>b.width||height>b.height)throw Error('Token must fit inside a Zone sector.');
  const x=b.x+(b.width-width)/2,y=b.y+(b.height-height)/2,rect=scene.dimensions?.sceneRect||{x:0,y:0,width:scene.width,height:scene.height};
  if(![rect.x,rect.y,rect.width,rect.height].every(Number.isFinite)||x<rect.x||y<rect.y||x+width>rect.x+rect.width||y+height>rect.y+rect.height)throw Error('Destination token bounds are outside the Scene.');
  return {x,y,hidden:!route.visibleToPlayers};
 }
 plan(route,token,scene){const target=this.target(route,token,scene);if(['x','y','hidden'].some(k=>token[k]!==target[k]))route.pending={sceneId:scene.id,tokenId:token.id,...target,before:{x:token.x,y:token.y,hidden:Boolean(token.hidden)}};}
 async settle(){
  const state=this.read();let changed=false;
  for(const r of state.routes){if(!r.pending)continue;
   const p=r.pending;try{
    const {scene,token}=this.context(r),target=this.target(r,token,scene);
    if(!same(target,{x:p.x,y:p.y,hidden:p.hidden}))throw Error('Pending movement no longer matches the grid/token. Edit the route.');
    const atTarget=['x','y','hidden'].every(k=>token[k]===p[k]),atBefore=['x','y','hidden'].every(k=>token[k]===p.before[k]);
    if(!atTarget&&!atBefore){Object.assign(r,repositionRoute(r,positionToCoordinate(tokenCenter(token,scene),this.store.config.grid),this.now));r.running=false;r.issue='Token changed during pending movement. Review its waypoint and Resume.';delete r.pending;changed=true;continue;}
    if(!atTarget){if(!this.authoritative)return;this.busy.add(tokenKey(p));try{await token.update({x:p.x,y:p.y,hidden:p.hidden},{animate:false,myzPatrol:true});if(!['x','y','hidden'].every(k=>token[k]===p[k]))throw Error('Token update was not applied. Resolve the veto and Resume.');}finally{this.busy.delete(tokenKey(p));}}
    delete r.pending;changed=true;
   }catch(error){r.running=false;r.issue=`Movement pending: ${error.message}`;changed=true;this.report(error);}
  }
  if(changed)await this.write(state);
 }
 tick(now=this.now){return this.enqueue(async()=>{
  // Durable intents are replayed before accepting more elapsed time.
  if(this.read().routes.some(r=>r.pending&&r.running))await this.settle();
  const state=this.read();let changed=false;
  for(let i=0;i<state.routes.length;i++){
   let r=state.routes[i];if(!r.running||r.pending)continue;const before=structuredClone(r);
   try{
    if(now===null)throw Error('Game clock unavailable. Restore game.time.worldTime, then Resume.');
    const {token,scene}=this.context(r);if(['pending','paused','moving','planned'].includes(token.movement?.state))throw Error('Token is moving. Finish movement and Resume the route.');
    const code=positionToCoordinate(tokenCenter(token,scene),this.store.config.grid);
    if(code!==r.waypoints[r.index])r=repositionRoute(r,code,now);
    else r=advanceRoute(r,now);
    if(r.running)this.plan(r,token,scene);
   }catch(error){r={...before,running:false,issue:error.message};}
   state.routes[i]=r;changed=changed||!same(before,r);
  }
  if(changed)await this.write(state);
  if(state.routes.some(r=>r.pending&&r.running))await this.settle();
  return this.read();
 });}
 saveRoute(draft,expected=null){return this.enqueue(async()=>{
  if(draft.sceneId&&draft.sceneId!==this.store.config.sceneId||draft.gridKey&&draft.gridKey!==gridKey(this.store.config))throw Error('Zone Scene/grid changed while editing. Reopen and review the route.');
  const state=this.read(),old=state.routes.find(r=>r.id===draft.id),now=this.now;if(old?!same(old,expected):expected!==null)throw Error('This route changed while editing. Reopen the editor; nothing was saved.');
  let r={id:old?.id||draft.id||this.env.foundry.utils.randomID(),name:String(draft.name||'').trim(),sceneId:this.store.config.sceneId,gridKey:gridKey(this.store.config),waypoints:[...draft.waypoints],pattern:draft.pattern,minutesPerSector:Number(draft.minutesPerSector),assignments:structuredClone(draft.assignments||[]),index:old?.index??0,direction:old?.direction??1,progressMs:old?.progressMs??0,lastTimeMs:old?.lastTimeMs??now,running:false,visibleToPlayers:draft.visibleToPlayers,issue:''};
  validateGeometry(r,this.store.config.grid);periodMilliseconds(r.minutesPerSector);
  const priorCode=old?.waypoints[old.index],geometryChanged=!old||!same(old.waypoints,r.waypoints)||old.pattern!==r.pattern||old.gridKey!==r.gridKey;
  const positionChanged=geometryChanged||Number.isInteger(draft.startIndex)&&draft.startIndex!==old?.index;
  if(positionChanged){const index=Number.isInteger(draft.startIndex)?draft.startIndex:r.waypoints.indexOf(priorCode);if(index<0||index>=r.waypoints.length)throw Error('Choose a valid Starting Waypoint for the changed route.');r.index=index;r.progressMs=0;r.direction=r.pattern==='pingpong'&&r.index===r.waypoints.length-1?-1:1;}
  if(old&&!positionChanged&&old.minutesPerSector!==r.minutesPerSector)r.progressMs=Number(BigInt(old.progressMs)*BigInt(periodMilliseconds(r.minutesPerSector))/BigInt(periodMilliseconds(old.minutesPerSector)));
  r.lastTimeMs=now===null?r.lastTimeMs:Math.max(r.lastTimeMs??now,now);
  const candidate={...state,routes:[...state.routes.filter(x=>x.id!==r.id),r]};validateRoutes(candidate);
  if(r.assignments.length){const {token,scene}=this.context(r);for(let index=0;index<r.waypoints.length;index++)this.target({...r,index},token,scene);this.plan(r,token,scene);}else r.issue='Assign a token before resuming.';
  // Preserve list order when editing.
  if(old)state.routes[state.routes.indexOf(old)]=r;else state.routes.push(r);
  await this.write(state);await this.settle();return this.read();
 });}
 pause(id){return this.enqueue(async()=>{const s=this.read(),r=s.routes.find(r=>r.id===id);if(!r)throw Error('Route no longer exists.');r.running=false;await this.write(s);return this.read();});}
 resume(id){return this.enqueue(async()=>{
  await this.settle();const s=this.read();let r=s.routes.find(r=>r.id===id);if(!r)throw Error('Route no longer exists.');if(r.pending)throw Error(r.issue||'Resolve pending movement before resuming.');const now=this.now;if(now===null)throw Error('Game clock unavailable. No real-world clock fallback is used.');
  const {token,scene}=this.context(r),code=positionToCoordinate(tokenCenter(token,scene),this.store.config.grid);
  if(code!==r.waypoints[r.index]){Object.assign(r,repositionRoute(r,code,now));if(!r.waypoints.includes(code))throw Error('Place the token on a route waypoint before resuming.');}
  r.running=true;r.issue='';r.lastTimeMs=Math.max(r.lastTimeMs??now,now);this.plan(r,token,scene);await this.write(s);await this.settle();return this.read();
 });}
 remove(id){return this.enqueue(async()=>{const s=this.read();s.routes=s.routes.filter(r=>r.id!==id);await this.write(s);return this.read();});}
 manual(token){if(!this.authoritative||!this.store.patrolTokens?.has(`${token.parent?.id}.${token.id}`))return Promise.resolve();return this.enqueue(async()=>{
  const s=this.read(),index=s.routes.findIndex(r=>r.assignments.some(a=>a.sceneId===token.parent?.id&&a.tokenId===token.id));if(index<0)return;
  let r=s.routes[index];if(r.pending)return;const before=JSON.stringify(r);const code=positionToCoordinate(tokenCenter(token,token.parent),this.store.config.grid),now=this.now;
  if(code!==r.waypoints[r.index])r=repositionRoute(r,code,now);
  if(now===null){r.running=false;r.issue='Game clock unavailable. Resume after restoring it.';}
  try{const {scene}=this.context(r);if(r.waypoints.includes(code))this.plan(r,token,scene);}catch(error){r.running=false;r.issue=error.message;}
  s.routes[index]=r;if(JSON.stringify(r)!==before)await this.write(s);await this.settle();if(r.issue)this.report(Error(r.issue));
 });}
 missing(token){return this.enqueue(async()=>{const s=this.read();let changed=false;for(const r of s.routes)if(r.assignments.some(a=>a.sceneId===token.parent?.id&&a.tokenId===token.id)){r.running=false;r.issue='Assigned token was deleted. Assign a replacement token.';changed=true;}if(changed)await this.write(s);});}
}
