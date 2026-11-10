import type { ManorLayoutData } from './ZoneLayout.ts'
import { box, type Part } from './parts.ts'

/** Rectangular glazed shaft, clipped only where an environment itself is hidden. */
export function elevatorShaftParts(layout:ManorLayoutData,from:number,to:number):Part[]{
  const {x,z,radius}=layout.elevator, r=radius*.72, h=to-from, parts:Part[]=[]
  for(const side of [-1,1]){
    parts.push(box('glass',[x+side*r,(from+to)/2,z],[.04,h,r*2]),box('glass',[x,(from+to)/2,z+side*r],[r*2,h,.04]))
    for(const front of [-1,1])parts.push(box('blackSteel',[x+side*r,(from+to)/2,z+front*r],[.09,h,.09]))
    parts.push(box('chrome',[x+side*(r-.1),(from+to)/2,z-r+.08],[.025,h,.04]))
  }
  for(const floor of [layout.elevator.bottom,layout.elevator.top])if(floor>=from&&floor<to){
    for(const side of [-1,1])parts.push(box('brass',[x+side*(r-.07),floor+1.2,z+r],[.08,2.4,.12]))
    parts.push(box('stone',[x,floor+.035,z],[r*2+.2,.07,r*2+.2]),box('brass',[x,floor+2.45,z+r],[r*2,.14,.18]),box('lampWarm',[x,floor+2.64,z+r+.02],[.3,.08,.04]))
  }
  return parts
}
