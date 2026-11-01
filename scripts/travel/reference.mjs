import {requireDocument,checkDocument} from '../ui/documents.mjs';
async function renderSheet(sheet,options,env){const V2=env.foundry?.applications?.api?.ApplicationV2;return typeof V2==='function'&&sheet instanceof V2?sheet.render({force:true,...options}):options?sheet.render(true,options):sheet.render(true);}
// Sheet opening is explicit: native link handlers require a real link event/target.
export async function openEncounterReference(uuid,service,env=globalThis){
 if(!service.store.isGM||!env.game.user.isGM)return false;
 let document,stage='resolve';
 const allowed=()=>{if(!service.store.isGM||!env.game.user.isGM)throw Error('GM access changed while opening the reference.');};
 try{
  document=await requireDocument(uuid,'Actor|JournalEntry|JournalEntryPage',env);allowed();
  let parent=document;if(document.documentName==='JournalEntryPage'){parent=document.parent;if(parent?.documentName!=='JournalEntry')throw Error('The referenced page has no available parent Journal.');checkDocument(parent,'JournalEntry',env);}
  stage='sheet';const sheet=parent.sheet;if(typeof sheet?.render!=='function')throw Error('The referenced document has no available sheet.');
  allowed();checkDocument(document,'',env);checkDocument(parent,'',env);
  if(document.documentName==='JournalEntryPage'){
   try{const result=await renderSheet(sheet,{pageId:document.id},env);if(result===false)throw Error('Journal page opening was rejected.');}
   catch(pageError){allowed();checkDocument(parent,'JournalEntry',env);env.console?.warn('MYZ Travel Encounter Reference',{uuid,type:document.documentName,stage:'page-navigation-fallback'},pageError);const result=await renderSheet(sheet,null,env);if(result===false)throw Error('Parent Journal opening was rejected.');env.ui.notifications.warn('The parent Journal was opened; its referenced page could not be selected.');}
  }else{const result=await renderSheet(sheet,null,env);if(result===false)throw Error('Document sheet opening was rejected.');}
  return true;
 }catch(error){
  if(service.store.isGM&&env.game.user.isGM){env.console?.error('MYZ Travel Encounter Reference',{uuid,type:document?.documentName||'unresolved',stage,state:error.state||'unavailable'},error);env.ui.notifications.warn('Encounter reference could not be opened. Check its availability and permissions; see the GM console for details.');}
  return false;
 }
}
