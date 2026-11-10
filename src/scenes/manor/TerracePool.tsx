import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SURFACE_Y } from '../../utils/layout/dimensions.ts'
import { buildWorldBatches } from './batches.ts'
import { Floors } from './Floors.tsx'
import { Batches, Boxes } from './Instanced.tsx'
import { geometryFor, manorMaterials } from './materials.ts'
import { box, cyl, shape, type Part } from './parts.ts'
import { lawnMap, tiled, waterBump, waterMap } from './textures.ts'
import { Glows } from './Glows.tsx'
import { poolFootprint, poolPaving, subtractFootprint } from './poolGeometry.ts'
import { jaggedFaces, rockMass, type ManorLayoutData, type QualityProfile } from './ZoneLayout.ts'
// Private west garden court, with separate water volume, open pergola, paving and lanterns.
// The Command Deck spring is independent of this recreational pool.
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
  rail(terrace.minX + 0.15, terrace.minZ + 0.15, terrace.minX + 0.15, terrace.maxZ - 0.15)
  // North-east 2.4 m garden entrance stays open. All balustrades belong to this court.
  rail(terrace.minX, terrace.minZ + 0.15, terrace.maxX - 2.8, terrace.minZ + 0.15)
  parts.push(box('porcelain', [pool.x, y - 1.05, pool.z], [pool.w, 0.1, pool.d]))
  for (const side of [-1, 1]) {
    parts.push(box('porcelain', [pool.x, y - 0.5, pool.z + side * pool.d / 2], [pool.w + 0.2, 1, 0.2]), box('porcelain', [pool.x + side * pool.w / 2, y - 0.5, pool.z], [0.2, 1, pool.d]))
  }
  // Coping round three sides of the pool; the east side is the vanishing edge.
  const px0 = pool.x - pool.w / 2
  const pz0 = pool.z - pool.d / 2
  parts.push(box('marble', [pool.x - 0.15, y + 0.05, pz0 - 0.2], [pool.w + 0.1, 0.1, 0.4]), box('marble', [pool.x - 0.15, y + 0.05, pz0 + pool.d + 0.2], [pool.w + 0.1, 0.1, 0.4]), box('marble', [px0 - 0.2, y + 0.05, pool.z], [0.4, 0.1, pool.d + 0.8]))
  parts.push(box('glass', [px0 + pool.w - 0.02, y - 0.05, pool.z], [0.04, 0.2, pool.d]))
  for (const [x, z] of [[terrace.minX + 0.4, terrace.maxZ - 0.4], [px0 - 0.6, terrace.maxZ - 0.4], [terrace.minX + 0.4, terrace.minZ + 0.4], [(terrace.minX + px0) / 2, terrace.maxZ - 0.4]] as [number, number][]) {
    parts.push(cyl('blackSteel', [x, y + 0.9, z], [0.08, 1.8, 0.08]), shape('cone', 'brass', [x, y + 2.05, z], [0.34, 0.2, 0.34]), box('lampWarm', [x, y + 1.82, z], [0.22, 0.3, 0.22]))
    lanterns.push([x, y + 1.82, z])
  }
  // Open-sided pergola over the lounge strip; the eastern circulation path stays clear.
  const pavilionX = terrace.minX + 2.8, pavilionZ = terrace.minZ + 4
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(box('stone', [pavilionX + sx * 2.2, y + 1.6, pavilionZ + sz * 3], [0.18, 3.2, 0.18]))
  for (const sx of [-1, 1]) parts.push(box('mahogany', [pavilionX + sx * 2.2, y + 3.22, pavilionZ], [0.2, 0.2, 6.3]))
  for (let dz = -3; dz <= 3; dz += 0.5) parts.push(box('oak', [pavilionX, y + 3.38, pavilionZ + dz], [4.8, 0.12, 0.14]))
  // Privacy planting is outside paving, never across an entry or the pool-side route.
  for (let dz = 1; dz < 8; dz += 1.5) parts.push(box('leaf', [terrace.minX - 0.6, y + 0.55, terrace.minZ + dz], [0.7, 1.1, 1.25]))
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
  useEffect(() => () => { material.map?.dispose(); material.bumpMap?.dispose(); material.dispose() }, [material])
  return <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} material={material} receiveShadow><planeGeometry args={[w, d]}/></mesh>
}

