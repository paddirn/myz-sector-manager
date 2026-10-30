import {test} from 'node:test';import assert from 'node:assert/strict';
import {travelFixture} from './helpers/travel-fixture.mjs';
import {MODULE,TRAVEL_SETTING,ROSTER_SETTING,travelDefaults,validateTravelConfiguration,validateRoster,rosterDefaults,expeditionRoster,exploredSector,pruneTravelState} from '../scripts/travel/model.mjs';
import {TravelEvents} from '../scripts/travel/service.mjs';
import {SectorEntryTriggers} from '../scripts/zone/entry-triggers.mjs';
import {travelReportHTML,showTravelReport} from '../scripts/travel/report.mjs';
test('defaults enable independent 1-in-12 checks; denominators accept d6/d12/d20/d36, not d66 pseudo-range',async()=>{
 const defaults=travelDefaults();assert.equal(defaults.enabled,true);assert.equal(defaults.normalEntry,true);assert.equal(defaults.weatherChance,12);assert.equal(defaults.encounterChance,12);assert.equal(defaults.exploredChance,20);
 for(const n of [1,6,12,20,36])assert.equal(validateTravelConfiguration({weatherChance:n}).weatherChance,n);
 for(const value of [0,-1,1.5,NaN,Infinity,'12',1000001])assert.throws(()=>validateTravelConfiguration({weatherChance:value}));
 assert.throws(()=>validateTravelConfiguration({stalkerMode:'bogus'}));assert.throws(()=>validateTravelConfiguration({enabled:1}));
 const f=travelFixture();f.probabilities.push(36,1);assert.equal(await f.service.chance(36),false);assert.equal(await f.service.chance(36),true);assert.deepEqual(f.rolls,[36,36]);
});
test('first eligible check establishes weather once, silently, with private persistent state and no sector mutation',async()=>{
 const f=travelFixture(),before=structuredClone(f.sector);const result=await f.service.onEntry(f.context());assert.equal(result.meaningful,false);assert.equal(f.weatherRolls(),1);assert.equal(f.state().weather.condition,'Clear Skies');assert.equal(f.state().weather.tableUuid,'RollTable.weather');assert.equal(f.reports.length,0);assert.equal(f.state().history.length,0);assert.deepEqual(f.rolls,[12]);assert.deepEqual(f.sector,before);assert.deepEqual(f.configDoc.ownership,{default:0});
 await f.service.onEntry(f.context());assert.equal(f.weatherRolls(),1);assert.deepEqual(f.rolls,[12,12,12]);assert.equal(f.state().processed.length,2);
 const reloaded=new TravelEvents(f.store,f.env,{roll:async sides=>sides});assert.equal(reloaded.state.weather.condition,'Clear Skies');
});
test('weather changes and encounters form one report, identical weather and failed checks stay silent',async()=>{
 const f=travelFixture();await f.service.onEntry(f.context());f.weatherResults[0]=' clear   skies ';f.probabilities.push(1,12);await f.service.onEntry(f.context());assert.equal(f.reports.length,0);assert.equal(f.state().weather.condition,'Clear Skies');
 f.weatherResults[0]='Heavy Rain';f.probabilities.push(1,1);const next=await f.service.onEntry(f.context());assert.equal(next.event.weatherChange.previous,'Clear Skies');assert.equal(next.event.encounter.title,'Neutral Travelers');assert.equal(f.reports.length,1);assert.equal(f.detections(),1);assert.equal(f.state().history.length,1);assert.equal(f.state().history[0].pending,false);assert.equal(f.state().history[0].sectorId,'sector');
 assert.match(travelReportHTML(next.event),/Weather Change/);assert.match(travelReportHTML(next.event),/Random Encounter/);assert.match(travelReportHTML(next.event),/house rule/);
});
test('weather-only and encounter-only reports are meaningful; no public or combat APIs are used',async()=>{
 const f=travelFixture();f.env.ChatMessage={create:()=>assert.fail('public chat')};f.env.Combat={create:()=>assert.fail('combat')};f.env.Actor={create:()=>assert.fail('Actor creation')};
 await f.service.onEntry(f.context());f.weatherResults[0]='Fog';f.probabilities.push(1,12);await f.service.onEntry(f.context());assert.equal(f.reports[0].encounter,null);
 f.probabilities.push(12,1);await f.service.onEntry(f.context());assert.equal(f.reports[1].weatherChange,null);assert(f.reports[1].encounter);assert.equal(f.reports.length,2);
});
test('missing/invalid weather does not prevent encounters; configuration errors alone never create event reports',async()=>{
 const f=travelFixture();f.docs.delete('RollTable.weather');await f.service.onEntry(f.context());assert.equal(f.reports.length,0);assert.equal(f.state().weather,null);assert(f.state().diagnostics.length);
 f.probabilities.push(1);await f.service.onEntry(f.context());assert.equal(f.reports.length,1);assert(f.reports[0].encounter);assert.equal(f.reports[0].weatherChange,null);
 const bad=travelFixture();bad.weatherResults[0]={description:''};await bad.service.onEntry(bad.context());assert.equal(bad.state().weather,null);assert.equal(bad.reports.length,0);
});
test('encounters in Explored/Cleared sectors use d20 while weather remains d12; other statuses use d12',async()=>{
 const f=travelFixture();await f.service.onEntry(f.context());f.rolls.length=0;
 for(const status of ['Explored','Cleared','Unexplored','Scouted','Visited','Lost']){f.sector.status=status;await f.service.onEntry(f.context());assert.deepEqual(f.rolls.splice(0),[12,['Explored','Cleared'].includes(status)?20:12]);}
 f.settings.set(TRAVEL_SETTING,{...travelDefaults(),reduceExplored:false});f.sector.status='Explored';await f.service.onEntry(f.context());assert.deepEqual(f.rolls,[12,12]);
});
test('entries are repeatable, persistent IDs prevent replay, and initialization/Special/disabled processing never rolls',async()=>{
 const f=travelFixture();const ctx=f.context();await f.service.onEntry(ctx);const writes=f.stateWrites();await f.service.onEntry(ctx);assert.equal(f.stateWrites(),writes);
 await f.service.onEntry(f.context());assert.equal(f.state().processed.length,2);
 f.sector.sectorType='special';const count=f.rolls.length;await f.service.onEntry(f.context());assert.equal(f.rolls.length,count);delete f.sector.sectorType;
 f.settings.set(TRAVEL_SETTING,{...travelDefaults(),enabled:false});await f.service.onEntry(f.context());assert.equal(f.rolls.length,count);
 f.settings.set(TRAVEL_SETTING,travelDefaults());f.env.game.users.activeGM={id:'other'};await assert.rejects(f.service.onEntry(f.context()),/active GM/);assert.equal(f.rolls.length,count);
});
test('travel report is awaited before once/repeat Macros; waypoint, duplicate and unrelated-token guards are shared',async()=>{
 const f=travelFixture();const order=[];let finish;const gate=new Promise(resolve=>finish=resolve);f.service.report=async()=>{order.push('report');await gate;order.push('closed');return true;};f.sector.effects=[{triggerId:'m',macroUuid:'Macro.test',macroRunOnce:false}];f.docs.set('Macro.test',{documentName:'Macro',canExecute:true,execute:async()=>order.push('macro')});
 let macroState={records:[]};const get=f.journal.getFlag;f.journal.getFlag=(m,k)=>k==='entryTriggers'?macroState:get(m,k);f.journal.setFlag=async(m,k,v)=>{assert.equal(k,'entryTriggers');macroState=structuredClone(v);};
 const dispatcher=new SectorEntryTriggers(f.store,f.env,{beforeMacros:ctx=>f.service.onEntry(ctx)});dispatcher.prime();assert.equal(order.length,0);
 f.probabilities.push(1);f.token.x=0;dispatcher.updated(f.token,{x:0});await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(order,['report']);
 f.token.x=500;dispatcher.updated(f.token,{x:500});f.token.x=0;dispatcher.updated(f.token,{x:0});finish();await dispatcher.queue;assert.deepEqual(order.slice(0,3),['report','closed','macro']);assert.equal(order.filter(x=>x==='macro').length,2);
 await dispatcher.updated({...f.token,id:'unrelated'},{x:1000});assert.equal(order.filter(x=>x==='macro').length,2);
});
test('dry-run manual checks are labeled TEST and do not persist weather/history/Macro/exploration state',async()=>{
 const f=travelFixture(),before=f.state(),sector=structuredClone(f.sector);const result=await f.service.test(f.context(),{kind:'encounter',persist:false});assert.equal(result.event.test,true);assert.equal(f.reports.length,1);assert.deepEqual(f.state(),before);assert.deepEqual(f.sector,sector);
 await f.service.test(f.context(),{kind:'weather',persist:true});assert.equal(f.state().weather.condition,'Clear Skies');assert.equal(f.state().history.length,0);
});
test('weather is global across expeditions and meaningful history remains stable after rename/move and reload',async()=>{
 const f=travelFixture();await f.service.onEntry(f.context());const second={...f.token,id:'second',uuid:'Scene.zone.Token.second'},group={...f.group,id:'second',tokenId:'second',name:'Second Expedition'};f.zone.tokens.set(second.id,second);f.store.config.groups.push(group);f.probabilities.push(12,1);
 await f.service.onEntry({...f.context(),token:second,group});assert.equal(f.weatherRolls(),1);assert.equal(f.state().history[0].expeditionId,'second');f.sector.code='C7';f.journal.name='Renamed';assert.equal(f.state().history[0].code,'A1');assert.equal(f.state().history[0].sectorId,'sector');
});
test('private pending reports survive authority loss and can be reviewed later; retention preserves unread events',async()=>{
 const f=travelFixture();f.service.report=async()=>false;f.probabilities.push(1);await f.service.onEntry(f.context());assert.equal(f.state().history[0].pending,true);f.env.game.users.activeGM={id:'other'};await assert.rejects(f.service.review(f.state().history[0].id),/active GM/);f.env.game.users.activeGM={id:'gm'};f.service.report=async()=>true;await f.service.review(f.state().history[0].id);assert.equal(f.state().history[0].pending,false);
 const state={history:Array.from({length:30},(_,i)=>({id:String(i),timestamp:i,pending:i===0})),processed:Array(1200).fill({}),diagnostics:Array(70).fill({})};pruneTravelState(state,10);assert.equal(state.history.length,11);assert(state.history.some(row=>row.id==='0'));assert.equal(state.processed.length,1000);assert.equal(state.diagnostics.length,50);
});
test('shared roster is single-expedition only; explicit assignment, lead uniqueness and validation are enforced',()=>{
 const member={actorUuid:'Actor.one',groupId:'',enabled:true,lead:true,eligibility:'auto',skillUuid:''},roster={version:1,members:[member]};assert.equal(validateRoster(roster).members.length,1);assert.equal(expeditionRoster(roster,{id:'one'},[{id:'one'}]).length,1);assert.equal(expeditionRoster(roster,{id:'one'},[{id:'one'},{id:'two'}]).length,0);
 assert.throws(()=>validateRoster({version:1,members:[member,member]}),/only once/);assert.throws(()=>validateRoster({version:1,members:[member,{...member,actorUuid:'Actor.two'}]}),/one lead/);assert.throws(()=>validateRoster({version:1,members:[{...member,actorUuid:'invalid uuid'}]}));
});
test('real encounter resolver reuses configured type/subtype tables, preserves neutral/hostile identities and exact references',async()=>{
 const f=travelFixture({injected:false});const {LEGACY_GENERATION_UUIDS}=await import('../scripts/document-references.mjs');let type='D66 Encounters';f.docs.set(LEGACY_GENERATION_UUIDS.threatType,{uuid:LEGACY_GENERATION_UUIDS.threatType,documentName:'RollTable',name:'Threat Type',roll:async()=>({results:[{description:type}]})});
 const make=(key,uuid,name,documentName)=>{f.docs.set(uuid,{uuid,name,documentName});f.docs.set(LEGACY_GENERATION_UUIDS[key],{uuid:LEGACY_GENERATION_UUIDS[key],documentName:'RollTable',name:key,roll:async()=>({results:[{documentUuid:uuid}]})});};
 make('encounter','Compendium.test.journals.JournalEntry.travel.JournalEntryPage.neutral','Friendly Traders','JournalEntryPage');Object.assign(f.docs.get('Compendium.test.journals.JournalEntry.travel.JournalEntryPage.neutral'),{type:'text',text:{content:'<p>They offer safe passage.</p><p>Second paragraph.</p>'}});f.probabilities.push(1);await f.service.onEntry(f.context());assert.equal(f.reports[0].encounter.title,'Friendly Traders');assert.equal(f.reports[0].encounter.details,'They offer safe passage.\n\nSecond paragraph.');assert.equal(f.reports[0].encounter.uuid,'Compendium.test.journals.JournalEntry.travel.JournalEntryPage.neutral');assert.equal(f.reports[0].detection.highest,null);
 type='Monster';make('monster','Actor.hostile','Territorial Beast','Actor');f.probabilities.push(12,1);await f.service.onEntry(f.context());assert.equal(f.reports[1].encounter.title,'Territorial Beast');f.docs.delete(LEGACY_GENERATION_UUIDS.threatType);f.probabilities.push(12,1);await f.service.onEntry(f.context());assert.equal(f.reports.length,2);assert(f.state().diagnostics.some(item=>/Threat Type/.test(item.message)));
});
test('GM reports persist without timers and Close / X resolve; players and empty events get no dialog',async()=>{
 for(const closeWith of ['button','x']){
  const f=travelFixture(),event={code:'A1',sectorName:'Private <script>',terrain:'Woods',expeditionName:'Alpha',weatherChange:{previous:'Clear',condition:'Fog'},encounter:null,errors:[]};let calls=0,options,resolveWait,settled=false;
  f.env.setTimeout=()=>assert.fail('Reports must never schedule dismissal');
  f.env.foundry.applications.api.DialogV2.wait=config=>{calls++;options=config;assert(!config.content.includes('<script>'));config.render(null,{});return new Promise(resolve=>{resolveWait=resolve;});};
  const showing=showTravelReport(event,f.service,f.env).then(value=>{settled=true;return value;});
  await Promise.resolve();assert.equal(settled,false);assert(f.service.activeDialog);
  resolveWait(closeWith==='button'?options.buttons[0].callback():options.close());assert.equal(await showing,true);assert.equal(f.service.activeDialog,null);
  f.env.game.users.activeGM={id:'other'};assert.equal(await showTravelReport(event,f.service,f.env),false);assert.equal(calls,1);
  f.env.game.user.isGM=false;assert.equal(await showTravelReport(event,f.service,f.env),false);
 }
 const f=travelFixture();assert.equal(await showTravelReport({code:'A1'},f.service,f.env),false);
});
test('dialog/history options, normal-entry toggle and corrupt future state never overwrite data',async()=>{
 const f=travelFixture();f.settings.set(TRAVEL_SETTING,{...travelDefaults(),showDialog:false});f.probabilities.push(1);await f.service.onEntry(f.context());assert.equal(f.reports.length,0);assert.equal(f.state().history.length,1);assert.equal(f.state().history[0].pending,false);
 f.settings.set(TRAVEL_SETTING,{...travelDefaults(),recordHistory:false});f.probabilities.push(12,1);await f.service.onEntry(f.context());assert.equal(f.reports.length,1);assert.equal(f.state().history.length,2);
 f.settings.set(TRAVEL_SETTING,{...travelDefaults(),normalEntry:false});const rolls=f.rolls.length;await f.service.onEntry(f.context());assert.equal(f.rolls.length,rolls);const writes=f.stateWrites();f.setState({version:2,secret:'Keep future state'});await assert.rejects(f.service.setWeather('Fog'),/Unsupported saved/);assert.equal(f.stateWrites(),writes);
});
test('results completed during GM handover use a private isolated outbox and survive for the next GM',async()=>{
 const f=travelFixture();let pending={};const get=f.configDoc.getFlag.bind(f.configDoc),set=f.configDoc.setFlag.bind(f.configDoc);f.configDoc.getFlag=(m,k)=>k==='pendingTravelReports'?structuredClone(pending):get(m,k);f.configDoc.setFlag=async(m,k,v)=>{if(k.startsWith('pendingTravelReports.'))pending[k.split('.')[1]]=structuredClone(v);else await set(m,k,v);};f.configDoc.update=async updates=>{for(const key of Object.keys(updates))delete pending[key.split('.-=')[1]];};
 f.service.encounter=async()=>{f.env.game.users.activeGM={id:'nextGM'};return {title:'Preserved encounter',details:'Generated before handover.',uuid:''};};f.probabilities.push(1);const result=await f.service.onEntry(f.context());assert.equal(result.pending,true);assert.equal(f.reports.length,0);assert.equal(Object.keys(pending).length,1);assert.equal(f.state().history.length,0);
 f.env.game.user.id='nextGM';await f.service.recoverPendingMoves();assert.equal(f.state().history.length,1);assert.equal(f.state().history[0].encounter.title,'Preserved encounter');assert.equal(f.state().history[0].pending,true);assert.equal(Object.keys(pending).length,0);assert.equal(f.state().weather.condition,'Clear Skies');await f.service.recoverPendingMoves();assert.equal(f.state().history.length,1);
});
test('automatic travel repeats independently of a consumed once-only Macro and works without any Macro references',async()=>{
 const f=travelFixture();let executions=0,macroHistory={records:[]};f.sector.effects=[{triggerId:'once',macroUuid:'Macro.once',macroRunOnce:true}];f.docs.set('Macro.once',{documentName:'Macro',canExecute:true,execute:async()=>executions++});const read=f.journal.getFlag;f.journal.getFlag=(m,k)=>k==='entryTriggers'?macroHistory:read(m,k);f.journal.setFlag=async(m,k,value)=>{macroHistory=structuredClone(value);};const dispatcher=new SectorEntryTriggers(f.store,f.env,{beforeMacros:context=>f.service.onEntry(context)});dispatcher.prime();
 f.probabilities.push(1);f.token.x=0;await dispatcher.updated(f.token,{x:0});assert.equal(executions,1);assert.equal(f.reports.length,1);
 f.token.x=500;await dispatcher.updated(f.token,{x:500});f.probabilities.push(12,1);f.token.x=0;await dispatcher.updated(f.token,{x:0});assert.equal(executions,1);assert.equal(f.reports.length,2);
 f.sector.effects=[];f.token.x=500;await dispatcher.updated(f.token,{x:500});f.probabilities.push(12,1);f.token.x=0;await dispatcher.updated(f.token,{x:0});assert.equal(executions,1);assert.equal(f.reports.length,3);
});

