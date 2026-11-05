import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Batch } from './batches.ts'
import { geometryFor, manorMaterials, tintBase, type MatKey } from './materials.ts'
// Draws batches as instanced meshes: one draw call per (geometry, material) pair.
const NO_SHADOW: ReadonlySet<MatKey> = new Set<MatKey>(['glass', 'holo', 'blinkA', 'blinkB', 'ledCyan', 'ledAmber', 'ledRed', 'ledGreen', 'ledViolet', 'ledWhite', 'flame', 'lampWarm', 'bankerGreen', 'crystal', 'rug', 'carpet'])
/** Medium quality: only these materials cast shadows (the main command light's shadow stays meaningful). */
const MAIN_CASTERS: ReadonlySet<MatKey> = new Set<MatKey>(['gunmetal', 'carbon'])
export type Shadows = boolean | 'main'
export function BatchMesh({ batch, shadows = true }: { batch: Batch; shadows?: Shadows }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const material = batch.tinted ? tintBase(batch.m) : manorMaterials()[batch.m]
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    batch.matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
    mesh.instanceMatrix.needsUpdate = true
    if (batch.colors) {
      batch.colors.forEach((color, index) => mesh.setColorAt(index, color))
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    mesh.computeBoundingSphere()
    mesh.computeBoundingBox()
  }, [batch])
  const cast = shadows === 'main' ? MAIN_CASTERS.has(batch.m) : shadows && !NO_SHADOW.has(batch.m)
  return <instancedMesh ref={ref} args={[geometryFor(batch.g), material, batch.matrices.length]} castShadow={cast} receiveShadow={shadows !== false && !NO_SHADOW.has(batch.m)}/>
}
export function Batches({ batches, shadows = true }: { batches: Batch[]; shadows?: Shadows }) {
  return <>{batches.map((batch) => <BatchMesh key={`${batch.key}:${batch.matrices.length}`} batch={batch} shadows={shadows}/>)}</>
}
/** Plain boxes from world-space rectangles (walls, slabs), sharing one draw call per material. */
export function Boxes({ boxes, material, shadows = true }: { boxes: { x: number; y: number; z: number; w: number; h: number; d: number }[]; material: THREE.Material; shadows?: boolean }) {
  const batch = useMemo<Batch>(() => ({ key: 'boxes', g: 'box', m: 'gunmetal', matrices: boxes.map((item) => new THREE.Matrix4().compose(new THREE.Vector3(item.x, item.y, item.z), new THREE.Quaternion(), new THREE.Vector3(item.w, item.h, item.d))) }), [boxes])
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    batch.matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [batch])
  if (boxes.length === 0) return null
  return <instancedMesh key={boxes.length} ref={ref} args={[geometryFor('box'), material, boxes.length]} castShadow={shadows} receiveShadow={shadows}/>
}
