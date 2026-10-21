// The single Shop stores references only. Legacy merchant data stays in settlement.shops as a recovery archive.
const id=()=>globalThis.foundry?.utils?.randomID?.()||globalThis.crypto.randomUUID();
export const SHOP_COLUMNS=Object.freeze(['Item','Cost','Requirement','Weight','Comment']);
export const newShopGroup=(name='General Gear')=>({id:id(),name,entries:[]});
export function normalizeShop(raw,legacy=[]){
  if(raw!==undefined&&(!raw||raw.version!==1||!Array.isArray(raw.groups)))throw new Error('Invalid Settlement Shop data. Record was not changed.');
  if(!Array.isArray(legacy))throw new Error('Invalid legacy Settlement Shops. Record was not changed.');
  let next=raw;
  if(next===undefined){
    const seen=new Set();let unlinked=0,duplicates=0;
    const groups=legacy.map((shop,index)=>{
      if(!shop||!Array.isArray(shop.inventory||[]))throw new Error('Invalid legacy Settlement inventory. Record was not changed.');
      const group=newShopGroup(String(shop.title||`Recovered inventory ${index+1}`));
      for(const item of shop.inventory||[]){
        if(!item?.uuid){unlinked++;continue;}if(seen.has(item.uuid)){duplicates++;continue;}seen.add(item.uuid);
        group.entries.push({id:id(),uuid:item.uuid,legacyEntryId:item.id||''});
      }
      return group;
    });
    next={version:1,groups:groups.length?groups:[newShopGroup()],...(legacy.length?{migration:{version:1,source:'settlement.shops',unlinked,duplicates}}:{})};
  }
  const ids=new Set(),uuids=new Set();
  const stable=entry=>{if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new Error('Invalid Settlement Shop entry. Record was not changed.');let key=entry.id;if(typeof key!=='string'||!/^[A-Za-z0-9_-]+$/.test(key)||ids.has(key))key=id();ids.add(key);return {...entry,id:key};};
  const groups=next.groups.map(rawGroup=>{
    const group=stable(rawGroup);if(!Array.isArray(group.entries))throw new Error('Invalid Settlement Shop group. Record was not changed.');
    group.entries=group.entries.map(rawEntry=>{
      const entry=stable(rawEntry);if(typeof entry.uuid!=='string'||!entry.uuid)throw new Error('Invalid Settlement Shop UUID. Record was not changed.');
      if(uuids.has(entry.uuid))throw new Error('Duplicate Settlement Shop UUID. Record was not changed.');uuids.add(entry.uuid);return entry;
    });return group;
  });
  return {...next,groups};
}
export function requireShopItem(doc,systemId='mutant-year-zero'){
  if(systemId!=='mutant-year-zero'||doc?.documentName!=='Item'||!['gear','artifact'].includes(doc.type))throw new Error('Shop inventory requires an MYZ Gear or Artifact Item (types “gear” or “artifact”), from Items or a Compendium.');
  return doc;
}
export function shopItemFields(doc){
  const {system={},type}=requireShopItem(doc);
  return {cost:system.cost??'',requirement:(type==='artifact'?system.dev_requirement:system.requirement)??'',weight:system.weight??'',comment:system.comment??''};
}
export function putShopItem(shop,doc,groupId,{replaceId=null}={}){
  requireShopItem(doc);if(!doc.uuid)throw new Error('The Item needs a stable UUID.');
  let group=shop.groups.find(g=>g.id===groupId)||shop.groups[0];if(!group){group=newShopGroup();shop.groups.push(group);}
  const previous=shop.groups.flatMap(g=>g.entries.map(entry=>({group:g,entry}))).find(row=>row.entry.uuid===doc.uuid);
  const replacement=replaceId?group.entries.find(entry=>entry.id===replaceId):null;
  if(replaceId&&!replacement)throw new Error('Selected Shop reference changed. Nothing was replaced.');
  if(previous){
    // One UUID per Settlement: a cross-group drop moves the existing record, retaining its ID.
    if(previous.group===group)return {entry:previous.entry,group,duplicate:true};
    previous.group.entries.splice(previous.group.entries.indexOf(previous.entry),1);
    if(replacement)group.entries.splice(group.entries.indexOf(replacement),1);
    group.entries.push(previous.entry);return {entry:previous.entry,group,moved:true};
  }
  if(replacement){replacement.uuid=doc.uuid;return {entry:replacement,group,replaced:true};}
  const entry={id:id(),uuid:doc.uuid};group.entries.push(entry);return {entry,group};
}
export function moveShopEntry(shop,entryId,targetId){
  const target=shop.groups.find(g=>g.id===targetId),source=shop.groups.find(g=>g.entries.some(entry=>entry.id===entryId));
  if(!source||!target)throw new Error('Select an existing Shop entry and destination group.');
  const entry=source.entries.find(e=>e.id===entryId);if(source!==target){source.entries.splice(source.entries.indexOf(entry),1);target.entries.push(entry);}return entry;
}
export function reorderById(list,key,offset){const index=list.findIndex(entry=>entry.id===key),destination=index+offset;if(index<0||destination<0||destination>=list.length)return false;const [entry]=list.splice(index,1);list.splice(destination,0,entry);return true;}
