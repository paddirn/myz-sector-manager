// Foundry v14: uuid identifies the embedded TableResult; documentUuid is its target.
// Read legacy *data* only, never deprecated accessors on live Foundry documents.
const ownData=(row,key)=>Object.getOwnPropertyDescriptor(row,key)?.value;
export function resultFields(row){
 const name=row.name??'',description=row.description??ownData(row,'text')??'';
 if(typeof name!=='string'||typeof description!=='string')throw new Error('Result Name and Description must be text.');
 return {name:name.trim(),description};
}
export function resultReference(row){
 if(row.documentUuid)return row.documentUuid;
 if(typeof row.getDocument==='function')return '';
 const collection=ownData(row,'documentCollection'),id=ownData(row,'documentId');
 if(collection&&id)return collection.includes('.')?`Compendium.${collection}.${id}`:`${collection}.${id}`;
 return '';
}
