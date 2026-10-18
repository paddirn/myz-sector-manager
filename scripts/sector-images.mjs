import {safeImageSource} from './zone/presentation.mjs';
// Store paths only, never embedded image bytes or temporary blob URLs.
export function imagePath(value){return typeof value==='string'&&!/^(?:data|blob):/i.test(value.trim())?safeImageSource(value):null;}
// Foundry v14 JournalEntryPage.Schema.src is the media URI; image contains caption metadata.
export function journalImageSource(page){return page?.documentName==='JournalEntryPage'&&page.type==='image'?imagePath(page.src):null;}
export function fitImage(width,height,region){
  if(!(width>0&&height>0&&region.width>0&&region.height>0))return null;
  const scale=Math.min(region.width/width,region.height/height);
  return {x:region.x+(region.width-width*scale)/2,y:region.y+(region.height-height*scale)/2,width:width*scale,height:height*scale};
}
export const SPECIAL_ACCENT=0x9563c9;
