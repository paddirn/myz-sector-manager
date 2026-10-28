import {partyRoster} from './travel/model.mjs';
export const RESOURCES=Object.freeze({bullets:{label:'Bullets',key:'bullets'},cleanGrub:{label:'Clean Grub',key:'grub'},cleanWater:{label:'Clean Water',key:'water'},booze:{label:'Booze (Dose)',key:'booze'}});
export const tradingDefaults=()=>({enabled:false,values:{bullets:1,cleanGrub:1,cleanWater:1,booze:1}});
// Rates remain relative values. Strings preserve authored decimal digits exactly.
export function decimalFraction(value){
 let text=typeof value==='number'&&Number.isFinite(value)?String(value):typeof value==='string'?value.trim():'';
 if(typeof value==='number'&&/[eE]/.test(text)){
  const [mantissa,power]=text.toLowerCase().split('e'),digits=mantissa.replace('.',''),point=mantissa.split('.')[0].length+Number(power);
  text=point<=0?'0.'+'0'.repeat(Math.min(400,-point))+digits:point>=digits.length?digits+'0'.repeat(Math.min(400,point-digits.length)):digits.slice(0,point)+'.'+digits.slice(point);
 }
 if(!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)||text.length>32)throw new Error('Resource values must be positive decimals up to 1,000,000, with at most 18 decimal places.');
 const [whole='',fraction='']=text.split('.');if(fraction.length>18)throw new Error('Use at most 18 decimal places.');
 const numerator=BigInt((whole||'0')+fraction),denominator=10n**BigInt(fraction.length);
 if(numerator<=0n||numerator>1000000n*denominator)throw new Error('Resource values must be greater than zero and at most 1,000,000.');
 return {numerator,denominator};
}
// Add one whole unit without converting authored fractional digits to binary floats.
export function stepResourceValue(value,direction){
 if(direction!==1&&direction!==-1)throw new Error('Invalid resource value step.');
 const {numerator,denominator}=decimalFraction(value),next=numerator+BigInt(direction)*denominator;
 if(next<=0n||next>1000000n*denominator)throw new Error('Resource value step would exceed the positive rate limits.');
 const whole=next/denominator,remainder=next%denominator,places=denominator.toString().length-1;
 return places?`${whole}.${remainder.toString().padStart(places,'0')}`:String(whole);
}
export function normalizeTrading(raw){
 if(raw!==undefined&&(!raw||typeof raw!=='object'||Array.isArray(raw)))throw new Error('Invalid resource trading configuration.');
 if(raw?.values!==undefined&&(!raw.values||typeof raw.values!=='object'||Array.isArray(raw.values)))throw new Error('Invalid resource values.');
 const next={...tradingDefaults(),...raw,values:{...tradingDefaults().values,...raw?.values}};
 if(typeof next.enabled!=='boolean')throw new Error('Resource trading enabled must be boolean.');
 for(const key of Object.keys(RESOURCES)){decimalFraction(next.values[key]);if(typeof next.values[key]==='string'){let text=next.values[key].trim().replace(/^0+(?=\d)/,'');if(text.startsWith('.'))text='0'+text;next.values[key]=text;}}return next;
}
const gcd=(a,b)=>b===0n?a:gcd(b,a%b);
export function tradeRatio(rates,give,receive){
 const {values}=normalizeTrading(rates);
 if(!Object.hasOwn(RESOURCES,give)||!Object.hasOwn(RESOURCES,receive)||give===receive)throw new Error('Choose two different resources.');
 const a=decimalFraction(values[give]),b=decimalFraction(values[receive]);let numerator=a.numerator*b.denominator,denominator=a.denominator*b.numerator;
 const divisor=gcd(numerator,denominator);numerator/=divisor;denominator/=divisor;
 const minimum=(denominator+numerator-1n)/numerator;
 if(minimum>1000000n)throw new Error('Minimum Give quantity exceeds the 1,000,000-unit limit for these rates.');
 return {numerator,denominator,minimum:Number(minimum),rate:`${values[give]} / ${values[receive]}`,equivalent:`${denominator} for ${numerator}`};
}
export function tradeQuote(rates,give,receive,quantity){
 const ratio=tradeRatio(rates,give,receive);
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>1000000)throw new Error('Trade quantity must be a whole number from 1 to 1,000,000.');
 const amount=Number(BigInt(quantity)*ratio.numerator/ratio.denominator);
 if(!Number.isSafeInteger(amount)||amount<1)throw new Error(`Minimum Give quantity is ${ratio.minimum}; this request must provide at least one unit in return.`);
 return {give,receive,quantity,amount,minimum:ratio.minimum,rate:ratio.rate,equivalent:ratio.equivalent};
}
export const resourceLabel=(key,quantity)=>key==='bullets'&&quantity===1?'Bullet':RESOURCES[key].label;
export function characterResources(actor,user,env=globalThis){
 if(env.game.system?.id!=='mutant-year-zero'||actor?.documentName!=='Actor'||!['mutant','animal','human','robot'].includes(actor.type)||!actor.testUserPermission?.(user,'OWNER'))throw new Error('Choose an owned, updateable MYZ character Actor.');
 if(!partyRoster(env).members.some(member=>member.actorUuid===actor.uuid))throw new Error('Choose an eligible character assigned to the Party Roster.');
 const resources={};for(const [key,{key:field}] of Object.entries(RESOURCES)){const value=actor.system?.resources?.[field]?.value;if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER)throw new Error('Character resources are missing or invalid.');resources[key]=value;}
 return resources;
}
export function tradeRequestQuote(actor,user,rates,give,receive,quantity,env=globalThis){
 const balances=characterResources(actor,user,env),quote=tradeQuote(rates,give,receive,quantity);
 if(balances[give]<quantity)throw new Error('Insufficient resources.');
 return quote;
}
