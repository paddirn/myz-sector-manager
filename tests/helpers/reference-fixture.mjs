import {REFERENCE_DEFINITIONS,REFERENCE_SETTING} from '../../scripts/document-references.mjs';
export const legacyReferenceConfiguration=()=>({formatVersion:1,references:Object.fromEntries(REFERENCE_DEFINITIONS.filter(def=>def.legacyUuid).map(def=>[def.key,{mode:'custom',uuid:def.legacyUuid}])),migration:{version:1,outcomes:[]}});
export function withLegacyReferences(env){
 env.game??={user:{isGM:true}};
 const get=env.game.settings?.get?.bind(env.game.settings);
 env.game.settings={...env.game.settings,get:(module,key)=>key===REFERENCE_SETTING?legacyReferenceConfiguration():get?.(module,key)};
 return env;
}
