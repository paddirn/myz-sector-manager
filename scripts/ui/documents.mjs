// Read-only Foundry document access. No persistent cache: concurrent UUID reads
// share one Promise, then it is removed; every consumer rechecks permissions.
const pending=new WeakMap();
export class ReferenceError extends Error {constructor(state,message){super(message);this.name='DocumentReferenceError';this.state=state;}}
export function validUuid(value){return typeof value==='string'&&Boolean(value.trim())&&value.length<=4096&&!/[\u0000-\u001f\u007f<>\[\]"{}]/.test(value);}
export function checkDocument(doc,types='',env=globalThis){
 if(!doc)throw new ReferenceError('missing','Reference could not be found; missing or inaccessible.');
 let permitted=false;try{const source=typeof doc.testUserPermission==='function'?doc:doc.parent;permitted=source?.testUserPermission?source.testUserPermission(env.game?.user,'OBSERVER')!==false:doc.visible!==false;}catch{}
 if(!permitted)throw new ReferenceError('inaccessible','Reference is inaccessible.');
 if(types&&!types.split('|').includes(doc.documentName))throw new ReferenceError('invalid',`This entry expects a ${types.replaceAll('|',' or ').replaceAll('JournalEntryPage','Journal Entry Page').replaceAll('JournalEntry','Journal Entry')} document.`);
 return doc;
}
export async function requireDocument(uuid,types='',env=globalThis){
 if(!validUuid(uuid))throw new ReferenceError('invalid','Invalid document UUID.');
 let reads=pending.get(env);if(!reads){reads=new Map();pending.set(env,reads);}
 let read=reads.get(uuid);if(!read){try{read=Promise.resolve(env.fromUuid(uuid));}catch(error){read=Promise.reject(error);}reads.set(uuid,read);}
 try{return checkDocument(await read,types,env);}catch(error){if(error instanceof ReferenceError)throw error;throw new ReferenceError('unavailable','Reference could not be resolved. Try again or replace it.');}finally{if(reads.get(uuid)===read)reads.delete(uuid);}
}
export async function resolveDocument(uuid,types='',env=globalThis){
 if(!uuid)return {state:'empty',doc:null};
 try{return {state:'valid',doc:await requireDocument(uuid,types,env)};}catch(error){return {state:error.state||'unavailable',doc:null,message:error.message};}
}
export function parseDocumentDrop(event,env=globalThis){
 let data;try{data=env.foundry.applications.ux.TextEditor.implementation.getDragEventData(event);}catch{throw new ReferenceError('invalid','Invalid drag data. Drop a Foundry document.');}
 if(!data||typeof data!=='object'||Array.isArray(data))throw new ReferenceError('invalid','Invalid drag data. Drop a Foundry document.');return data;
}
export async function openDocument(doc,event,env=globalThis){
 checkDocument(doc,'',env);
 if(doc.documentName&& !['Actor','Item','JournalEntry','JournalEntryPage','Scene'].includes(doc.documentName)){if(!doc.sheet?.render)throw new ReferenceError('unavailable','Document editor is unavailable.');return doc.sheet.render(true);}
 if(doc.documentName==='Scene'&&typeof doc.view==='function')return doc.view();
 // Use the native click contract: never Scene.activate, Macro.execute or show-to-players.
 if(typeof doc._onClickDocumentLink==='function')return doc._onClickDocumentLink(event);
 if(doc.documentName==='JournalEntryPage'&&doc.parent?.sheet?.render)return doc.parent.sheet.render(true,{pageId:doc.id});
 if(doc.sheet?.render)return doc.sheet.render(true);
 throw new ReferenceError('unavailable','Document view is unavailable.');
}
export function currentReferenceNode(host,node){const root=node?.closest?.('.sm-root');return !host.referenceClosed&&(!root||!host.referenceRoot||root===host.referenceRoot);}
