import assert from 'node:assert/strict';
import {fixture as zoneFixture} from './zone-fixture.mjs';
import {TravelEvents} from '../../scripts/travel/service.mjs';
import {MODULE,TRAVEL_SETTING,ROSTER_SETTING,STATE_FLAG,travelDefaults,rosterDefaults,travelStateDefaults} from '../../scripts/travel/model.mjs';
import {legacyReferenceConfiguration} from './reference-fixture.mjs';
export function travelFixture({injected=true}={}){
 const f=zoneFixture();let state=travelStateDefaults(),writes=0,sequence=0;const rolls=[],reports=[],weatherResults=['Clear Skies'],errors=[],docs=new Map();let encounters=0,detections=0,weatherRolls=0;
 f.settings.set(TRAVEL_SETTING,travelDefaults());f.settings.set(ROSTER_SETTING,rosterDefaults());const references=legacyReferenceConfiguration();references.references['travelEvents.weatherTable']={mode:'custom',uuid:'RollTable.weather'};f.settings.set('documentReferences',references);
 const originalGet=f.configDoc.getFlag.bind(f.configDoc),originalSet=f.configDoc.setFlag.bind(f.configDoc);f.configDoc.ownership={default:0};f.configDoc.getFlag=(module,key)=>key===STATE_FLAG?structuredClone(state):originalGet(module,key);f.configDoc.setFlag=async(module,key,value)=>{if(key===STATE_FLAG){state=structuredClone(value);writes++;}else await originalSet(module,key,value);};
 const sector={version:1,code:'A1',terrain:'Scrublands',status:'Unexplored',customName:'Test Sector',nameOverride:true,effects:[],history:[{title:'Old sector History'}]};const journal={id:'sector',name:'Test Sector',getFlag:(m,key)=>key==='sector'?sector:null};f.env.game.journal[1]=journal;
 const table={uuid:'RollTable.weather',name:'Weather Conditions',documentName:'RollTable',roll:async options=>{assert.deepEqual(options,{recursive:false});weatherRolls++;const next=weatherResults.length>1?weatherResults.shift():weatherResults[0];if(next instanceof Error)throw next;return {results:[typeof next==='string'?{description:next}:next]};}};docs.set(table.uuid,table);
 f.env.fromUuid=async uuid=>docs.get(uuid);f.env.game.system={id:'mutant-year-zero',version:'14.0.4'};f.env.console={warn:message=>errors.push(message),error:message=>errors.push(message)};f.env.ui.notifications.warn=message=>errors.push(message);f.env.foundry.utils={randomID:()=>`random${++sequence}`};
 const probabilities=[],roll=async sides=>{rolls.push(sides);return probabilities.length?probabilities.shift():sides;};
 const service=new TravelEvents(f.store,f.env,{roll,report:async event=>{reports.push(structuredClone(event));return true;},...(injected?{encounter:async()=>{encounters++;return {title:'Neutral Travelers',details:'They offer directions.',uuid:'JournalEntry.travel',category:'encounter',sources:[]};},detection:async()=>{detections++;return {highest:0,rolls:[],issues:['No eligible Stalker'],recommendation:'Encounter awareness uncertain; GM determination required.',houseRule:true};}}:{})});
 const group=f.store.config.groups[0],token=f.zone.tokens.get('party');token.uuid='Scene.zone.Token.party';const context=()=>({journal,token,group,entryId:`entry${++sequence}`});
 return {...f,service,sector,journal,token,group,context,docs,probabilities,rolls,reports,weatherResults,errors,state:()=>structuredClone(state),setState:next=>{state=structuredClone(next);},stateWrites:()=>writes,encounters:()=>encounters,detections:()=>detections,weatherRolls:()=>weatherRolls};
}
