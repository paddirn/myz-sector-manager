import {escapeEntryText as esc} from './entry.mjs';
// Preserve nonempty saved custom values; keep existing empty/default semantics.
// Choosing a supported option remains an explicit ordinary form edit.
export function selectOptions(value,choices){
 const saved=value===undefined||value===null?'':String(value),known=choices.map(String),custom=saved!==''&&!known.includes(saved);
 return (custom?`<option value="${esc(saved)}" selected>${esc(saved)} (Legacy/custom value)</option>`:'')+choices.map(choice=>`<option value="${esc(choice)}" ${String(choice)===saved?'selected':''}>${esc(choice)}</option>`).join('');
}
