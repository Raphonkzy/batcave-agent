import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { geometryFor, manorMaterials, tintBase, ALIAS, type GeoKey, type MatKey } from '../../scenes/manor/materials.ts'
import type { OfficeStation } from '../../types.ts'
import { planPath } from '../../utils/layout/navigation.ts'
import type { Placement } from '../../utils/layout/placements.ts'
import type { ManorLayoutData } from '../../utils/layout/types.ts'
import { agentGear } from './agentLooks.ts'
import { characterParts, PIVOTS, type Bone } from './rig.ts'
// The whole crew in a handful of draw calls: every body part and piece of gear of every agent
// goes into one instanced mesh per (shape, material). A single frame loop walks each agent along
// its planned route, poses it (walking, seated, typing, lying) and writes the instance matrices.
const BONES: Bone[] = ['body', 'head', 'armL', 'armR', 'legL', 'legR']
const WALK_SPEED = 2.6
const LIFT_SPEED = 2.2
/** Height of the label anchor above an agent's feet (the elevator cab reads it too). */
export const ANCHOR_HEIGHT = 2.05
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)
interface Motion { position: THREE.Vector3; rotY: number; path: THREE.Vector3[]; destination: string; walking: boolean; pose?: number[]; bodyY?: number; layout?: ManorLayoutData }
interface Slot { agent: number; bone: Bone; local: THREE.Matrix4 }
interface CrewBatch { key: string; g: GeoKey; m: MatKey; tinted: boolean; slots: Slot[]; colors: THREE.Color[] }
const GREY = new THREE.Color('#7b7f7d')
function crewBatches(stations: OfficeStation[]): CrewBatch[] {
  const batches = new Map<string, CrewBatch>()
  const euler = new THREE.Euler()
  stations.forEach((station, agent) => {
    const offline = station.state === 'Offline'
    for (const part of characterParts(agentGear(station.id))) {
      const alias = ALIAS[part.m]
      const m = alias?.[0] ?? part.m
      const key = `${part.g}|${m}`
      let batch = batches.get(key)
      if (!batch) { batch = { key, g: part.g, m, tinted: !!alias, slots: [], colors: [] }; batches.set(key, batch) }
      const quaternion = part.r ? new THREE.Quaternion().setFromEuler(euler.set(...part.r)) : new THREE.Quaternion()
      batch.slots.push({ agent, bone: part.bone, local: new THREE.Matrix4().compose(new THREE.Vector3(...part.p), quaternion, new THREE.Vector3(...part.s)) })
      const color = new THREE.Color(part.c ?? alias?.[1] ?? '#ffffff')
      batch.colors.push(offline ? color.lerp(GREY, 0.75) : color)
    }
  })
  return [...batches.values()]
}
function CrewMesh({ batch, bones, shadows }: { batch: CrewBatch; bones: MutableRefObject<THREE.Matrix4[][]>; shadows: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const material = batch.tinted ? tintBase(batch.m) : manorMaterials()[batch.m]
  const scratch = useMemo(() => new THREE.Matrix4(), [])
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    batch.colors.forEach((color, index) => mesh.setColorAt(index, color))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [batch])
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    batch.slots.forEach((slot, index) => mesh.setMatrixAt(index, scratch.multiplyMatrices(bones.current[slot.agent]?.[BONES.indexOf(slot.bone)] ?? ZERO, slot.local)))
    mesh.instanceMatrix.needsUpdate = true
  })
  const glow = batch.m === 'ledCyan' || batch.m === 'blinkA'
  return <instancedMesh ref={ref} args={[geometryFor(batch.g), material, batch.slots.length]} frustumCulled={false} castShadow={shadows && !glow && (batch.g === 'box' || batch.g === 'roundedBox') && (batch.m === 'paper' || batch.m === 'carbon')}/>
}
export interface CrewProps {
  layout: ManorLayoutData
  stations: OfficeStation[]
  /** One placement per station, in the same order. */
  placements: Placement[]
  /** Whether a point (an agent's feet) is on a floor the current view shows. */
  visible: (position: THREE.Vector3) => boolean
  animate: boolean
  shadows: boolean
  anchors: MutableRefObject<Map<string, THREE.Object3D>>
  onSelect: (index: number) => void
  /** Double-click on a character (the camera focuses it). */
  onFocus?: (index: number) => void
  /** The character under the pointer, or null when it leaves. */
  onHover?: (index: number | null) => void
}
export function Crew({ layout, stations, placements, visible, animate, shadows, anchors, onSelect, onFocus, onHover }: CrewProps) {
  const signature = stations.map((station) => `${station.id}:${station.state === 'Offline' ? 'off' : 'on'}`).join('|')
  // Rebuilt only when the crew or someone's online status changes; poses update every frame.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const batches = useMemo(() => crewBatches(stations), [signature])
  const motions = useRef(new Map<string, Motion>())
  const bones = useRef<THREE.Matrix4[][]>([])
  const group = useRef<THREE.Group>(null)
  const hitbox = useRef<THREE.InstancedMesh>(null)
  const ring = useRef<THREE.InstancedMesh>(null)
  const temp = useMemo(() => ({ root: new THREE.Matrix4(), body: new THREE.Matrix4(), joint: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), up: new THREE.Vector3(0, 1, 0), x: new THREE.Vector3(1, 0, 0) }), [])
  const hitMaterial = useMemo(() => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), [])
  const ringMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#e9c47b', transparent: true, opacity: 0.85, toneMapped: false }), [])
  const ringGeometry = useMemo(() => new THREE.RingGeometry(0.45, 0.55, 24).rotateX(-Math.PI / 2), [])
  // Agent label anchors: plain objects the 2D labels and the elevator cab follow.
  useLayoutEffect(() => {
    const root = group.current
    const registry = anchors.current
    if (!root) return
    const made: THREE.Object3D[] = stations.map((station) => {
      const anchor = new THREE.Object3D()
      anchor.name = station.id
      root.add(anchor)
      registry.set(`agent-${station.id}`, anchor)
      return anchor
    })
    return () => { for (const anchor of made) { root.remove(anchor); registry.delete(`agent-${anchor.name}`) } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, anchors])
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    const step = Math.min(delta, 0.1)
    stations.forEach((station, index) => {
      const placement = placements[index]
      if (!placement) return
      const target = new THREE.Vector3(...placement.position)
      const destination = `${layout.agentCount}:${placement.position.join(',')}`
      let motion = motions.current.get(station.id)
      if (!motion) { motion = { position: target.clone(), rotY: placement.facing, path: [], destination, walking: false }; motions.current.set(station.id, motion) }
      // A new destination (or a resized manor) re-plans from wherever the agent is now.
      if (motion.destination !== destination || motion.layout !== layout) {
        motion.layout = layout
        motion.path = planPath(layout, [motion.position.x, motion.position.y, motion.position.z], placement.position).map(([x, y, z]) => new THREE.Vector3(x, y, z))
        motion.destination = destination
      }
      motion.walking = false
      const next = motion.path[0]
      if (next) {
        const to = temp.v.copy(next).sub(motion.position)
        const distance = to.length()
        if (distance < 0.04) motion.path.shift()
        else {
          motion.walking = true
          const vertical = Math.abs(to.y) > Math.hypot(to.x, to.z)
          motion.position.addScaledVector(to.normalize(), Math.min(distance, step * (vertical ? LIFT_SPEED : WALK_SPEED)))
          if (!vertical) motion.rotY += Math.atan2(Math.sin(Math.atan2(to.x, to.z) - motion.rotY), Math.cos(Math.atan2(to.x, to.z) - motion.rotY)) * 0.25
        }
      }
      writeBones(index, station, placement, motion, t, step)
    })
    bones.current.length = stations.length
    if (hitbox.current) hitbox.current.instanceMatrix.needsUpdate = true
    if (ring.current) ring.current.instanceMatrix.needsUpdate = true
  }, -1)
  const SEATED_WORK = ['Working', 'Reviewing', 'Deploying', 'Researching', 'Cron']
  function writeBones(index: number, station: OfficeStation, placement: Placement, motion: Motion, t: number, step: number) {
    const arrived = !motion.walking && motion.path.length === 0
    const lying = arrived && placement.pose === 'lie'
    const seated = arrived && placement.seated
    if (!motion.walking) motion.rotY += Math.atan2(Math.sin(placement.facing - motion.rotY), Math.cos(placement.facing - motion.rotY)) * (lying ? 1 : 0.12)
    const wave = (speed: number, phase = 0) => (animate ? Math.sin(t * speed + phase) : 0)
    const swing = motion.walking ? (animate ? Math.sin(t * 10) * 0.6 : 0.3) : 0
    const typing = seated && SEATED_WORK.includes(station.state)
    const talking = arrived && (station.state === 'Collaborating' || station.state === 'Triage')
    const reviewing = arrived && !seated && station.state === 'Reviewing'
    const personality = index * .73
    const breathe = !motion.walking ? wave(lying ? 1.2 : 1.7, personality) * .008 : 0
    const targetBodyY = lying ? (placement.height ?? 0.6) + 0.16 + breathe : seated ? -0.14 + breathe : breathe
    motion.bodyY = THREE.MathUtils.damp(motion.bodyY ?? targetBodyY, targetBodyY, 10, step)
    const bodyY = motion.bodyY
    const legs = lying ? 0 : seated ? -Math.PI / 2.2 : swing
    const armL = lying ? 0 : motion.walking ? -swing : typing ? -1.1 + wave(14) * 0.12 : talking ? -0.4 + wave(3) * 0.3 : 0
    const armR = lying ? 0 : motion.walking ? swing : typing ? -1.1 + wave(14, Math.PI / 2) * 0.12 : reviewing ? -1.0 : 0
    const shown = visible(motion.position)
    const set = (bones.current[index] ??= BONES.map(() => new THREE.Matrix4()))
    if (!shown) for (const matrix of set) matrix.copy(ZERO)
    else {
      temp.root.compose(motion.position, temp.q.setFromAxisAngle(temp.up, motion.rotY), temp.s.set(1, 1, 1))
      temp.body.copy(temp.root).multiply(temp.joint.makeTranslation(0, bodyY, 0)).multiply(new THREE.Matrix4().makeRotationX(lying ? -Math.PI / 2 : 0))
      const angles: Record<Bone, number> = { body: 0, head: wave(.65, personality)*.025, armL: armL + wave(1.3, personality)*.015, armR: armR + wave(1.3, personality+1)*.015, legL: legs, legR: -legs * (seated || lying ? -1 : 1) }
      motion.pose ??= BONES.map(bone=>angles[bone])
      BONES.forEach((bone,k)=>{motion.pose![k]=THREE.MathUtils.damp(motion.pose![k],angles[bone],14,step)})
      BONES.forEach((bone, k) => {
        if (bone === 'body') { set[k].copy(temp.body); return }
        const [px, py, pz] = PIVOTS[bone]
        set[k].copy(temp.body).multiply(temp.joint.makeTranslation(px, py, pz)).multiply(new THREE.Matrix4().makeRotationX(motion.pose![k]))
      })
    }
    const anchor = anchors.current.get(`agent-${station.id}`)
    if (anchor) {
      anchor.position.set(motion.position.x, motion.position.y + (lying ? (placement.height ?? 0.6) + 0.6 : ANCHOR_HEIGHT + bodyY), motion.position.z)
      anchor.visible = shown
    }
    // Invisible pick volume, a little larger than the body so a small, distant character is easy to click.
    hitbox.current?.setMatrixAt(index, shown ? new THREE.Matrix4().compose(new THREE.Vector3(motion.position.x, motion.position.y + 1 + bodyY, motion.position.z), temp.q, new THREE.Vector3(1.1, 2.2, 1.1)) : ZERO)
    ring.current?.setMatrixAt(index, shown && station.state === 'Unknown' ? new THREE.Matrix4().makeTranslation(motion.position.x, motion.position.y + 0.03, motion.position.z) : ZERO)
  }
  return <group ref={group}>
    {batches.map((batch) => <CrewMesh key={`${batch.key}:${batch.slots.length}`} batch={batch} bones={bones} shadows={shadows}/>)}
    {/* userData.crew: furniture under a character yields the click to it (InteractionLayer). */}
    <instancedMesh key={`hit${stations.length}`} ref={hitbox} args={[geometryFor('box'), hitMaterial, Math.max(1, stations.length)]} frustumCulled={false} userData={{ crew: true }}
      onClick={(event) => { if (event.button !== 0 || event.delta > 4) return; event.stopPropagation(); if (event.instanceId !== undefined && event.instanceId < stations.length) onSelect(event.instanceId) }}
      onDoubleClick={(event) => { if (event.button !== 0 || event.delta > 4) return; event.stopPropagation(); if (event.instanceId !== undefined && event.instanceId < stations.length) onFocus?.(event.instanceId) }}
      onPointerMove={(event) => { event.stopPropagation(); document.body.style.cursor = 'pointer'; onHover?.(event.instanceId !== undefined && event.instanceId < stations.length ? event.instanceId : null) }}
      onPointerOut={() => { document.body.style.cursor = ''; onHover?.(null) }}/>
    <instancedMesh key={`ring${stations.length}`} ref={ring} args={[ringGeometry, ringMaterial, Math.max(1, stations.length)]} frustumCulled={false}/>
  </group>
}
