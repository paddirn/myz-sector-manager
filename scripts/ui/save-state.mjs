// Optimistic checks use the existing persisted record. Own partial writes advance
// only their acknowledged paths, so an unrelated remote edit stays detectable.
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export const sameRecord=(a,b)=>canonical(a)===canonical(b);
export function acknowledgePaths(baseline,journal,record,paths,clone=structuredClone){
 if(baseline?.journal!==journal)return;
 for(const path of paths){const parts=path.split('.');let source=record,target=baseline.record;for(const part of parts.slice(0,-1)){source=source?.[part];target[part]??={};target=target[part];}const key=parts.at(-1);if(source?.[key]===undefined)delete target[key];else target[key]=clone(source[key]);}
}
export function saveStatus(host){
 const draft=host.dirty?'● Unsaved changes':'Changes saved';
 if(host.busy)return 'Saving sector…';
 return host.saveNote?`${draft} · ${host.saveNote}`:draft;
}
