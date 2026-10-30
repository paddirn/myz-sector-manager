export function travelNoteText(event){
 const lines=[`Travel Event — ${event.code}${event.sectorName?`: ${event.sectorName}`:''}`,event.expeditionName?`Expedition: ${event.expeditionName}`:''];
 const weather=event.weatherChange,encounter=event.encounter,detection=event.detection;
 if(weather)lines.push('Weather Change',`Previous: ${weather.previous||'Unknown'}`,`Current: ${weather.condition}`,weather.description||'');
 if(encounter){lines.push('Random Encounter',encounter.title,encounter.details||'',encounter.category?`Type: ${encounter.category}`:'',encounter.uuid?`Reference: ${encounter.uuid}`:'');
  if(detection){lines.push('Find the Path / Stalker checks (hidden, unpushed)');for(const roll of detection.rolls||[])lines.push(`${roll.name}: ${roll.successes} ${roll.successes===1?'success':'successes'}`,roll.formula||'',(roll.dice||[]).map(d=>`${d.diceType}: ${d.value}`).join(', '));lines.push(...(detection.issues||[]),detection.recommendation?`Suggested awareness — house rule: ${detection.recommendation}`:'');}
 }
 if(event.errors?.length)lines.push(`Diagnostics: ${event.errors.join('; ')}`);
 return lines.filter(Boolean).join('\n\n');
}
export function noteChunks(text){const chunks=[];for(let start=0;start<text.length;){let end=Math.min(start+20000,text.length);if(end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1]))end--;chunks.push(text.slice(start,end));start=end;}return chunks;}
