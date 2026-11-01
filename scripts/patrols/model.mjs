import {dispositionFilter} from './dispositions.mjs';
import {validateSchedule} from './schedule.mjs';
import {canonicalCoordinate,sectorDistance,coordinateToBounds,validateGrid} from '../zone/grid.mjs';
export const PATROL_FLAG='patrolRoutes';
export const emptyRoutes=()=>({version:1,revision:0,routes:[]});
export const tokenKey=assignment=>`${assignment.sceneId}.${assignment.tokenId}`;
export const gridKey=config=>JSON.stringify(['reference','originX','originY','width','height','columns','rows','columnAxis','columnDirection','rowDirection'].map(k=>config.grid?.[k]));
export function clockMilliseconds(seconds){
 if(typeof seconds!=='number'||!Number.isFinite(seconds)||!Number.isSafeInteger(Math.round(seconds*1000)))return null;
 return Math.round(seconds*1000);
}
export function periodMilliseconds(minutes){
 const value=minutes*60000,rounded=Math.round(value);
 if(typeof minutes!=='number'||!Number.isFinite(minutes)||!Number.isSafeInteger(rounded)||rounded<1||Math.abs(value-rounded)>.000001)throw Error('Minutes per sector must be positive and representable to a millisecond.');
 return rounded;
}
export function adjacent(a,b){return sectorDistance(a,b)?.sectors===1;}
export function validateGeometry(route,grid){
 validateGrid(grid);
 if(!Array.isArray(route.waypoints)||route.waypoints.length<2||route.waypoints.length>1000||new Set(route.waypoints).size<2)throw Error('Select 2–1,000 waypoints, including two distinct sectors.');
 for(const [i,code] of route.waypoints.entries()){
  if(canonicalCoordinate(code)!==code||!coordinateToBounds(code,grid))throw Error(`Invalid or out-of-bounds waypoint ${i+1}.`);
  if(i&&!adjacent(route.waypoints[i-1],code))throw Error(`Waypoints ${i} and ${i+1} must be adjacent sectors (diagonals allowed); select intervening sectors.`);
 }
 if(route.pattern==='loop'&&!adjacent(route.waypoints.at(-1),route.waypoints[0]))throw Error('A Loop must close between adjacent last and first waypoints.');
}
export function validateRoutes(state){
 if(state?.version!==1||!Number.isSafeInteger(state.revision)||state.revision<0||!Array.isArray(state.routes)||state.routes.length>200)throw Error('Invalid saved Patrols / Trade Routes data. Original data retained.');
 const ids=new Set(),tokens=new Set();
 for(const r of state.routes){
  if(typeof r.id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(r.id)||ids.has(r.id))throw Error('Invalid or duplicate route ID.');ids.add(r.id);
  if(typeof r.name!=='string'||!r.name.trim()||r.name.length>200||typeof r.sceneId!=='string'||!r.sceneId||typeof r.gridKey!=='string'||!['loop','pingpong'].includes(r.pattern)||typeof r.running!=='boolean'||typeof r.visibleToPlayers!=='boolean'||typeof r.issue!=='string')throw Error('Invalid route name, configuration or status.');
  if(!Array.isArray(r.waypoints)||r.waypoints.length<2||r.waypoints.length>1000||r.waypoints.some(c=>!canonicalCoordinate(c)||canonicalCoordinate(c)!==c)||!Number.isInteger(r.index)||r.index<0||r.index>=r.waypoints.length||![1,-1].includes(r.direction))throw Error('Invalid route waypoints or current position.');
  dispositionFilter(r.stopDispositions);validateSchedule(r.schedule);validateScheduleState(r.scheduleState,r);
  if(r.encounter&&(typeof r.encounter.sector!=='string'||!Array.isArray(r.encounter.tokenIds)||r.encounter.tokenIds.some(id=>typeof id!=='string')))throw Error('Invalid patrol encounter acknowledgment.');
  const period=periodMilliseconds(r.minutesPerSector);
  if(!Number.isSafeInteger(r.progressMs)||r.progressMs<0||r.progressMs>=period||r.lastTimeMs!==null&&!Number.isSafeInteger(r.lastTimeMs))throw Error('Invalid saved route progress or time baseline.');
  if(!Array.isArray(r.assignments)||r.assignments.length>1)throw Error('This version supports one token assignment per route.');
  for(const a of r.assignments){if(a?.sceneId!==r.sceneId||typeof a.tokenId!=='string'||!a.tokenId||tokens.has(tokenKey(a)))throw Error('Assign each Scene token to only one route.');tokens.add(tokenKey(a));}
  if(r.pending){const p=r.pending;if(p.transition!==undefined&&typeof p.transition!=='boolean')throw Error('Invalid pending patrol transition.');if(p.routeBefore!==undefined||p.routeAfter!==undefined)for(const checkpoint of [p.routeBefore,p.routeAfter])if(!checkpoint||!Number.isInteger(checkpoint.index)||checkpoint.index<0||checkpoint.index>=r.waypoints.length||![1,-1].includes(checkpoint.direction)||!Number.isSafeInteger(checkpoint.progressMs)||checkpoint.progressMs<0||checkpoint.progressMs>=period||checkpoint.lastTimeMs!==null&&!Number.isSafeInteger(checkpoint.lastTimeMs))throw Error('Invalid route movement checkpoint.');if(p.routeBefore)for(const checkpoint of [p.routeBefore,p.routeAfter])validateScheduleState(checkpoint.scheduleState,r);if(r.assignments.length!==1||p.sceneId!==r.sceneId||p.tokenId!==r.assignments[0].tokenId||![p.x,p.y,p.before?.x,p.before?.y].every(Number.isFinite)||typeof p.hidden!=='boolean'||typeof p.before?.hidden!=='boolean')throw Error('Invalid pending route movement.');}
 }
 return state;
}
// Absolute millisecond timestamps plus BigInt arithmetic avoid repeated decimal drift.
export function advanceRoute(route,now){
 const r=structuredClone(route);if(!r.running||now===null)return r;
 if(r.lastTimeMs===null){r.lastTimeMs=now;return r;}
 if(now<r.lastTimeMs){r.issue='Clock rewound: waiting for the previous time baseline.';return r;}
 const elapsed=BigInt(now)-BigInt(r.lastTimeMs),period=BigInt(periodMilliseconds(r.minutesPerSector)),total=BigInt(r.progressMs)+elapsed,steps=total/period;
 r.progressMs=Number(total%period);r.lastTimeMs=now;r.issue='';
 const n=r.waypoints.length;
 if(r.pattern==='loop'){r.index=Number((BigInt(r.index)+steps)%BigInt(n));r.direction=1;}
 else{const end=n-1,cycle=BigInt(end*2),phase=r.direction===1?r.index:end*2-r.index,p=Number((BigInt(phase)+steps)%cycle);r.index=p<=end?p:end*2-p;r.direction=p<end?1:-1;}
 return r;
}
export function repositionRoute(route,code,now){
 const r=structuredClone(route),indices=r.waypoints.flatMap((v,i)=>v===code?[i]:[]);
 if(!indices.length){r.running=false;r.issue='Token is off-route. Return it to a waypoint before resuming.';return r;}
 r.index=indices.sort((a,b)=>Math.abs(a-r.index)-Math.abs(b-r.index)||a-b)[0];
 if(r.pattern==='pingpong'){if(r.index===0)r.direction=1;else if(r.index===r.waypoints.length-1)r.direction=-1;}
 r.progressMs=0;r.lastTimeMs=now===null?r.lastTimeMs:Math.max(r.lastTimeMs??now,now);r.issue='';return r;
}

function validateScheduleState(st,r){if(st!==undefined&&(!st||!Number.isInteger(st.homeIndex)||st.homeIndex<0||st.homeIndex>=r.waypoints.length||![1,-1].includes(st.homeDirection)||st.remainingSteps!==null&&(!Number.isInteger(st.remainingSteps)||st.remainingSteps<0||st.remainingSteps>2*r.waypoints.length)||st.nextDepartureMs!==null&&!Number.isSafeInteger(st.nextDepartureMs)))throw Error('Invalid saved patrol scheduling state.');}
