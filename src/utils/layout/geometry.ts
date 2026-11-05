import type { BoundingBox, LayoutItem } from './types.ts'
// Footprints are rotated rectangles. Overlap uses the separating-axis test, so items placed along
// an arc (the display wall, the console) can sit side by side without false collisions.
export const EPS = 1e-6
type Footprint = Pick<LayoutItem, 'x' | 'z' | 'w' | 'd' | 'rotY'>
/** Axis-aligned bounds of an item's (possibly rotated) footprint. */
export function footprintOf(item: Footprint): BoundingBox {
  const c = Math.abs(Math.cos(item.rotY))
  const s = Math.abs(Math.sin(item.rotY))
  const hw = (item.w * c + item.d * s) / 2
  const hd = (item.w * s + item.d * c) / 2
  return { minX: item.x - hw, maxX: item.x + hw, minZ: item.z - hd, maxZ: item.z + hd }
}
export const rectsOverlap = (a: BoundingBox, b: BoundingBox, eps = EPS) => a.minX < b.maxX - eps && a.maxX > b.minX + eps && a.minZ < b.maxZ - eps && a.maxZ > b.minZ + eps
export const inflate = (rect: BoundingBox, by: number): BoundingBox => ({ minX: rect.minX - by, maxX: rect.maxX + by, minZ: rect.minZ - by, maxZ: rect.maxZ + by })
export const area = (rect: BoundingBox) => (rect.maxX - rect.minX) * (rect.maxZ - rect.minZ)
export const contains = (rect: BoundingBox, x: number, z: number, eps = EPS) => x >= rect.minX - eps && x <= rect.maxX + eps && z >= rect.minZ - eps && z <= rect.maxZ + eps
/** Distance from a point to an item's footprint (0 inside). */
export function distanceToItem(item: Footprint, x: number, z: number): number {
  const dx = x - item.x
  const dz = z - item.z
  // Into the item's own frame: local x = (cos, -sin), local z = (sin, cos) in world (x, z).
  const c = Math.cos(item.rotY)
  const s = Math.sin(item.rotY)
  const lx = dx * c - dz * s
  const lz = dx * s + dz * c
  return Math.hypot(Math.max(Math.abs(lx) - item.w / 2, 0), Math.max(Math.abs(lz) - item.d / 2, 0))
}
function corners(item: Footprint): [number, number][] {
  const c = Math.cos(item.rotY)
  const s = Math.sin(item.rotY)
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
    const lx = (u * item.w) / 2
    const lz = (v * item.d) / 2
    return [item.x + lx * c + lz * s, item.z - lx * s + lz * c]
  })
}
/** True when two footprints overlap by more than `eps` (separating-axis test). */
export function footprintsOverlap(a: Footprint, b: Footprint, eps = 1e-4): boolean {
  if (!rectsOverlap(footprintOf(a), footprintOf(b), eps)) return false
  const pa = corners(a)
  const pb = corners(b)
  for (const poly of [pa, pb]) for (let index = 0; index < 4; index += 1) {
    const [x1, z1] = poly[index]
    const [x2, z2] = poly[(index + 1) % 4]
    const nx = z1 - z2
    const nz = x2 - x1
    const length = Math.hypot(nx, nz)
    const project = (points: [number, number][]) => points.map(([x, z]) => (x * nx + z * nz) / length)
    const ra = project(pa)
    const rb = project(pb)
    if (Math.max(...ra) <= Math.min(...rb) + eps || Math.max(...rb) <= Math.min(...ra) + eps) return false
  }
  return true
}
