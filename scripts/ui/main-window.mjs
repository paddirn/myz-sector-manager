const isMinimize=control=>/minimiz/i.test(control.action||'')||/fa-window-minimize/.test(control.icon||'')||control.label==='Minimize'||control.label==='APPLICATION.ACTIONS.Minimize';
// Called only by SectorManager; secondary apps inherit their untouched native controls.
export function mainFrameButtons(app,inherited=[]){
 const buttons=[...inherited];let minimize=buttons.find(isMinimize);
 if(minimize)buttons.splice(buttons.indexOf(minimize),1);
 else minimize={action:'myzMinimize',icon:'fa-solid fa-minus',label:'Minimize',onClick:()=>app.minimize()};
 const menu=buttons.findIndex(button=>button.action==='toggleControls');buttons.splice(menu<0?buttons.length:menu,0,minimize);return buttons;
}
export function positionMainMinimize(app){
 const header=app.window?.header||app.element?.querySelector?.('.window-header');if(!header)return;
 const controls=app.window?.controls||header.querySelector('[data-action="toggleControls"]');
 const button=Array.from(header.querySelectorAll('button')).find(node=>isMinimize({action:node.dataset.action,icon:node.className,label:node.getAttribute('aria-label')}));
 if(!button)return;button.type='button';button.title='Minimize';button.setAttribute('aria-label','Minimize');button.dataset.tooltip='Minimize';
 if(controls&&button.nextElementSibling!==controls)controls.before(button);
}
