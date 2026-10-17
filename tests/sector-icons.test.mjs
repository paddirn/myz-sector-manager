import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SECTOR_ICONS,STATUS_ICONS,sectorIndicators,iconMarkup,drawSectorIcon} from '../scripts/sector-icons.mjs';
import {overlayFixture} from './helpers/overlay-fixture.mjs';
test('shared SVG and PIXI icons use the same vector primitives and colors for every status',()=>{
  assert.equal(new Set(Object.values(STATUS_ICONS)).size,6);
  const {env}=overlayFixture();
  for(const [status,icon] of Object.entries(STATUS_ICONS)){
    assert.equal(sectorIndicators({status}).status.icon,icon);
    const markup=iconMarkup(icon,'Exploration Status: '+status);
    assert(markup.includes(`data-sector-icon="${icon}"`));assert(markup.includes(SECTOR_ICONS[icon].color));assert(markup.includes(`aria-label="Exploration Status: ${status}"`));
    const operations=[];class Graphics{lineStyle(...p){operations.push(['style',...p]);return this;}moveTo(...p){operations.push(['move',...p]);return this;}lineTo(...p){operations.push(['line',...p]);return this;}drawCircle(...p){operations.push(['circle',...p]);return this;}}
    const graphic=drawSectorIcon({Graphics},icon,24);assert.equal(graphic.sectorIcon,icon);assert(operations.some(p=>p[0]==='style'&&p[2]===parseInt(SECTOR_ICONS[icon].color.slice(1),16)));
    for(const shape of SECTOR_ICONS[icon].shapes){if(shape.circle){assert(markup.includes(`<circle cx="${shape.circle[0]}"`));assert(operations.some(p=>p[0]==='circle'&&JSON.stringify(p.slice(1))===JSON.stringify(shape.circle)));}else assert(operations.some(p=>p[0]==='move'&&p[1]===shape.points[0]&&p[2]===shape.points[1]));}
  }
});
test('indicators count entries, classify phenomena, retain explicit zero Rot, and escape current tooltip values',()=>{
  const data={terrain:'<script>custom</script>',rot:0,status:'Scouted',encounters:[{title:'Five mutants'},{title:'One beast'}],effects:[{category:'Weather'},{category:'Phenomenon'},{category:'Hazard'},{generated:{threatCategory:'phenomenon'}},{category:'Weather',generated:{threatCategory:'phenomenon'}}]};
  const before=structuredClone(data),info=sectorIndicators(data);assert.equal(info.encounters.value,2);assert.equal(info.encounters.title,'2 Encounters');assert.equal(info.phenomena.value,2);assert.equal(info.rot.visible,true);assert.equal(info.rot.title,'Rot Level: 0');assert.equal(info.status.icon,STATUS_ICONS.Scouted);assert(iconMarkup(info.terrain.icon,info.terrain.title).includes('&lt;script&gt;'));assert.deepEqual(data,before);
  assert.equal(sectorIndicators({encounters:[{}],effects:[{category:'Phenomenon'}]}).encounters.title,'1 Encounter');assert.equal(sectorIndicators({effects:[{category:'Phenomenon'}]}).phenomena.title,'1 Phenomenon');
  for(const key of ['terrain','rot','encounters','phenomena','loot','status'])assert.equal(sectorIndicators({})[key].visible,false,key);
  for(const rot of [null,undefined,''])assert.equal(sectorIndicators({rot}).rot.visible,false);
});
test('loot availability includes uncollected regular loot and known consumables without mutating quantities',()=>{
  for(const data of [{loot:[{title:'Artifact'}]},{loot:[{title:'Scrap',status:'Active',quantity:2}]},{supplies:{bullets:{quantity:.5,collected:false}}},{supplies:{components:{quantity:1}}}]){const before=structuredClone(data);assert.equal(sectorIndicators(data).loot.visible,true);assert.equal(sectorIndicators(data).loot.title,'Uncollected Loot Available');assert.deepEqual(data,before);}
  for(const data of [{loot:[{title:'Artifact',status:'Collected'}]},{loot:[{title:'Scrap',status:'Depleted'}]},{loot:[{title:'Scrap',quantity:0}]},{supplies:{bullets:{quantity:2,collected:true}}},{supplies:{cleanWater:{quantity:0,collected:false}}},{loot:[{status:'Active'}]}])assert.equal(sectorIndicators(data).loot.visible,false);
});