export function TerracePool({ layout, profile, animate }: { layout: ManorLayoutData; profile: QualityProfile; animate: boolean }) {
  const pool = layout.items.find((item) => item.type === 'infinityPool')!
  const terrace = useMemo(() => layout.zoneList.filter(zone => zone.kind === 'outdoor' && zone.level === 'surface').flatMap(zone => zone.id === 'terracePool' ? poolPaving(zone, pool) : [zone]), [layout, pool])
  const { parts, lanterns } = useMemo(() => terraceParts(layout), [layout])
  const batches = useMemo(() => buildWorldBatches(parts), [parts])
  return <group>
    <Floors zones={terrace}/>
    <Water x={pool.x} y={SURFACE_Y - 0.08} z={pool.z} w={pool.w} d={pool.d} animate={animate} repeatX={2}/>
    <Batches batches={batches} shadows={profile.shadows === 'all'}/>
    <Glows glows={lanterns.map((position) => ({ position, color: '#ffbb66' }))} size={1.6} opacity={0.52} flicker animate={animate}/>
  </group>
}
/** The cliff between the levels with its jagged face, the far cliff past the chasm, and the lawn on top. */
export function CliffGrounds({ layout, profile }: { layout: ManorLayoutData; profile: QualityProfile }) {
  const { cliff, grounds } = useMemo(() => rockMass(layout), [layout])
  const pool = layout.items.find(item => item.type === 'infinityPool')!
  const lawnPatches = useMemo(() => subtractFootprint(grounds, poolFootprint(pool)), [grounds, pool])
  const rockBlocks = useMemo(() => cliff.flatMap(block => subtractFootprint({minX:block.x-block.w/2,maxX:block.x+block.w/2,minZ:block.z-block.d/2,maxZ:block.z+block.d/2},poolFootprint(pool)).map(rect=>({...block,x:(rect.minX+rect.maxX)/2,z:(rect.minZ+rect.maxZ)/2,w:rect.maxX-rect.minX,d:rect.maxZ-rect.minZ}))), [cliff,pool])
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
  useEffect(() => () => { lawn.map?.dispose(); lawn.dispose() }, [lawn])
  // A dark granite foundation curb under the whole building, raising the interior floor 0.35 above
  // the lawn so no grass blade at the outer walls can poke through the floor.
  const curb = useMemo(() => {
    // One slab per ground-floor room (the upper floor stands on the same ground), not one for the
    // building's bounding box, which would cover the lawn where the building is not.
    return layout.zoneList.filter((zone) => zone.level === 'surface' && zone.kind !== 'outdoor').map(({ rect }) => ({
      x: (rect.minX + rect.maxX) / 2, y: SURFACE_Y - 0.175, z: (rect.minZ + rect.maxZ) / 2, w: rect.maxX - rect.minX + 0.6, h: 0.35, d: rect.maxZ - rect.minZ + 0.6,
    }))
  }, [layout])
  return <group>
    <Boxes boxes={rockBlocks} material={m.rock} shadows={profile.shadows !== 'none'}/>
    <instancedMesh key={jagged.length} ref={ref} args={[geometryFor('ico'), m.rock, jagged.length]} castShadow={profile.shadows === 'all'} receiveShadow/>
    {lawnPatches.map((rect,index)=><mesh key={index} position={[(rect.minX+rect.maxX)/2,SURFACE_Y-0.01,(rect.minZ+rect.maxZ)/2]} rotation={[-Math.PI/2,0,0]} material={lawn} receiveShadow><planeGeometry args={[rect.maxX-rect.minX,rect.maxZ-rect.minZ]}/></mesh>)}
    <Boxes boxes={curb} material={m.stone} shadows={profile.shadows !== 'none'}/>
  </group>
}
