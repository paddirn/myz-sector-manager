// Journal descriptions are plain-text snapshots, never enriched or executed.
const BLOCKS=new Set(['p','div','section','article','h1','h2','h3','h4','h5','h6','blockquote','pre','figure','figcaption','ul','ol','table']);
const OMIT=new Set(['img','picture','video','audio','iframe','script','style','object','embed','svg','canvas','source','track','noscript','template','link','meta']);
const VOID=new Set(['img','embed','source','track','link','meta']);
const clean=value=>value.replace(/[ \t]+\n/g,'\n').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
function boundary(tag,closing){return tag==='br'?(closing?'':'\n'):tag==='li'?(closing?'':'\n- '):tag==='tr'?'\n':['td','th'].includes(tag)&&closing?'\t':BLOCKS.has(tag)?'\n\n':'';}
function decode(value){
  const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',mdash:'—',ndash:'–',hellip:'…',copy:'©',eacute:'é'};
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(match,entity)=>{if(entity[0]!=='#')return Object.hasOwn(named,entity)?named[entity]:match;const n=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'�';});
}
export function journalBodyText(html,env=globalThis){
  const source=String(html??'');
  const plain=!/<[a-z!/][^>]*>/i.test(source);
  if(env.document?.createElement){
    const template=env.document.createElement('template');template.innerHTML=source;
    template.content.querySelectorAll([...OMIT].join(',')).forEach(node=>node.remove());
    if(plain)return clean(template.content.textContent);
    const walk=node=>node.nodeType===1&&node.localName==='pre'?'\n\n'+node.textContent+'\n\n':node.nodeType===3?node.textContent.replace(/\s+/g,' '):node.nodeType===1?boundary(node.localName,false)+Array.from(node.childNodes,walk).join('')+boundary(node.localName,true):Array.from(node.childNodes||[],walk).join('');
    return clean(walk(template.content));
  }
  // Dependency-free server/test fallback; Foundry uses the inert DOM path above.
  if(plain)return clean(decode(source));
  let out='',hidden=[],pre=0;
  for(const token of source.match(/<!--[\s\S]*?-->|<(?:"[^"]*"|'[^']*'|[^'">])*>|[^<]+|</g)||[]){
    if(token.startsWith('<!--'))continue;
    const tag=token.match(/^<\s*(\/?)\s*([a-z][\w-]*)/i);
    if(tag){const name=tag[2].toLowerCase(),closing=Boolean(tag[1]);if(OMIT.has(name)){if(closing){const index=hidden.lastIndexOf(name);if(index>=0)hidden.length=index;}else if(!VOID.has(name)&&!token.endsWith('/>'))hidden.push(name);continue;}if(!hidden.length){if(name==='pre')pre+=closing?-1:1;out+=boundary(name,closing);}}
    else if(!hidden.length&&!token.startsWith('<'))out+=pre>0?decode(token):decode(token).replace(/\s+/g,' ');
  }
  return clean(out);
}
export async function locationDescription(result,env=globalThis){
  if(result.documentType&&!['JournalEntry','JournalEntryPage'].includes(result.documentType))throw new Error('Location results must reference a JournalEntry or JournalEntryPage.');
  let document;
  try{document=result.uuid?await env.fromUuid(result.uuid):null;}catch{}
  if(!document)return {...result,details:'',referenceWarning:result.referenceWarning||`Location journal is missing or unavailable: ${result.uuid||result.text}.`};
  if(!['JournalEntry','JournalEntryPage'].includes(document.documentName))throw new Error('Location results must reference a JournalEntry or JournalEntryPage.');
  try{
    const pages=document.documentName==='JournalEntryPage'?[document]:Array.from(document.pages?.values?document.pages.values():document.pages||[]).sort((a,b)=>(a.sort??0)-(b.sort??0));
    const details=pages.filter(page=>page.type==='text').map(page=>journalBodyText(page.text?.content||page.text?.markdown||'',env)).filter(Boolean).join('\n\n');
    return {...result,details};
  }catch(error){return {...result,details:'',referenceWarning:`Location text is unavailable: ${error.message}`};}
}
