// v14 prepared x/y can still be animated. Persisted data is the verification source.
export function tokenSource(token){return typeof token?.toObject==='function'?token.toObject(true):token;}
export function tokenPosition(token){if(!token)return null;try{const s=tokenSource(token);return {x:s?.x,y:s?.y,hidden:Boolean(s?.hidden)};}catch{return null;}}
export const matchesPosition=(actual,expected)=>Boolean(actual&&expected&&['x','y','hidden'].every(k=>actual[k]===expected[k]));
export const routeProgress=r=>({index:r.index,direction:r.direction,progressMs:r.progressMs,lastTimeMs:r.lastTimeMs,...(r.scheduleState?{scheduleState:structuredClone(r.scheduleState)}:{})});
export function resultSummary(result){
 if(result===null||result===undefined||typeof result!=='object')return {type:typeof result,value:result??null};
 try{return {type:'document',id:result.id||null,...(typeof result.toObject==='function'?{position:tokenPosition(result)}:{})};}catch(error){return {type:'unreadable-result',message:error.message};}
}

export function restoreProgress(route,checkpoint){Object.assign(route,checkpoint);if(!checkpoint.scheduleState)delete route.scheduleState;return route;}
