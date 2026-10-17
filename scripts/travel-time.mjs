// Reference calculator only: all durations are minutes; no Foundry side effects.
export const TRAVEL_DEFAULTS={mode:'foot',rushed:false,stalker:false,open:false,difficult:false,difficulty:2,night:false};
export function travelOptions(value={}){
  const result={...TRAVEL_DEFAULTS,...value};
  result.mode=result.mode==='vehicle'?'vehicle':'foot';
  const number=Number(result.difficulty);result.difficulty=Number.isFinite(number)?Math.max(2,number):2;
  if(result.difficult)result.open=false;
  return result;
}
export function travelTimes(value={}){
  const o=travelOptions(value);
  return {explore:(o.mode==='vehicle'?120:240)*(o.rushed?.25:1)*(o.stalker?.5:1)*(o.open?.5:1)*(o.difficult?o.difficulty:1)*(o.night?2:1),pass:o.mode==='vehicle'?30:60};
}
export function formatDuration(minutes){
  const hours=Math.floor(minutes/60),rest=Number((minutes-hours*60).toPrecision(12));
  return [hours?`${hours} hour${hours===1?'':'s'}`:'',rest||!hours?`${rest} minute${rest===1?'':'s'}`:''].filter(Boolean).join(' ');
}