test('native reports queue weather-only then encounter-only; Close and X release processing and retain both history records',async()=>{
 const f=travelFixture(),dialogs=[];await f.service.setWeather('Clear');f.weatherResults[0]='Fog';f.probabilities.push(1,12,12,1);
 f.env.foundry.applications.api.DialogV2.wait=options=>new Promise(resolve=>{dialogs.push({options,resolve});options.render(null,{});});f.service.report=event=>showTravelReport(event,f.service,f.env);
 let completed=0;const first=f.service.onEntry(f.context()).then(()=>completed++),second=f.service.onEntry(f.context()).then(()=>completed++);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(dialogs.length,1);assert.equal(completed,0);assert.match(dialogs[0].options.content,/Weather Change/);assert(!dialogs[0].options.content.includes('Random Encounter'));assert.equal(f.state().history[0].pending,true);assert.equal(f.state().processed.length,1);
 dialogs[0].resolve(dialogs[0].options.buttons[0].callback());await first;await new Promise(resolve=>setImmediate(resolve));assert.equal(dialogs.length,2);assert.equal(completed,1);assert.match(dialogs[1].options.content,/Random Encounter/);assert(!dialogs[1].options.content.includes('Weather Change'));assert.equal(f.state().history[0].pending,false);
 dialogs[1].resolve(dialogs[1].options.close());await second;assert.equal(completed,2);assert.equal(f.state().history.length,2);assert(f.state().history.every(event=>!event.pending));assert.equal(f.service.activeDialog,null);
});
test('campaign integration receives actual persisted outcomes before reporting, but never previews, no-events, or duplicates',async()=>{const f=travelFixture(),logged=[];f.service.onTriggered=async e=>logged.push(structuredClone(e));const initial=f.context();await f.service.onEntry(initial);assert.equal(logged.length,0);f.probabilities.push(12,1);const context={...f.context(),campaignVisit:{sessionId:'session',visitId:'visit'},entryAt:Date.now()};await f.service.onEntry(context);assert.equal(logged.length,1);assert.deepEqual(logged[0].campaignVisit,context.campaignVisit);assert.equal(logged[0].sceneId,f.group.sceneId);assert.equal(logged[0].tokenId,f.token.id);await f.service.onEntry(context);assert.equal(logged.length,1);await f.service.test(f.context(),{kind:'encounter',persist:true});assert.equal(logged.length,1);});
test('campaign write failure warns without suppressing Travel Event report or history',async()=>{const f=travelFixture();f.service.onTriggered=async()=>{throw Error('Campaign write failed');};await f.service.onEntry(f.context());f.probabilities.push(12,1);await f.service.onEntry(f.context());assert.equal(f.reports.length,1);assert.equal(f.state().history.length,1);assert(f.errors.some(e=>String(e).includes('Campaign write failed')));});
