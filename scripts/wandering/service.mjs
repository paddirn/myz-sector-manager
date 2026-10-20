import {MarkerAlignment} from './alignment.mjs';
import {warnReferenceOnce} from '../document-references.mjs';
import {LastKnownPositions} from './markers.mjs';
import {MODULE,FLAG,wanderingConfiguration,baseEligible,destinations,canModify,playerControlled} from './model.mjs';
export class WanderingTokens {
 constructor(store,env=globalThis,{random=Math.random}={}){this.store=store;this.env=env;this.random=random;this.queue=Promise.resolve();this.busy=new Set();this.markers=new LastKnownPositions(store,env);this.alignment=new MarkerAlignment(this,env);}
 assertAuthority(){if(!this.store.authoritative)throw new Error('Only the active GM can move wandering tokens.');}
 enqueue(task){const next=this.queue.then(task);this.queue=next.catch(error=>this.env.console?.error('MYZ Wandering Tokens',error));return next;}
 index(length){const n=this.random();if(!Number.isFinite(n)||n<0||n>=1)throw new Error('Invalid wandering random value.');return Math.floor(n*length);}
 onEntry(context){return this.enqueue(()=>this.check({context}));}
 async check({manual=false,context=null}={}){
  this.assertAuthority();const config=wanderingConfiguration(this.env);
  if(!manual&&(!config.enabled||config.frequency==='manual'))return {moved:0,skipped:true};
  const scene=this.store.scene,grid=JSON.stringify(this.store.config.grid);if(!scene||!this.store.config.grid)return {moved:0};
  if(!manual){
   if(!context?.entryId||context.token?.parent?.id!==scene.id||!this.store.config.groups.some(group=>group.id===context.group?.id&&group.sceneId===scene.id&&group.tokenId===context.token.id))return {moved:0,skipped:true};
   // Claim before chance/movement. Reloads and repeated calls cannot reroll this entry.
   const document=await this.store.ensureDocument();this.assertAuthority();const saved=document.getFlag(MODULE,'wanderingEntries')??{version:1,ids:[]};
   if(saved.version!==1||!Array.isArray(saved.ids))throw new Error('Unsupported wandering entry state; original data retained.');
   if(saved.ids.includes(context.entryId))return {moved:0,skipped:true};
   await document.setFlag(MODULE,'wanderingEntries',{...saved,ids:[...saved.ids,context.entryId].slice(-1000)});this.assertAuthority();
   if(config.frequency==='quarter'&&this.index(4)!==0)return {moved:0};
  }
  const candidates=Array.from(scene.tokens.values()).filter(token=>!this.alignment.hasTest(token)&&baseEligible(token,this.store,this.env,this.busy)&&destinations(token,this.store,config).length);let moved=0;const errors=[];
  for(let i=0;i<config.maximum&&candidates.length;i++){
   this.assertAuthority();if(scene.id!==this.store.scene?.id||grid!==JSON.stringify(this.store.config.grid))break;
   const token=candidates.splice(this.index(candidates.length),1)[0];if(this.alignment.hasTest(token)||!baseEligible(token,this.store,this.env,this.busy))continue;
   const choices=destinations(token,this.store,config);if(!choices.length)continue;const target=choices[this.index(choices.length)],key=token.uuid||token.id;
   this.busy.add(key);
   try{
    this.assertAuthority();const options={animate:true,autoRotate:false,showRuler:false,constrainOptions:{ignoreWalls:true,ignoreCost:true},myzWandering:true};
    const origin={x:token.x,y:token.y};const validate=()=>{this.assertAuthority();if(token.x!==origin.x||token.y!==origin.y||!baseEligible(token,this.store,this.env)||!destinations(token,this.store,config).some(point=>point.x===target.x&&point.y===target.y))throw new Error('Wandering token position, ownership or destination changed before movement.');};
    const completed=await this.markers.move(token,config,target,()=>{validate();return typeof token.move==='function'?token.move({x:target.x,y:target.y},options):token.update({x:target.x,y:target.y},options);},validate);
    if(completed!==false)moved++;
   }catch(error){errors.push({tokenId:token.id,message:error.message});this.env.console?.error(`MYZ wandering token ${token.id}`,error);if(config.markers&&this.store.authoritative)warnReferenceOnce(`Wandering token ${token.id}: ${error.message}`,this.env);}
   finally{this.busy.delete(key);}
  }
  return {moved,errors};
 }
 async manual(){const result=await this.enqueue(()=>this.check({manual:true}));if(this.store.isGM)this.env.ui.notifications.info(result.moved?`${result.moved} wandering ${result.moved===1?'token':'tokens'} moved.`:'No eligible wandering tokens.');if(this.store.isGM&&result.errors?.length)this.env.ui.notifications.warn(`${result.errors.length} wandering token movements failed. See the console.`);return result;}
 async bulk(enabled){
  if(!this.store.isGM)throw new Error('GM access required.');
  const tokens=(this.env.canvas?.tokens?.controlled||[]).map(object=>object.document).filter(token=>canModify(token,this.env)&&(!enabled||!playerControlled(token,this.env)));
  const groups=new Map();for(const token of tokens){if(!groups.has(token.parent))groups.set(token.parent,[]);groups.get(token.parent).push({_id:token.id,[`flags.${MODULE}.${FLAG}`]:enabled});}
  let count=0;for(const [scene,updates] of groups){const changed=await scene.updateEmbeddedDocuments('Token',updates);count+=changed.length;}
  if(this.store.isGM)this.env.ui.notifications.info(`${count} selected ${count===1?'token':'tokens'} updated.`);return count;
 }
}
