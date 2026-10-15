import {MODULE} from './store.mjs';
const ACTION='toggleZoneOverlay';
const normalize=value=>({CONTROL:'Control',CTRL:'Control',SHIFT:'Shift',ALT:'Alt',META:'Control',Meta:'Control'}[value]||value);
export const OVERLAY_BINDINGS=[
  {key:'KeyZ',modifiers:['Control','Shift']},
  {key:'KeyZ',modifiers:['Control','Alt','Shift']},
  {key:'KeyM',modifiers:['Control','Alt','Shift']}
];
export function bindingConflicts(candidate,binding,reserved=[]) {
  const logical=value=>(value.logicalKey||(value.key?.startsWith('Key')?value.key.slice(3):'')).toLowerCase();
  if(!(candidate.key&&candidate.key===binding.key)&&!(logical(candidate)&&logical(candidate)===logical(binding)))return false;
  const pressed=new Set((candidate.modifiers||[]).map(normalize)),required=new Set((binding.modifiers||[]).map(normalize)),optional=new Set(reserved.map(normalize));
  return [...required].every(key=>pressed.has(key))&&[...pressed].every(key=>required.has(key)||optional.has(key));
}
export function chooseOverlayBinding(actions,saved={}) {
  return OVERLAY_BINDINGS.find(candidate=>![...actions].some(([id,action])=>{
    const bindings=[...(action.uneditable||[]),...(Array.isArray(saved[id])?saved[id]:action.editable||[])];
    return bindings.some(binding=>bindingConflicts(candidate,binding,action.reservedModifiers||[]));
  }))||null;
}
export function registerOverlayShortcut(runtime) {
  const {game}=runtime.env;
  let saved={};try{saved=game.settings.get('core','keybindings')||{};}catch{/* Defaults are still checked before keybindings initialize. */}
  const binding=chooseOverlayBinding(game.keybindings.actions,saved);
  game.keybindings.register(MODULE,ACTION,{
    name:'Toggle Zone sector overlay',hint:'GM-only. Affects only the designated Zone Scene; change this shortcut in Configure Controls.',
    editable:binding?[binding]:[],restricted:true,repeat:false,
    onDown:()=>{
      if(!runtime.store.isGM||!runtime.store.scene||!runtime.store.config.grid||runtime.calibrator.active)return false;
      void runtime.toggleOverlay(true).catch(error=>runtime.env.ui.notifications.error(`Zone Map: ${error.message}`));return true;
    }
  });
  runtime.shortcutDefault=binding;
}
export function warnShortcutConflict(runtime) {
  const {game}=runtime.env;
  const own=`${MODULE}.${ACTION}`,bindings=game.keybindings?.bindings;
  if(!runtime.store.isGM||!bindings)return;
  const selected=bindings.get(own)||[];
  for(const [id,other] of bindings){
    if(id===own)continue;
    const reserved=game.keybindings.actions.get(id)?.reservedModifiers||[];
    if(selected.some(candidate=>other.some(binding=>bindingConflicts(candidate,binding,reserved)))){
      runtime.env.ui.notifications.warn('The Zone overlay shortcut conflicts with another active binding. Review Configure Controls → MYZ Sector Manager; your custom binding was preserved.');return;
    }
  }
}
