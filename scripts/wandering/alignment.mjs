import {MODULE,canModify,playerControlled,wanderingConfiguration} from './model.mjs';
import {captureMarkerSource,markerTileData,ALIGNMENT_KIND,MARKER_FLAG} from './markers.mjs';
const values=collection=>Array.from(collection?.values?.()||[]);
const point=value=>value?Object.fromEntries(['x','y'].map(key=>[key,Number(value[key])])):null;
const rect=value=>value?Object.fromEntries(['x','y','width','height'].map(key=>[key,Number(value[key])])):null;
const matrix=value=>value?Object.fromEntries(['a','b','c','d','tx','ty'].map(key=>[key,Number(value[key])])):null;
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function alignmentMetadata(tile){const flag=tile?.getFlag?.(MODULE,MARKER_FLAG);return flag?.version===1&&flag.kind===ALIGNMENT_KIND&&flag.sourceSceneId===tile.parent?.id?flag:null;}
// Tile placeable and primary mesh can have different parents; local (0,0) alone is not a placement error.
export function inspectArtwork(placeable,env=globalThis){
 if(!placeable)return {available:false};const mesh=placeable.mesh;
 let canvasBounds=null,boundsMethod=null,error=null;
 try{
  mesh?.updateCanvasTransform?.();
  if(mesh?.canvasBounds){canvasBounds=rect(mesh.canvasBounds);boundsMethod='native mesh.canvasBounds (Scene canvas space)';}
  else if(mesh?.getBounds&&env.canvas?.stage?.worldTransform?.applyInverse){
   const world=mesh.getBounds();const corners=[[world.x,world.y],[world.x+world.width,world.y],[world.x+world.width,world.y+world.height],[world.x,world.y+world.height]].map(([x,y])=>env.canvas.stage.worldTransform.applyInverse({x,y}));
   const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);canvasBounds={x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};boundsMethod='world AABB converted through inverse stage transform (approximation under rotation)';
  }
 }catch(cause){error=cause.message;}
 const transforms=object=>object?{class:object.constructor?.name,position:point(object.position),pivot:point(object.pivot),anchor:point(object.anchor),scale:point(object.scale),rotation:object.rotation,angle:object.angle,worldTransform:matrix(object.worldTransform),canvasTransform:matrix(object.canvasTransform),parentClass:object.parent?.constructor?.name}:null;
 const parents=[];let parent=mesh?.parent;const seen=new Set();while(parent&&parents.length<6&&!seen.has(parent)){seen.add(parent);parents.push(transforms(parent));parent=parent.parent;}
 return {parents,available:true,placeable:transforms(placeable),mesh:transforms(mesh),canvasBounds,boundsMethod,error,texture:mesh?.texture?{width:mesh.texture.width,height:mesh.texture.height,orig:rect(mesh.texture.orig),frame:rect(mesh.texture.frame),rotate:mesh.texture.rotate}:null,shader:mesh?.shader?.constructor?.name,filters:mesh?.filters?.map(filter=>filter.constructor?.name)||[]};
}
export function alignmentReport(token,tile,source,env=globalThis){
 const tokenRender=inspectArtwork(token.object,env),tileRender=inspectArtwork(tile.object,env);
 const current=typeof token.toObject==='function'?token.toObject(true):token;
 const a=tokenRender.canvasBounds,b=tileRender.canvasBounds;const textureDifferences=Object.fromEntries(Object.entries(source.texture).filter(([key,value])=>String(tile.texture?.[key])!==String(value)).map(([key,value])=>[key,{expected:value,actual:tile.texture?.[key]}]));
 return {status:a&&b?'Canvas bounds available; visual overlap still requires GM verification.':'Waiting for rendered mesh/canvas bounds. Use Compare after the Tile appears.',
  note:'Tile placeable local (0,0) can be normal: inspect its primary mesh and Scene-space bounds. Bounds equality alone does not prove identical pixels or shader behavior.',
  sourceCapture:source,tokenDocument:{x:current.x,y:current.y,width:current.width,height:current.height,elevation:current.elevation,alpha:current.alpha,rotation:current.rotation,lockRotation:current.lockRotation,ring:current.ring,texture:current.texture},tileDocument:{x:tile.x,y:tile.y,width:tile.width,height:tile.height,elevation:tile.elevation,rotation:tile.rotation,alpha:tile.alpha,texture:tile.texture},
  intendedOrientation:current.lockRotation?'Token artwork rotation locked.':'Token artwork may follow document rotation; marker document remains upright. Compare mesh transforms before choosing a remedy.',
  documentDelta:{x:tile.x-source.x,y:tile.y-source.y,width:tile.width-source.width,height:tile.height-source.height,rotationFromUpright:tile.rotation,elevation:tile.elevation-(source.elevation+1)},textureDifferences,sourceMovedSinceCapture:current.x!==source.x||current.y!==source.y,
  unsupportedArtworkFeatures:{unlockedTokenRotation:!source.orientation?.lockRotation&&Boolean(source.orientation?.rotation),dynamicTokenRing:source.orientation?.ringEnabled===true},
  tokenRender,tileRender,canvasBoundsDelta:a&&b?Object.fromEntries(['x','y','width','height'].map(key=>[key,b[key]-a[key]])):null,
  enabledModules:values(env.game.modules).filter(module=>module.active).map(module=>({id:module.id,version:module.version})),foundryVersion:env.game.version};
}
export class MarkerAlignment {
 constructor(service,env=globalThis){this.service=service;this.store=service.store;this.env=env;this.sessions=new Set();}
 tests(scene){return values(scene?.tiles).filter(alignmentMetadata);}
 hasTest(token){return this.tests(token.parent).some(tile=>alignmentMetadata(tile).sourceTokenId===token.id);}
 assertToken(token){this.service.assertAuthority();if(!canModify(token,this.env)||token.parent?.id!==this.env.canvas?.scene?.id||token.hidden||playerControlled(token,this.env)||this.store.config.groups.some(group=>group.sceneId===token.parent.id&&group.tokenId===token.id))throw new Error('Select one visible, modifiable NPC on the viewed Scene for the alignment test.');if(['pending','paused','moving','planned'].includes(token.movement?.state))throw new Error('Stop token movement before testing alignment.');}
 async remove(scene,ids){this.service.assertAuthority();const allowed=this.tests(scene).filter(tile=>ids.includes(tile.id)).map(tile=>tile.id);if(allowed.length)await scene.deleteEmbeddedDocuments('Tile',allowed);for(const id of ids)this.sessions.delete(id);}
 async clear(scene){return this.service.enqueue(()=>this.remove(scene,this.tests(scene).map(tile=>tile.id)));}
 async clearOrphans(scene){const ids=this.tests(scene).filter(tile=>{const owner=alignmentMetadata(tile).ownerId;return !this.sessions.has(tile.id)&&(owner===this.env.game.user.id||this.env.game.users.get?.(owner)?.active===false);}).map(tile=>tile.id);await this.remove(scene,ids);}
 async launch(token){
  const env=this.env,scene=token?.parent;let tile,source;
  await this.service.enqueue(async()=>{
   this.assertToken(token);if(this.hasTest(token))throw new Error('Remove the existing temporary alignment marker first.');source=captureMarkerSource(token,this.store.config.grid);await this.service.markers.artwork(source);this.assertToken(token);
   if(token.x!==source.x||token.y!==source.y)throw new Error('Token moved while preparing the alignment test.');
   const [created]=await scene.createEmbeddedDocuments('Tile',[markerTileData(token,source,wanderingConfiguration(env),{operationId:env.foundry.utils.randomID(),kind:ALIGNMENT_KIND,ownerId:env.game.user.id,alpha:1,grayscale:false})]);
   if(!created?.id)throw new Error('Alignment Tile creation failed.');tile=created;this.sessions.add(tile.id);
  });
  let report,root;
  const compare=()=>{report=alignmentReport(token,tile,source,env);if(root?.querySelector('[data-alignment-report]'))root.querySelector('[data-alignment-report]').textContent=JSON.stringify(report,null,2);env.console?.info?.('MYZ marker alignment comparison',report);return report;};
  try{
   await env.foundry.applications.api.DialogV2.wait({window:{title:'Temporary Marker Alignment Test',resizable:true},position:{width:650},content:`<div style="max-height:65vh;overflow:auto;overflow-wrap:anywhere"><p>The NPC stays visible and stationary. This temporary Tile uses the permanent marker builder. Native movement excludes this NPC while its test Tile exists.</p><p>Start with grayscale off and opacity 1. Compare artwork in the Scene, then change one option at a time.</p><label><input type="checkbox" data-alignment-gray> Grayscale</label><label>Opacity <select data-alignment-alpha><option value="1">1 — full opacity</option><option value="${escape(source.alpha)}">${escape(source.alpha)} — configured marker opacity</option></select></label><button type="button" data-alignment-compare>Compare / Refresh Report</button><button type="button" data-alignment-copy>Copy Report</button><pre data-alignment-report style="white-space:pre-wrap"></pre></div>`,buttons:[{action:'close',label:'Close and Remove Test Marker',default:true,callback:()=>true}],rejectClose:false,close:()=>true,
    render:(_event,dialog)=>{
     root=dialog.element;compare();const run=callback=>async()=>{try{this.service.assertAuthority();await callback();compare();}catch(error){env.ui.notifications.warn(error.message);}};
     root?.querySelector('[data-alignment-compare]')?.addEventListener('click',run(()=>{}));
     root?.querySelector('[data-alignment-gray]')?.addEventListener('change',run(async()=>{await tile.update({[`flags.${MODULE}.${MARKER_FLAG}.grayscale`]:root.querySelector('[data-alignment-gray]').checked});}));
     root?.querySelector('[data-alignment-alpha]')?.addEventListener('change',run(async()=>{await tile.update({alpha:Number(root.querySelector('[data-alignment-alpha]').value)});}));
     root?.querySelector('[data-alignment-copy]')?.addEventListener('click',run(async()=>{await env.navigator.clipboard.writeText(JSON.stringify(compare(),null,2));}));
    }});
   return compare();
  }finally{if(tile&&this.store.authoritative)await this.service.enqueue(()=>this.remove(scene,[tile.id]));}
 }
}
