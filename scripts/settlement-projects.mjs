// Native MYZ Project work_points is a requirement string, never accumulated progress.
export function connectedProjectPlayers(env=globalThis){
 const assistant=env.CONST?.USER_ROLES?.ASSISTANT??3;
 return new Set(Array.from(env.game.users||[]).filter(u=>u.active&&!u.isGM&&(u.role===undefined||u.role<assistant)).map(u=>u.id)).size;
}
export function projectMultiplier(value){
 if(typeof value==='number')return Number.isSafeInteger(value)&&value>0?value:null;
 const match=String(value??'').trim().match(/^(\d+)\s*(?:(?:x|×|\*)\s*(?:number\s+of\s+PCs|PCs))?$/i);
 const n=match?Number(match[1]):NaN;return Number.isSafeInteger(n)&&n>0?n:null;
}
export function projectTotal(doc,env=globalThis){
 const multiplier=projectMultiplier(doc?.system?.work_points),players=connectedProjectPlayers(env),total=multiplier===null?null:multiplier*players;
 return total!==null&&Number.isSafeInteger(total)?total:null;
}
export const projectProgress=entry=>Number.isSafeInteger(entry?.workPoints)&&entry.workPoints>=0?entry.workPoints:0;
export const projectBucket=entry=>entry?.status==='Completed'?'Completed':entry?.status==='Not available'?'Not Available':'Not completed';
export function projectHeading(entry,total){
 const title=entry.title||entry.referenceName||'New Project';return entry.status==='Completed'?title:`${title} (${projectProgress(entry)}/${total===null?'?':total})`;
}
export function nextProjectProgress(entry,value,total){
 if(!Number.isSafeInteger(value)||value<0)throw new Error('Work Points must be a nonnegative integer.');
 const previous=projectProgress(entry);
 if(total!==null&&value>total&&value>previous)throw new Error('Work Points cannot exceed the current requirement. Existing progress is retained.');
 return {...entry,workPoints:value,...(value>previous&&total>0&&value>=total&&entry.status==='Not completed'?{status:'Completed'}:{})};
}
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
