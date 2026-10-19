import {lootCollected} from './loot.mjs';
import {CONSUMABLES} from './sector-content.mjs';
// Shared offline vector primitives, in a 24×24 view box, for SVG and PIXI alike.
const line=(...points)=>({points});
const circle=(x,y,r)=>({circle:[x,y,r]});
export const SECTOR_ICONS=Object.freeze({
  terrain:{color:'#439c80',shapes:[line(2,20,9,6,15,17,18,12,23,20,2,20)]},
  rot:{color:'#b79425',shapes:[circle(12,12,2),line(9,8,6,3,2,9,8,11),line(15,8,18,3,22,9,16,11),line(9,16,8,22,16,22,15,16)]},
  encounters:{color:'#c96755',shapes:[line(3,3,19,19),line(21,3,5,19),line(13,19,19,13),line(5,13,11,19),line(2,22,6,18),line(22,22,18,18)]},
  phenomena:{color:'#a17acf',shapes:[line(14,2,4,14,11,14,9,22,21,9,13,9,14,2)]},
  loot:{color:'#b79425',shapes:[line(3,8,21,8,21,21,3,21,3,8,7,3,17,3,21,8),line(3,13,21,13),line(12,11,12,16)]},
  unknown:{color:'#8c969e',shapes:[circle(12,12,10),line(8,8,10,5,15,5,17,8,16,11,12,13,12,15),circle(12,19,.5)]},
  scouted:{color:'#568fbe',shapes:[line(1,12,6,6,12,4,18,6,23,12,18,18,12,20,6,18,1,12),circle(12,12,4)]},
  visited:{color:'#a58a53',shapes:[circle(7,6,3),line(8,10,11,15,9,22),line(11,15,17,20),line(8,10,4,16),line(9,11,17,11)]},
  explored:{color:'#439c80',shapes:[circle(12,12,10),line(6,12,10,16,18,8)]},
  cleared:{color:'#568fbe',shapes:[line(5,22,5,2,21,2,18,7,21,12,5,12),line(9,6,12,9,17,4)]},
  lost:{color:'#c96755',shapes:[circle(12,12,10),line(7,7,17,17),line(17,7,7,17)]}
});
export const STATUS_ICONS=Object.freeze({Unexplored:'unknown',Scouted:'scouted',Visited:'visited',Explored:'explored',Cleared:'cleared',Lost:'lost'});
export const escapeIconText=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function iconMarkup(icon,title){
  const definition=SECTOR_ICONS[icon]||SECTOR_ICONS.unknown;
  return `<svg class="sm-sector-icon" data-sector-icon="${escapeIconText(icon)}" viewBox="0 0 24 24" width="18" height="18" role="img" aria-label="${escapeIconText(title)}" style="color:${definition.color};vertical-align:middle;flex:none;background:#202327;border-radius:3px;padding:1px" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><title>${escapeIconText(title)}</title>${definition.shapes.map(shape=>shape.circle?`<circle cx="${shape.circle[0]}" cy="${shape.circle[1]}" r="${shape.circle[2]}"/>`:`<polyline points="${shape.points.reduce((out,v,i)=>out+(i%2?',':' ')+v,'').trim()}"/>`).join('')}</svg>`;
}
export function drawSectorIcon(PIXI,icon,size){
  const definition=SECTOR_ICONS[icon]||SECTOR_ICONS.unknown,graphics=new PIXI.Graphics();
  graphics.eventMode='none';graphics.sectorIcon=icon;
  // Contrast outline uses the same geometry and keeps colors readable over map art.
  for(const [width,color] of [[4,0x111111],[2,Number.parseInt(definition.color.slice(1),16)]]){
    graphics.lineStyle(width*size/24,color,1);
    for(const shape of definition.shapes){
      if(shape.circle){const [x,y,r]=shape.circle;graphics.drawCircle(x*size/24,y*size/24,r*size/24);}
      else{const p=shape.points;graphics.moveTo(p[0]*size/24,p[1]*size/24);for(let i=2;i<p.length;i+=2)graphics.lineTo(p[i]*size/24,p[i+1]*size/24);}
    }
  }
  return graphics;
}
export function sectorIndicators(data={}){
  const encounters=Array.isArray(data.encounters)?data.encounters.length:0;
  const phenomena=Array.isArray(data.effects)?data.effects.filter(entry=>entry?.category==='Phenomenon'||(!entry?.category&&entry?.generated?.threatCategory==='phenomenon')).length:0;
  const loot=(data.loot||[]).some(entry=>entry&&!lootCollected(entry)&&(['title','details','uuid'].some(key=>String(entry[key]??'').trim())||Number(entry.quantity)>0)&&(entry.quantity===undefined||Number(entry.quantity)>0))||Object.keys(CONSUMABLES).some(key=>Number(data.supplies?.[key]?.quantity)>0&&!data.supplies[key].collected);
  const result={terrain:{icon:'terrain',title:`Terrain: ${data.terrain||'Not assigned'}`,value:data.terrain||'',visible:Boolean(data.terrain)},rot:{icon:'rot',title:`Rot Level: ${data.rot??'Not assigned'}`,value:data.rot,visible:data.rot!==undefined&&data.rot!==null&&data.rot!==''},encounters:{icon:'encounters',title:`${encounters} ${encounters===1?'Inhabitant':'Inhabitants'}`,value:encounters,visible:encounters>0},phenomena:{icon:'phenomena',title:`${phenomena} ${phenomena===1?'Phenomenon':'Phenomena'}`,value:phenomena,visible:phenomena>0},loot:{icon:'loot',title:loot?'Uncollected Gear & Artifacts Available':'No Uncollected Gear & Artifacts',value:'',visible:loot},status:{icon:STATUS_ICONS[data.status]||'unknown',title:`Exploration Status: ${data.status||'Not assigned'}`,value:'',visible:Boolean(data.status)}};
  return result;
}
