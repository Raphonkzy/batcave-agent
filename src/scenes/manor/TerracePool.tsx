import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SURFACE_Y } from '../../utils/layout/dimensions.ts'
import { buildWorldBatches } from './batches.ts'
import { Floors } from './Floors.tsx'
import { Batches, Boxes } from './Instanced.tsx'
import { geometryFor, manorMaterials } from './materials.ts'
import { box, cyl, shape, type Part } from './parts.ts'
import { lawnMap, tiled, waterBump, waterMap } from './textures.ts'
import { Glows } from './Glows.tsx'
import { mulberry32 } from './random.ts'
import { jaggedFaces, rockMass, type ManorLayoutData, type QualityProfile } from './ZoneLayout.ts'
// The terrace on the cliff edge: flagstones, stone balustrades, garden lanterns and the infinity
// pool whose eastern edge spills over the rock lip into the chasm. Also the rock between the two
// levels (the sheer cliff face) and the cliff-top lawn the manor stands on.
function terraceParts(layout: ManorLayoutData): { parts: Part[]; lanterns: [number, number, number][] } {
  const terrace = layout.zones.terracePool
  const pool = layout.items.find((item) => item.type === 'infinityPool')!
  const y = SURFACE_Y
  const parts: Part[] = []
  const lanterns: [number, number, number][] = []
  const rail = (x0: number, z0: number, x1: number, z1: number) => {
    const length = Math.hypot(x1 - x0, z1 - z0)
    const along = x1 !== x0
    for (let t = 0; t <= length; t += 0.45) parts.push(cyl('stone', [along ? x0 + t : x0, y + 0.4, along ? z0 : z0 + t], [0.16, 0.8, 0.16]))
    parts.push(box('stone', [(x0 + x1) / 2, y + 0.86, (z0 + z1) / 2], along ? [length + 0.2, 0.12, 0.3] : [0.3, 0.12, length + 0.2]), box('stone', [(x0 + x1) / 2, y + 0.04, (z0 + z1) / 2], along ? [length + 0.2, 0.08, 0.3] : [0.3, 0.08, length + 0.2]))
  }
  rail(terrace.minX, terrace.maxZ - 0.15, pool.x - pool.w / 2 - 0.3, terrace.maxZ - 0.15)
  rail(terrace.minX + 0.15, terrace.minZ + 2.2, terrace.minX + 0.15, terrace.maxZ - 0.15)
  // Coping round three sides of the pool; the east side is the vanishing edge.
  const px0 = pool.x - pool.w / 2
  const pz0 = pool.z - pool.d / 2
  parts.push(box('marble', [pool.x - 0.15, y + 0.05, pz0 - 0.2], [pool.w + 0.1, 0.1, 0.4]), box('marble', [pool.x - 0.15, y + 0.05, pz0 + pool.d + 0.2], [pool.w + 0.1, 0.1, 0.4]), box('marble', [px0 - 0.2, y + 0.05, pool.z], [0.4, 0.1, pool.d + 0.8]))
  parts.push(box('glass', [px0 + pool.w - 0.02, y - 0.05, pool.z], [0.04, 0.2, pool.d]))
  for (const [x, z] of [[terrace.minX + 0.4, terrace.maxZ - 0.4], [px0 - 0.6, terrace.maxZ - 0.4], [terrace.minX + 0.4, terrace.minZ + 2.4], [(terrace.minX + px0) / 2, terrace.maxZ - 0.4]] as [number, number][]) {
    parts.push(cyl('blackSteel', [x, y + 0.9, z], [0.08, 1.8, 0.08]), shape('cone', 'brass', [x, y + 2.05, z], [0.34, 0.2, 0.34]), box('lampWarm', [x, y + 1.82, z], [0.22, 0.3, 0.22]))
    lanterns.push([x, y + 1.82, z])
  }
  return { parts, lanterns }
}
function Water({ x, y, z, w, d, animate, repeatX }: { x: number; y: number; z: number; w: number; d: number; animate: boolean; repeatX: number }) {
  const material = useMemo(() => {
    const map = waterMap().clone()
    const bump = waterBump().clone()
    for (const texture of [map, bump]) { texture.needsUpdate = true; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeatX, 1) }
    // Clear infinity-pool water: nearly smooth and slightly refractive. The plane lies in the XZ
    // plane, so its local x maps to world +X, the vanishing edge the water drifts towards.
    return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.5, color: '#9fdcec', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.86 })
  }, [repeatX])
  useFrame(({ clock }) => {
    if (!animate) return
    const t = clock.elapsedTime
    // Ripples drift steadily towards the eastern vanishing edge where the water spills over.
    material.map?.offset.set(t * 0.05, Math.sin(t * 0.3) * 0.015)
    material.bumpMap?.offset.set(t * 0.07, Math.sin(t * 0.25) * 0.01)
  })
  return <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} material={material} receiveShadow><planeGeometry args={[w, d]}/></mesh>
}
/** One grass blade: a tall, thin quad curved forward, dark at the root and bright at the tip. */
function bladeGeometry(): THREE.BufferGeometry {
  const segments = 3
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const root = new THREE.Color('#13240f')
  const tip = new THREE.Color('#6f9a3a')
  const halfWidth = 0.035
  for (let s = 0; s <= segments; s += 1) {
    const t = s / segments
    const y = t
    const bend = t * t * 0.28 // curve forward towards the tip
    const w = halfWidth * (1 - t * 0.7)
    positions.push(-w, y, bend, w, y, bend)
    const c = root.clone().lerp(tip, t)
    colors.push(c.r, c.g, c.b, c.r, c.g, c.b)
  }
  for (let s = 0; s < segments; s += 1) {
    const a = s * 2
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
/** A field of grass tufts across the cliff-top lawn, placed deterministically, thinned on low quality. */
function GrassField({ layout, density }: { layout: ManorLayoutData; density: number }) {
  const { grounds } = useMemo(() => rockMass(layout), [layout])
  const geometry = useMemo(() => bladeGeometry(), [])
  const material = useMemo(() => manorMaterials().grassBlade, [])
  const ref = useRef<THREE.InstancedMesh>(null)
  const blades = useMemo(() => {
    const random = mulberry32(0x47524153)
    const area = (grounds.maxX - grounds.minX) * (grounds.maxZ - grounds.minZ)
    const target = Math.round(Math.min(2000, Math.max(1200, area * 3)) * density)
    const terrace = layout.zones.terracePool
    // The manor building footprint: every surface/upper room except the open terrace. Grass must
    // never grow inside it (a 0.25 margin keeps blades off the foundation curb), nor on the paved
    // terrace. It only fills the open lawn around the building.
    // The building is not a rectangle: test each of its rooms (the ground floor and the upper floor
    // overhang the same ground), with a 0.25 margin for the foundation curb.
    const rooms = layout.zoneList.filter((zone) => zone.level !== 'subterranean' && zone.id !== 'terracePool').map((zone) => zone.rect)
    const distance = (x: number, z: number) => Math.min(...rooms.map((rect) => Math.hypot(Math.max(rect.minX - x, x - rect.maxX, 0), Math.max(rect.minZ - z, z - rect.maxZ, 0))))
    const insideManor = (x: number, z: number) => distance(x, z) < 0.25
    const insideTerrace = (x: number, z: number) => x >= terrace.minX && x <= terrace.maxX && z >= terrace.minZ && z <= terrace.maxZ
    // Denser near the cliff edges and rock, sparser (smooth falloff) towards the building.
    const nearBuilding = (x: number, z: number) => Math.min(1, distance(x, z) / 1.2)
    const out: { x: number; z: number; rotY: number; scale: number; tiltX: number; tiltZ: number }[] = []
    for (let i = 0; i < target; i += 1) {
      const x = grounds.minX + random() * (grounds.maxX - grounds.minX)
      const z = grounds.minZ + random() * (grounds.maxZ - grounds.minZ)
      if (insideManor(x, z) || insideTerrace(x, z)) continue
      if (random() > nearBuilding(x, z)) continue // smooth thinning towards the walls
      const tilt = (5 + random() * 10) * (Math.PI / 180)
      const lean = random() * Math.PI * 2
      out.push({ x, z, rotY: random() * Math.PI * 2, scale: 0.3 + random() * 0.3, tiltX: Math.cos(lean) * tilt, tiltZ: Math.sin(lean) * tilt })
    }
    return out
  }, [grounds, layout, density])
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    blades.forEach((blade, index) => {
      q.setFromEuler(e.set(blade.tiltX, blade.rotY, blade.tiltZ))
      mesh.setMatrixAt(index, new THREE.Matrix4().compose(new THREE.Vector3(blade.x, SURFACE_Y - 0.02, blade.z), q, new THREE.Vector3(blade.scale, blade.scale, blade.scale)))
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [blades])
  if (blades.length === 0) return null
  return <instancedMesh key={blades.length} ref={ref} args={[geometry, material, blades.length]} frustumCulled={false} receiveShadow/>
}
export function TerracePool({ layout, profile, animate }: { layout: ManorLayoutData; profile: QualityProfile; animate: boolean }) {
  const terrace = useMemo(() => layout.zoneList.filter((zone) => zone.id === 'terracePool'), [layout])
  const pool = layout.items.find((item) => item.type === 'infinityPool')!
  const { parts, lanterns } = useMemo(() => terraceParts(layout), [layout])
  const batches = useMemo(() => buildWorldBatches(parts), [parts])
  const lip = layout.chasm.minX - (pool.x + pool.w / 2)
  return <group>
    <Floors zones={terrace}/>
    <Water x={pool.x} y={SURFACE_Y + 0.06} z={pool.z} w={pool.w} d={pool.d} animate={animate} repeatX={2}/>
    <Water x={pool.x + pool.w / 2 + lip / 2 + 0.15} y={SURFACE_Y + 0.02} z={pool.z} w={lip + 0.3} d={pool.d} animate={animate} repeatX={1}/>
    <Batches batches={batches} shadows={profile.shadows === 'all'}/>
    <Glows glows={lanterns.map((position) => ({ position, color: '#ffbb66' }))} size={1.6} opacity={0.52} flicker animate={animate}/>
  </group>
}
/** The cliff between the levels with its jagged face, the far cliff past the chasm, and the lawn on top. */
export function CliffGrounds({ layout, profile, grass = true }: { layout: ManorLayoutData; profile: QualityProfile; grass?: boolean }) {
  const { cliff, grounds } = useMemo(() => rockMass(layout), [layout])
  const jagged = useMemo(() => jaggedFaces(layout, profile.density), [layout, profile.density])
  const ref = useRef<THREE.InstancedMesh>(null)
  const m = manorMaterials()
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const up = new THREE.Vector3(0, 1, 0)
    jagged.forEach((block, index) => mesh.setMatrixAt(index, new THREE.Matrix4().compose(new THREE.Vector3(block.x, block.y, block.z), new THREE.Quaternion().setFromAxisAngle(up, block.rotY ?? 0), new THREE.Vector3(block.w, block.h, block.d))))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [jagged])
  const lawn = useMemo(() => new THREE.MeshStandardMaterial({ map: tiled(lawnMap(), Math.round((grounds.maxX - grounds.minX) / 4), Math.round((grounds.maxZ - grounds.minZ) / 4)), roughness: 1 }), [grounds])
  // A dark granite foundation curb under the whole building, raising the interior floor 0.35 above
  // the lawn so no grass blade at the outer walls can poke through the floor.
  const curb = useMemo(() => {
    // One slab per ground-floor room (the upper floor stands on the same ground), not one for the
    // building's bounding box, which would cover the lawn where the building is not.
    return layout.zoneList.filter((zone) => zone.level === 'surface' && zone.id !== 'terracePool').map(({ rect }) => ({
      x: (rect.minX + rect.maxX) / 2, y: SURFACE_Y - 0.175, z: (rect.minZ + rect.maxZ) / 2, w: rect.maxX - rect.minX + 0.6, h: 0.35, d: rect.maxZ - rect.minZ + 0.6,
    }))
  }, [layout])
  return <group>
    <Boxes boxes={cliff} material={m.rock} shadows={profile.shadows !== 'none'}/>
    <instancedMesh key={jagged.length} ref={ref} args={[geometryFor('ico'), m.rock, jagged.length]} castShadow={profile.shadows === 'all'} receiveShadow/>
    <mesh position={[(grounds.minX + grounds.maxX) / 2, SURFACE_Y - 0.01, (grounds.minZ + grounds.maxZ) / 2]} rotation={[-Math.PI / 2, 0, 0]} material={lawn} receiveShadow>
      <planeGeometry args={[grounds.maxX - grounds.minX, grounds.maxZ - grounds.minZ]}/>
    </mesh>
    <Boxes boxes={curb} material={m.stone} shadows={profile.shadows !== 'none'}/>
    {grass && <GrassField layout={layout} density={profile.density}/>}
  </group>
}
