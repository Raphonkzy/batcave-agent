import type { ManorLayoutData } from '../../utils/layout/types.ts'
import { box, shape, type Part } from './parts.ts'
import { estateConfig } from './worldConfig.ts'

export function estateBoundary(layout: ManorLayoutData): Part[] {
  const {lot,gate} = estateConfig(layout), y=lot.surfaceY, parts:Part[]=[]
  const run=(ax:number,az:number,bx:number,bz:number)=>{
    const length=Math.hypot(bx-ax,bz-az), n=Math.ceil(length/2.8), dx=(bx-ax)/length,dz=(bz-az)/length
    for(let k=0;k<=n;k++){
      const t=k/n,x=ax+(bx-ax)*t,z=az+(bz-az)*t
      parts.push(box('stone',[x,y+.65,z],[.32,1.3,.32]),shape('cone','brass',[x,y+1.38,z],[.26,.16,.26]))
    }
    for(let k=0;k<n;k++){
      const t=(k+.5)/n,x=ax+(bx-ax)*t,z=az+(bz-az)*t,span=length/n
      parts.push(box('stone',[x,y+.1,z],[Math.abs(dx)*span+.16,.2,Math.abs(dz)*span+.16]))
      for(const h of [.4,1.12])parts.push(box('blackSteel',[x,y+h,z],[Math.abs(dx)*span+.06,.055,Math.abs(dz)*span+.06]))
      const bars=Math.ceil(span/.22)
      for(let b=0;b<bars;b++){
        const s=(k+(b+.5)/bars)/n
        parts.push(box('blackSteel',[ax+(bx-ax)*s,y+.76,az+(bz-az)*s],[.035,.95,.035]))
      }
    }
  }
  run(lot.minX,lot.minZ,lot.maxX,lot.minZ)
  run(lot.minX,lot.minZ,lot.minX,gate.position[2])
  run(lot.maxX,lot.minZ,lot.maxX,gate.position[2])
  run(lot.minX,gate.position[2],-3.8,gate.position[2])
  run(3.8,gate.position[2],lot.maxX,gate.position[2])
  // Posts and lighting remain static; the hinged leaves are rendered by EstateGate.
  for(const side of [-1,1]){
    const x=side*3.8,z=gate.position[2]
    parts.push(box('lampWarm',[x,y+2.35,z],[.3,.3,.3]),box('stone',[x,y+2.14,z],[.8,.14,.8]))
  }
  return parts
}
