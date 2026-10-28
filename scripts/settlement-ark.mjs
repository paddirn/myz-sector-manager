import {canonicalCoordinate,coordinateToBounds} from './zone/grid.mjs';
import {sectorOnScene} from './sector-types.mjs';
// Official MYZ 14.0.4: module/data-model.js MYZArkDataModel and Ark sheet tabs.
export function requireArk(actor,env=globalThis){
 if(env.game?.system?.id!=='mutant-year-zero'||actor?.documentName!=='Actor'||actor.type!=='ark')throw new Error('Choose an official MYZ Ark Actor.');
 if(actor.testUserPermission&&!actor.testUserPermission(env.game.user,'OBSERVER'))throw new Error('Ark Actor is inaccessible.');
 return actor;
}
export function arkInformation(actor,env=globalThis){
 const s=requireArk(actor,env).system;
 return [['Population',s.population],['Coordinates',s.coordinates],['Water Source',s.water_source],...['food','culture','technology','warfare'].map(k=>[`Development: ${k}`,s.dev_levels?.[k]?.value??'—']),['Projects',Array.from(actor.items||[]).filter(i=>i.type==='project').map(i=>`${i.name}${i.system?.completed?' (completed)':''}`).join('\n')],['Artifacts',Array.from(actor.items||[]).filter(i=>i.type==='artifact').map(i=>i.name).join('\n')],['Bosses',Object.values(s.bosses||{}).map(b=>[b.name,b.type,b.description].filter(Boolean).join(' — ')).filter(Boolean).join('\n')],['Info',s.description]];
}
export async function hydrateArk(host,root=host.element,env=globalThis){
 const target=root.querySelector('[data-ark-information]');if(!target)return;
 const uuid=host.data.settlement.arkUuid,request=target.arkRequest=(target.arkRequest||0)+1;
 const current=()=>host.data.settlement.arkUuid===uuid&&target.arkRequest===request;
 const population=root.querySelector('[data-ark-population]'),coordinates=root.querySelector('[data-ark-coordinates]'),placement=root.querySelector('[data-ark-placement-warning]');
 const unavailable=()=>{if(population)population.value='Unavailable';if(coordinates)coordinates.value='Unavailable';if(placement)placement.textContent='Ark coordinate unavailable; existing sector placement retained.';};
 if(!uuid){target.textContent='Drop an Ark Actor above or paste its UUID. The linked sheet remains the source of truth.';return;}
 try{
  const actor=requireArk(await env.fromUuid(uuid),env);if(!current())return;
  if(population)population.value=String(actor.system?.population??'');if(coordinates)coordinates.value=String(actor.system?.coordinates??'');if(placement)placement.textContent=arkCoordinateState(actor,host.data,host.arkPlacementContext).message;
  target.replaceChildren();const open=env.document.createElement('button');open.type='button';open.textContent=`Open Ark Sheet: ${actor.name}`;open.addEventListener('click',()=>actor.sheet.render(true));target.append(open);
  const dl=env.document.createElement('dl');dl.style.whiteSpace='pre-wrap';dl.style.overflowWrap='anywhere';
  for(const [label,value] of arkInformation(actor,env)){const dt=env.document.createElement('dt'),dd=env.document.createElement('dd');dt.textContent=label;dd.textContent=new env.DOMParser().parseFromString(String(value??''),'text/html').body.textContent;dl.append(dt,dd);}target.append(dl);
 }catch(error){if(current()){unavailable();target.textContent=`Linked Ark unavailable (${uuid}): ${error.message} Saved reference and Settlement data are retained.`;}}
}

