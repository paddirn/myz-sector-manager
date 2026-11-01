// Persist symbolic keys; resolve numeric values through Foundry's runtime constants.
export const DISPOSITIONS=Object.freeze([
 Object.freeze({key:'NEUTRAL',label:'Neutral'}),Object.freeze({key:'FRIENDLY',label:'Friendly'}),
 Object.freeze({key:'SECRET',label:'Secret'}),Object.freeze({key:'HOSTILE',label:'Hostile'})
]);
export function dispositionFilter(raw){
 if(raw===undefined)return ['HOSTILE'];
 if(!Array.isArray(raw)||new Set(raw).size!==raw.length||raw.some(key=>!DISPOSITIONS.some(d=>d.key===key)))throw Error('Invalid patrol disposition filters. Original route data retained.');
 return DISPOSITIONS.filter(d=>raw.includes(d.key)).map(d=>d.key);
}
export function dispositionDefinitions(env){
 const constants=env.CONST?.TOKEN_DISPOSITIONS;
 if(!constants||DISPOSITIONS.some(d=>typeof constants[d.key]!=='number'||!Number.isFinite(constants[d.key]))||new Set(DISPOSITIONS.map(d=>constants[d.key])).size!==4)throw Error('Foundry Token Disposition constants are unavailable or invalid.');
 return DISPOSITIONS.map(d=>({...d,value:constants[d.key]}));
}
export function selectedValues(route,env){const keys=dispositionFilter(route.stopDispositions);return new Set(dispositionDefinitions(env).filter(d=>keys.includes(d.key)).map(d=>d.value));}
