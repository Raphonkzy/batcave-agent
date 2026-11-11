import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { CAVE_CEILING } from '../../utils/layout/dimensions.ts'
import { buildWorldBatches } from './batches.ts'
import { Batches } from './Instanced.tsx'
import { box } from './parts.ts'
import { isDeckView, isManorView, type ManorLayoutData, type ManorView } from './ZoneLayout.ts'
const ANCHOR_HEIGHT=2.05

import { elevatorShaftParts } from './elevatorGeometry.ts'
export function VerticalShaft({layout,view,anchors}:{layout:ManorLayoutData;view:ManorView;anchors?:MutableRefObject<Map<string,THREE.Object3D>>}){
  const {x,z,radius,bottom,top}=layout.elevator,r=radius*.72
  const [from,to]=isDeckView(view)?[bottom,CAVE_CEILING]:isManorView(view)?[top,top+2.8]:[bottom,top+2.8]
  const shaft=useMemo(()=>buildWorldBatches(elevatorShaftParts(layout,from,to)),[layout,from,to])
  const car=useMemo(()=>buildWorldBatches([
    box('marbleBlack',[0,.06,0],[r*2-.14,.12,r*2-.14]),box('blackSteel',[0,2.42,0],[r*2-.14,.12,r*2-.14]),box('lampWarm',[0,2.35,0],[r*1.4,.025,r*1.4]),
    ...[-1,1].flatMap(s=>[box('blackSteel',[s*(r-.1),1.25,-r+.1],[.06,2.3,.06]),box('brass',[s*(r-.1),1.1,0],[.035,.04,r*1.7])]),
    box('glass',[0,1.2,-r+.08],[r*2-.2,2.2,.04]),
  ]),[r])
  const cab=useRef<THREE.Group>(null),left=useRef<THREE.Mesh>(null),right=useRef<THREE.Mesh>(null)
  const point=useMemo(()=>new THREE.Vector3(),[]),state=useRef({y:isManorView(view)?top:bottom,door:1})
  useFrame((_,delta)=>{
    if(!cab.current)return
    let target=state.current.y
    for(const anchor of anchors?.current.values()??[]){
      anchor.getWorldPosition(point)
      if(Math.hypot(point.x-x,point.z-z)<radius && point.y-ANCHOR_HEIGHT>=bottom-.1 && point.y-ANCHOR_HEIGHT<=top+.1){target=point.y-ANCHOR_HEIGHT;break}
    }
    const moving=Math.abs(target-state.current.y)>.035
    state.current.y=THREE.MathUtils.damp(state.current.y,target,12,Math.min(delta,.1))
    const atFloor=Math.min(Math.abs(state.current.y-bottom),Math.abs(state.current.y-top))<.12
    state.current.door=THREE.MathUtils.damp(state.current.door,atFloor&&!moving?1:0,6,Math.min(delta,.1))
    cab.current.position.y=state.current.y;cab.current.visible=state.current.y>=from-.15&&state.current.y<=to
    if(left.current)left.current.position.x=-r*.42-state.current.door*r*.65
    if(right.current)right.current.position.x=r*.42+state.current.door*r*.65
  })
  return <group name="ArchitecturalElevator"><Batches batches={shaft} shadows={false}/><group ref={cab} position={[x,state.current.y,z]}><Batches batches={car} shadows={false}/>{[-1,1].map(s=><mesh key={s} ref={s<0?left:right} position={[s*r*.42,1.2,r-.08]}><boxGeometry args={[r*.82,2.2,.045]}/><meshStandardMaterial color="#807052" metalness={.75} roughness={.32}/></mesh>)}</group></group>
}
