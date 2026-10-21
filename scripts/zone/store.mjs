import {sectorOnScene} from '../sector-types.mjs';
import {ensureJournalFolders} from '../journal-organization.mjs';
import {canonicalCoordinate,validateGrid,locateToken,updateLocation,sectorDistance} from './grid.mjs';
export const MODULE='myz-sector-manager';
export const CONFIG_KEY='zoneConfiguration';
export const emptyConfiguration=()=>({version:1,sceneId:'',grid:null,ark:null,arkCoordinate:null,kmPerSector:1.6,groups:[],overlay:{enabled:false,boundaries:true,labels:true,status:true}});

export function normalizeConfiguration(saved,scene) {
  const next=structuredClone(saved||emptyConfiguration());
  next.kmPerSector??=1.6;
  // Explicit null is an authoritative clear. Never resurrect the old Ark token.
  if(!Object.hasOwn(next,'arkCoordinate')){
    const legacy=next.ark;
    next.arkCoordinate=[legacy?.lastKnown,legacy?.location?.coordinate,legacy&&next.grid?locateToken(legacy,scene,next.grid).coordinate:null].map(canonicalCoordinate).find(Boolean)||null;
  }
  return next;
}

// A separate GM-owned Journal holds the optional integration. The world setting
// contains only its ID, never sector secrets or tracking data.
export class ZoneStore {
  constructor(env=globalThis){this.env=env;this.listeners=new Set();this.queue=Promise.resolve();this.config=emptyConfiguration();this.documentId='';}
  get isGM(){return Boolean(this.env.game.user.isGM);}
  get scene(){return this.env.game.scenes.get(this.config.sceneId);}
  get live(){return Boolean(this.scene&&this.env.canvas?.ready&&this.env.canvas.scene?.id===this.config.sceneId);}
  get document(){return this.env.game.journal.get(this.documentId);}
  get authoritative(){return this.isGM&&this.env.game.users.activeGM?.id===this.env.game.user.id;}
  register(){
    this.env.game.settings.register(MODULE,'zoneConfigurationId',{scope:'world',config:false,type:String,default:'',restricted:true,onChange:()=>this.reload()});
  }
  subscribe(listener){this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
  emit(){for(const listener of this.listeners)listener();}
  reload(){
    if(!this.isGM)return;
    const previousId=this.documentId;
    this.documentId=this.env.game.settings.get(MODULE,'zoneConfigurationId');
    const saved=this.document?.getFlag(MODULE,CONFIG_KEY);
    const next=normalizeConfiguration(saved,this.env.game.scenes.get(saved?.sceneId));
    const changed=previousId!==this.documentId||JSON.stringify(next)!==JSON.stringify(this.config);
    this.config=next;
    if(changed)this.emit();
  }
  enqueue(task){const result=this.queue.then(task);this.queue=result.catch(error=>{this.env.ui.notifications.error(`Zone Map: ${error.message}`);});return result;}
  async ensureDocument(){
    if(this.document)return this.document;
    const folders=await ensureJournalFolders(this.env);
    const doc=await this.env.JournalEntry.create({name:'Configuration',folder:folders.root.id,ownership:{default:0},pages:[],flags:{[MODULE]:{[CONFIG_KEY]:emptyConfiguration()}}});
    this.documentId=doc.id;
    await this.env.game.settings.set(MODULE,'zoneConfigurationId',doc.id);
    return doc;
  }
  async validate(config){
    if(config.version!==1)throw new Error('Unsupported Zone configuration version.');
    if(config.arkCoordinate!=null&&config.arkCoordinate!==''&&!canonicalCoordinate(config.arkCoordinate))throw new Error('Ark location must be a valid coordinate such as A1 or AA12.');
    if(config.kmPerSector!=null&&(!Number.isFinite(config.kmPerSector)||config.kmPerSector<=0))throw new Error('Kilometers per sector must be positive.');
    if(!config.sceneId)return;
    const scene=this.env.game.scenes.get(config.sceneId);
    if(!scene)throw new Error('Choose an available Zone Scene.');
    validateGrid(config.grid);
    const ids=new Set();
    for(const track of config.groups){
      const prior=this.config.groups.find(old=>old?.sceneId===track.sceneId&&old?.tokenId===track.tokenId);
      if(track.sceneId!==scene.id||!track.tokenId||(!scene.tokens.get(track.tokenId)&&!prior))throw new Error('Tracked tokens must belong to the designated Zone Scene.');
      if(ids.has(track.tokenId))throw new Error('Assign each Scene token only once.');
      ids.add(track.tokenId);
      if(track.actorUuid){const doc=await this.env.fromUuid(track.actorUuid);if(doc?.documentName!=='Actor'&&track.actorUuid!==prior?.actorUuid)throw new Error('A group Actor reference must resolve to an Actor.');}
    }
    const groupIds=config.groups.map(group=>group.id);
    if(new Set(groupIds).size!==groupIds.length)throw new Error('Expedition group identifiers must be unique.');
  }
  save(config){
    if(!this.isGM)return Promise.reject(new Error('GM access only.'));
    return this.enqueue(async()=>{
      this.reload();
      await this.validate(config);
      const next=normalizeConfiguration(config,this.env.game.scenes.get(config.sceneId));
      next.arkCoordinate=canonicalCoordinate(next.arkCoordinate);
      for(const track of next.groups){
        const latest=this.config.groups.find(prior=>prior?.sceneId===track.sceneId&&prior?.tokenId===track.tokenId);
        if(latest){track.lastKnown=latest.lastKnown;track.lastSeenAt=latest.lastSeenAt;track.location=latest.location;}
      }
      // Recalculate from the designated Scene documents, never the viewed Scene.
      const scene=this.env.game.scenes.get(next.sceneId);
      for(const track of next.groups)updateLocation(track,locateToken(track,scene,next.grid));
      const doc=await this.ensureDocument();
      await doc.setFlag(MODULE,CONFIG_KEY,next);
      this.reload();
    });
  }
  setOverlay(enabled){
    if(!this.isGM)return Promise.reject(new Error('GM access only.'));
    return this.enqueue(async()=>{
      this.reload();
      if(!this.document||!this.config.sceneId)return;
      const next=structuredClone(this.config);next.overlay.enabled=enabled??!next.overlay.enabled;
      await this.document.setFlag(MODULE,CONFIG_KEY,next);this.reload();
    });
  }
  refreshTracking(){
    if(!this.authoritative)return Promise.resolve(false);
    return this.enqueue(async()=>{
      // Read after earlier writes so token hooks cannot overwrite configuration.
      this.reload();
      if(!this.config.sceneId||!this.config.grid||!this.document)return false;
      const next=structuredClone(this.config);
      let changed=!Object.hasOwn(this.document.getFlag(MODULE,CONFIG_KEY),'arkCoordinate');
      for(const track of next.groups)changed=updateLocation(track,locateToken(track,this.scene,next.grid))||changed;
      if(!changed)return false; // No write for moves inside the same sector.
      await this.document.setFlag(MODULE,CONFIG_KEY,next);
      this.reload();
      return true;
    });
  }
  tokenChanged(token,changes){
    if(!this.isGM||token.parent?.id!==this.config.sceneId)return Promise.resolve(false);
    if(changes&&!['x','y','width','height','movement'].some(key=>key in changes))return Promise.resolve(false);
    const track=this.config.groups.find(track=>track?.tokenId===token.id);
    if(!track)return Promise.resolve(false);
    const current=locateToken(track,this.scene,this.config.grid);
    if(track.location?.coordinate===current.coordinate&&track.location?.status===current.status)return Promise.resolve(false);
    this.emit();
    return this.refreshTracking();
  }
  sectorRecords(coordinate){
    if(!this.isGM)return [];
    const canonical=canonicalCoordinate(coordinate);
    if(!canonical)return [];
    return this.env.game.journal.filter(doc=>doc.getFlag(MODULE,'sector')?.version===1&&sectorOnScene(doc.getFlag(MODULE,'sector'),this.config.sceneId)&&canonicalCoordinate(doc.getFlag(MODULE,'sector').code)===canonical);
  }
  trackingRows(){
    if(!this.isGM)return [];
    const ark=this.config.arkCoordinate?{kind:'ark',id:'ark',name:'Ark',coordinate:this.config.arkCoordinate,fixed:true,live:false,status:'fixed'}:null;
    const groups=this.config.groups.map(track=>{
      const current=locateToken(track,this.scene,this.config.grid);
      const live=this.live&&current.status==='located';
      const coordinate=live?current.coordinate:track.lastKnown??null;
      return {...track,kind:'expedition',coordinate,live,status:current.status,distance:current.status==='located'?sectorDistance(this.config.arkCoordinate,coordinate,this.config.kmPerSector):null};
    });
    return ark?[ark,...groups]:groups;
  }
}
