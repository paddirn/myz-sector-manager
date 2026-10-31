import {safeImageSource} from '../zone/presentation.mjs';
import {imagePath} from '../sector-images.mjs';
const requests=new WeakMap();
export function imagePreview(target,src,alt,missing='Image is missing or could not be loaded.',{env=globalThis,current=()=>true,onError}={}){
 if(!target)return;const request={};requests.set(target,request);const valid=()=>requests.get(target)===request&&current();target.replaceChildren();target.dataset.imageState='empty';
 const path=safeImageSource(src);if(target.getAttribute?.('role')==='img')target.setAttribute('aria-label',path?alt:missing);if(!path){target.textContent=missing;return;}
 const image=env.document.createElement('img');image.alt=alt;image.loading='lazy';image.decoding='async';image.draggable=false;target.dataset.imageState='loading';
 image.addEventListener('load',()=>{if(valid())target.dataset.imageState='ready';},{once:true});image.addEventListener('error',()=>{if(!valid())return;target.dataset.imageState='error';if(target.getAttribute?.('role')==='img')target.setAttribute('aria-label',missing);if(onError)onError();else target.textContent=missing;},{once:true});image.src=path;target.append(image);return image;
}
export async function pickImage({path='',current=()=>true,onSelect},env=globalThis){
 const Picker=env.foundry.applications.apps.FilePicker.implementation;
 return new Picker({type:'image',current:path,callback:value=>{if(!current())return;const selected=imagePath(value);if(!selected){env.ui.notifications.warn('Choose a supported image file path.');return;}onSelect(selected);}}).render(true);
}
