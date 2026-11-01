import {sectorOnScene} from '../sector-types.mjs';
import {canonicalCoordinate,coordinateToBounds} from '../zone/grid.mjs';
const MODULE='myz-sector-manager';
// Unknown/pending/authored records are not blank. Never bypass them with a transient context.
export function isBlankDestination(store,env,coordinate){
 if(!env.game.user.isGM)return false;
 const code=canonicalCoordinate(coordinate),scene=store.scene;
 try{if(!code||!scene||!coordinateToBounds(code,store.config.grid))return false;}catch{return false;}
 return !Array.from(env.game.journal.values?.()||env.game.journal).some(j=>{const sector=j.getFlag(MODULE,'sector');return sector&&sectorOnScene(sector,scene.id)&&canonicalCoordinate(sector.code)===code;});
}
