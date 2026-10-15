// Pure Scene-coordinate math. No canvas zoom, screen pixels, or Journal writes.
export function parseCoordinate(value) {
  const match=String(value??'').trim().match(/^([a-z]+)[\s-]*0*([1-9]\d*)$/i);
  if(!match)return null;
  let column=0;
  for(const letter of match[1].toUpperCase())column=column*26+letter.charCodeAt(0)-64;
  const row=Number(match[2]);
  if(!Number.isSafeInteger(column)||!Number.isSafeInteger(row))return null;
  return {column,row};
}
export function formatCoordinate(column,row) {
  if(!Number.isSafeInteger(column)||column<1||!Number.isSafeInteger(row)||row<1)return null;
  let letters='';
  while(column){column--;letters=String.fromCharCode(65+column%26)+letters;column=Math.floor(column/26);}
  return `${letters}${row}`;
}
export function canonicalCoordinate(value) {
  const parsed=parseCoordinate(value);
  return parsed?formatCoordinate(parsed.column,parsed.row):null;
}
export function validateGrid(grid) {
  if(!grid||!parseCoordinate(grid.reference))throw new Error('Reference sector must be a coordinate such as A1 or AA10.');
  for(const key of ['originX','originY'])if(!Number.isFinite(grid[key]))throw new Error('Origin must use finite Scene pixel coordinates.');
  for(const key of ['width','height'])if(!Number.isFinite(grid[key])||grid[key]<=0)throw new Error('Sector dimensions must be positive Scene pixel sizes.');
  for(const key of ['columns','rows'])if(!Number.isInteger(grid[key])||grid[key]<1||grid[key]>1000)throw new Error('Zone columns and rows must be whole numbers from 1 to 1000.');
  if(!['x','y'].includes(grid.columnAxis)||![1,-1].includes(grid.columnDirection)||![1,-1].includes(grid.rowDirection))throw new Error('Invalid grid orientation.');
  const ref=parseCoordinate(grid.reference);
  if(ref.column>grid.columns||ref.row>grid.rows)throw new Error('Reference sector must be inside the configured A1-to-maximum range.');
  if(!Number.isFinite(Math.abs(grid.originX)+grid.width*Math.max(grid.columns,grid.rows))||!Number.isFinite(Math.abs(grid.originY)+grid.height*Math.max(grid.columns,grid.rows)))throw new Error('Grid extent is too large.');
  return grid;
}
export function coordinateToBounds(coordinate,grid) {
  const cell=parseCoordinate(coordinate), ref=parseCoordinate(grid?.reference);
  if(!cell||!ref||cell.column>grid.columns||cell.row>grid.rows)return null;
  const dx=grid.columnAxis==='x'?(cell.column-ref.column)*grid.columnDirection:(cell.row-ref.row)*grid.rowDirection;
  const dy=grid.columnAxis==='x'?(cell.row-ref.row)*grid.rowDirection:(cell.column-ref.column)*grid.columnDirection;
  return {x:grid.originX+dx*grid.width,y:grid.originY+dy*grid.height,width:grid.width,height:grid.height};
}
export function positionToCoordinate(point,grid) {
  if(!grid||!Number.isFinite(point?.x)||!Number.isFinite(point?.y))return null;
  const ref=parseCoordinate(grid.reference);
  if(!ref||grid.width<=0||grid.height<=0)return null;
  const dx=Math.floor((point.x-grid.originX)/grid.width),dy=Math.floor((point.y-grid.originY)/grid.height);
  const column=ref.column+(grid.columnAxis==='x'?dx:dy)*grid.columnDirection;
  const row=ref.row+(grid.columnAxis==='x'?dy:dx)*grid.rowDirection;
  if(column<1||row<1||column>grid.columns||row>grid.rows)return null;
  return formatCoordinate(column,row);
}
export function gridBounds(grid) {
  const first=coordinateToBounds('A1',grid),last=coordinateToBounds(formatCoordinate(grid.columns,grid.rows),grid);
  return {x:Math.min(first.x,last.x),y:Math.min(first.y,last.y),width:Math.abs(first.x-last.x)+grid.width,height:Math.abs(first.y-last.y)+grid.height};
}
export function sceneCellSize(scene) {
  const grid=scene?.grid;
  return {width:grid?.sizeX||grid?.size,height:grid?.sizeY||grid?.size};
}
export function tokenCenter(token,scene) {
  const {width,height}=sceneCellSize(scene);
  if(!token||!Number.isFinite(width)||width<=0||!Number.isFinite(height)||height<=0)return null;
  const data=token.toObject?token.toObject():token;
  return {x:data.x+data.width*width/2,y:data.y+data.height*height/2};
}
export function locateToken(track,scene,grid) {
  if(!scene||track.sceneId!==scene.id)return {coordinate:null,status:'missing-scene'};
  const token=scene.tokens.get(track.tokenId);
  if(!token)return {coordinate:null,status:'missing-token'};
  const center=tokenCenter(token,scene);
  if(!center)return {coordinate:null,status:'unavailable'};
  const coordinate=positionToCoordinate(center,grid);
  return {coordinate,status:coordinate?'located':'outside'};
}
export function updateLocation(track,location,now=Date.now()) {
  const previous=track.location;
  if(previous?.coordinate===location.coordinate&&previous?.status===location.status)return false;
  track.location=location;
  if(location.coordinate){track.lastKnown=location.coordinate;track.lastSeenAt=now;}
  return true;
}

export function sectorDistance(from,to,kmPerSector=1.6) {
  const a=parseCoordinate(from),b=parseCoordinate(to);
  if(!a||!b||!Number.isFinite(kmPerSector)||kmPerSector<=0)return null;
  const sectors=Math.max(Math.abs(a.column-b.column),Math.abs(a.row-b.row));
  const kilometers=sectors*kmPerSector;
  return Number.isFinite(kilometers)?{sectors,kilometers}:null;
}
export function formatDistance(distance) {
  if(!distance)return 'Distance unavailable';
  const km=distance.kilometers.toFixed(1).replace(/\.0$/,'');
  return `${distance.sectors} sectors (${km} km)`;
}
export function gridFromCorners(topLeft,topRight,bottomLeft,base) {
  for(const point of [topLeft,topRight,bottomLeft])if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y))throw new Error('Select three finite Scene-local points.');
  const width=topRight.x-topLeft.x,height=bottomLeft.y-topLeft.y;
  if(width<=.001||height<=.001)throw new Error('Corners must produce positive width and height. Click top-left, top-right, then bottom-left of the same sector.');
  // Small click imprecision is tolerated, but rotated/skewed maps are unsupported.
  if(Math.abs(topRight.y-topLeft.y)>Math.max(1,width*.005)||Math.abs(bottomLeft.x-topLeft.x)>Math.max(1,height*.005))throw new Error('This grid appears rotated or skewed. Only axis-aligned rectangular sectors are supported; retry with aligned corners or use an aligned map.');
  return validateGrid({...base,reference:canonicalCoordinate(base.reference)||'A1',originX:topLeft.x,originY:topLeft.y,width,height});
}
