export function safeImageSource(value) {
  if(typeof value!=='string'||!value.trim())return null;
  const source=value.trim();
  if(/[\u0000-\u001f]/.test(source)||/\.(webm|mp4|m4v|ogg)(?:[?#]|$)/i.test(source))return null;
  if(/^[a-z][a-z\d+.-]*:/i.test(source)&&!/^https?:/i.test(source)&&!/^blob:/i.test(source)&&!/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(source))return null;
  return source;
}
export async function portraitCandidates(track,scene,resolve) {
  const token=track.sceneId===scene?.id?scene.tokens.get(track.tokenId):null;
  let actor;
  if(track.actorUuid){try{actor=await resolve(track.actorUuid);}catch{/* Fall through to the token Actor or generic icon. */}}
  return [...new Set([token?.texture?.src,actor?.documentName==='Actor'?actor.img:null,token?.actor?.img].map(safeImageSource).filter(Boolean))];
}
