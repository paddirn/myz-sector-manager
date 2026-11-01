const MODULE='myz-sector-manager';
// Opt-in, GM-local console only. No trace payloads are broadcast or persisted.
export function travelDebug(env,stage,details={}){
 if(!env.game?.user?.isGM)return;
 try{if(env.game.settings.get(MODULE,'travelEventsConfiguration')?.debug!==true)return;}catch{return;}
 env.console?.debug?.('MYZ Travel Events',stage,details);
}