// Persisted snapshots are updated in the editor draft only, on Save Sector.
// Source UUIDs identify entries; manual records never acquire synchronization metadata.
export function synchronizeArkProjects(settlement,actor){
 if(settlement.projects!==undefined&&!Array.isArray(settlement.projects))throw new Error('Invalid Settlement Projects list; no data changed.');
 const arkUuid=settlement.arkUuid||'',projects=Array.isArray(settlement.projects)?settlement.projects:[];
 const available=actor?.uuid===arkUuid&&actor?.documentName==='Actor'&&actor.type==='ark';
 const sources=new Map(available?Array.from(actor.items||[]).filter(item=>item.type==='project'&&typeof item.uuid==='string'&&item.uuid).map(item=>[item.uuid,item]):[]);
 const next=[],seen=new Set(),used=new Set([...['projects','inhabitants','factions','events','threads','shops'].flatMap(key=>(settlement[key]||[]).map(p=>p.id)),...(settlement.shops||[]).flatMap(shop=>(shop.inventory||[]).map(p=>p.id))]);
 const linked=(previous,item)=>({...previous,uuid:item.uuid,title:item.name||'',referenceName:item.name||'',referenceType:'project',details:String(item.system?.description??''),status:typeof item.system?.completed==='boolean'?(item.system.completed?'Completed':'Not completed'):'',progress:String(item.system?.work_points??''),notes:String(item.system?.comment??''),arkSource:{...previous.arkSource,version:1,arkUuid,projectUuid:item.uuid,missing:false}});
 for(const entry of projects){
  if(!entry.arkSource){next.push(entry);continue;}
  const key=`${entry.arkSource.arkUuid}:${entry.arkSource.projectUuid}`;
  if(seen.has(key))continue;seen.add(key);
  const item=entry.arkSource.arkUuid===arkUuid?sources.get(entry.arkSource.projectUuid):null;
  next.push(item?linked(entry,item):{...entry,arkSource:{...entry.arkSource,missing:true}});
 }
 for(const [uuid,item] of sources){
  if(seen.has(`${arkUuid}:${uuid}`))continue;
  let hash=14695981039346656037n;for(const c of uuid)hash=BigInt.asUintN(64,(hash^BigInt(c.charCodeAt(0)))*1099511628211n);
  const base=`ark-project-${hash.toString(16)}`;let id=base,index=1;while(used.has(id))id=`${base}-${index++}`;used.add(id);
  next.push(linked({id},item));
 }
 return {projects:next,changed:JSON.stringify(projects)!==JSON.stringify(next)};
}
export async function synchronizeArkDraft(host,env=globalThis){
 const draft=host.draft;if(!draft?.settlement)return false;
 const uuid=draft.settlement.arkUuid;let actor;
 try{if(uuid)actor=requireArk(await env.fromUuid(uuid),env);}catch{/* retain missing snapshots */}
 if(host.draft!==draft||draft.settlement.arkUuid!==uuid)return false;
 const result=synchronizeArkProjects(draft.settlement,actor);
 if(result.changed){draft.settlement.projects=result.projects;host.markDirty();}
 return result.changed;
}

export function arkCoordinateState(actor,sector,context={}){
 const coordinate=canonicalCoordinate(actor?.system?.coordinates);
 if(!coordinate)return {state:'invalid',message:'Ark coordinate is empty or invalid; no automatic placement performed.'};
 if(!context?.sceneId||!context.grid)return {state:'unavailable',message:'Zone grid unavailable; Ark coordinate is display-only.'};
 if(!coordinateToBounds(coordinate,context.grid))return {state:'out-of-grid',message:'Ark coordinate is outside the Zone grid; no automatic placement performed.'};
 const sectorScene=sector.placement?.sceneId||sector.sceneId;
 if(sectorScene&&sectorScene!==context.sceneId)return {state:'foreign-scene',message:'Settlement belongs to another Scene; no cross-Scene placement performed.'};
 const occupying=Array.from(context.journals||[]).filter(j=>{const data=j.getFlag('myz-sector-manager','sector');return data?.version===1&&sectorOnScene(data,context.sceneId)&&canonicalCoordinate(data.code)===coordinate;});
 if(occupying.length>1)return {state:'ambiguous',message:'Multiple sectors occupy the Ark coordinate; no automatic placement performed.'};
 if(occupying.some(j=>j.id!==context.journalId))return {state:'occupied',message:'Another sector occupies the Ark coordinate; it will not be moved or replaced.'};
 if(canonicalCoordinate(sector.code)===coordinate)return {state:'matched',message:'Ark coordinates match this sector’s existing Zone placement.'};
 return {state:'manual',message:'Ark coordinate is valid, but automatic placement is unavailable. Use the existing GM Zone placement controls; saved placement is unchanged.'};
}
