const isMinimize=control=>/minimiz/i.test(control.action||'')||['maximize','restore'].includes(control.action)||/fa-window-(minimize|restore)/.test(control.icon||'')||['Minimize','Restore','APPLICATION.ACTIONS.Minimize'].includes(control.label);
const appearance=app=>app.minimized?{label:'Restore',icon:'fa-solid fa-window-restore'}:{label:'Minimize',icon:'fa-solid fa-minus'};
const transitions=new WeakMap();
// Frame buttons dispatch data-action through DEFAULT_OPTIONS.actions, not metadata callbacks.
export function mainFrameButtons(app,inherited=[]){
 const buttons=[...inherited],existing=buttons.find(isMinimize);if(existing)buttons.splice(buttons.indexOf(existing),1);
 const {onClick,...metadata}=existing||{};
 const minimize={...metadata,...appearance(app),action:'myzMinimize'};
 const menu=buttons.findIndex(button=>button.action==='toggleControls');buttons.splice(menu<0?buttons.length:menu,0,minimize);return buttons;
}
export async function toggleMainMinimize(app,env=globalThis){
 if(transitions.has(app))return transitions.get(app);
 const task=Promise.resolve().then(async()=>{const restore=Boolean(app.minimized);if(restore)await app.maximize();else await app.minimize();if(Boolean(app.minimized)===restore)throw Error(`Native window ${restore?'restoration':'minimization'} did not complete.`);}).catch(error=>{env.console?.error('MYZ Sector Manager window control',error);env.ui?.notifications?.error('Sector Manager could not change window state. See the console for details.');}).finally(()=>{transitions.delete(app);positionMainMinimize(app);});
 transitions.set(app,task);return task;
}
export function positionMainMinimize(app){
 const header=app.window?.header||app.element?.querySelector?.('.window-header');if(!header)return;
 const controls=app.window?.controls||header.querySelector('[data-action="toggleControls"]');
 const button=Array.from(header.querySelectorAll('button')).find(node=>isMinimize({action:node.dataset.action,icon:node.className,label:node.getAttribute('aria-label')}));
 if(!button)return;const {label,icon}=appearance(app);button.type='button';button.title=label;button.setAttribute('aria-label',label);button.dataset.tooltip=label;
 const glyph=button.querySelector('i')||button;glyph.classList.remove('fa-minus','fa-window-minimize','fa-window-restore');glyph.classList.add(...icon.split(' '));
 if(controls&&button.nextElementSibling!==controls)controls.before(button);
}
