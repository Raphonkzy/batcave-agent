import { plan, SURFACE_Y } from '../../utils/layout/dimensions.ts'
import type { ManorLayoutData, Vec3 } from '../../utils/layout/types.ts'

/** +Y is up; +Z is the formal front. The pool occupies a separate west garden court. */
export function estateConfig(layout?: ManorLayoutData) {
  const p = plan(layout?.agentCount ?? 12)
  const z = layout?.zones.entranceHall.maxZ ?? p.terraceZ
  const pool = layout?.items.find((item) => item.type === 'infinityPool')
  const poolEast = layout?.zones.terracePool.maxX ?? -p.ww - 8
  const poolZ = pool?.z ?? z + 13
  const gateZ = z + 24
  return {
    entrance: { threshold: [0, SURFACE_Y, z] as Vec3, facing: [0, 0, 1] as Vec3 },
    gate: { position: [0, SURFACE_Y, gateZ] as Vec3, width: 7 },
    lot: { minX: Math.min(-32, (layout?.bounds.minX ?? -p.half) - 4), maxX: Math.max(32, p.half + 4), minZ: -20, maxZ: gateZ + 2, surfaceY: SURFACE_Y },
    pathWidth: 2.8,
    pathPolyline: [[0, SURFACE_Y, z], [0, SURFACE_Y, z + 6], [0, SURFACE_Y, gateZ]] as Vec3[],
    poolConnector: [[-6, SURFACE_Y, z + 3], [poolEast - 1.2, SURFACE_Y, z + 3], [poolEast - 1.2, SURFACE_Y, poolZ]] as Vec3[],
  }
}
export const WORLD_CONFIG = estateConfig()
export function dot(a: Vec3, b: Vec3): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
export function sub(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
export function dist(a: Vec3, b: Vec3): number { return Math.hypot(...sub(a, b)) }
