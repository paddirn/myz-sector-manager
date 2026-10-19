import {expeditionRoster} from './model.mjs';
export function findPathPool(actor,member,env=globalThis){
 if(env.game.system?.id!=='mutant-year-zero')throw new Error('Find the Path automation requires the official mutant-year-zero system.');
 const skills=Array.from(actor.items?.values?.()||actor.items||[]).filter(item=>item.type==='skill'&&item.system?.skillKey==='FINDTHEPATH');
 const matching=member.skillUuid?skills.filter(skill=>skill.uuid===member.skillUuid):skills;
 if(matching.length!==1)throw new Error(matching.length?'Multiple Find the Path skills; choose the intended skill in Party Roster.':'No embedded FINDTHEPATH skill.');
 const skill=matching[0];if(member.eligibility==='exclude'||(member.eligibility!=='include'&&!(Number(skill.system.value)>0)))return null;
 if(typeof actor.getRollData!=='function')throw new Error('Actor does not expose supported getRollData().');
 const data=actor.getRollData(),attribute=skill.system.attribute,base=data?.attributeDiceTotals?.[attribute],totals=data?.skillDiceTotals?.FINDTHEPATH;
 const pool={base:base?.baseDiceTotal,skill:totals?.skillDiceTotal,gear:totals?.gearDiceTotal};
 if(!attribute||!Object.values(pool).every(value=>Number.isSafeInteger(value)&&Math.abs(value)<=100)||pool.base<0||pool.gear<0)throw new Error('Unsupported current MYZ attribute/skill/gear dice totals; GM detection required.');
 return {...pool,attribute,skillUuid:skill.uuid,modifiers:{base:structuredClone(base.modifiersToAttributes||[]),skill:structuredClone(totals.modifiersToSkill||[]),gear:structuredClone(totals.modifiersToGear||[])}};
}
const checkAuthority=env=>{if(!env.game.user.isGM||env.game.users&&env.game.users.activeGM?.id!==env.game.user.id)throw new Error('Active GM authority changed; remaining Stalker checks skipped.');};
export async function rollFindPath(actor,member,env=globalThis){
 checkAuthority(env);
 const pool=findPathPool(actor,member,env);if(!pool)return null;
 const parser=env.game.myz?.DiceRoller;if(typeof parser?.ParseResults!=='function'||typeof parser?.CountSuccesses!=='function')throw new Error('Official MYZ dice parsing API is unavailable.');
 // Evaluate only: no Item.roll, DiceRoller.Roll/SendToChat, toMessage, push or 3D broadcast.
 const formula=`${pool.base}db + ${Math.abs(pool.skill)}ds + ${pool.gear}dg`,roll=await new env.Roll(formula).evaluate();
 const dice=await parser.ParseResults(roll,pool.skill),successes=parser.CountSuccesses(dice);
 if(!Array.isArray(dice)||!Number.isFinite(successes))throw new Error('Invalid MYZ skill-roll result.');
 return {actorUuid:actor.uuid,name:actor.name,pool,formula,dice:structuredClone(dice),successes,hidden:true,pushed:false};
}
export async function detectEncounter({roster,group,groups,mode='all',enabled=true,env=globalThis}){
 const result={rolls:[],issues:[],highest:null,recommendation:'Encounter awareness uncertain; GM determination required.',houseRule:true};
 if(!enabled){result.issues.push('Automatic Find the Path is disabled.');return result;}
 const candidates=[];
 for(const member of expeditionRoster(roster,group,groups).filter(member=>member.enabled&&member.eligibility!=='exclude')){
  try{checkAuthority(env);const actor=await env.fromUuid(member.actorUuid);checkAuthority(env);if(actor?.documentName!=='Actor')throw new Error('Actor missing or unavailable.');if(actor.testUserPermission&&!actor.testUserPermission(env.game.user,'OBSERVER'))throw new Error('Actor is inaccessible.');const pool=findPathPool(actor,member,env);if(pool)candidates.push({actor,member});}
  catch(error){result.issues.push(`${member.actorUuid}: ${error.message}`);}
 }
 let selected=candidates;
 if(mode==='lead'){const lead=candidates.find(entry=>entry.member.lead);if(lead)selected=[lead];else result.issues.push('Lead Stalker unavailable; using all eligible Stalkers as fallback.');}
 for(const {actor,member} of selected){try{const roll=await rollFindPath(actor,member,env);if(roll)result.rolls.push(roll);}catch(error){result.issues.push(`${actor.name}: ${error.message}`);}}
 if(result.rolls.length){result.highest=Math.max(...result.rolls.map(roll=>roll.successes));result.recommendation=result.highest>0?'Party spots signs of the encounter first (house-rule recommendation; GM decides circumstances).':'No advance warning; awareness uncertain. Possible ambush only if the GM determines the encounter is hostile and circumstances support it.';}
 else result.issues.push('No eligible Stalker could be rolled; detection was not automatically determined.');
 return result;
}
