import {partyRoster} from './travel/model.mjs';
export const RESOURCES=Object.freeze({bullets:{label:'Bullets',key:'bullets'},cleanGrub:{label:'Clean Grub',key:'grub'},cleanWater:{label:'Clean Water',key:'water'}});
export const tradingDefaults=()=>({enabled:false,values:{bullets:1,cleanGrub:1,cleanWater:1}});
export function normalizeTrading(raw){
 if(raw!==undefined&&(!raw||typeof raw!=='object'||Array.isArray(raw)))throw new Error('Invalid resource trading configuration.');
 if(raw?.values!==undefined&&(!raw.values||typeof raw.values!=='object'||Array.isArray(raw.values)))throw new Error('Invalid resource values.');
 const next={...tradingDefaults(),...raw,values:{...tradingDefaults().values,...raw?.values}};
 if(typeof next.enabled!=='boolean')throw new Error('Resource trading enabled must be boolean.');
 for(const key of Object.keys(RESOURCES))if(!Number.isSafeInteger(next.values[key])||next.values[key]<1||next.values[key]>1000000)throw new Error('Resource values must be whole numbers from 1 to 1,000,000.');
 return next;
}
export function tradeQuote(rates,give,receive,quantity){
 const {values}=normalizeTrading(rates);
 if(!Object.hasOwn(RESOURCES,give)||!Object.hasOwn(RESOURCES,receive)||give===receive)throw new Error('Choose two different resources.');
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>1000000)throw new Error('Trade quantity must be a whole number from 1 to 1,000,000.');
 const amount=Number(BigInt(quantity)*BigInt(values[give])/BigInt(values[receive]));
 if(!Number.isSafeInteger(amount)||amount<1)throw new Error('This trade must provide at least one unit in return.');
 return {give,receive,quantity,amount,rate:`${values[give]} / ${values[receive]}`};
}
export function characterResources(actor,user,env=globalThis){
 if(env.game.system?.id!=='mutant-year-zero'||actor?.documentName!=='Actor'||!['mutant','animal','human','robot'].includes(actor.type)||!actor.testUserPermission?.(user,'OWNER'))throw new Error('Choose an owned, updateable MYZ character Actor.');
 if(!partyRoster(env).members.some(member=>member.actorUuid===actor.uuid))throw new Error('Choose an eligible character assigned to the Party Roster.');
 const resources={};for(const [key,{key:field}] of Object.entries(RESOURCES)){const value=actor.system?.resources?.[field]?.value;if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER)throw new Error('Character resources are missing or invalid.');resources[key]=value;}
 return resources;
}
export function tradeUpdate(actor,user,rates,give,receive,quantity,env=globalThis){
 const balances=characterResources(actor,user,env),quote=tradeQuote(rates,give,receive,quantity);
 if(balances[give]<quantity)throw new Error('Insufficient resources.');
 const total=balances[receive]+quote.amount;if(!Number.isFinite(total)||total>Number.MAX_SAFE_INTEGER)throw new Error('Resource balance would overflow.');
 return {quote,update:{[`system.resources.${RESOURCES[give].key}.value`]:balances[give]-quantity,[`system.resources.${RESOURCES[receive].key}.value`]:total}};
}
