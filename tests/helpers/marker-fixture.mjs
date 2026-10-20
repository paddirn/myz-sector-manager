import {fixture} from './zone-fixture.mjs';
import {WanderingTokens} from '../../scripts/wandering/service.mjs';
import {MODULE,SETTING,wanderingDefaults} from '../../scripts/wandering/model.mjs';
export function markerFixture(){
 const f=fixture(),events=[],warnings=[],flags={},fail={};let sequence=0;f.zone.tiles=new Map();f.settings.set(SETTING,wanderingDefaults());
 const get=f.configDoc.getFlag.bind(f.configDoc);f.configDoc.getFlag=(m,k)=>k==='zoneConfiguration'?get(m,k):flags[k];f.configDoc.setFlag=async(m,k,v)=>flags[k]=structuredClone(v);
 f.env.console={error(){},warn(){}};f.env.ui.notifications={warn:message=>warnings.push(message),info(){},error(){}};
 f.env.foundry.utils={randomID:()=>`id${++sequence}`};f.env.foundry.canvas={loadTexture:async src=>{if(fail.image)throw Error('Image unavailable');return {valid:true,src};}};
 f.zone.createEmbeddedDocuments=async(type,rows)=>{events.push('tile-create');if(fail.tile)throw Error('Tile creation denied');if(type!=='Tile')throw Error('Unexpected document type');return rows.map(data=>{const doc={...structuredClone(data),id:`tile${++sequence}`,parent:f.zone,getFlag(m,k){return this.flags?.[m]?.[k];}};f.zone.tiles.set(doc.id,doc);return doc;});};
 f.zone.deleteEmbeddedDocuments=async(type,ids)=>{events.push('tile-delete');if(fail.delete)throw Error('Tile deletion denied');const removed=ids.map(id=>f.zone.tiles.get(id));for(const id of ids)f.zone.tiles.delete(id);return removed;};
 const token={id:'npc',uuid:'Scene.zone.Token.npc',parent:f.zone,x:600,y:450,width:1.5,height:2,rotation:35,elevation:4,hidden:false,texture:{src:'tokens/zone-rat.webp',scaleX:-1,scaleY:1.2,tint:'#d0d0ff'},actor:{ownership:{gm:3}},flags:{[MODULE]:{wanderingEnabled:true}},canUserModify:()=>true,getFlag(m,k){return this.flags[m]?.[k];},setFlag:async function(m,k,v){return this.update({[`flags.${m}.${k}`]:v});},update:async function(data,options){
  if(Object.hasOwn(data,'hidden')){events.push(data.hidden?'hide':'reveal');if(fail.hide&&data.hidden)throw Error('Hide denied');}
  if(Object.hasOwn(data,'x')){events.push('move');if(fail.move)throw Error('Movement denied');}
  for(const [key,value] of Object.entries(data)){if(key.startsWith('flags.'))this.flags[MODULE][key.slice(`flags.${MODULE}.`.length)]=structuredClone(value);else this[key]=value;}return this;
 }};
 f.zone.tokens.set(token.id,token);const service=new WanderingTokens(f.store,f.env,{random:()=>0});
 return {...f,token,events,warnings,fail,service,markers:service.markers,config:()=>f.settings.get(SETTING)};
}
