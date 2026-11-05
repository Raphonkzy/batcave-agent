import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { CAVE_CEILING } from '../../utils/layout/dimensions.ts'
import { buildWorldBatches } from './batches.ts'
import { Batches } from './Instanced.tsx'
import { manorMaterials } from './materials.ts'
import { cyl, shape, type Part } from './parts.ts'
import { isDeckView, isManorView, type ManorLayoutData, type ManorView } from './ZoneLayout.ts'
/** Height of the agent anchors above their feet (as in the crew). */
const ANCHOR_HEIGHT = 2.05
// The glass elevator: a tube from the deck (y 0) to the foyer (y 11) with steel rings, and a cab
// that rides with whoever is inside the tube and otherwise waits where it last stopped.
const TUBE_TOP_ABOVE_MANOR = 2.6
function tubeParts(layout: ManorLayoutData, from: number, to: number): Part[] {
  const { x, z, radius } = layout.elevator
  const parts: Part[] = [cyl('glass', [x, (from + to) / 2, z], [radius * 2, to - from, radius * 2])]
  for (let y = Math.ceil(from); y <= to; y += 2) parts.push(shape('torus', 'gunmetal', [x, y, z], [radius * 2 + 0.06, 1, radius * 2 + 0.06]))
  for (const level of [layout.elevator.bottom, layout.elevator.top]) if (level >= from - 0.01 && level <= to) parts.push(cyl('gunmetal', [x, level + 0.075, z], [radius * 2 + 0.3, 0.15, radius * 2 + 0.3]), shape('torus', 'ledCyan', [x, level + 0.16, z], [radius * 2 + 0.1, 1, radius * 2 + 0.1]))
  return parts
}
export function VerticalShaft({ layout, view, anchors }: { layout: ManorLayoutData; view: ManorView; anchors?: MutableRefObject<Map<string, THREE.Object3D>> }) {
  const { x, z, radius, bottom, top } = layout.elevator
  const [from, to] = isDeckView(view) ? [bottom, CAVE_CEILING] : isManorView(view) ? [top, top + TUBE_TOP_ABOVE_MANOR] : [bottom, top + TUBE_TOP_ABOVE_MANOR]
  const batches = useMemo(() => buildWorldBatches(tubeParts(layout, from, to)), [layout, from, to])
  const cab = useRef<THREE.Group>(null)
  const m = manorMaterials()
  const point = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, delta) => {
    const group = cab.current
    if (!group) return
    let target = group.position.y
    for (const anchor of anchors?.current.values() ?? []) {
      anchor.getWorldPosition(point)
      if (Math.hypot(point.x - x, point.z - z) < radius && point.y - ANCHOR_HEIGHT > bottom - 0.5 && point.y - ANCHOR_HEIGHT < top + 0.5) { target = point.y - ANCHOR_HEIGHT; break }
    }
    group.position.y += (target - group.position.y) * Math.min(1, delta * 6)
    group.visible = group.position.y >= from - 0.1 && group.position.y <= to
  })
  return <group>
    <Batches batches={batches} shadows={false}/>
    <group ref={cab} position={[x, bottom, z]}>
      <mesh material={m.gunmetal} position={[0, 0.06, 0]}><cylinderGeometry args={[radius - 0.08, radius - 0.08, 0.12, 24]}/></mesh>
      <mesh material={m.gunmetal} position={[0, 2.5, 0]}><cylinderGeometry args={[radius - 0.08, radius - 0.08, 0.1, 24]}/></mesh>
      <mesh material={m.ledCyan} position={[0, 2.43, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[radius - 0.2, 0.03, 4, 32]}/></mesh>
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((angle) => <mesh key={angle} material={m.chrome} position={[Math.cos(angle) * (radius - 0.12), 1.25, Math.sin(angle) * (radius - 0.12)]} scale={[0.05, 2.4, 0.05]}><boxGeometry/></mesh>)}
    </group>
  </group>
}
