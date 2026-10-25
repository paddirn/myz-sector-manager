export function settingsMenu(host,runtime,env=globalThis){
 if(!env.game.user.isGM)return '';
 const record=host.journal?.getFlag?.('myz-sector-manager','sector');
 return `<div class="sm-settings"><button type="button" data-sm-settings popovertarget="myz-sector-settings-menu" popovertargetaction="toggle" aria-label="Sector Manager Settings" title="Sector Manager Settings" aria-haspopup="menu" aria-expanded="false" aria-controls="myz-sector-settings-menu"><i class="fa-solid fa-gear" aria-hidden="true"></i></button><div id="myz-sector-settings-menu" class="sm-settings-menu" data-sm-settings-menu popover="auto" role="menu" aria-label="Sector Manager Settings">${runtime.settingsActions()}<hr><button type="button" data-sector-import role="menuitem">Import Sector</button><button type="button" data-sector-export role="menuitem" ${!record||record.version!==1||record.initialSavePending?'disabled':''}>Export Sector</button></div></div>`;
}
export function bindSettingsMenu(host,runtime,{onImport,onExport},env=globalThis){
 const button=host.element.querySelector('[data-sm-settings]'),menu=host.element.querySelector('[data-sm-settings-menu]');if(!button||!menu||!env.game.user.isGM)return;
 const open=()=>menu.matches(':popover-open'),buttons=()=>Array.from(menu.querySelectorAll('button:not(:disabled)'));
 const close=()=>{if(open())menu.hidePopover();button.setAttribute('aria-expanded','false');};
 const place=()=>{if(!open())return;const rect=button.getBoundingClientRect(),box=menu.getBoundingClientRect(),width=env.innerWidth||env.document.documentElement.clientWidth,height=env.innerHeight||env.document.documentElement.clientHeight;menu.style.left=`${Math.max(8,Math.min(rect.right-box.width,width-box.width-8))}px`;menu.style.top=`${Math.max(8,Math.min(rect.bottom+4,height-box.height-8))}px`;};host.settingsMenuReposition=place;
 for(const item of menu.querySelectorAll('button')){item.setAttribute('role','menuitem');item.addEventListener('click',()=>{close();button.focus();});}
 runtime.bindSummary(menu);
 const run=fn=>()=>{if(!env.game.user.isGM)return;Promise.resolve().then(fn).catch(error=>env.ui.notifications.error(`Sector transfer: ${error.message}`));};
 menu.querySelector('[data-sector-import]').addEventListener('click',run(onImport));menu.querySelector('[data-sector-export]').addEventListener('click',run(onExport));
 button.addEventListener('click',()=>{queueMicrotask(()=>{button.setAttribute('aria-expanded',String(open()));place();if(open())buttons()[0]?.focus();});});
 menu.addEventListener('toggle',event=>{button.setAttribute('aria-expanded',String(open()));place();if(event.newState==='open')buttons()[0]?.focus();});
 menu.addEventListener('keydown',event=>{const items=buttons(),index=items.indexOf(env.document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();items[event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();button.focus();}});
}

export function refreshSettingsMenu(host,runtime){
 const menu=host.element?.querySelector('[data-sm-settings-menu]');if(!menu)return;
 const scene=runtime.store.scene,config=runtime.store.config;
 for(const [key,disabled] of [['view',!scene],['select',!runtime.store.live||!config.grid],['overlay',!scene||!config.grid]]){const button=menu.querySelector(`[data-zone-${key}]`);if(button)button.disabled=disabled;}
 const overlay=menu.querySelector('[data-zone-overlay]');if(overlay){overlay.textContent=`${config.overlay.enabled?'Hide':'Show'} overlay`;overlay.setAttribute('aria-pressed',String(Boolean(config.overlay.enabled)));}
}
