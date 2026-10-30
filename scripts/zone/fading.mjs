import {gridBounds,coordinateToBounds,displayGridCounts} from './grid.mjs';
export const gridOpacity=distance=>{const stops=[1,1,.75,.55,.35],d=Math.max(0,Math.min(4,distance));return stops[Math.floor(d)]+(stops[Math.ceil(d)]-stops[Math.floor(d)])*(d-Math.floor(d));};
// Sparse, capped Chebyshev distance field. Only the three-cell halo needs storage;
// every other cell is at the minimum opacity. No map-sized distance matrix.
export function buildGridFade(grid,codes){
 const bounds=gridBounds(grid),counts=displayGridCounts(grid),columns=counts.columns,rows=counts.rows,distances=new Map(),queue=[];
 const key=(x,y)=>y*columns+x;
 for(const code of codes){const b=coordinateToBounds(code,grid);if(!b)continue;const x=Math.round((b.x-bounds.x)/grid.width),y=Math.round((b.y-bounds.y)/grid.height),k=key(x,y);if(!distances.has(k)){distances.set(k,0);queue.push([x,y,0]);}}
 for(let i=0;i<queue.length;i++){const [x,y,d]=queue[i];if(d>=3)continue;for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=columns||yy>=rows||distances.has(key(xx,yy)))continue;distances.set(key(xx,yy),d+1);queue.push([xx,yy,d+1]);}}
 const distance=(x,y)=>x<0||y<0||x>=columns||y>=rows?4:distances.get(key(x,y))??4;
 const vertical=new Map(),horizontal=new Map(),add=(map,line,value)=>{if(!map.has(line))map.set(line,new Set());for(let offset=-1;offset<=1;offset++)map.get(line).add(value+offset);};
 for(const [x,y] of queue){add(vertical,x,y);add(vertical,x+1,y);add(horizontal,y,x);add(horizontal,y+1,x);}
 const segments=[];
 const lines=(count,length,map,isVertical)=>{for(let line=0;line<=count;line++){
  const factor=i=>{i=Math.max(0,Math.min(length-1,i));return isVertical?Math.max(gridOpacity(distance(line-1,i)),gridOpacity(distance(line,i))):Math.max(gridOpacity(distance(i,line-1)),gridOpacity(distance(i,line)));};
  const sample=t=>{const i=Math.floor(t-.5),fraction=t-.5-i;return factor(i)*(1-fraction)+factor(i+1)*fraction;};
  const points=new Set([0,length]);for(const cell of map.get(line)||[])for(const t of [cell,cell+.5,cell+1])if(t>0&&t<length)points.add(t);
  const sorted=[...points].sort((a,b)=>a-b);let previous;
  for(let i=1;i<sorted.length;i++){const from=sorted[i-1],to=sorted[i],alpha=sample((from+to)/2);
   if(previous&&Math.abs(previous.alpha-alpha)<1e-9)previous.to=to;
   else{previous={vertical:isVertical,line,from,to,alpha};segments.push(previous);}
  }
 }};
 lines(columns,rows,vertical,true);lines(rows,columns,horizontal,false);
 const verticalLines=new Map(),horizontalLines=new Map();for(const segment of segments){const map=segment.vertical?verticalLines:horizontalLines;if(!map.has(segment.line))map.set(segment.line,[]);map.get(segment.line).push(segment);}
 return {bounds,segments,distances,distance,verticalLines,horizontalLines};
}
