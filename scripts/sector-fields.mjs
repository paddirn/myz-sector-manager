export const PATH_STUNT_IDS=['safePath','artifact','assessRot','bullets','grub','water','halfTime','rush','saferRoute'];
export function normalizePathStunts(value={}, {legacy=false}={}){
  const result={...value};for(const key of PATH_STUNT_IDS)result[key]=value[key]===true;
  if(legacy&&PATH_STUNT_IDS.slice(1).some(key=>result[key]))result.safePath=true;
  if(!result.safePath)for(const key of PATH_STUNT_IDS.slice(1))result[key]=false;
  return result;
}
export function normalizeThreatLevel(value,fallback=1){
  if(value===null||String(value).trim()==='')return fallback;
  const number=Number(value);return Number.isSafeInteger(number)&&number>=0?number:fallback;
}
export function sectorThreatLevel(data={}){return normalizeThreatLevel(data.threatLevel??data.randomization?.numericThreatLevel);}
export const threatDescriptor=value=>value>=9?'Unusually Dangerous Area':value>=5?'Central Zone':'Fringe Zone';
export function meaningfulText(value){
  const source=String(value??'');if(/<(?:img|video|audio)\b/i.test(source))return true;
  return Boolean(source.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]*>/g,'').replace(/&(?:nbsp|ensp|emsp|thinsp|hairsp|ZeroWidthSpace|Tab|NewLine);/gi,' ').replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(entity,code)=>{const n=parseInt(code.replace(/^x/i,''),/^x/i.test(code)?16:10);return n<=0x10ffff?String.fromCodePoint(n):entity;}).replace(/[\s\u200b-\u200d\ufeff]/g,''));
}
// Root threatLevel is canonical. Old generation metadata is read only as a
// migration fallback, then removed with Foundry's supported deletion operator.
export function cleanThreatRecord(data){
  const result=structuredClone(data);result.threatLevel=sectorThreatLevel(result);
  if(result.randomization){delete result.randomization.numericThreatLevel;delete result.randomization['-=numericThreatLevel'];}
  return result;
}
export function threatDeletion(prior){return prior?.randomization&&Object.hasOwn(prior.randomization,'numericThreatLevel')?{'flags.myz-sector-manager.sector.randomization.-=numericThreatLevel':null}:{};}
