import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { LayoutItem, ManorLayoutData, Vec3 } from '../../utils/layout/types.ts'
import { interactive, placementError } from './simulation.ts'
import { ObjectHighlight } from './ObjectHighlight.tsx'
import { Batches } from './Instanced.tsx'
import { buildBatches } from './batches.ts'
export function InteractionLayer({layout,level,selected,preview,onSelect,onFocus,onPreview,onGround,destination,commanding}: {
 layout: ManorLayoutData; level: 'deck'|'ground'|'upper'; selected: LayoutItem|null; preview: LayoutItem|null;
 onSelect:(item:LayoutItem)=>void; onFocus?:(item:LayoutItem)=>void; onPreview:(point:Vec3)=>void; onGround:(point:Vec3)=>void; destination:Vec3|null; commanding:boolean
}) {
 const [hover,setHover]=useState<string|null>(null)
 const hit=useRef<THREE.InstancedMesh>(null)
 const items=useMemo(()=>layout.items.filter(i=>interactive(i) && (level==='deck'?i.level==='subterranean':level==='ground'?i.level==='surface':i.level==='surfaceUpper')), [layout,level])
 useLayoutEffect(()=>{
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),p=new THREE.Vector3(),up=new THREE.Vector3(0,1,0)
  items.forEach((i,k)=>hit.current?.setMatrixAt(k,m.compose(p.set(i.x,i.y+Math.max(i.h,0.4)/2,i.z),q.setFromAxisAngle(up,i.rotY),s.set(i.w,Math.max(i.h,0.4),i.d))))
  if(hit.current){hit.current.instanceMatrix.needsUpdate=true;hit.current.computeBoundingSphere()}
 },[items,preview,commanding])
 useEffect(()=>{document.body.style.cursor=preview||commanding?'crosshair':hover?'pointer':'';return()=>{document.body.style.cursor=''}},[hover,preview,commanding])
 const highlighted=selected ?? items.find(i=>i.id===hover)
 const batches=useMemo(()=>preview?buildBatches([preview]):[],[preview])
 const y=preview?.y ?? (level==='deck'?0:level==='ground'?11:14.5)
 const point=(e:ThreeEvent<PointerEvent|MouseEvent>):Vec3=>[e.point.x,y,e.point.z]
 return <group>
  {!preview && !commanding && <instancedMesh ref={hit} key={items.length} args={[undefined,undefined,Math.max(1,items.length)]}
   onPointerMove={e=>{e.stopPropagation();setHover(e.instanceId===undefined?null:items[e.instanceId]?.id ?? null)}} onPointerOut={()=>setHover(null)}
   onClick={e=>{if(e.button!==0||e.delta>4)return;e.stopPropagation();if(e.instanceId!==undefined&&items[e.instanceId])onSelect(items[e.instanceId])}}
   onDoubleClick={e=>{if(e.button!==0||e.delta>4)return;e.stopPropagation();if(e.instanceId!==undefined&&items[e.instanceId])onFocus?.(items[e.instanceId])}}>
   <boxGeometry/><meshBasicMaterial colorWrite={false} depthWrite={false}/>
  </instancedMesh>}
  {!preview && <ObjectHighlight id={highlighted?.id} selected={!!selected} revision={layout}/>}
  {preview && <><Batches batches={batches} shadows={false}/><mesh position={[preview.x,y+0.1,preview.z]} rotation={[-Math.PI/2,0,-preview.rotY]}><planeGeometry args={[preview.w+0.1,preview.d+0.1]}/><meshBasicMaterial wireframe depthTest={false} color={placementError(layout,preview)?'#ef7979':'#79c9ad'}/></mesh></>}
  {(preview || commanding) && <mesh position={[0,y+0.015,0]} rotation={[-Math.PI/2,0,0]} onPointerMove={e=>{if(preview){e.stopPropagation();onPreview(point(e))}}} onClick={e=>{if(e.button===0&&e.delta<4){e.stopPropagation();onGround(point(e))}}}>
    <planeGeometry args={[600,600]}/><meshBasicMaterial colorWrite={false} depthWrite={false} side={THREE.DoubleSide}/>
  </mesh>}
  {destination && <mesh position={[destination[0],destination[1]+0.12,destination[2]]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.35,0.48,32]}/><meshBasicMaterial color="#79c9ad" depthTest={false}/></mesh>}
 </group>
}
