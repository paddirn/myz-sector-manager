// Client-only view state. Capture at replacement time (not render start), so a
// user can scroll while asynchronous reference hydration is still in progress.
const selector='.sm-list,.sm-content,.sm-tabs,.sm-settings-menu,[data-shop-inventory],[data-shop-group-body],.sm-faction-gallery,.sm-inhabitant-description,.sm-image-preview,textarea,[data-scroll-key]';
const scope=root=>root?.dataset?.scrollScope||'';
function kind(el){for(const name of ['sm-list','sm-content','sm-tabs','sm-settings-menu','sm-faction-gallery','sm-inhabitant-description','sm-image-preview'])if(el.classList.contains(name))return name;return el.hasAttribute('data-shop-inventory')?'shop-inventory':el.hasAttribute('data-shop-group-body')?'shop-group':el.localName;}
export function scrollKey(el,root){
 if(el.matches('.sm-list'))return 'sidebar';if(el.matches('.sm-tabs'))return 'tabs';
 const context=scope(root),card=el.closest('[data-entry]'),group=el.closest('[data-shop-group]'),field=el.getAttribute('name');
 const owner=card?`entry:${card.dataset.entry}`:group?`group:${group.dataset.shopGroup}`:'view';
 const name=el.dataset.scrollKey||(field?(card?field.split('.').at(-1):field):kind(el));
 return `${context}|${owner}|${name}`;
}
const candidates=root=>root?.querySelectorAll?Array.from(root.querySelectorAll(selector)):[];
const clamp=(value,max)=>Math.max(0,Math.min(Number(value)||0,Math.max(0,max)));
function anchorId(el){for(const attr of ['data-entry','data-shop-entry','data-faction-member','data-project-group'])if(el.hasAttribute(attr))return [attr,el.getAttribute(attr)];return null;}
function anchorFor(el){if(!el.matches('.sm-content,[data-shop-inventory]')||!el.getBoundingClientRect)return null;const box=el.getBoundingClientRect();for(const item of el.querySelectorAll('[data-entry],[data-shop-entry]')){const rect=item.getBoundingClientRect();if(rect.height&&rect.bottom>box.top+1&&rect.top<box.bottom)return {id:anchorId(item),offset:rect.top-box.top};}return null;}
function findAnchor(el,anchor){if(!anchor?.id)return null;return Array.from(el.querySelectorAll(`[${anchor.id[0]}]`)).find(node=>node.getAttribute(anchor.id[0])===anchor.id[1]);}
export class ScrollKeeper {
 constructor(env=globalThis){this.env=env;this.states=new Map();this.pending=new Map();this.restored=new WeakSet();}
 capture(root){
  if(!root)return;for(const el of candidates(root)){const key=scrollKey(el,root);if(el.clientHeight===0&&this.states.has(key))continue;this.states.set(key,{top:el.scrollTop,left:el.scrollLeft,anchor:anchorFor(el)});}
  const active=root.ownerDocument?.activeElement;this.focus=null;if(active&&root.contains(active)){
   if(active.matches('[data-open]'))this.focus={sidebar:active.dataset.open};
   else if(active.matches('button')){const attr=['data-action','data-remove','data-entry-toggle','data-image-toggle','data-expand-all','data-collapse-all','data-shop-add-group','data-shop-remove','data-shop-refresh','data-shop-expand-all','data-shop-collapse-all','data-member-remove'].find(name=>active.hasAttribute(name));if(attr)this.focus={scope:scope(root),buttonAttr:attr,value:active.getAttribute(attr),entry:active.closest('[data-entry]')?.dataset.entry};}
   else if(active.matches('input,textarea,select')&&active.closest('.sm-content'))this.focus={scope:scope(root),entry:active.closest('[data-entry]')?.dataset.entry,name:active.name,field:active.name?.split('.').at(-1),sectorName:active.hasAttribute('data-sector-name'),start:active.selectionStart,end:active.selectionEnd};
  }
 }
 restore(root){
  this.disconnect();this.root=root;this.restored=new WeakSet();
  for(const el of candidates(root)){const key=scrollKey(el,root),saved=this.states.get(key);if(!saved)continue;let top=saved.top;const anchor=findAnchor(el,saved.anchor);if(anchor&&el.clientHeight)top=el.scrollTop+anchor.getBoundingClientRect().top-el.getBoundingClientRect().top-saved.anchor.offset;
   this.apply(el,{...saved,top});this.restored.add(el);
   if((el.clientHeight===0||Array.from(el.querySelectorAll('img')).some(img=>!img.complete))&&(top>el.scrollHeight-el.clientHeight||saved.left>el.scrollWidth-el.clientWidth))this.pending.set(el,{top,left:saved.left,expectedTop:el.scrollTop,expectedLeft:el.scrollLeft});
  }
  const saved=this.focus;if(saved){let control;if(saved.sidebar)control=Array.from(root.querySelectorAll('[data-open]')).find(el=>el.dataset.open===saved.sidebar);else if(saved.scope===scope(root)&&saved.buttonAttr)control=Array.from(root.querySelectorAll(`[${saved.buttonAttr}]`)).find(el=>el.getAttribute(saved.buttonAttr)===saved.value&&el.closest('[data-entry]')?.dataset.entry===saved.entry);else if(saved.scope===scope(root))control=Array.from(root.querySelectorAll('input,textarea,select')).find(el=>(saved.entry?el.name?.split('.').at(-1)===saved.field:el.name===saved.name)&&el.closest('[data-entry]')?.dataset.entry===saved.entry&&(!saved.sectorName||el.hasAttribute('data-sector-name')));if(control?.disabled&&saved.buttonAttr==='data-shop-remove')control=root.querySelector('[data-shop-inventory]');if(control&&!control.disabled&&control.getClientRects().length){control.focus({preventScroll:true});if(typeof saved.start==='number'&&['text','search','url','tel','password','textarea',undefined].includes(control.type))try{control.setSelectionRange(saved.start,saved.end);}catch{}}
  }
  const settle=()=>{if(this.root===root)this.settle();},intent=event=>{if(event.type==='keydown'&&!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','PageDown','PageUp','Home','End',' '].includes(event.key))return;this.releaseFor(event.target);},scroll=event=>{const p=this.pending.get(event.target);if(p&&(event.target.scrollTop!==p.expectedTop||event.target.scrollLeft!==p.expectedLeft))this.pending.delete(event.target);};
  for(const event of ['load','error','toggle'])root.addEventListener(event,settle,true);
  for(const event of ['wheel','touchstart','pointerdown','keydown'])root.addEventListener(event,intent,{capture:true,passive:true});root.addEventListener('scroll',scroll,true);
  const observer=this.env.ResizeObserver?new this.env.ResizeObserver(settle):null;for(const el of this.pending.keys()){observer?.observe(el);for(const child of el.children)observer?.observe(child);}
  this.cleanup=()=>{observer?.disconnect();for(const event of ['load','error','toggle'])root.removeEventListener(event,settle,true);for(const event of ['wheel','touchstart','pointerdown','keydown'])root.removeEventListener(event,intent,true);root.removeEventListener('scroll',scroll,true);};
 }
 apply(el,saved){const top=clamp(saved.top,el.scrollHeight-el.clientHeight),left=clamp(saved.left,el.scrollWidth-el.clientWidth);if(el.scrollTop!==top)el.scrollTop=top;if(el.scrollLeft!==left)el.scrollLeft=left;}
 settle(){for(const [el,p] of this.pending){if(!this.root?.contains(el)){this.pending.delete(el);continue;}if(el.scrollTop!==p.expectedTop||el.scrollLeft!==p.expectedLeft){this.pending.delete(el);continue;}this.apply(el,p);p.expectedTop=el.scrollTop;p.expectedLeft=el.scrollLeft;if(el.clientHeight&&el.scrollTop===p.top&&el.scrollLeft===p.left)this.pending.delete(el);}}
 releaseFor(node){for(const el of this.pending.keys())if(el===node||el.contains(node))this.pending.delete(el);}
 hasRestored(el){return this.restored.has(el);}
 disconnect(){this.cleanup?.();this.cleanup=null;this.pending.clear();this.root=null;}
}
