import {test} from 'node:test';
import assert from 'node:assert/strict';
import {imagePath,journalImageSource,fitImage,SPECIAL_ACCENT} from '../scripts/sector-images.mjs';
import {normalizeSectorType,sectorTabs} from '../scripts/sector-types.mjs';
import {tabHasContent} from '../scripts/sector-content.mjs';

test('v14 Image Journal pages use page.src, never their UUID or image caption',()=>{
  for(const uuid of ['JournalEntry.a.JournalEntryPage.p','Compendium.myz.book.JournalEntry.a.JournalEntryPage.p']){
    const page={documentName:'JournalEntryPage',type:'image',uuid,src:'worlds/myz/illustration.webp',image:{caption:'Caption is not an image URL'}};assert.equal(journalImageSource(page),page.src);
    assert.equal(journalImageSource({...page,type:'text'}),null);assert.equal(journalImageSource({...page,src:null}),null);assert.equal(journalImageSource({...page,documentName:'JournalEntry'}),null);
  }
});
test('image paths allow local and remote image assets but reject executable/media/embedded bytes',()=>{
  for(const path of ['worlds/test/map.png','icons/sector.svg','https://example.com/map.avif?key=value','modules/myz/art.jpg'])assert.equal(imagePath(path),path);
  for(const path of ['',null,'javascript:alert(1)','data:image/png;base64,AAA','blob:temporary','clip.webm','x\n.png'])assert.equal(imagePath(path),null);
});
test('overlay aspect fit centers landscape and portrait textures within the upper-third region',()=>{
  const region={x:10,y:20,width:120,height:40};
  assert.deepEqual(fitImage(600,100,region),{x:10,y:30,width:120,height:20});assert.deepEqual(fitImage(100,600,region),{x:66.66666666666666,y:20,width:6.666666666666667,height:40});
  assert.equal(fitImage(0,0,region),null);assert.equal(SPECIAL_ACCENT,0x9563c9);
});
test('image defaults and conversion preserve references/paths/unknown metadata without embedding data',()=>{
  const old={sectorType:'special',special:{source:'Book',future:'Keep'}};const initial=normalizeSectorType(old);assert.equal(initial.special.overlayImage,'');assert.deepEqual(initial.special.images,[]);assert.equal(old.special.images,undefined);
  initial.special.overlayImage='worlds/myz/label.webp';initial.special.images.push({title:'Illustration',uuid:'JournalEntry.a.JournalEntryPage.p',details:'Notes\n\nMore',imageSrc:'worlds/myz/illustration.png'});
  const before=structuredClone(initial.special);for(const sectorType of ['normal','special','normal','special']){const next=normalizeSectorType({...initial,sectorType});assert.deepEqual(next.special,before);assert.equal(sectorTabs(next).includes('Images'),sectorType==='special');}
  assert.equal(tabHasContent(initial,'Images'),true);assert.equal(tabHasContent(normalizeSectorType({}),'Images'),false);
});
