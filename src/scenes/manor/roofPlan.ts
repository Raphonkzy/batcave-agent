import { LEVEL_Y, type BoundingBox, type ManorLayoutData } from '../../utils/layout/types.ts'
export interface RoofSection extends BoundingBox { y: number }
/** Tile the indoor footprint at shared boundaries, choosing the highest occupied floor. */
export function roofPlan(layout: ManorLayoutData): RoofSection[] {
 const rooms=layout.zoneList.filter(z=>z.level!=='subterranean'&&z.kind!=='outdoor')
 const xs=[...new Set(rooms.flatMap(z=>[z.rect.minX,z.rect.maxX]))].sort((a,b)=>a-b)
 const zs=[...new Set(rooms.flatMap(z=>[z.rect.minZ,z.rect.maxZ]))].sort((a,b)=>a-b)
 const cells=zs.slice(0,-1).map((z,r)=>xs.slice(0,-1).map((x,c)=>{
  const own=rooms.filter(q=>(x+xs[c+1])/2>q.rect.minX&&(x+xs[c+1])/2<q.rect.maxX&&(z+zs[r+1])/2>q.rect.minZ&&(z+zs[r+1])/2<q.rect.maxZ)
  return own.length?Math.max(...own.map(q=>LEVEL_Y[q.level]+q.height)):0
 }))
 const out:RoofSection[]=[]
 for(let r=0;r<cells.length;r++)for(let c=0;c<cells[r].length;c++){
  const y=cells[r][c];if(!y)continue
  let end=c+1;while(end<cells[r].length&&cells[r][end]===y)end++
  let bottom=r+1;while(bottom<cells.length&&cells[bottom].slice(c,end).every(h=>h===y))bottom++
  out.push({minX:xs[c],maxX:xs[end],minZ:zs[r],maxZ:zs[bottom],y})
  for(let rr=r;rr<bottom;rr++)for(let cc=c;cc<end;cc++)cells[rr][cc]=0
 }
 return out
}
