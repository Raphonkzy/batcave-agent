import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GANTRY_Y } from '../../utils/layout/dimensions.ts'
import { buildWorldBatches } from './batches.ts'
import { Batches } from './Instanced.tsx'
import { manorMaterials } from './materials.ts'
import { box, shape, type Part } from './parts.ts'
import type { ManorLayoutData } from './ZoneLayout.ts'
// The hangar bay: the turntable with the delta-wing jet (turning slowly), and the overhead
// servicing rails. The other vehicles, the workshop and the docks are ordinary instanced items.
/** A swept-back trapezoid wing: root chord along the fuselage, tip set back and narrower. `side` mirrors it. */
function wingGeometry(side: 1 | -1): THREE.BufferGeometry {
  const outline = new THREE.Shape()
  outline.moveTo(0, 1.3)
  outline.lineTo(3.1 * side, -1.1)
  outline.lineTo(3.1 * side, -1.9)
  outline.lineTo(0, -2.1)
  outline.closePath()
  return new THREE.ExtrudeGeometry(outline, { depth: 0.08, bevelEnabled: false }).rotateX(Math.PI / 2)
}
type JetMaterial = 'blackSteel' | 'carbon' | 'gunmetal' | 'ledCyan' | 'darkGlass'
/**
 * The delta-wing jet as one merged geometry per material (five meshes instead of nineteen), built
 * once. Mirrored parts are written out for each side rather than scaled by -1, which would flip
 * their faces inside out.
 */
function jetGeometries(): Record<JetMaterial, THREE.BufferGeometry> {
  const pieces: Record<JetMaterial, THREE.BufferGeometry[]> = { blackSteel: [], carbon: [], gunmetal: [], ledCyan: [], darkGlass: [] }
  const matrix = new THREE.Matrix4()
  const add = (material: JetMaterial, geometry: THREE.BufferGeometry, position: [number, number, number], rotation: [number, number, number], scale: [number, number, number]) => {
    const piece = (geometry.index ? geometry.toNonIndexed() : geometry).clone()
    piece.applyMatrix4(matrix.compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale)))
    pieces[material].push(piece)
  }
  const box = new THREE.BoxGeometry()
  const cone3 = new THREE.ConeGeometry(0.5, 1, 3)
  const cone4 = new THREE.ConeGeometry(0.5, 1, 4)
  const tube = new THREE.CylinderGeometry(0.5, 0.5, 1, 16)
  const ring = new THREE.TorusGeometry(0.16, 0.025, 6, 20)
  add('blackSteel', cone3, [0, 0, 0], [Math.PI / 2, 0, 0], [1.5, 6.2, 0.55])
  add('carbon', box, [0, -0.18, -0.6], [0, 0, 0], [1.1, 0.3, 3.4])
  for (const side of [-1, 1] as const) {
    add('carbon', wingGeometry(side), [0.35 * side, -0.1, 0], [0, 0, 0], [1, 1, 1])
    add('blackSteel', box, [3.42 * side, -0.35, -1.5], [0, 0, -1.1 * side], [0.06, 0.55, 0.8])
    add('gunmetal', box, [1.9 * side, -0.12, -1.95], [0, 0.65 * side, 0], [2.4, 0.05, 0.2])
    add('ledCyan', box, [3.15 * side, -0.08, -1.5], [0, 0, 0], [0.04, 0.03, 0.7])
    add('gunmetal', tube, [0.45 * side, -0.12, -2.65], [Math.PI / 2, 0, 0], [0.36, 0.8, 0.36])
    add('ledCyan', ring, [0.45 * side, -0.12, -3.06], [0, 0, 0], [1, 1, 1])
    add('blackSteel', box, [side * 0.5, 0.45, -2.3], [0, 0, side * 0.35], [0.05, 0.7, 0.9])
  }
  add('darkGlass', cone4, [0, 0.22, 1.1], [-0.22, Math.PI / 4, 0], [0.6, 0.45, 1.3])
  const merged = {} as Record<JetMaterial, THREE.BufferGeometry>
  for (const key of Object.keys(pieces) as JetMaterial[]) merged[key] = mergeGeometries(pieces[key])!
  for (const list of Object.values(pieces)) for (const piece of list) piece.dispose()
  for (const geometry of [box, cone3, cone4, tube, ring]) geometry.dispose()
  return merged
}
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
    <group ref={turn} position={[pad.x, pad.h, pad.z]}>
      <mesh material={m.grating} position={[0, -0.05, 0]} receiveShadow><cylinderGeometry args={[pad.w / 2 - 0.1, pad.w / 2 - 0.1, 0.1, 48]}/></mesh>
      <mesh material={m.ledAmber} position={[0, 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[pad.w / 2 - 0.35, 0.03, 4, 64]}/></mesh>
      <TacticalJet shadows={shadows}/>
    </group>
    <Batches batches={gantry} shadows={shadows}/>
  </group>
}
