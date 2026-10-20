import {coordinateToBounds,positionToCoordinate,tokenCenter,sceneCellSize,validateGrid} from '../zone/grid.mjs';
export const MODULE='myz-sector-manager',SETTING='wanderingConfiguration',FLAG='wanderingEnabled';
export const wanderingDefaults=()=>({version:1,enabled:true,maximum:2,frequency:'every',allowSpecial:false,markers:true,grayscale:true,autoHide:true});
export function validateWandering(raw){
 const next={...wanderingDefaults(),...raw};
 if(next.version!==1||typeof next.enabled!=='boolean'||typeof next.allowSpecial!=='boolean'||['markers','grayscale','autoHide'].some(key=>typeof next[key]!=='boolean')||!['every','quarter','manual'].includes(next.frequency)||!Number.isInteger(next.maximum)||next.maximum<1||next.maximum>6)throw new Error('Wandering Tokens: use a maximum of 1–6 and a supported frequency.');
 return next;
}
export const wanderingConfiguration=env=>validateWandering(env.game.settings.get(MODULE,SETTING)||wanderingDefaults());
const values=collection=>Array.from(collection?.values?.()||collection||[]);
export function playerControlled(token,env){
 const actor=token.actor;
 if(actor?.hasPlayerOwner===true)return true;
 const owner=env.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER??3;
 // Include offline users and default ownership; disposition never determines control.
 return values(env.game.users).some(user=>!user.isGM&&(actor?.testUserPermission?.(user,'OWNER')===true||token.testUserPermission?.(user,'OWNER')===true||Number(actor?.ownership?.[user.id]??actor?.ownership?.default??0)>=owner||Number(token.ownership?.[user.id]??token.ownership?.default??0)>=owner));
}
export function canModify(token,env){return env.game.user.isGM&&Boolean(token?.parent)&&typeof token.update==='function'&&(typeof token.canUserModify==='function'?token.canUserModify(env.game.user,'update'):token.isOwner===true);}
export function baseEligible(token,store,env,busy=new Set()){
 return store.scene?.tokens.get(token.id)===token&&token.parent?.id===store.scene?.id&&token.getFlag?.(MODULE,FLAG)===true&&canModify(token,env)&&!playerControlled(token,env)&&!store.config.groups.some(group=>group.sceneId===token.parent.id&&group.tokenId===token.id)&&!busy.has(token.uuid||token.id)&&!['pending','paused','moving','planned'].includes(token.movement?.state);
}
export function destinations(token,store,{allowSpecial=false}={}){
 const scene=store.scene,grid=store.config.grid;if(!scene||!grid)return [];
 try{validateGrid(grid);}catch{return [];}
 const center=tokenCenter(token,scene),code=positionToCoordinate(center,grid),source=coordinateToBounds(code,grid),size=sceneCellSize(scene);
 if(!source)return [];
 const width=token.width*size.width,height=token.height*size.height;
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>source.width||height>source.height)return [];
 const rect=scene.dimensions?.sceneRect||{x:scene.dimensions?.sceneX??0,y:scene.dimensions?.sceneY??0,width:scene.width,height:scene.height};
 if(![rect.x,rect.y,rect.width,rect.height].every(Number.isFinite))return [];
 const offsetX=Math.max(0,Math.min(token.x-source.x,source.width-width)),offsetY=Math.max(0,Math.min(token.y-source.y,source.height-height));
 return [[0,-1,'North'],[0,1,'South'],[1,0,'East'],[-1,0,'West']].flatMap(([dx,dy,direction])=>{
  const destination=positionToCoordinate({x:source.x+source.width/2+dx*source.width,y:source.y+source.height/2+dy*source.height},grid);
  const bounds=coordinateToBounds(destination,grid);if(!bounds)return [];
  if(!allowSpecial&&store.sectorRecords(destination).some(doc=>doc.getFlag(MODULE,'sector')?.sectorType==='special'))return [];
  const x=bounds.x+offsetX,y=bounds.y+offsetY;
  if(x<rect.x||y<rect.y||x+width>rect.x+rect.width||y+height>rect.y+rect.height)return [];
  return [{x,y,coordinate:destination,direction}];
 });
}
