// Official MYZ 14.0.4: module/data-model.js MYZArkDataModel and Ark sheet tabs.
export function requireArk(actor,env=globalThis){
 if(env.game?.system?.id!=='mutant-year-zero'||actor?.documentName!=='Actor'||actor.type!=='ark')throw new Error('Choose an official MYZ Ark Actor.');
 if(actor.testUserPermission&&!actor.testUserPermission(env.game.user,'OBSERVER'))throw new Error('Ark Actor is inaccessible.');
 return actor;
}
export function arkInformation(actor,env=globalThis){
 const s=requireArk(actor,env).system;
 return [['Population',s.population],['Coordinates',s.coordinates],['Water Source',s.water_source],...['food','culture','technology','warfare'].map(k=>[`Development: ${k}`,`${s.dev_levels?.[k]?.value??'—'} / ${s.dev_levels?.[k]?.max??'—'}`]),['Projects',Array.from(actor.items||[]).filter(i=>i.type==='project').map(i=>`${i.name}${i.system?.completed?' (completed)':''}`).join('\n')],['Artifacts',Array.from(actor.items||[]).filter(i=>i.type==='artifact').map(i=>i.name).join('\n')],['Bosses',Object.values(s.bosses||{}).map(b=>[b.name,b.type,b.description].filter(Boolean).join(' — ')).filter(Boolean).join('\n')],['Info',s.description]];
}
export async function hydrateArk(host,root=host.element,env=globalThis){
 const target=root.querySelector('[data-ark-information]');if(!target)return;
 const uuid=host.data.settlement.arkUuid,request=target.arkRequest=(target.arkRequest||0)+1;
 const current=()=>host.data.settlement.arkUuid===uuid&&target.arkRequest===request;
 if(!uuid){target.textContent='Drop an Ark Actor above or paste its UUID. The linked sheet remains the source of truth.';return;}
 try{
  const actor=requireArk(await env.fromUuid(uuid),env);if(!current())return;
  target.replaceChildren();const open=env.document.createElement('button');open.type='button';open.textContent=`Open Ark Sheet: ${actor.name}`;open.addEventListener('click',()=>actor.sheet.render(true));target.append(open);
  const dl=env.document.createElement('dl');dl.style.whiteSpace='pre-wrap';dl.style.overflowWrap='anywhere';
  for(const [label,value] of arkInformation(actor,env)){const dt=env.document.createElement('dt'),dd=env.document.createElement('dd');dt.textContent=label;dd.textContent=new env.DOMParser().parseFromString(String(value??''),'text/html').body.textContent;dl.append(dt,dd);}target.append(dl);
 }catch(error){if(current())target.textContent=`Linked Ark unavailable (${uuid}): ${error.message} Saved reference and Settlement data are retained.`;}
}
