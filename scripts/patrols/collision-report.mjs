import {escapeHTML as esc} from '../zone/config.mjs';
import {dispositionDefinitions} from './dispositions.mjs';
import {tokenSource} from './movement.mjs';
export function collisionDetails(tokens,env){const definitions=dispositionDefinitions(env);return tokens.map(token=>({name:typeof token.name==='string'&&token.name.trim()?token.name:'Unnamed token',disposition:definitions.find(d=>d.value===tokenSource(token).disposition)?.label||'Unknown'}));}
export function collisionContent(route,tokens){return `<article class="myz-patrol-collision"><h3>Patrol Stopped</h3><p><strong>Route:</strong> ${esc(route.name)}<br><strong>Sector:</strong> ${esc(route.encounter.sector)}</p><ul>${tokens.map(t=>`<li><strong>Encountered:</strong> ${esc(t.name)}<br><strong>Disposition:</strong> ${esc(t.disposition)}</li>`).join('')}</ul><p>The patrol has stopped. Click Start in Patrols / Trade Routes to continue.</p></article>`;}
export async function postCollision(route,tokens,env){
 if(typeof env.ChatMessage?.getWhisperRecipients!=='function'||typeof env.ChatMessage?.create!=='function')throw Error('GM collision chat is unavailable. The patrol remains stopped.');
 const whisper=[...new Set(env.ChatMessage.getWhisperRecipients('GM').filter(u=>u.isGM&&u.active===true&&typeof u.id==='string'&&u.id).map(u=>u.id))];
 if(!whisper.length)throw Error('No active GM chat recipients. The patrol remains stopped; no public message was sent.');
 const message=await env.ChatMessage.create({user:env.game.user.id,whisper,blind:false,content:collisionContent(route,tokens)});
 if(!message?.id)throw Error('Collision chat delivery could not be confirmed. The patrol remains stopped; check chat before retrying.');
 return message;
}
