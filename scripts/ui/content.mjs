import {collectionEmpty} from './presentation.mjs';
// Presentation only. Callers supply model-specific quantity rules and extra
// fields; existing manager/domain modules still own edits, links and persistence.
import {entryCard,escapeEntryText as esc} from './entry.mjs';
import {selectOptions} from './options.mjs';
import {LOOT_TYPES,lootTitle} from '../loot.mjs';
export function contentEmpty(kind){return collectionEmpty(kind==='item'?'loot':'special.events');}
export function gearFields({item,prefix,quantity,minimum,step,reference='',extra='',warning=''}, {field,area}){
 const quantityControl=`<label class="sm-field"><span>Quantity</span><input name="${esc(prefix)}.quantity" type="number" min="${esc(minimum)}" step="${esc(step)}" value="${esc(quantity)}"></label>`;
 const type=`<label class="sm-field"><span>Type</span><select name="${esc(prefix)}.type">${selectOptions(item.type??'scrap',LOOT_TYPES,value=>value[0].toUpperCase()+value.slice(1))}</select></label>`;
 const legacy=item.legacyType!==undefined&&item.legacyType!==item.type?`<small>Previous item type: ${esc(item.legacyType)} (retained)</small>`:'';
 return `<div class="sm-grid">${field('Title',`${prefix}.title`,item.title||'')}${quantityControl}${type}${reference}${extra}</div>${warning}${legacy}${area('Description / Notes',`${prefix}.details`,item.details||'',5)}`;
}
export function gearEntry(options,render){
 const {id,key,item,index=0,collapsed=false,classes=''}=options;
 return entryCard({id,collection:key,collapsed,classes:`sm-gear-entry ${classes}`.trim(),cardAttributes:{'data-content-title-fallback':`Item ${index+1}`},title:lootTitle(item,`Item ${index+1}`),removeTitle:'Remove entry',removeLabel:`Remove ${item.title||`Item ${index+1}`}`,body:gearFields(options,render)});
}
export function eventFields({item,prefix,metadata='',extra=''}, {field,area}){
 return `<div class="sm-grid">${field('Event Title',`${prefix}.title`,item.title||'')}${metadata}</div>${area('Description',`${prefix}.details`,item.details||'',5)}${extra}`;
}
export function eventEntry(options,render){
 const {id,key,item,index=0,collapsed=false}=options;
 return entryCard({id,collection:key,collapsed,classes:'sm-event-entry',cardAttributes:{'data-content-title-fallback':`Event ${index+1}`},title:item.title||`Event ${index+1}`,removeTitle:'Remove entry',removeLabel:`Remove ${item.title||`Event ${index+1}`}`,body:eventFields(options,render)});
}
