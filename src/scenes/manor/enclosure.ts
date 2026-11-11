import { LEVEL_Y, type ManorLayoutData } from '../../utils/layout/types.ts'
import { roofPlan } from './roofPlan.ts'
import type { WallBox } from './wallGeometry.ts'

export interface EnclosureBand extends WallBox { axis: 'x'|'z'; at:number; from:number; to:number; bottom:number; top:number }
const EPS=1e-5
/** Vertical envelope of the union of room volumes. Upper-floor voids are not floor plates.
 * Shared walls only reach the shorter room; exposed bands above them need real masonry.
 * Subtract existing wall coverage so full-height exterior walls/windows are not duplicated.
 */
export function enclosureBands(layout:ManorLayoutData):EnclosureBand[]{
 const sections=roofPlan(layout), out:EnclosureBand[]=[]
 const walls=layout.walls.filter(w=>w.level!=='subterranean')
 const heightAt=(x:number,z:number)=>Math.max(11,...sections.filter(s=>x>s.minX&&x<s.maxX&&z>s.minZ&&z<s.maxZ).map(s=>s.y))
 const xs=[...new Set(sections.flatMap(s=>[s.minX,s.maxX]))].sort((a,b)=>a-b)
 const zs=[...new Set(sections.flatMap(s=>[s.minZ,s.maxZ]))].sort((a,b)=>a-b)
 for(const axis of ['x','z'] as const){
  const fixed=axis==='x'?zs:xs, along=axis==='x'?xs:zs
  for(const at of fixed)for(let i=0;i<along.length-1;i++){
   const from=along[i],to=along[i+1],mid=(from+to)/2
   const a=axis==='x'?heightAt(mid,at-EPS):heightAt(at-EPS,mid)
   const b=axis==='x'?heightAt(mid,at+EPS):heightAt(at+EPS,mid)
   if(Math.abs(a-b)<EPS)continue
   const low=Math.min(a,b),high=Math.max(a,b)
   const own=walls.filter(w=>w.axis===axis&&Math.abs(w.at-at)<EPS&&w.to>from+EPS&&w.from<to-EPS)
   const doors=layout.doors.filter(d=>d.level!=='subterranean'&&d.axis===axis&&Math.abs(d.at-at)<EPS&&d.center+d.width/2>from&&d.center-d.width/2<to)
   const cuts=[...new Set([from,to,...own.flatMap(w=>[Math.max(from,w.from),Math.min(to,w.to)]),...doors.flatMap(d=>[Math.max(from,d.center-d.width/2),Math.min(to,d.center+d.width/2)])])].sort((a,b)=>a-b)
   for(let k=0;k<cuts.length-1;k++){
    const start=cuts[k],end=cuts[k+1],center=(start+end)/2
    const covered=[...own.filter(w=>center>w.from-EPS&&center<w.to+EPS).map(w=>[LEVEL_Y[w.level],LEVEL_Y[w.level]+w.height]),...doors.filter(d=>Math.abs(center-d.center)<d.width/2+EPS).map(d=>[LEVEL_Y[d.level],LEVEL_Y[d.level]+2.5])].sort((a,b)=>a[0]-b[0])
    let cursor=low
    const add=(bottom:number,top:number)=>{
     if(top-bottom<EPS)return
     out.push({axis,at,from:start,to:end,bottom,top,x:axis==='x'?center:at,y:(bottom+top)/2,z:axis==='x'?at:center,w:axis==='x'?end-start+.02:.3,h:top-bottom,d:axis==='x'?.3:end-start+.02})
    }
    for(const [bottom,top] of covered){if(bottom>cursor)add(cursor,Math.min(bottom,high));cursor=Math.max(cursor,top);if(cursor>=high)break}
    if(cursor<high)add(cursor,high)
   }
  }
 }
 return out
}
export function validateEnclosure(layout:ManorLayoutData):string[]{
 const bands=enclosureBands(layout),errors:string[]=[]
 for(const [i,b] of bands.entries()){
  if(![b.x,b.y,b.z,b.w,b.h,b.d].every(Number.isFinite)||Math.min(b.w,b.h,b.d)<=0)errors.push('invalid band '+i)
  if(!roofPlan(layout).some(s=>Math.abs(s.y-b.top)<EPS))errors.push('unsupported roof edge '+i)
  for(const other of bands.slice(i+1))if(other.axis===b.axis&&Math.abs(other.at-b.at)<EPS&&Math.min(other.to,b.to)-Math.max(other.from,b.from)>EPS&&Math.min(other.top,b.top)-Math.max(other.bottom,b.bottom)>EPS)errors.push('overlapping bands '+i)
 }
 return errors
}
export const fullManorShell=(level:string,mode:string)=>level!=='deck'&&mode==='wallsUp'
