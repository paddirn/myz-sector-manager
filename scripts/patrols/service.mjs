import {validateSchedule,worldClock,validateClockSchedule,advanceScheduled,resetDeparture,nextDeparture} from './schedule.mjs';
import {sourceSector,hostileTokens,firstHostileStep,encounterRecord,sameEncounter} from './hostility.mjs';
import {tokenSource,tokenPosition,matchesPosition,routeProgress,restoreProgress,resultSummary} from './movement.mjs';
import {MODULE} from '../zone/store.mjs';
import {coordinateToBounds,positionToCoordinate,tokenCenter,sceneCellSize} from '../zone/grid.mjs';
import {canModify,playerControlled} from '../wandering/model.mjs';
import {PATROL_FLAG,emptyRoutes,validateRoutes,validateGeometry,periodMilliseconds,clockMilliseconds,repositionRoute,tokenKey,gridKey} from './model.mjs';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export class PatrolRoutes {
 constructor(store,env=globalThis){this.store=store;this.env=env;this.hooks=[];this.listeners=new Set();this.busy=new Set();this.wanderingMoves=new Set();}
 get authoritative(){return this.store.authoritative;}
 get now(){return clockMilliseconds(this.env.game.time?.worldTime);}
 read(){if(!this.store.isGM)throw Error('GM access only.');return validateRoutes(structuredClone(this.store.document?.getFlag(MODULE,PATROL_FLAG)||emptyRoutes()));}
 subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
 emit(){if(!this.store.isGM)this.store.patrolTokens=new Set();else try{this.store.patrolTokens=new Set(this.read().routes.flatMap(r=>r.assignments.map(tokenKey)));}catch{this.store.patrolTokens=new Set();}for(const fn of this.listeners)fn();}
 report(error){this.env.console?.error('MYZ Patrol Routes',error.patrolDiagnostic||{},error);if(this.store.isGM&&this.lastError!==error.message){this.lastError=error.message;this.env.ui.notifications.warn(`Patrols / Trade Routes: ${error.message}`);}}
 enqueue(task){return this.store.enqueue(async()=>{if(!this.authoritative)throw Error('Only the active GM can edit or advance patrol routes.');return task();});}
 async write(state){validateRoutes(state);if(!this.authoritative)throw Error('Active GM changed. Check route state before retrying.');if(state.revision>=Number.MAX_SAFE_INTEGER)throw Error('Route revision limit reached.');state.revision++;const doc=await this.store.ensureDocument();const users=Array.from(this.env.game.users.values?.()||this.env.game.users||[]);if(Number(doc.ownership?.default||0)>0||users.some(u=>!u.isGM&&(Number(doc.ownership?.[u.id]||0)>0||doc.testUserPermission?.(u,'LIMITED')===true)))throw Error('Configuration Journal must be GM-private before storing routes.');if(!this.authoritative)throw Error('Active GM changed.');await doc.setFlag(MODULE,PATROL_FLAG,state);this.emit();return state;}
 start(){
  if(!this.store.isGM||this.hooks.length)return;
  const run=task=>{void Promise.resolve().then(task).catch(error=>this.report(error));};
  const on=(name,fn)=>this.hooks.push([name,this.env.Hooks.on(name,fn)]);
  on('updateWorldTime',seconds=>{if(this.authoritative)run(()=>this.tick(clockMilliseconds(seconds)));});
  on('updateToken',(token,changes,options={})=>{if(this.authoritative&&['x','y','disposition'].some(k=>Object.hasOwn(changes,k))&&!['pending','paused','moving','planned'].includes(token.movement?.state))run(()=>this.collisions(token));if(options.myzWandering){this.wanderingMoves.add(`${token.parent?.id}.${token.id}`);if(this.authoritative&&this.store.patrolTokens?.has(`${token.parent?.id}.${token.id}`))run(()=>this.wanderingConflict(token));return;}if(options.myzPatrol||this.busy.has(tokenKey({sceneId:token.parent?.id,tokenId:token.id})))return;if(['x','y','width','height','hidden'].some(k=>Object.hasOwn(changes,k))&&this.authoritative&&!['pending','paused','moving','planned'].includes(token.movement?.state))run(()=>this.manual(token));});
  on('stopToken',token=>{if(this.authoritative)run(()=>this.collisions(token));if(this.wanderingMoves.delete(`${token.parent?.id}.${token.id}`))return;if(this.authoritative&&!this.busy.has(`${token.parent?.id}.${token.id}`))run(()=>this.manual(token));});
  on('deleteToken',token=>{if(this.authoritative)run(()=>this.missing(token));});
  on('updateJournalEntry',doc=>{if(doc.id===this.store.documentId)this.emit();});
  const refresh=()=>{this.emit();if(this.authoritative)run(()=>this.tick(this.now));};
  on('updateUser',refresh);on('userConnected',refresh);this.unsubscribe=this.store.subscribe(refresh);refresh();
 }
 stop(){for(const [name,id] of this.hooks)this.env.Hooks.off(name,id);this.hooks=[];this.unsubscribe?.();}
 context(route){
  if(route.sceneId!==this.store.config.sceneId||route.gridKey!==gridKey(this.store.config))throw Error('Zone Scene/grid changed. Edit the route against the current grid before starting.');
  validateGeometry(route,this.store.config.grid);
  const scene=this.env.game.scenes.get(route.sceneId);if(!scene)throw Error('Route Scene is unavailable.');
  const a=route.assignments[0],token=a&&scene.tokens.get(a.tokenId);if(!token)throw Error('Assigned token is missing. Assign a replacement token.');if(token.parent?.id!==scene.id||token.id!==a.tokenId)throw Error('Assignment does not match the Scene TokenDocument.');
  if(!canModify(token,this.env)||playerControlled(token,this.env))throw Error('Use a GM-controlled, non-player-owned token that the active GM can update.');
  if(this.store.config.groups.some(g=>g.sceneId===scene.id&&g.tokenId===token.id)||this.store.config.ark?.sceneId===scene.id&&this.store.config.ark?.tokenId===token.id)throw Error('Party/Expedition and Ark tokens cannot be assigned to routes.');
  return {scene,token};
 }
 target(route,token,scene){
  const b=coordinateToBounds(route.waypoints[route.index],this.store.config.grid),size=sceneCellSize(scene),source=tokenSource(token),width=source.width*size.width,height=source.height*size.height;
  if(!b||![width,height].every(n=>Number.isFinite(n)&&n>0)||width>b.width||height>b.height)throw Error('Token must fit inside a Zone sector.');
  const x=Math.round(b.x+(b.width-width)/2),y=Math.round(b.y+(b.height-height)/2),rect=scene.dimensions?.sceneRect||{x:0,y:0,width:scene.width,height:scene.height};
  if(![rect.x,rect.y,rect.width,rect.height].every(Number.isFinite)||x<rect.x||y<rect.y||x+width>rect.x+rect.width||y+height>rect.y+rect.height)throw Error('Destination token bounds are outside the Scene.');
  return {x,y,hidden:!route.visibleToPlayers};
 }
 plan(route,token,scene,beforeRoute=route){
  const target=this.target(route,token,scene),before=tokenPosition(token);
  if(!matchesPosition(before,target)){
   route.pending={sceneId:scene.id,tokenId:token.id,...target,before,routeBefore:routeProgress(beforeRoute),routeAfter:routeProgress(route)};
   // Claim the intent durably; publish travel progress only after verified movement.
   restoreProgress(route,route.pending.routeBefore);
  }
 }
 async settle(){
  const state=this.read();let changed=false;const notifications=[];
  for(const r of state.routes){if(!r.pending)continue;
   const p=r.pending,expected={x:Math.round(p.x),y:Math.round(p.y),hidden:p.hidden};
   const diagnostic={routeId:r.id,routeName:r.name,tokenId:p.tokenId,sceneId:p.sceneId,startingSector:r.waypoints[p.routeBefore?.index??r.index],destinationSector:r.waypoints[p.routeAfter?.index??r.index],expected,actual:null,prepared:null,api:null,result:null,outcome:'validation',userId:this.env.game.user.id,activeGMId:this.env.game.users.activeGM?.id,legacyIntent:!p.routeAfter};
   try{
    const {scene,token}=this.context(r),target=this.target({...r,index:p.routeAfter?.index??r.index},token,scene);
    const source=tokenSource(token);diagnostic.startingSector=positionToCoordinate(tokenCenter({x:p.before.x,y:p.before.y,width:source.width,height:source.height},scene),this.store.config.grid);
    const inspect=()=>{const current=scene.tokens.get(p.tokenId);diagnostic.actual=tokenPosition(current);diagnostic.prepared=current?{x:current.x,y:current.y,hidden:current.hidden}:null;return current;};
    inspect();
    if(!same(target,expected))throw Error('Pending movement no longer matches the grid/token. Edit the route.');
    const atTarget=matchesPosition(diagnostic.actual,expected),atBefore=matchesPosition(diagnostic.actual,{x:Math.round(p.before.x),y:Math.round(p.before.y),hidden:p.before.hidden});
    if(!atTarget&&!atBefore){Object.assign(r,repositionRoute(r,positionToCoordinate(tokenCenter(token,scene),this.store.config.grid),this.now));r.running=false;r.issue='Token changed during pending movement. Review its waypoint and Start.';delete r.pending;changed=true;continue;}
    if(!atTarget){
     if(!this.authoritative)return;this.busy.add(tokenKey(p));
     try{
      const moving=diagnostic.actual.x!==expected.x||diagnostic.actual.y!==expected.y;
      diagnostic.api=moving&&typeof token.move==='function'?'TokenDocument.move':'TokenDocument.update';
      diagnostic.outcome='exception';
      const result=diagnostic.api==='TokenDocument.move'
       ?await token.move(expected,{animate:false,pan:false,autoRotate:false,showRuler:false,myzPatrol:true})
       :await token.update(expected,{animate:false,pan:false,myzPatrol:true});
      diagnostic.result=resultSummary(result);inspect();
      if(!matchesPosition(diagnostic.actual,expected)){
       diagnostic.outcome=result===false||result==null?'rejected':'verification';
       throw Error(diagnostic.outcome==='rejected'?'Token movement was rejected or stopped. See the GM console and Start after correcting it.':'Token movement failed source-position verification. See the GM console before starting.');
      }
     }finally{this.busy.delete(tokenKey(p));}
    }
    // Source already matches after a prior update/uncertain acknowledgement: never move twice.
    if(p.routeAfter)restoreProgress(r,p.routeAfter);
    delete r.pending;r.issue='';
    if(p.transition){delete r.encounter;const hostiles=hostileTokens(scene.tokens.get(p.tokenId),scene,this.store.config.grid,r.waypoints[r.index],this.env);if(hostiles.length){this.stopEncounter(r,hostiles);notifications.push({route:structuredClone(r),names:hostiles.map(t=>t.name||t.id)});}}
    changed=true;
   }catch(cause){
    const error=cause instanceof Error?cause:new Error(cause?.message||String(cause));
    if(p.routeBefore)restoreProgress(r,p.routeBefore);
    const token=this.env.game.scenes.get(p.sceneId)?.tokens.get(p.tokenId);
    diagnostic.actual=tokenPosition(token);diagnostic.prepared=token?{x:token.x,y:token.y,hidden:token.hidden}:null;
    error.patrolDiagnostic=diagnostic;r.running=false;r.issue=`Movement pending: ${error.message}`;changed=true;this.report(error);
   }
  }
  if(changed)await this.write(state);
  for(const n of notifications)this.notifyEncounter(n.route,n.names);
 }
 tick(now=this.now){return this.enqueue(async()=>{
  // Durable intents are replayed before accepting more elapsed time.
  if(this.read().routes.some(r=>r.pending&&r.running))await this.settle();
  const state=this.read();let changed=false;const notifications=[];
  for(let i=0;i<state.routes.length;i++){
   let r=state.routes[i];if(!r.running||r.pending)continue;const before=structuredClone(r);
   try{
    if(now===null)throw Error('Game clock unavailable. Restore game.time.worldTime, then Start.');
    const {token,scene}=this.context(r);if(['pending','paused','moving','planned'].includes(token.movement?.state))throw Error('Token is moving. Finish movement and Start the route.');
    const code=sourceSector(token,scene,this.store.config.grid);
    let transitions=0n;
    if(code!==r.waypoints[r.index]){r=repositionRoute(r,code,now);resetDeparture(r,now,worldClock(this.env.game.time,now));delete r.encounter;}
    else{const result=advanceScheduled(r,now,worldClock(this.env.game.time,now),firstHostileStep(r,token,scene,this.store.config.grid,this.env));r=result.route;transitions=result.steps;}
    if(r.running){this.plan(r,token,scene,before);if(r.pending)r.pending.transition=transitions>0n;else if(transitions>0n){delete r.encounter;const hostiles=hostileTokens(token,scene,this.store.config.grid,r.waypoints[r.index],this.env);if(hostiles.length){this.stopEncounter(r,hostiles);notifications.push({route:r,names:hostiles.map(t=>t.name||t.id)});}}}
   }catch(error){r={...before,running:false,issue:error.message};}
   state.routes[i]=r;changed=changed||!same(before,r);
  }
  if(changed)await this.write(state);
  for(const n of notifications)this.notifyEncounter(n.route,n.names);
  if(state.routes.some(r=>r.pending&&r.running))await this.settle();
  return this.read();
 });}
 saveRoute(draft,expected=null){return this.enqueue(async()=>{
  if(draft.sceneId&&draft.sceneId!==this.store.config.sceneId||draft.gridKey&&draft.gridKey!==gridKey(this.store.config))throw Error('Zone Scene/grid changed while editing. Reopen and review the route.');
  const state=this.read(),old=state.routes.find(r=>r.id===draft.id),now=this.now;if(old?!same(old,expected):expected!==null)throw Error('This route changed while editing. Reopen the editor; nothing was saved.');
  const schedule=validateSchedule(draft.schedule??old?.schedule);validateClockSchedule(schedule,worldClock(this.env.game.time,now??0));
  let r={schedule,...(old?.scheduleState?{scheduleState:structuredClone(old.scheduleState)}:{}),id:old?.id||draft.id||this.env.foundry.utils.randomID(),name:String(draft.name||'').trim(),sceneId:this.store.config.sceneId,gridKey:gridKey(this.store.config),waypoints:[...draft.waypoints],pattern:draft.pattern,minutesPerSector:Number(draft.minutesPerSector),assignments:structuredClone(draft.assignments||[]),index:old?.index??0,direction:old?.direction??1,progressMs:old?.progressMs??0,lastTimeMs:old?.lastTimeMs??now,running:false,visibleToPlayers:draft.visibleToPlayers,issue:''};
  validateGeometry(r,this.store.config.grid);periodMilliseconds(r.minutesPerSector);
  const priorCode=old?.waypoints[old.index],geometryChanged=!old||!same(old.waypoints,r.waypoints)||old.pattern!==r.pattern||old.gridKey!==r.gridKey;
  const positionChanged=geometryChanged||Number.isInteger(draft.startIndex)&&draft.startIndex!==old?.index;
  if(positionChanged){const index=Number.isInteger(draft.startIndex)?draft.startIndex:r.waypoints.indexOf(priorCode);if(index<0||index>=r.waypoints.length)throw Error('Choose a valid Starting Waypoint for the changed route.');r.index=index;r.progressMs=0;r.direction=r.pattern==='pingpong'&&r.index===r.waypoints.length-1?-1:1;}
  if(old&&!positionChanged&&old.minutesPerSector!==r.minutesPerSector)r.progressMs=Number(BigInt(old.progressMs)*BigInt(periodMilliseconds(r.minutesPerSector))/BigInt(periodMilliseconds(old.minutesPerSector)));
  r.lastTimeMs=now===null?r.lastTimeMs:Math.max(r.lastTimeMs??now,now);
  if(positionChanged||!same(schedule,validateSchedule(old?.schedule)))resetDeparture(r,now??r.lastTimeMs??0,worldClock(this.env.game.time,now??0));
  const candidate={...state,routes:[...state.routes.filter(x=>x.id!==r.id),r]};validateRoutes(candidate);
  if(r.assignments.length){const {token,scene}=this.context(r);if(['pending','paused','moving','planned'].includes(token.movement?.state))throw Error('Finish native token movement before assigning or editing this route.');for(let index=0;index<r.waypoints.length;index++)this.target({...r,index},token,scene);this.plan(r,token,scene);}else r.issue='Assign a token before starting.';
  // Preserve list order when editing.
  if(old)state.routes[state.routes.indexOf(old)]=r;else state.routes.push(r);
  await this.write(state);await this.settle();return this.read();
 });}
 pause(id){return this.enqueue(async()=>{const s=this.read(),r=s.routes.find(r=>r.id===id);if(!r)throw Error('Route no longer exists.');r.running=false;await this.write(s);return this.read();});}
 resume(id){return this.enqueue(async()=>{
  await this.settle();const s=this.read();let r=s.routes.find(r=>r.id===id);if(!r)throw Error('Route no longer exists.');if(r.pending)throw Error(r.issue||'Resolve pending movement before starting.');const now=this.now;if(now===null)throw Error('Game clock unavailable. No real-world clock fallback is used.');
  const {token,scene}=this.context(r),code=sourceSector(token,scene,this.store.config.grid);
  if(code!==r.waypoints[r.index]){Object.assign(r,repositionRoute(r,code,now));resetDeparture(r,now,worldClock(this.env.game.time,now));delete r.encounter;if(!r.waypoints.includes(code))throw Error('Place the token on a route waypoint before starting.');}
  if(r.encounter){const present=hostileTokens(token,scene,this.store.config.grid,code,this.env).filter(t=>r.encounter.tokenIds.includes(t.id));if(present.length)r.encounter=encounterRecord(code,present);else delete r.encounter;}
  r.running=true;r.issue='';r.lastTimeMs=Math.max(r.lastTimeMs??now,now);const clock=worldClock(this.env.game.time,r.lastTimeMs),schedule=validateSchedule(r.schedule);validateClockSchedule(schedule,clock);if(schedule.mode==='departure'){if(!r.scheduleState)resetDeparture(r,r.lastTimeMs,clock);else if(r.scheduleState.remainingSteps===null)r.scheduleState.nextDepartureMs=nextDeparture(r.lastTimeMs,schedule,clock);}this.plan(r,token,scene);await this.write(s);await this.settle();return this.read();
 });}
 remove(id){return this.enqueue(async()=>{const s=this.read();s.routes=s.routes.filter(r=>r.id!==id);await this.write(s);return this.read();});}
 manual(token){if(!this.authoritative||!this.store.patrolTokens?.has(`${token.parent?.id}.${token.id}`))return Promise.resolve();return this.enqueue(async()=>{
  const s=this.read(),index=s.routes.findIndex(r=>r.assignments.some(a=>a.sceneId===token.parent?.id&&a.tokenId===token.id));if(index<0)return;
  let r=s.routes[index];if(r.pending)return;const before=JSON.stringify(r),priorIssue=r.issue;const code=sourceSector(token,token.parent,this.store.config.grid),now=this.now;
  if(code!==r.waypoints[r.index]){r=repositionRoute(r,code,now);resetDeparture(r,now??r.lastTimeMs??0,worldClock(this.env.game.time,now??0));delete r.encounter;}
  if(now===null){r.running=false;r.issue='Game clock unavailable. Start after restoring it.';}
  try{const {scene}=this.context(r);if(r.waypoints.includes(code))this.plan(r,token,scene);}catch(error){r.running=false;r.issue=error.message;}
  s.routes[index]=r;if(JSON.stringify(r)!==before)await this.write(s);await this.settle();if(r.issue&&r.issue!==priorIssue)this.report(Error(r.issue));
 });}
 stopEncounter(route,tokens){route.running=false;route.encounter=encounterRecord(route.waypoints[route.index],tokens);route.issue=`Hostile token encountered in ${route.encounter.sector}. Review and Start to continue.`;}
 notifyEncounter(route,names){if(this.authoritative)this.env.ui.notifications.warn(`Patrol "${route.name}" encountered a hostile token in sector ${route.encounter.sector} and has stopped${names.length?`: ${names.join(', ')}`:'.'}`);}
 collisions(token){if(!this.authoritative||token.parent?.id!==this.store.config.sceneId)return Promise.resolve();return this.enqueue(async()=>{
  const state=this.read(),notifications=[];let changed=false;
  for(const r of state.routes){if(!r.running||r.pending||this.busy.has(tokenKey(r.assignments[0]||{})))continue;
   const patrol=this.env.game.scenes.get(r.sceneId)?.tokens.get(r.assignments[0]?.tokenId);if(!patrol)continue;
   const sector=sourceSector(patrol,patrol.parent,this.store.config.grid);if(sector!==r.waypoints[r.index])continue;
   // Only a moved participant can cause a collision, not unrelated updates elsewhere in the Scene.
   if(token.id!==patrol.id&&sourceSector(token,token.parent,this.store.config.grid)!==sector&&!r.encounter?.tokenIds.includes(token.id))continue;
   const hostiles=hostileTokens(patrol,patrol.parent,this.store.config.grid,sector,this.env),record=encounterRecord(sector,hostiles);
   const newcomers=hostiles.filter(t=>r.encounter?.sector!==sector||!r.encounter.tokenIds.includes(t.id));
   if(newcomers.length){this.stopEncounter(r,hostiles);changed=true;notifications.push({route:r,names:hostiles.map(t=>t.name||t.id)});}
   else if(r.encounter&&!sameEncounter(r.encounter,record)){if(hostiles.length)r.encounter=record;else delete r.encounter;changed=true;}
  }
  if(changed){await this.write(state);for(const n of notifications)this.notifyEncounter(n.route,n.names);}
 });}
 wanderingConflict(token){return this.enqueue(async()=>{const state=this.read(),r=state.routes.find(r=>r.assignments.some(a=>a.sceneId===token.parent?.id&&a.tokenId===token.id));if(!r)return;r.running=false;r.issue='Unexpected Random Wandering movement on a patrol-owned token. Return it to its waypoint before Start.';await this.write(state);});}
 missing(token){return this.enqueue(async()=>{const s=this.read();let changed=false;for(const r of s.routes)if(r.assignments.some(a=>a.sceneId===token.parent?.id&&a.tokenId===token.id)){r.running=false;r.issue='Assigned token was deleted. Assign a replacement token.';changed=true;}if(changed)await this.write(s);});}
}
