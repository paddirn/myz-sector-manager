import {withLegacyReferences} from './helpers/reference-fixture.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {journalBodyText,locationDescription} from '../scripts/location-text.mjs';
import {generateEntry} from '../scripts/entry-generation.mjs';
import {TABLE_UUIDS} from '../scripts/sector-randomizer.mjs';

test('journal HTML becomes paragraph-separated text without media, attributes or executable contents',()=>{
  const html='<h2>Hospital &amp; Ruins</h2><p>First &quot;room&quot;.<br>Second line.</p><p>Caf&eacute; &#x2014; &#169;</p><img src="secret.png" alt="not copied"><picture><source srcset="other.webp"></picture><video src="film"><p>media text</p></video><audio>sound</audio><iframe>frame</iframe><script>execute()</script><style>body{color:red}</style><object>object</object><p>Last <b>safe</b> paragraph.</p>';
  assert.equal(journalBodyText(html,{}),'Hospital & Ruins\n\nFirst "room".\nSecond line.\n\nCafé — ©\n\nLast safe paragraph.');
});
test('empty/media-only content stays empty; lists and plain multiline content retain readable separation',()=>{
  assert.equal(journalBodyText('<img src="data:image/png;base64,AAAA"><script>unsafe</script><iframe src="bad"></iframe>',{}),'');assert.equal(journalBodyText('First\n\nSecond',{}),'First\n\nSecond');assert.match(journalBodyText('<ul><li>One</li><li>Two</li></ul>',{}),/- One\n- Two/);
});
test('world/compendium Journal and Page UUIDs retain titles and extract only relevant Text pages in sort order',async()=>{
  for(const prefix of ['JournalEntry.book','Compendium.myz.ruins.JournalEntry.book'])for(const asPage of [false,true]){
    const first={type:'text',sort:10,text:{content:'<p>First paragraph</p><p>Another</p>'}},second={type:'text',sort:20,text:{content:'<p>Second page</p>'}},image={type:'image',sort:0,src:'image.png',text:{content:'Do not include'}};
    const uuid=prefix+(asPage?'.JournalEntryPage.specific':''),doc=asPage?{...second,documentName:'JournalEntryPage',uuid}:{documentName:'JournalEntry',uuid,pages:new Map([['second',second],['image',image],['first',first]])};
    const result={uuid,text:'Keep title',documentType:doc.documentName,sources:[]},snapshot=await locationDescription(result,{fromUuid:async()=>doc});assert.equal(snapshot.uuid,uuid);assert.equal(snapshot.text,'Keep title');assert.equal(snapshot.details,asPage?'Second page':'First paragraph\n\nAnother\n\nSecond page');second.text.content='Changed later';assert(!snapshot.details.includes('Changed later'));
  }
});
test('missing/empty journals preserve references and produce empty descriptions without name lookup',async()=>{
  const result={uuid:'JournalEntry.missing',text:'Saved title'};for(const doc of [null,{documentName:'JournalEntry',pages:[]},{documentName:'JournalEntryPage',type:'image',src:'asset.png'}]){const next=await locationDescription(result,{fromUuid:async()=>doc});assert.equal(next.uuid,result.uuid);assert.equal(next.details,'');}
  const denied=await locationDescription(result,{fromUuid:async()=>{throw new Error('Denied');}});assert.equal(denied.details,'');assert.match(denied.referenceWarning,/unavailable/);
});
test('manual Location generation snapshots page body without modifying the source sector or the document',async()=>{
  const page={uuid:'JournalEntry.ruin.JournalEntryPage.p',documentName:'JournalEntryPage',name:'Hospital',type:'text',text:{content:'<p>Descriptive room.</p><p>More detail.</p>'}},table={uuid:TABLE_UUIDS.ruinsA,name:'Ruins',documentName:'RollTable',roll:async()=>({results:[{documentUuid:page.uuid}]})};
  const env={game:{user:{isGM:true}},fromUuid:async uuid=>uuid===page.uuid?page:uuid===table.uuid?table:null};withLegacyReferences(env);const sector={terrain:'Overgrown Ruins',locations:[{title:'Manual',details:'Keep edits'}]},before=structuredClone(sector);const entry=await generateEntry('locations',sector,{env});assert.equal(entry.title,'Hospital');assert.equal(entry.uuid,page.uuid);assert.equal(entry.details,'Descriptive room.\n\nMore detail.');assert.deepEqual(sector,before);
});
test('preformatted lines remain separated and markdown fallback cannot introduce embedded media or scripts',async()=>{
  assert.equal(journalBodyText('<pre>First line\nSecond line</pre>',{}),'First line\nSecond line');
  const page={documentName:'JournalEntryPage',type:'text',text:{markdown:'<p>Safe</p><script>unsafe()</script><img src="image.png">'}};assert.equal((await locationDescription({uuid:'JournalEntry.a.JournalEntryPage.p'},{fromUuid:async()=>page})).details,'Safe');
});
