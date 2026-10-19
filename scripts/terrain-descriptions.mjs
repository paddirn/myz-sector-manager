import {LEGACY_TERRAIN_UUIDS,REFERENCE_DEFINITIONS,referenceSelection,resolveConfiguredDocument,warnReferenceOnce} from './document-references.mjs';
import {journalBodyText} from './location-text.mjs';
export const TERRAIN_DESCRIPTION_TABLES=LEGACY_TERRAIN_UUIDS;
const key=value=>String(value||'').trim().replace(/\s+/g,' ').toLowerCase();
export async function terrainDescription(terrain,env=globalThis){
 const definition=REFERENCE_DEFINITIONS.find(def=>def.terrain&&key(def.terrain)===key(terrain));
 if(!definition)return null;
 const {uuid,mode}=referenceSelection(definition.key,env);if(mode==='disabled')return null;
 try{
  const table=await resolveConfiguredDocument(definition.key,env);
  const result=await table.roll({recursive:false});
  if(result?.results?.length!==1)throw new Error('Expected one text result');
  const raw=result.results[0];
  if(raw.documentUuid||raw.documentId)throw new Error('Expected a plain-text description');
  const text=journalBodyText(raw.description||raw.text||'',env);
  if(!text)throw new Error('Empty description');
  return text;
 }catch(error){const message=`Terrain description ${terrain} (${uuid}): ${error.message}. Existing Description retained.`;warnReferenceOnce(message,env);return null;}
}
