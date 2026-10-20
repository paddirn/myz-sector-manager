import {MODULE,wanderingConfiguration} from './model.mjs';
import {sceneCellSize,tokenCenter,positionToCoordinate} from '../zone/grid.mjs';
export const MARKER_FLAG='lastKnownPosition',MARKER_KIND='wandering-last-known';
const values=collection=>Array.from(collection?.values?.()||[]);
export function markerMetadata(tile){const flag=tile?.getFlag?.(MODULE,MARKER_FLAG);return flag?.version===1&&flag.kind===MARKER_KIND?flag:null;}
export function ownsMarker(tile,token){const flag=markerMetadata(tile);return Boolean(flag&&flag.sourceSceneId===token.parent?.id&&flag.sourceTokenId===token.id);}
const stateFor=(token,phase,extra={})=>({version:1,sourceSceneId:token.parent.id,sourceTokenId:token.id,phase,tileId:null,...extra});
export class LastKnownPositions {
 constructor(store,env=globalThis){this.store=store;this.env=env;}
 assert(){if(!this.store.authoritative)throw new Error('Only the active GM can manage Last Known Positions.');}
 state(token){const state=token.getFlag(MODULE,MARKER_FLAG);if(!state)return null;if(state.version!==1)throw new Error('Unsupported Last Known Position state; original data preserved.');return state.sourceSceneId===token.parent.id&&state.sourceTokenId===token.id?state:null;}
 tiles(token){return values(token.parent.tiles).filter(tile=>ownsMarker(tile,token));}
 async set(token,state,extra={}){this.assert();await token.update({...extra,[`flags.${MODULE}.${MARKER_FLAG}`]:state},{myzWanderingMarker:true,animate:false});}
 async removeTiles(token){const tiles=this.tiles(token);if(tiles.length){this.assert();await token.parent.deleteEmbeddedDocuments('Tile',tiles.map(tile=>tile.id));}}
 async clear(token,{reset=false}={}){this.assert();this.state(token);await this.removeTiles(token);await this.set(token,stateFor(token,reset?'armed':'cleared',{allowHidden:reset&&token.hidden===true}));}
 async reconcile(token){
  this.assert();let state=this.state(token),tiles=this.tiles(token);
  if(!state){if(tiles.length){const tile=tiles[0],flag=markerMetadata(tile);state=stateFor(token,'active',{tileId:tile.id,originalHidden:flag.originalHidden,origin:flag.origin});await this.set(token,state);}else if(token.getFlag(MODULE,MARKER_FLAG)){await this.set(token,stateFor(token,'cleared'));}return state;}
  if(['preparing','moving'].includes(state.phase)){
   if(['pending','paused','moving','planned'].includes(token.movement?.state))return state;
   const atOrigin=token.x===state.origin?.x&&token.y===state.origin?.y;
   if(atOrigin){await this.removeTiles(token);await this.set(token,stateFor(token,'cleared'));}
   else if(tiles.length)await this.set(token,{...state,phase:'active',tileId:tiles[0].id});
   else await this.set(token,stateFor(token,'cleared'));
   return this.state(token);
  }
  if(state.phase==='active'&&!tiles.some(tile=>tile.id===state.tileId)){await this.removeTiles(token);await this.set(token,stateFor(token,'cleared'));return this.state(token);}
  if(['cleared','suppressed','armed'].includes(state.phase)&&tiles.length)await this.removeTiles(token);
  return state;
 }
 async artwork(token){
  const src=token.texture?.src;
  if(typeof src!=='string'||!src.trim()||/^(?:javascript|data|blob):/i.test(src)||/[\u0000-\u001f]/.test(src))throw new Error('Last Known Position: token artwork path is missing or unsafe.');
  const load=this.env.foundry?.canvas?.loadTexture;if(typeof load==='function'){const texture=await this.env.foundry.canvas.loadTexture(src,{fallback:null});if(!texture||texture.valid===false||texture.baseTexture?.valid===false)throw new Error(`Last Known Position: artwork could not be loaded: ${src}`);}
  return src;
 }
 async move(token,config,target,execute,validate=()=>this.assert()){
  if(!config.markers)return execute();
  this.assert();let state=await this.reconcile(token);validate();
  if(state?.phase==='active'){
   if(config.autoHide&&!token.hidden)await this.set(token,state,{hidden:true});
   return execute();
  }
  if(state&&state.phase!=='armed')return execute();
  if(token.hidden&&!state?.allowHidden){await this.set(token,stateFor(token,'suppressed',{originalHidden:true}));return execute();}
  const wasHidden=token.hidden===true;const src=await this.artwork(token);validate();if((token.hidden===true)!==wasHidden)throw new Error('Token visibility changed during marker preparation.');
  const origin={x:token.x,y:token.y},originalHidden=token.hidden===true,size=sceneCellSize(token.parent),operationId=this.env.foundry.utils.randomID();
  state=stateFor(token,'preparing',{origin,target:{x:target.x,y:target.y},originalHidden,operationId});
  await this.set(token,state);let hiddenByUs=false;
  try{
   this.assert();const texture={src,...Object.fromEntries(['scaleX','scaleY','tint'].filter(key=>token.texture[key]!==undefined).map(key=>[key,token.texture[key]]))};
   const [tile]=await token.parent.createEmbeddedDocuments('Tile',[{x:origin.x,y:origin.y,width:token.width*size.width,height:token.height*size.height,rotation:token.rotation||0,elevation:token.elevation||0,alpha:Math.min(1,Math.max(0,Number(token.alpha??1)))*.65,hidden:false,texture,flags:{[MODULE]:{[MARKER_FLAG]:{version:1,kind:MARKER_KIND,sourceSceneId:token.parent.id,sourceTokenId:token.id,createdAt:Date.now(),operationId,origin,originalHidden,sector:positionToCoordinate(tokenCenter(token,token.parent),this.store.config.grid),grayscale:config.grayscale}}}}]);
   if(!tile?.id)throw new Error('Last Known Position Tile creation returned no document.');
   validate();state={...state,phase:'moving',tileId:tile.id};await this.set(token,state,config.autoHide?{hidden:true}:{});hiddenByUs=config.autoHide&&!originalHidden;
   // No position update is sent until the hide + association update has completed.
   this.assert();const result=await execute();
   if(result===false)throw new Error('Wandering movement stopped or was prevented.');
   await this.set(token,{...state,phase:'active'});return result;
  }catch(error){
   if(this.store.authoritative){
    try{
     if(token.x===origin.x&&token.y===origin.y){await this.removeTiles(token);const restore=hiddenByUs&&token.x===origin.x&&token.y===origin.y?{hidden:originalHidden}:{};await this.set(token,stateFor(token,'armed',{allowHidden:originalHidden}),restore);}
     else{const tile=this.tiles(token)[0];await this.set(token,tile?{...state,phase:'active',tileId:tile.id}:stateFor(token,'cleared'));}
    }catch(cleanup){this.env.console?.error('MYZ Last Known Position recovery required',cleanup);}
   }
   throw error;
  }
 }
 async deletedToken(token){this.assert();await this.removeTiles(token);}
 async deletedTile(tile){const flag=markerMetadata(tile);if(!flag||flag.sourceSceneId!==tile.parent?.id)return;const token=tile.parent.tokens.get(flag.sourceTokenId);if(token&&this.state(token)?.tileId===tile.id)await this.set(token,stateFor(token,'cleared'));}
 async sceneReady(scene){this.assert();if(!scene)return;for(const token of values(scene.tokens))if(token.getFlag?.(MODULE,MARKER_FLAG)||this.tiles(token).length)await this.reconcile(token);for(const tile of values(scene.tiles)){const flag=markerMetadata(tile);if(flag?.sourceSceneId===scene.id&&!scene.tokens.get(flag.sourceTokenId)){this.assert();await scene.deleteEmbeddedDocuments('Tile',[tile.id]);}}}
 async clearScene(scene){this.assert();const tiles=values(scene?.tiles).filter(tile=>markerMetadata(tile)?.sourceSceneId===scene.id);if(tiles.length)await scene.deleteEmbeddedDocuments('Tile',tiles.map(tile=>tile.id));for(const token of values(scene.tokens))if(token.getFlag?.(MODULE,MARKER_FLAG)||tiles.some(tile=>ownsMarker(tile,token)))await this.set(token,stateFor(token,'cleared'));return tiles.length;}
}
const filters=new WeakMap();
// Local Tile mesh filter only: never mutate shared textures or other modules' filters.
export function styleMarker(tile,env=globalThis){
 const mesh=tile?.mesh;if(!mesh)return;const previous=filters.get(tile),wanted=markerMetadata(tile.document)?.grayscale;
 if(previous&&wanted&&previous.mesh===mesh&&(mesh.filters||[]).includes(previous.filter))return;
 if(previous){previous.mesh.filters=(previous.mesh.filters||[]).filter(filter=>filter!==previous.filter);previous.filter.destroy?.();filters.delete(tile);}
 if(!wanted)return;
 try{const Filter=env.PIXI?.ColorMatrixFilter||env.PIXI?.filters?.ColorMatrixFilter;if(!Filter)return;const filter=new Filter();filter.desaturate();mesh.filters=[...(mesh.filters||[]),filter];filters.set(tile,{mesh,filter});}catch(error){env.console?.warn('MYZ marker grayscale unavailable; original artwork retained.',error);}
}
