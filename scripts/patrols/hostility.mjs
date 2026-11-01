import {selectedValues} from './dispositions.mjs';
import {positionToCoordinate,tokenCenter} from '../zone/grid.mjs';
import {tokenSource} from './movement.mjs';
import {cycleSteps,shiftSteps} from './schedule.mjs';
export function sourceSector(token,scene,grid){return positionToCoordinate(tokenCenter(tokenSource(token),scene),grid);}
export function matchingTokens(route,patrol,scene,grid,sector,env){
 const selected=selectedValues(route,env);if(!selected.size)return [];
 return Array.from(scene.tokens.values()).filter(t=>t.id!==patrol.id&&t.parent?.id===scene.id&&selected.has(tokenSource(t).disposition)&&sourceSector(t,scene,grid)===sector);
}
// Occupancy repeats after one route cycle, so even enormous clock jumps inspect at most 2(n-1) sectors.
export function firstCollisionStep(route,token,scene,grid,env){
 const selected=selectedValues(route,env);if(!selected.size)return null;
 const occupied=new Set(Array.from(scene.tokens.values()).filter(t=>t.id!==token.id&&t.parent?.id===scene.id&&selected.has(tokenSource(t).disposition)).map(t=>sourceSector(t,scene,grid)));
 if(!occupied.size)return null;const r={...route};for(let step=1;step<=cycleSteps(r);step++){shiftSteps(r,1n);if(occupied.has(r.waypoints[r.index]))return step;}return null;
}
export const encounterRecord=(sector,tokens)=>({sector,tokenIds:tokens.map(t=>t.id).sort()});
export const sameEncounter=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
