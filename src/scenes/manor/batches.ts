import * as THREE from 'three'
import type { LayoutItem } from '../../utils/layout/types.ts'
import { ALIAS, type GeoKey, type MatKey } from './materials.ts'
import { deckParts, SPECIAL_TYPES, type Part } from './parts.ts'
import { fleetParts } from './partsFleet.ts'
import { lobbyParts } from './partsLobby.ts'
import { manorParts } from './partsManor.ts'
import { seedFrom } from './random.ts'
/** Decor is thinned out on low quality; working furniture never is. */
export const keepAt = (density: number) => (item: LayoutItem) => item.role !== 'decor' || (seedFrom(item.id) % 1000) / 1000 < density
/** The parts an item is drawn from (none for items with their own component). */
export function partsFor(item: LayoutItem): Part[] {
  if (SPECIAL_TYPES.has(item.type)) return []
  return deckParts(item) ?? fleetParts(item) ?? lobbyParts(item) ?? manorParts(item) ?? []
}
/** All instances sharing one geometry and one material: one draw call. */
export interface Batch { key: string; g: GeoKey; m: MatKey; matrices: THREE.Matrix4[]; colors?: THREE.Color[]; tinted?: boolean }
const up = new THREE.Vector3(0, 1, 0)
const euler = new THREE.Euler()
function push(batches: Map<string, Batch>, part: Part, origin: THREE.Vector3, rotY: number, scale = 1): void {
  const alias = ALIAS[part.m]
  const m = alias?.[0] ?? part.m
  const tint = part.c ?? alias?.[1]
  const key = `${part.g}|${m}`
  let batch = batches.get(key)
  if (!batch) { batch = { key, g: part.g, m, matrices: [], ...(alias ? { tinted: true } : {}) }; batches.set(key, batch) }
  const turn = new THREE.Quaternion().setFromAxisAngle(up, rotY)
  const position = new THREE.Vector3(...part.p).multiplyScalar(scale).applyQuaternion(turn).add(origin)
  const quaternion = turn.clone()
  if (part.r) quaternion.multiply(new THREE.Quaternion().setFromEuler(euler.set(...part.r)))
  batch.matrices.push(new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(...part.s).multiplyScalar(scale)))
  // Colours stay aligned with matrices once any instance of the batch has one.
  if (tint || batch.colors) {
    batch.colors ??= batch.matrices.slice(0, -1).map(() => new THREE.Color('#ffffff'))
    batch.colors.push(new THREE.Color(tint ?? '#ffffff'))
  }
}
/** Group the parts of layout items into instanced batches. `keep` thins out decor on low quality. */
export function buildBatches(items: LayoutItem[], keep: (item: LayoutItem) => boolean = () => true): Batch[] {
  const batches = new Map<string, Batch>()
  for (const item of items) {
    if (!keep(item)) continue
    const origin = new THREE.Vector3(item.x, item.y, item.z)
    for (const part of partsFor(item)) push(batches, part, origin, item.rotY)
  }
  return [...batches.values()]
}
/** Group loose parts already in world coordinates (shell, catwalks, beams). */
export function buildWorldBatches(parts: Part[]): Batch[] {
  const batches = new Map<string, Batch>()
  const origin = new THREE.Vector3()
  for (const part of parts) push(batches, part, origin, 0)
  return [...batches.values()]
}
/** Parts of one item placed at an arbitrary transform, for things that are not layout items (pod displays). */
export function placeParts(parts: Part[], at: THREE.Vector3, rotY: number, scale = 1): Batch[] {
  const batches = new Map<string, Batch>()
  for (const part of parts) push(batches, part, at, rotY, scale)
  return [...batches.values()]
}
/** Draws a profile's suit for the vault pods (the same gear the agents wear). */
export type SuitParts = (profile: string) => Part[]
