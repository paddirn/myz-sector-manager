import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCoordinate,formatCoordinate,canonicalCoordinate,validateGrid,coordinateToBounds,positionToCoordinate,gridBounds,tokenCenter,locateToken,updateLocation} from '../scripts/zone/grid.mjs';
const grid=()=>({reference:'B3',originX:500,originY:800,width:400,height:250,columns:30,rows:20,columnAxis:'x',columnDirection:1,rowDirection:1});

test('coordinates normalize padded/separated labels and support multiple letters',()=>{
  for(const [input,output] of [['a-07','A7'],['AA1','AA1'],[' az 010 ','AZ10'],['ZZ999','ZZ999']])assert.equal(canonicalCoordinate(input),output);
  assert.deepEqual(parseCoordinate('AA1'),{column:27,row:1});
  for(const invalid of ['A0','1A','A-0','A1junk','',null,'A1.5'])assert.equal(parseCoordinate(invalid),null);
  assert.equal(formatCoordinate(26,10),'Z10');assert.equal(formatCoordinate(27,1),'AA1');assert.equal(formatCoordinate(703,2),'AAA2');assert.equal(formatCoordinate(0,1),null);
});
test('grid conversion is reversible for offsets, swapped axes and both directions',()=>{
  for(const columnAxis of ['x','y'])for(const columnDirection of [1,-1])for(const rowDirection of [1,-1]){
    const g={...grid(),columnAxis,columnDirection,rowDirection};validateGrid(g);
    for(const code of ['A1','B3','A10','AA1','AD20']){
      const b=coordinateToBounds(code,g);assert.equal(positionToCoordinate({x:b.x+b.width/2,y:b.y+b.height/2},g),code);
      assert.equal(positionToCoordinate({x:b.x,y:b.y},g),code);
    }
  }
});
test('half-open boundaries and explicit map limits return no sector outside the grid',()=>{
  const g={...grid(),reference:'A1',originX:150,originY:200,columns:2,rows:2};
  assert.equal(positionToCoordinate({x:549.99,y:449.99},g),'A1');
  assert.equal(positionToCoordinate({x:550,y:200},g),'B1');
  assert.equal(positionToCoordinate({x:150,y:450},g),'A2');
  for(const point of [{x:149,y:200},{x:950,y:200},{x:150,y:700},{x:NaN,y:200}])assert.equal(positionToCoordinate(point,g),null);
  assert.equal(coordinateToBounds('C1',g),null);assert.equal(coordinateToBounds('A3',g),null);
  assert.deepEqual(gridBounds(g),{x:150,y:200,width:800,height:500});
});
test('invalid dimensions, bounds and reference coordinates cannot be saved',()=>{
  for(const change of [{width:0},{height:-1},{originX:Infinity},{columns:0},{rows:1.5},{columns:1001},{reference:'ZZ1'},{columnAxis:'z'},{rowDirection:0}])assert.throws(()=>validateGrid({...grid(),...change}));
});
test('token centers use source documents and the designated Scene grid size rather than rendered canvas objects',()=>{
  const token={x:999,y:999,width:1,height:1,toObject:()=>({x:50,y:60,width:2,height:3})};
  assert.deepEqual(tokenCenter(token,{grid:{size:100}}),{x:150,y:210});
  assert.deepEqual(tokenCenter(token,{grid:{size:100,sizeX:80,sizeY:90}}),{x:130,y:195});
  assert.equal(tokenCenter(token,{grid:{size:0}}),null);
});
test('locations distinguish missing Scene/token and outside positions while preserving last-known coordinates',()=>{
  const g={...grid(),reference:'A1',originX:0,originY:0};const track={sceneId:'zone',tokenId:'ark',lastKnown:'B2'};
  const scene={id:'zone',grid:{size:100},tokens:new Map([['ark',{x:375,y:0,width:1,height:1}]])};
  assert.deepEqual(locateToken(track,scene,g),{coordinate:'B1',status:'located'}); // top-left is A1, center is B1
  assert.equal(locateToken(track,{...scene,id:'combat'},g).status,'missing-scene');
  assert.equal(locateToken({...track,tokenId:'missing'},scene,g).status,'missing-token');
  scene.tokens.get('ark').x=-1000;const outside=locateToken(track,scene,g);assert.equal(outside.status,'outside');
  assert(updateLocation(track,outside,1));assert.equal(track.lastKnown,'B2');
  assert(!updateLocation(track,outside,2));
  assert(updateLocation(track,{coordinate:'AA10',status:'located'},3));assert.equal(track.lastKnown,'AA10');assert.equal(track.lastSeenAt,3);
});
