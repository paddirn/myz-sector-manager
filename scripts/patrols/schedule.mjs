// World-calendar arithmetic only. No wall clock, per-minute loops or calendar add-ons.
const mod=(n,d)=>((n%d)+d)%d;
const floor=(n,d)=>(n-mod(n,d))/d;
export const scheduleDefaults=()=>({mode:'always',startMinute:360,stopMinute:1080,departureMinute:360,restrictHours:false});
export function validateSchedule(raw){
 const s={...scheduleDefaults(),...raw};
 if(!['always','hours','departure'].includes(s.mode)||typeof s.restrictHours!=='boolean'||!['startMinute','stopMinute','departureMinute'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=0))throw Error('Invalid patrol schedule.');
 if((s.mode==='hours'||s.mode==='departure'&&s.restrictHours)&&s.startMinute===s.stopMinute)throw Error('Operating start and stop must differ; use Always Active for all-day travel.');
 return s;
}
export function worldClock(time,now){
 const d=time?.calendar?.days||{hoursPerDay:24,minutesPerHour:60,secondsPerMinute:60};
 const minuteMs=d.secondsPerMinute*1000,dayMs=d.hoursPerDay*d.minutesPerHour*minuteMs;
 if(![minuteMs,dayMs,d.hoursPerDay,d.minutesPerHour].every(n=>Number.isSafeInteger(n)&&n>0))throw Error('Unsupported world calendar units for patrol scheduling.');
 const wholeSeconds=Math.floor(now/1000),c=time?.calendar?.timeToComponents?.(wholeSeconds);
 const phase=c?((c.hour*d.minutesPerHour+c.minute)*d.secondsPerMinute+c.second)*1000:now;
 if(!Number.isSafeInteger(phase))throw Error('World calendar returned an invalid time of day.');
 return {dayMs,minuteMs,minutesPerHour:d.minutesPerHour,hoursPerDay:d.hoursPerDay,offsetMs:Number(mod(BigInt(phase)-BigInt(c?wholeSeconds*1000:now),BigInt(dayMs)))};
}
export function validateClockSchedule(s,clock){
 const total=clock.dayMs/clock.minuteMs;
 const keys=s.mode==='always'?[]:s.mode==='hours'?['startMinute','stopMinute']:s.restrictHours?['startMinute','stopMinute','departureMinute']:['departureMinute'];
 if(keys.some(k=>s[k]>=total))throw Error('Schedule time is outside the configured world-calendar day.');
}
export function parseTime(text,clock){const m=/^(\d{1,3}):(\d{2,3})$/.exec(text||'');if(!m||Number(m[1])>=clock.hoursPerDay||Number(m[2])>=clock.minutesPerHour)throw Error('Enter a valid world-calendar time as HH:MM.');return Number(m[1])*clock.minutesPerHour+Number(m[2]);}
export const formatTime=(minute,clock)=>`${String(Math.floor(minute/clock.minutesPerHour)).padStart(2,'0')}:${String(minute%clock.minutesPerHour).padStart(2,'0')}`;
function windows(s,c){if(s.mode==='always'||s.mode==='departure'&&!s.restrictHours)return [[0n,BigInt(c.dayMs)]];const a=BigInt(s.startMinute*c.minuteMs),b=BigInt(s.stopMinute*c.minuteMs),d=BigInt(c.dayMs);return a<b?[[a,b]]:[[0n,b],[a,d]];}
export function activeMilliseconds(from,to,s,c){
 const day=BigInt(c.dayMs),offset=BigInt(c.offsetMs),w=windows(s,c),daily=w.reduce((n,[a,b])=>n+b-a,0n);
 const prefix=t=>{const n=BigInt(t)+offset,p=mod(n,day);return floor(n,day)*daily+w.reduce((n,[a,b])=>n+(p<=a?0n:(p<b?p:b)-a),0n);};
 return prefix(to)-prefix(from);
}
export function nextDeparture(at,s,c,inclusive=true){const day=BigInt(c.dayMs),offset=BigInt(c.offsetMs),target=BigInt(s.departureMinute*c.minuteMs),n=BigInt(at)+offset;let result=floor(n,day)*day+target-offset;if(result<BigInt(at)||!inclusive&&result===BigInt(at))result+=day;const value=Number(result);if(!Number.isSafeInteger(value))throw Error('Next departure exceeds the supported game clock.');return value;}
function completion(from,to,needed,s,c){let lo=BigInt(from),hi=BigInt(to);while(lo<hi){const mid=lo+(hi-lo)/2n;if(activeMilliseconds(from,Number(mid),s,c)>=needed)hi=mid;else lo=mid+1n;}return Number(lo);}
export const cycleSteps=r=>r.pattern==='loop'?r.waypoints.length:2*(r.waypoints.length-1);
export function shiftSteps(r,steps){const n=r.waypoints.length;if(r.pattern==='loop'){r.index=Number((BigInt(r.index)+steps)%BigInt(n));r.direction=1;}else{const end=n-1,cycle=BigInt(2*end),phase=r.direction===1?r.index:2*end-r.index,p=Number((BigInt(phase)+steps)%cycle);r.index=p<=end?p:2*end-p;r.direction=p<end?1:-1;}return r;}
export function resetDeparture(route,now,clock){
 const s=validateSchedule(route.schedule);if(s.mode!=='departure'){delete route.scheduleState;return;}
 route.scheduleState={homeIndex:route.index,homeDirection:route.direction,remainingSteps:null,nextDepartureMs:nextDeparture(now,s,clock)};
}
export function advanceScheduled(route,now,clock,maxSteps=null){
 const r=structuredClone(route),s=validateSchedule(r.schedule);validateClockSchedule(s,clock);
 let steps=0n,limited=false;const period=BigInt(Math.round(r.minutesPerSector*60000)),limit=maxSteps===null?null:BigInt(maxSteps);
 if(!r.running||now===null)return {route:r,steps,limited};
 if(r.lastTimeMs===null){r.lastTimeMs=now;return {route:r,steps,limited};}
 if(now<r.lastTimeMs){r.issue='Clock rewound: waiting for the previous time baseline.';return {route:r,steps,limited};}
 let cursor=r.lastTimeMs;
 const consume=(until,remaining=null)=>{
  const available=BigInt(r.progressMs)+activeMilliseconds(cursor,until,s,clock);let count=available/period;
  if(remaining!==null&&count>BigInt(remaining))count=BigInt(remaining);
  if(limit!==null&&steps+count>=limit){count=limit-steps;limited=true;}
  shiftSteps(r,count);steps+=count;
  if(limited){r.progressMs=0;return count;}
  r.progressMs=Number(available-count*period);return count;
 };
 if(s.mode!=='departure')consume(now);
 else{
  if(!r.scheduleState)resetDeparture(r,cursor,clock);
  const st=r.scheduleState;let stride=null;
  while(cursor<=now){
   if(st.remainingSteps===null){
    if(st.nextDepartureMs===null||st.nextDepartureMs<cursor)st.nextDepartureMs=nextDeparture(cursor,s,clock);
    if(st.nextDepartureMs>now)break;
    // Every full trip departing at this daily phase has the same duration. Skip whole cycles arithmetically.
    if(stride&&limit===null){const skip=(BigInt(now)-BigInt(st.nextDepartureMs))/stride;if(skip>0n){steps+=skip*BigInt(cycleSteps(r));st.nextDepartureMs=Number(BigInt(st.nextDepartureMs)+skip*stride);}}
    cursor=st.nextDepartureMs;st.remainingSteps=cycleSteps(r);st.nextDepartureMs=null;
   }
   const need=BigInt(st.remainingSteps)*period-BigInt(r.progressMs),available=activeMilliseconds(cursor,now,s,clock);
   if(available<need){const count=consume(now,st.remainingSteps);st.remainingSteps-=Number(count);break;}
   const finish=completion(cursor,now,need,s,clock),departure=cursor,oldProgress=r.progressMs,count=consume(finish,st.remainingSteps);st.remainingSteps-=Number(count);
   if(limited)break;
   r.progressMs=0;st.remainingSteps=null;st.nextDepartureMs=nextDeparture(finish,s,clock,false);cursor=finish;
   // A resumed partial trip is not representative of a complete daily cycle.
   if(count===BigInt(cycleSteps(r))&&oldProgress===0&&nextDeparture(departure,s,clock)===departure)stride=BigInt(st.nextDepartureMs)-BigInt(departure);
   if(cursor===now)break;
  }
 }
 r.lastTimeMs=now;r.issue='';return {route:r,steps,limited};
}
