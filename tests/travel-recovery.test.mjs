import {test} from 'node:test';import assert from 'node:assert/strict';
import {MovementRecovery} from '../scripts/travel/recovery.mjs';import {MODULE,TRAVEL_SETTING,travelDefaults} from '../scripts/travel/model.mjs';
import {travelFixture} from './helpers/travel-fixture.mjs';
test('originating owner retains only genuine completed moves without an active GM, not startup, others or animation frames',async()=>{
 const f=travelFixture();let flags={version:1,entries:[],overflow:0};f.token.isOwner=true;f.token.getFlag=()=>flags;f.token.setFlag=async(m,k,v)=>{assert.equal(m,MODULE);assert.equal(k,'pendingTravelEntries');flags=structuredClone(v);};f.env.game.users.activeGM=null;const recovery=new MovementRecovery(f.env);recovery.prime();assert.equal(flags.entries.length,0);
 f.token.movement={state:'pending'};f.token.x=1000;recovery.updated(f.token,'gm');f.token.x=1500;recovery.updated(f.token,'gm');assert.equal(flags.entries.length,0);f.token.movement.state='completed';recovery.completed(f.token,'gm');await recovery.queue;assert.equal(flags.entries.length,1);assert.equal(flags.entries[0].from.x,500);assert.equal(flags.entries[0].to.x,1500);
 recovery.updated(f.token,'gm');await recovery.queue;assert.equal(flags.entries.length,1);f.token.x=2000;recovery.updated(f.token,'other');await recovery.queue;assert.equal(flags.entries.length,1);f.env.game.users.activeGM={id:'gm'};f.token.x=2500;recovery.updated(f.token,'gm');await recovery.queue;assert.equal(flags.entries.length,1);
});
test('pending owner moves are filtered through the existing grid and processed only for registered Normal destinations',async()=>{
 const f=travelFixture();let flags={version:1,entries:[{id:'offline-one',from:{x:500,y:0,width:1,height:1},to:{x:0,y:0,width:1,height:1}},{id:'same-sector',from:{x:0,y:0,width:1,height:1},to:{x:20,y:0,width:1,height:1}}],overflow:0};f.token.getFlag=()=>flags;f.token.setFlag=async(m,k,v)=>{flags=structuredClone(v);};await f.service.recoverPendingMoves();assert.equal(f.state().weather.condition,'Clear Skies');assert.equal(f.state().processed.length,1);assert.equal(f.state().processed[0].id,'offline-one');assert.equal(flags.entries.length,0);assert.equal(f.sector.history[0].title,'Old sector History');
});
test('offline recovery respects disablement and native Token permission failures; buffer growth is bounded',async()=>{
 const f=travelFixture();f.env.game.user.isGM=false;f.env.game.user.id='player';f.env.game.users.activeGM=null;let flags={version:1,entries:[],overflow:0};f.token.isOwner=true;f.token.getFlag=()=>flags;f.token.setFlag=async(m,k,v)=>flags=structuredClone(v);const recovery=new MovementRecovery(f.env);recovery.prime();
 f.settings.set(TRAVEL_SETTING,{...travelDefaults(),enabled:false});f.token.x=1000;recovery.updated(f.token,'player');await recovery.queue;assert.equal(flags.entries.length,0);f.settings.set(TRAVEL_SETTING,travelDefaults());
 for(let i=0;i<52;i++){f.token.x=i%2?1000:0;recovery.updated(f.token,'player');}await recovery.queue;assert.equal(flags.entries.length,50);assert.equal(flags.overflow,2);
 f.token.setFlag=async()=>{throw Error('Native write permission denied');};f.token.x=2000;recovery.updated(f.token,'player');await recovery.queue;assert.equal(flags.entries.length,50);assert(f.errors.some(message=>String(message).includes('native Token permissions')));
});
