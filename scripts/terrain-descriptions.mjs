import {journalBodyText} from './location-text.mjs';
export const TERRAIN_DESCRIPTION_TABLES=Object.freeze(Object.fromEntries([
 ['Ash Desert','FMb1CJATTxsXLKNy'],['Crumbling Ruins','iOuf5HBkPTJRtai7'],['Dead Woods','DDIlg70LYjP70uGk'],['Decayed Ruins','cB0RcJZRY9SCZMIs'],['Derelict Industries','PlKYSGrma1BD3ZOw'],['Glasified Field','AFvYlL3SKE7TJlyy'],['Huge Crater','yJ2ZT69torV7PyQn'],['Marshlands','udnDBnBSFQz5NrJl'],['Overgrown Ruins','LJR12IhuWO5QidLz'],['Scrublands','6y7FfEQgbSGMO9Rk'],['Settlement','QmXrOSRquBrSMKgo'],['Thick Woods','5esCJTuBkL01hsE4'],['Unscathed Ruins','bf0HSWkE02OfTqK9']
].map(([name,id])=>[name,`RollTable.${id}`])));
const key=value=>String(value||'').trim().replace(/\s+/g,' ').toLowerCase();
export async function terrainDescription(terrain,env=globalThis){
 const uuid=Object.entries(TERRAIN_DESCRIPTION_TABLES).find(([name])=>key(name)===key(terrain))?.[1];
 if(!uuid)return null;
 try{
  const table=await env.fromUuid(uuid);
  if(table?.documentName!=='RollTable')throw new Error('RollTable missing or unavailable');
  if(table.testUserPermission&&!table.testUserPermission(env.game?.user,'OBSERVER'))throw new Error('RollTable permission denied');
  const result=await table.roll({recursive:false});
  if(result?.results?.length!==1)throw new Error('Expected one text result');
  const raw=result.results[0];
  if(raw.documentUuid||raw.documentId)throw new Error('Expected a plain-text description');
  const text=journalBodyText(raw.description||raw.text||'',env);
  if(!text)throw new Error('Empty description');
  return text;
 }catch(error){const message=`Terrain description ${terrain} (${uuid}): ${error.message}. Existing Description retained.`;env.console?.warn(message);env.ui?.notifications?.warn(message);return null;}
}
