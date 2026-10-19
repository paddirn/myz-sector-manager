import assert from 'node:assert/strict';
import {ZoneStore,MODULE,CONFIG_KEY,emptyConfiguration} from '../../scripts/zone/store.mjs';
export function fixture(){
  let writes=0,creations=0;
  const config={...emptyConfiguration(),sceneId:'zone',grid:{reference:'A1',originX:0,originY:0,width:500,height:400,columns:30,rows:30,columnAxis:'x',columnDirection:1,rowDirection:1},ark:{sceneId:'zone',tokenId:'ark'},arkCoordinate:'A1',groups:[{id:'group1',name:'Alpha',sceneId:'zone',tokenId:'party',actorUuid:''}]};
  const zone={id:'zone',name:'The Zone',grid:{size:100},width:3000,height:3000,tokens:new Map()};
  const combat={id:'combat',grid:{size:50},tokens:new Map()};
  const token=(id,x,y,parent=zone)=>({id,x,y,width:1,height:1,parent});
  zone.tokens.set('ark',token('ark',0,0));zone.tokens.set('party',token('party',500,0));combat.tokens.set('party',token('party',500,0,combat));
  const configDoc={id:'config',getFlag:(module,key)=>key===CONFIG_KEY?configDoc.value:null,value:structuredClone(config),async setFlag(module,key,value){assert.equal(module,MODULE);assert.equal(key,CONFIG_KEY);writes++;this.value=structuredClone(value);}};
  const journal=[configDoc,{id:'sector',getFlag:(mod,key)=>key==='sector'?{version:1,code:'a-01',custom:{keep:true}}:null}];journal.get=id=>journal.find(doc=>doc.id===id);
  const callbacks=new Map();let sequence=0;
  const Hooks={on:(name,fn)=>{const id=++sequence;if(!callbacks.has(name))callbacks.set(name,new Map());callbacks.get(name).set(id,fn);return id;},off:(name,id)=>callbacks.get(name)?.delete(id),call:(name,...args)=>{for(const fn of callbacks.get(name)?.values()||[])fn(...args);}};
  const settings=new Map([['zoneConfigurationId','config'],['travelEventsConfiguration',{enabled:false}]]);
  const folders=[];const env={Folder:{create:async data=>{const folder={...data,id:'folder'+folders.length};folders.push(folder);return folder;}},game:{folders,user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}},journal,scenes:new Map([['zone',zone],['combat',combat]]),settings:{register(){},get:(module,key)=>settings.get(key),set:async(module,key,value)=>settings.set(key,value)}},canvas:{ready:true,scene:zone},Hooks,ui:{notifications:{error(){},warn(){},info(){}}},JournalEntry:{create:async data=>{creations++;const doc={...configDoc,id:'newConfig',value:data.flags[MODULE][CONFIG_KEY],ownership:data.ownership};journal.push(doc);return doc;}},foundry:{applications:{api:{DialogV2:{confirm:async()=>true}}}},fromUuid:async uuid=>uuid==='Actor.valid'?{documentName:'Actor'}:null};
  const store=new ZoneStore(env);store.reload();
  return {store,env,zone,combat,configDoc,config,settings,callbacks,writes:()=>writes,creations:()=>creations};
}

