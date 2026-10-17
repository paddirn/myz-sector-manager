import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sectorName,ensureJournalFolders,JournalOrganization} from '../scripts/journal-organization.mjs';
function fixture(){
  const folders=[],journals=[],warnings=[],events=new Map();let writes=0;
  const env={game:{user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}},folders,journal:journals,settings:{get:()=> 'config'}},Folder:{create:async data=>{const folder={...data,id:'f'+folders.length};folders.push(folder);return folder;}},ui:{notifications:{warn:message=>warnings.push(message),error:message=>warnings.push(message)}},Hooks:{on:(event,callback)=>{events.set(event,callback);return event;}}};
  const doc=(id,name,flags)=>{const value={id,uuid:'JournalEntry.'+id,name,flags,folder:null,pages:[{text:'keep'}],ownership:{default:0},getFlag:(mod,key)=>value.flags[mod]?.[key],async update(changes){writes++;if(changes['flags.myz-sector-manager.sector'])this.flags['myz-sector-manager'].sector=changes['flags.myz-sector-manager.sector'];for(const [key,value] of Object.entries(changes))if(!key.startsWith('flags.'))this[key]=value;}};journals.push(value);return value;};
  return {env,folders,journals,warnings,events,doc,writes:()=>writes};
}
test('shared sector names canonicalize coordinates, use placeholders and preserve custom terrain',()=>{
  assert.equal(sectorName({code:'a-03',terrain:'Overgrown Ruins'}),'A3 - Overgrown Ruins');assert.equal(sectorName({} ),'-# - Unknown Terrain');assert.equal(sectorName({terrain:'Custom site'}),'-# - Custom site');assert.equal(sectorName({code:'B7'}),'B7 - Unknown Terrain');
});
test('folders are created once, reused concurrently, and Sectors has the Journal root as parent',async()=>{
  const f=fixture();const [a,b]=await Promise.all([ensureJournalFolders(f.env),ensureJournalFolders(f.env)]);assert.equal(f.folders.length,2);assert.equal(a.root.id,b.root.id);assert.equal(a.root.type,'JournalEntry');assert.equal(a.root.name,'MYZ: Sector Manager');assert.equal(a.sectors.name,'Sectors');assert.equal(a.sectors.folder,a.root.id);
});
test('migration moves positively identified journals only, preserves identity/data, and is idempotent',async()=>{
  const f=fixture();const sector=f.doc('sector','A3 - Overgrown Ruins',{'myz-sector-manager':{sector:{version:1,nameOverride:false,code:'A3',terrain:'Overgrown Ruins',loot:[{uuid:'Item.keep'}]}}});const config=f.doc('config','Configuration',{});const other=f.doc('other','B7 - Thick Woods',{});const snapshot=structuredClone({flags:sector.flags,pages:sector.pages,ownership:sector.ownership,uuid:sector.uuid});
  const org=new JournalOrganization(f.env);const first=await org.run();assert.equal(first.updated,2);assert.equal(sector.name,'A3 - Overgrown Ruins');assert.equal(sector.folder,f.folders[1].id);assert.equal(config.folder,f.folders[0].id);assert.equal(other.folder,null);assert.deepEqual({flags:sector.flags,pages:sector.pages,ownership:sector.ownership,uuid:sector.uuid},snapshot);
  const writes=f.writes();assert.equal((await org.run()).updated,0);assert.equal(f.writes(),writes);assert.equal(f.folders.length,2);
  sector.flags['myz-sector-manager'].sector.terrain='Factory';await org.run();assert.equal(sector.name,'A3 - Factory');
});
test('non-active GMs and players do not migrate; unsupported sector versions are reported without moving them',async()=>{
  const f=fixture(),doc=f.doc('future','Unknown',{'myz-sector-manager':{sector:{version:2}}});f.env.game.users.activeGM.id='other';assert.equal((await new JournalOrganization(f.env).run()).skipped,true);assert.equal(f.folders.length,0);
  f.env.game.users.activeGM.id='gm';await new JournalOrganization(f.env).run();assert.equal(doc.folder,null);assert.match(f.warnings[0],/unsupported sector flag/);f.env.game.user.isGM=false;await assert.rejects(ensureJournalFolders(f.env),/GM access/);
});
test('import/load hooks organize newly added flagged sectors while unrelated journals remain untouched',async()=>{
  const f=fixture(),org=new JournalOrganization(f.env);org.start();await org.task;
  const imported=f.doc('imported','Imported old title',{'myz-sector-manager':{sector:{version:1,code:'',terrain:''}}});f.events.get('createJournalEntry')(imported);await org.task;assert.equal(imported.name,'Imported old title');assert.equal(imported.getFlag('myz-sector-manager','sector').nameOverride,true);assert.equal(imported.folder,f.folders[1].id);
});
