import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { jetGeometries } from './jetGeometry.ts'
import { GANTRY_Y } from '../../utils/layout/dimensions.ts'
import { buildWorldBatches } from './batches.ts'
import { Batches } from './Instanced.tsx'
import { manorMaterials } from './materials.ts'
import { box, shape, type Part } from './parts.ts'
import type { ManorLayoutData } from './ZoneLayout.ts'
// The hangar bay: the turntable with the delta-wing jet (turning slowly), and the overhead
// servicing rails. The other vehicles, the workshop and the docks are ordinary instanced items.
function TacticalJet({ shadows }: { shadows: boolean }) {
  const m = manorMaterials()
  const parts = useMemo(() => jetGeometries(), [])
  useEffect(() => () => { for (const geometry of Object.values(parts)) geometry.dispose() }, [parts])
  return <group position={[0, 0.95, 0]}>
    <mesh geometry={parts.blackSteel} material={m.blackSteel} castShadow={shadows}/>
    <mesh geometry={parts.carbon} material={m.carbon} castShadow={shadows}/>
    <mesh geometry={parts.gunmetal} material={m.gunmetal} castShadow={shadows}/>
    <mesh geometry={parts.ledCyan} material={m.ledCyan}/>
    <mesh geometry={parts.darkGlass} material={m.darkGlass}/>
  </group>
}
function gantryParts(layout: ManorLayoutData): Part[] {
  const hangar = layout.zones.hangarBay
  const width = hangar.maxX - hangar.minX
  const cx = (hangar.minX + hangar.maxX) / 2
  const parts: Part[] = []
  // One overhead rail, along the glass wall at the north: a rail on the south side would cross the
  // back row of vehicles when seen from the south.
  for (const z of [hangar.minZ + 0.6]) {
    parts.push(box('gunmetal', [cx, GANTRY_Y, z], [width, 0.3, 0.08]), box('gunmetal', [cx, GANTRY_Y + 0.15, z], [width, 0.04, 0.3]), box('gunmetal', [cx, GANTRY_Y - 0.15, z], [width, 0.04, 0.3]))
    for (let x = hangar.minX + 1; x < hangar.maxX; x += 6) parts.push(box('blackSteel', [x, GANTRY_Y / 2, z], [0.25, GANTRY_Y, 0.25]))
  }
  // Amber warning beacons on the rails. Nothing hangs across the middle of the bay: the floor and
  // the servicing aisle between the two rows of vehicles stay clear, seen from above too.
  for (const z of [hangar.minZ + 0.6]) for (let x = hangar.minX + 3; x < hangar.maxX; x += 6) parts.push(shape('sphere', 'ledAmber', [x, GANTRY_Y + 0.3, z], [0.18, 0.12, 0.18]))
  return parts
}
export function HangarBay({ layout, animate, shadows }: { layout: ManorLayoutData; animate: boolean; shadows: boolean }) {
  const pad = layout.items.find((item) => item.type === 'turntablePad')!
  const turn = useRef<THREE.Group>(null)
  const gantry = useMemo(() => buildWorldBatches(gantryParts(layout)), [layout])
  const m = manorMaterials()
  useFrame((_, delta) => { if (turn.current && animate) turn.current.rotation.y += delta * 0.05 })
  return <group>
    <mesh material={m.hazard} position={[pad.x, 0.02, pad.z]} receiveShadow><cylinderGeometry args={[pad.w / 2 + 0.45, pad.w / 2 + 0.45, 0.04, 64]}/></mesh>
    <mesh material={m.blackSteel} position={[pad.x, 0.03, pad.z]} receiveShadow><cylinderGeometry args={[pad.w / 2 + 0.2, pad.w / 2 + 0.2, 0.04, 64]}/></mesh>
    <group ref={turn} position={[pad.x, pad.h, pad.z]} userData={{itemId: layout.items.find(i=>i.type==='tacticalJet')?.id}}>
      <mesh material={m.grating} position={[0, -0.05, 0]} receiveShadow><cylinderGeometry args={[pad.w / 2 - 0.1, pad.w / 2 - 0.1, 0.1, 48]}/></mesh>
      <mesh material={m.ledAmber} position={[0, 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[pad.w / 2 - 0.35, 0.03, 4, 64]}/></mesh>
      <TacticalJet shadows={shadows}/>
    </group>
    <Batches batches={gantry} shadows={shadows}/>
  </group>
}
