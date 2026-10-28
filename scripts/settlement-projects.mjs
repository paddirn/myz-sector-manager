// Native MYZ Project work_points is a requirement string, never accumulated progress.
export function connectedProjectPlayers(env=globalThis){
 const assistant=env.CONST?.USER_ROLES?.ASSISTANT??3;
 return new Set(Array.from(env.game.users||[]).filter(u=>u.active&&!u.isGM&&(u.role===undefined||u.role<assistant)).map(u=>u.id)).size;
}
export function projectMultiplier(value){
 try{const match=String(value??'').replaceAll('−','-').match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i),n=match?Number(match[0]):NaN;return Number.isFinite(n)&&n>0&&n<=Number.MAX_SAFE_INTEGER?n:null;}catch{return null;}
}
export function projectRequirement(doc,env=globalThis){
 const multiplier=projectMultiplier(doc?.system?.work_points),players=Math.max(1,connectedProjectPlayers(env)),total=multiplier===null?null:multiplier*players;
 if(total===null||!Number.isFinite(total)||total>Number.MAX_SAFE_INTEGER)return {total:null,diagnostic:'Required Work Points unavailable: the linked MYZ Project system.work_points field must contain a positive numeric multiplier.'};
 return {total,diagnostic:`Multiplier ${multiplier} × ${players} effective connected player${players===1?'':'s'} (minimum 1).`};
}
export const projectTotal=(doc,env=globalThis)=>projectRequirement(doc,env).total;
export const projectProgress=entry=>Number.isSafeInteger(entry?.workPoints)&&entry.workPoints>=0?entry.workPoints:0;
export const projectBucket=entry=>entry?.status==='Completed'?'Completed':entry?.status==='Not available'?'Not Available':projectProgress(entry)>0?'Not completed':'Not started';
export function projectHeading(entry,total){
 const title=entry.title||entry.referenceName||'New Project';return ['Completed','Not available'].includes(entry.status)?title:`${title} (${projectProgress(entry)}/${total===null?'?':total})`;
}
export function nextProjectProgress(entry,value,total){
 if(!Number.isSafeInteger(value)||value<0)throw new Error('Work Points must be a nonnegative integer.');
 return {...entry,workPoints:value};
}
export const projectReady=(entry,total)=>entry?.status==='Not completed'&&total!==null&&total>0&&projectProgress(entry)>=total;
export async function writeArkProjectStatus(settlement,entry,status,env=globalThis){
 if(!['Not completed','Completed','Not available'].includes(status))throw new Error('Choose a valid Project Status.');
 if(!env.game.user.isGM)throw new Error('Only a GM may update Projects.');
 if(!entry.arkSource)return;
 const source=entry.arkSource;
 if(source.arkUuid!==settlement.arkUuid||source.missing)throw new Error('Ark Project source is unavailable; saved data was retained.');
 const actor=await env.fromUuid(source.arkUuid);
 if(actor?.documentName!=='Actor'||actor.type!=='ark'||!actor.testUserPermission?.(env.game.user,'OWNER'))throw new Error('Owner permission on the linked Ark is required.');
 const item=Array.from(actor.items||[]).find(i=>i.uuid===source.projectUuid&&i.type==='project');
 if(!item||item.parent?.uuid!==actor.uuid||!item.id)throw new Error('The linked Ark Project is missing; no other Project was changed.');
 const completed=status==='Completed';if(item.system.completed===completed)return;
 await actor.updateEmbeddedDocuments('Item',[{_id:item.id,'system.completed':completed}]);
}
