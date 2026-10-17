import {canonicalCoordinate} from './zone/grid.mjs';
const MODULE='myz-sector-manager';
const values=collection=>Array.from(collection?.values?collection.values():collection||[]);
const folderId=folder=>typeof folder==='string'?folder:folder?.id||null;
export function defaultSectorName(data={}){
  const raw=String(data.code??'').trim();
  return `${canonicalCoordinate(raw)||raw||'-#'} - ${String(data.terrain??'').trim()||'Unknown Terrain'}`;
}
// Missing state is migrated from the existing Journal title; explicit false means automatic.
export function sectorNaming(data={}, title=''){
  if(typeof data.nameOverride==='boolean')return {...data};
  const custom=title&&title!==defaultSectorName(data)?title:'';
  return {...data,nameOverride:Boolean(custom),customName:custom};
}
export function sectorName(data={}, title=''){
  const state=sectorNaming(data,title);
  return state.nameOverride?String(state.customName??''):defaultSectorName(state);
}
export const activeGM=env=>Boolean(env.game.user.isGM&&env.game.users?.activeGM?.id===env.game.user.id);
const queues=new WeakMap();
export function ensureJournalFolders(env=globalThis){
  if(!env.game.user.isGM)return Promise.reject(new Error('GM access required for module Journal folders.'));
  const prior=queues.get(env)||Promise.resolve();
  const work=prior.catch(()=>{}).then(async()=>{
    const find=(name,parent)=>values(env.game.folders).filter(folder=>folder.type==='JournalEntry'&&folder.name===name&&folderId(folder.folder)===parent).sort((a,b)=>a.id.localeCompare(b.id))[0];
    let root=find('MYZ: Sector Manager',null);
    if(!root){if(!activeGM(env))throw new Error('The active GM must initialize MYZ Sector Manager Journal folders.');root=await env.Folder.create({name:'MYZ: Sector Manager',type:'JournalEntry',folder:null});}
    let sectors=find('Sectors',root.id);
    if(!sectors){if(!activeGM(env))throw new Error('The active GM must initialize the Sectors Journal folder.');sectors=await env.Folder.create({name:'Sectors',type:'JournalEntry',folder:root.id});}
    return {root,sectors};
  });
  queues.set(env,work);return work;
}
export function organizationUpdate(document,folders,configId=''){
  const sector=document.getFlag(MODULE,'sector'),config=document.getFlag(MODULE,'zoneConfiguration');
  if(sector&&sector.version!==1)return {warning:`Journal ${document.id} has an unsupported sector flag; left untouched.`};
  const kind=sector?.version===1?'sector':config||document.id===configId||Object.keys(document.flags?.[MODULE]||{}).length?'configuration':null;
  if(!kind)return {changes:{},unmanaged:true};
  const changes={};const target=kind==='sector'?folders.sectors.id:folders.root.id;
  if(folderId(document.folder)!==target)changes.folder=target;
  if(kind==='sector'){
    const state=sectorNaming(sector,document.name);
    if(typeof sector.nameOverride!=='boolean')changes[`flags.${MODULE}.sector`]=state;
    if(document.name!==sectorName(state))changes.name=sectorName(state);
  }
  return {changes};
}
export class JournalOrganization {
  constructor(env=globalThis){this.env=env;this.task=null;this.again=false;this.hooks=[];}
  run(){
    if(!activeGM(this.env))return Promise.resolve({skipped:true,updated:0});
    if(this.task){this.again=true;return this.task;}
    this.task=(async()=>{
      let updated=0;const warnings=new Set();const untouched=new Set();
      do{
        this.again=false;const folders=await ensureJournalFolders(this.env);
        const configId=this.env.game.settings.get(MODULE,'zoneConfigurationId');
        for(const document of values(this.env.game.journal)){
          if(!activeGM(this.env))return {skipped:true,updated};
          const {changes,warning,unmanaged}=organizationUpdate(document,folders,configId);
          if(unmanaged)untouched.add(document.id);
          if(warning){warnings.add(warning);continue;}
          if(Object.keys(changes).length){await document.update(changes);updated++;}
        }
      }while(this.again);
      for(const warning of warnings)this.env.ui.notifications.warn(warning);
      return {updated,warnings:[...warnings],untouched:[...untouched]};
    })().finally(()=>{this.task=null;});
    return this.task;
  }
  start(){
    const schedule=()=>{void this.run().catch(error=>this.env.ui.notifications.error(`Journal organization: ${error.message}`));};
    for(const event of ['createJournalEntry','updateJournalEntry','updateUser'])this.hooks.push([event,this.env.Hooks.on(event,schedule)]);
    schedule();
  }
}
