import {positionToCoordinate,tokenCenter} from '../zone/grid.mjs';
import {tokenSource} from './movement.mjs';
import {cycleSteps,shiftSteps} from './schedule.mjs';
export function sourceSector(token,scene,grid){return positionToCoordinate(tokenCenter(tokenSource(token),scene),grid);}
function opposingDisposition(token,env){const v=env.CONST?.TOKEN_DISPOSITIONS||{FRIENDLY:1,HOSTILE:-1},d=tokenSource(token).disposition;return d===v.FRIENDLY?v.HOSTILE:d===v.HOSTILE?v.FRIENDLY:null;}
export function hostileTokens(patrol,scene,grid,sector,env){
 const opposed=opposingDisposition(patrol,env);
 if(opposed===null)return [];
 return Array.from(scene.tokens.values()).filter(t=>t.id!==patrol.id&&t.parent?.id===scene.id&&tokenSource(t).disposition===opposed&&sourceSector(t,scene,grid)===sector);
}
// Occupancy repeats after one route cycle, so even enormous clock jumps inspect at most 2(n-1) sectors.
export function firstHostileStep(route,token,scene,grid,env){
 const opposed=opposingDisposition(token,env);if(opposed===null)return null;
 const occupied=new Set(Array.from(scene.tokens.values()).filter(t=>t.id!==token.id&&t.parent?.id===scene.id&&tokenSource(t).disposition===opposed).map(t=>sourceSector(t,scene,grid)));
 if(!occupied.size)return null;const r={...route};for(let step=1;step<=cycleSteps(r);step++){shiftSteps(r,1n);if(occupied.has(r.waypoints[r.index]))return step;}return null;
}
export const encounterRecord=(sector,tokens)=>({sector,tokenIds:tokens.map(t=>t.id).sort()});
export const sameEncounter=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
