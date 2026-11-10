import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CAVE_CEILING, CATWALK_WIDTH } from '../../utils/layout/dimensions.ts'
import { buildBatches, buildWorldBatches, keepAt } from './batches.ts'
import { Floors } from './Floors.tsx'
import { Batches, Boxes } from './Instanced.tsx'
import { geometryFor, manorMaterials } from './materials.ts'
import { box, cyl, type Part } from './parts.ts'
import type { Door, WallSegment } from '../../utils/layout/types.ts'
import { rockMass, spikes, type ManorLayoutData, type QualityProfile } from './ZoneLayout.ts'
import { waterBump, waterMap } from './textures.ts'
// The subterranean command deck: rock shell, stalactites and stalagmites, the rooms behind their
// glass partitions, the catwalk over the basin and the war table's holographic projection.
/** Glass partitions between the deck's rooms: a steel base, glass up to 2.6, mullions every 2 units, a lintel over each door. */
const PARTITION = { base: 0.9, top: 2.6 }
function partitionParts(walls: WallSegment[], doors: Door[]): Part[] {
  const parts: Part[] = []
  for (const wall of walls) {
    const length = wall.to - wall.from
    const mid = (wall.from + wall.to) / 2
    const at = (along: number, y: number, size: [number, number], thick = 0.1): [Part['p'], Part['s']] => wall.axis === 'x' ? [[along, y, wall.at], [size[0], size[1], thick]] : [[wall.at, y, along], [thick, size[1], size[0]]]
    const [p0, s0] = at(mid, PARTITION.base / 2, [length, PARTITION.base])
    const [p1, s1] = at(mid, (PARTITION.base + PARTITION.top) / 2, [length, PARTITION.top - PARTITION.base], 0.04)
    const [p2, s2] = at(mid, PARTITION.top, [length, 0.08])
    const [p3, s3] = at(mid, PARTITION.base, [length, 0.03])
    parts.push(box('blackSteel', p0, s0), box('glass', p1, s1), box('gunmetal', p2, s2), box('ledCyan', p3, s3))
    for (let along = wall.from; along <= wall.to + 1e-6; along += Math.max(1, length / Math.max(1, Math.round(length / 2)))) {
      const [p, s] = at(along, PARTITION.top / 2, [0.08, PARTITION.top])
      parts.push(box('gunmetal', p, s))
    }
  }
  for (const door of doors) {
    const [p, s]: [Part['p'], Part['s']] = door.axis === 'x' ? [[door.center, PARTITION.top, door.at], [door.width, 0.08, 0.12]] : [[door.at, PARTITION.top, door.center], [0.12, 0.08, door.width]]
    parts.push(box('gunmetal', p, s))
  }
  return parts
}
function Spikes({ layout, profile }: { layout: ManorLayoutData; profile: QualityProfile }) {
  const { hanging, standing } = useMemo(() => spikes(layout, profile.density), [layout, profile.density])
  const refs = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)]
  useLayoutEffect(() => {
    const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI)
    const put = (mesh: THREE.InstancedMesh | null, list: typeof hanging, down: boolean) => {
      if (!mesh) return
      list.forEach((spike, index) => mesh.setMatrixAt(index, new THREE.Matrix4().compose(new THREE.Vector3(spike.x, down ? spike.y - spike.height / 2 : spike.y + spike.height / 2, spike.z), down ? flip : new THREE.Quaternion(), new THREE.Vector3(spike.radius * 2, spike.height, spike.radius * 2))))
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    put(refs[0].current, hanging, true)
    put(refs[1].current, standing, false)
    // refs are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hanging, standing])
  const rock = manorMaterials().rock
  return <>
    <instancedMesh key={`h${hanging.length}`} ref={refs[0]} args={[geometryFor('cone'), rock, hanging.length]} castShadow={profile.shadows === 'all'}/>
    <instancedMesh key={`s${standing.length}`} ref={refs[1]} args={[geometryFor('cone'), rock, standing.length]} castShadow={profile.shadows === 'all'}/>
  </>
}
/** The war table's projection: a turning ring and a faint cone of light, amber while briefing. */
function Projection({ layout, briefing, animate }: { layout: ManorLayoutData; briefing: boolean; animate: boolean }) {
  const table = layout.items.find((item) => item.type === 'warTable')!
  const ring = useRef<THREE.Mesh>(null)
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: '#00ffcc', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), [])
  useLayoutEffect(() => { material.color.set(briefing ? '#ffaa00' : '#00ffcc') }, [briefing, material])
  useFrame(({ clock }) => {
    if (ring.current && animate) ring.current.rotation.z = clock.elapsedTime * 0.4
    material.opacity = animate ? 0.13 + Math.sin(clock.elapsedTime * 2) * 0.03 : 0.14
  })
  return <group position={[table.x, table.h, table.z]}>
    <mesh ref={ring} position={[0, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]} material={material}><torusGeometry args={[1.6, 0.04, 6, 48]}/></mesh>
    <mesh position={[0, 0.65, 0]} material={material}><cylinderGeometry args={[1.5, 1.9, 0.9, 32, 1, true]}/></mesh>
    <mesh position={[0, 0.9, 0]} material={material}><icosahedronGeometry args={[0.45, 1]}/></mesh>
  </group>
}
/** Railings and grating along the basin catwalk, and steel ribs on the walls. */
function catwalkParts(layout: ManorLayoutData) {
  const walk = layout.zones.basinCatwalk
  const length = walk.maxZ - walk.minZ
  const railX = walk.maxX - 0.05
  const parts = [box('grating', [walk.minX + CATWALK_WIDTH / 2, -0.06, (walk.minZ + walk.maxZ) / 2], [CATWALK_WIDTH, 0.1, length]), box('gunmetal', [railX, 1.05, (walk.minZ + walk.maxZ) / 2], [0.06, 0.06, length]), box('gunmetal', [railX, 0.55, (walk.minZ + walk.maxZ) / 2], [0.04, 0.04, length])]
  for (let z = walk.minZ + 0.3; z < walk.maxZ; z += 1.6) parts.push(cyl('gunmetal', [railX, 0.53, z], [0.06, 1.06, 0.06]), box('blackSteel', [walk.minX + CATWALK_WIDTH / 2, -1.0, z], [0.12, 1.9, 0.12]))
  const deck = layout.levels.subterranean.bounds
  for (let x = deck.minX + 2; x < walk.minX; x += 4) parts.push(box('blackSteel', [x, CAVE_CEILING / 2, deck.minZ + 0.08], [0.3, CAVE_CEILING, 0.16]), box('ledCyan', [x, 2.2, deck.minZ + 0.17], [0.05, 1.6, 0.02]))
  return parts
}
function Basin({ layout, animate }: { layout: ManorLayoutData; animate: boolean }) {
  const { basin } = rockMass(layout)
  const material = useMemo(() => {
    const map = waterMap().clone()
    const bump = waterBump().clone()
    for (const texture of [map, bump]) { texture.needsUpdate = true; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(1, 3) }
    return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.5, color: '#3a6f80', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.9 })
  }, [])
  useFrame(({ clock }) => {
    if (!animate) return
    material.map?.offset.set(clock.elapsedTime * 0.01, clock.elapsedTime * 0.03)
    material.bumpMap?.offset.set(-clock.elapsedTime * 0.02, clock.elapsedTime * 0.05)
  })
  useEffect(() => () => { material.map?.dispose(); material.bumpMap?.dispose(); material.dispose() }, [material])
  return <mesh position={[(basin.minX + basin.maxX) / 2, layout.chasm.waterY, (basin.minZ + basin.maxZ) / 2]} rotation={[-Math.PI / 2, 0, 0]} material={material} receiveShadow>
    <planeGeometry args={[basin.maxX - basin.minX, basin.maxZ - basin.minZ]}/>
  </mesh>
}
export function SubterraneanCave({ layout, profile, briefing, animate, frontOnly = false }: { layout: ManorLayoutData; profile: QualityProfile; briefing: boolean; animate: boolean; frontOnly?: boolean }) {
  const zones = useMemo(() => layout.zoneList.filter((zone) => zone.level === 'subterranean'), [layout])
  // In the overview only the hangar shows under the cliff's edge, so only the hangar is drawn.
  const batches = useMemo(() => buildBatches(layout.items.filter((item) => item.level === 'subterranean' && (!frontOnly || item.zone === 'hangarBay' || item.zone === 'basinCatwalk')), keepAt(profile.density)), [layout, profile.density, frontOnly])
  // In the overview only the hangar's own wall shows under the cliff's edge.
  const hangarZ = layout.zones.hangarBay.minZ
  const shownWalls = useMemo(() => layout.walls.filter((wall) => wall.level === 'subterranean' && (!frontOnly || (wall.axis === 'x' && wall.at >= hangarZ - 1e-6))), [layout, frontOnly, hangarZ])
  const shownDoors = useMemo(() => layout.doors.filter((door) => door.level === 'subterranean' && (!frontOnly || (door.axis === 'x' && door.at >= hangarZ - 1e-6))), [layout, frontOnly, hangarZ])
  const extra = useMemo(() => buildWorldBatches([...catwalkParts(layout), ...partitionParts(shownWalls, shownDoors)]), [layout, shownWalls, shownDoors])
  // The waterfall lands near the east basin; rock within 4 units of its foot gets a wet sheen.
  const { dry, wet } = useMemo(() => {
    const fallX = layout.chasm.minX + 0.5
    const fallZ = (layout.chasm.minZ + layout.chasm.maxZ) / 2
    const deckRock = rockMass(layout).deck
    const dry: typeof deckRock = []
    const wet: typeof deckRock = []
    // In the overview the basin sits under the cliff, so the wet sheen is not worth a second batch.
    if (frontOnly) return { dry: deckRock, wet }
    for (const block of deckRock) {
      const nx = Math.max(block.x - block.w / 2, Math.min(fallX, block.x + block.w / 2))
      const nz = Math.max(block.z - block.d / 2, Math.min(fallZ, block.z + block.d / 2))
      ;(Math.hypot(nx - fallX, nz - fallZ) <= 4 ? wet : dry).push(block)
    }
    return { dry, wet }
  }, [layout, frontOnly])
  const shadows = profile.shadows === 'all' ? true : profile.shadows === 'main' ? 'main' : false
  return <group>
    <Boxes boxes={dry} material={manorMaterials().rock} shadows={profile.shadows === 'all'}/>
    <Boxes boxes={wet} material={manorMaterials().wetRock} shadows={profile.shadows === 'all'}/>
    <Floors zones={zones.filter((zone) => zone.id !== 'basinCatwalk')}/>
    <Batches batches={batches} shadows={shadows}/>
    <Batches batches={extra} shadows={shadows}/>
    <Spikes layout={layout} profile={profile}/>
    <Basin layout={layout} animate={animate}/>
    {!frontOnly && <Projection layout={layout} briefing={briefing} animate={animate}/>}
  </group>
}
