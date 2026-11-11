import * as THREE from 'three'
import type { BoundingBox, CameraPreset, LayoutItem, LevelId, ManorLayoutData } from '../../utils/layout/types.ts'
import { LEVEL_Y } from '../../utils/layout/types.ts'
import { enclosureBands } from './enclosure.ts'
import { wallBoxes } from './wallGeometry.ts'
import type { Level, WallMode } from './ZoneLayout.ts'

/** Every tunable of the camera controller in one place. */
export const CAMERA_CONFIG = {
  /** Pixels a pointer must travel before a press becomes a camera drag instead of a click. */
  dragThreshold: 5,
  rotateSpeed: 0.7,
  panSpeed: 0.8,
  zoomSpeed: 0.9,
  /** Orbit damping rate per second (frame-rate independent). */
  dampingRate: 12,
  /** Vertical rotation limits (radians from straight up). Never fully top-down, never below the horizon. */
  minPolarAngle: 0.15,
  maxPolarAngle: Math.PI / 2 - 0.05,
  minDistance: 2,
  maxDistance: 300,
  /** Exponential rates (1/s) of preset flights and of following a moving target. */
  flightRate: 3.2,
  followRate: 4,
  /** Clearance kept between the camera and solid geometry. */
  collisionMargin: 0.45,
  /** Corrections larger than this are eased in instead of snapped (e.g. after toggling walls). */
  snapLimit: 0.6,
  panBounds: { minX: -200, maxX: 200, minZ: -200, maxZ: 300 } as BoundingBox,
}
export type CameraConfig = typeof CAMERA_CONFIG

export interface Box { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }
type V3 = { x: number; y: number; z: number }

const LEVELS_SHOWN: Record<Level, LevelId[]> = {
  deck: ['subterranean'],
  ground: ['subterranean', 'surface'],
  upper: ['subterranean', 'surface', 'surfaceUpper'],
}
const centered = (x: number, y: number, z: number, w: number, h: number, d: number): Box =>
  ({ minX: x - w / 2, maxX: x + w / 2, minY: y - h / 2, maxY: y + h / 2, minZ: z - d / 2, maxZ: z + d / 2 })
const FLOOR_THICKNESS = 0.6
const MIN_SOLID_HEIGHT = 1
const BIG_ITEM = { height: 1.5, side: 0.8 }

/** Axis-aligned bounds of a (possibly rotated) item footprint. */
function itemBox(item: LayoutItem): Box {
  const c = Math.abs(Math.cos(item.rotY)), s = Math.abs(Math.sin(item.rotY))
  return centered(item.x, item.y + item.h / 2, item.z, c * item.w + s * item.d, item.h, s * item.w + c * item.d)
}

/**
 * Solid geometry the camera must not enter: walls, floor plates and large furniture of the floors
 * the current view shows. Built once per layout/level/wall-mode, never per frame.
 */
export function buildObstacles(layout: ManorLayoutData, level: Level, wallMode: WallMode): Box[] {
  const shown = LEVELS_SHOWN[level]
  const boxes: Box[] = []
  const walls = wallBoxes(layout.walls.filter(w => shown.includes(w.level)), wallMode)
  for (const w of [...walls.stone, ...walls.wainscot, ...walls.plaster]) {
    if (w.h >= MIN_SOLID_HEIGHT) boxes.push(centered(w.x, w.y, w.z, w.w, w.h, w.d))
  }
  if (level !== 'deck' && wallMode === 'wallsUp') {
    for (const b of enclosureBands(layout)) boxes.push(centered(b.x, b.y, b.z, b.w, b.h, b.d))
  }
  for (const zone of layout.zoneList) {
    if (!shown.includes(zone.level) || zone.kind === 'outdoor') continue
    const top = LEVEL_Y[zone.level]
    boxes.push({ minX: zone.rect.minX, maxX: zone.rect.maxX, minZ: zone.rect.minZ, maxZ: zone.rect.maxZ, minY: top - FLOOR_THICKNESS, maxY: top })
  }
  for (const item of layout.items) {
    if (shown.includes(item.level) && item.h >= BIG_ITEM.height && Math.min(item.w, item.d) >= BIG_ITEM.side) boxes.push(itemBox(item))
  }
  return boxes
}

/**
 * Push `position` out of any box (grown by `margin`). `previous` is where the camera was last frame:
 * a box is left through the side the camera came from, so thin walls cannot be tunnelled through.
 * Mutates `position`; returns true when something moved. Allocation free.
 */
export function pushOutOfBoxes(position: V3, previous: V3, boxes: readonly Box[], margin: number): boolean {
  let moved = false
  for (let pass = 0; pass < 3; pass++) {
    let changed = false
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]
      const x = position.x, y = position.y, z = position.z
      if (x <= b.minX - margin || x >= b.maxX + margin || y <= b.minY - margin || y >= b.maxY + margin || z <= b.minZ - margin || z >= b.maxZ + margin) continue
      // Distance to leave through each face, and whether the camera was already outside on that axis.
      const lowX = x - (b.minX - margin), highX = b.maxX + margin - x
      const lowY = y - (b.minY - margin), highY = b.maxY + margin - y
      const lowZ = z - (b.minZ - margin), highZ = b.maxZ + margin - z
      let bestAxis = -1, bestDist = Infinity, bestSign = 1
      let anyAxis = -1, anyDist = Infinity, anySign = 1
      const consider = (axis: number, prev: number, lo: number, hi: number, dLow: number, dHigh: number) => {
        const sign = dLow < dHigh ? -1 : 1, dist = Math.min(dLow, dHigh)
        if (dist < anyDist) { anyDist = dist; anyAxis = axis; anySign = sign }
        if (prev <= lo - margin) { if (dLow < bestDist) { bestDist = dLow; bestAxis = axis; bestSign = -1 } }
        else if (prev >= hi + margin) { if (dHigh < bestDist) { bestDist = dHigh; bestAxis = axis; bestSign = 1 } }
      }
      consider(0, previous.x, b.minX, b.maxX, lowX, highX)
      consider(1, previous.y, b.minY, b.maxY, lowY, highY)
      consider(2, previous.z, b.minZ, b.maxZ, lowZ, highZ)
      const axis = bestAxis >= 0 ? bestAxis : anyAxis, sign = bestAxis >= 0 ? bestSign : anySign
      if (axis === 0) position.x = sign < 0 ? b.minX - margin : b.maxX + margin
      else if (axis === 1) position.y = sign < 0 ? b.minY - margin : b.maxY + margin
      else position.z = sign < 0 ? b.minZ - margin : b.maxZ + margin
      changed = moved = true
    }
    if (!changed) break
  }
  return moved
}

/**
 * Orbit distance that frames a bounding sphere comfortably. Keeps the current distance when it
 * is already reasonable, so focusing never zooms far out and never ends up inside the object.
 */
export function framingDistance(radius: number, fovDegrees: number, aspect: number, current: number, cfg: CameraConfig = CAMERA_CONFIG): number {
  const halfV = THREE.MathUtils.degToRad(fovDegrees) / 2
  const halfH = Math.atan(Math.tan(halfV) * Math.max(aspect, 0.1))
  const fit = (radius / Math.sin(Math.min(halfV, halfH))) * 1.35
  const near = Math.max(fit, cfg.minDistance + 1), far = Math.max(near * 2, near + 6)
  return THREE.MathUtils.clamp(current, near, Math.min(far, cfg.maxDistance))
}

/** Camera goal that looks at `target` from the current direction, at a framed distance. */
export function focusGoal(camera: V3, orbitTarget: V3, target: V3, radius: number | undefined, fov: number, aspect: number, cfg: CameraConfig = CAMERA_CONFIG) {
  const offset = new THREE.Vector3(camera.x - orbitTarget.x, camera.y - orbitTarget.y, camera.z - orbitTarget.z)
  if (offset.lengthSq() < 1e-6) offset.set(0, 1, 1)
  if (radius !== undefined) offset.setLength(framingDistance(radius, fov, aspect, offset.length(), cfg))
  const t = new THREE.Vector3(target.x, target.y, target.z)
  return { target: t, position: t.clone().add(offset) }
}

/**
 * Re-aim the orbit at another area (floor switch, recenter): same direction and zoom distance,
 * new target kept inside the preset's pan area. Never changes rotation or forces a top-down view.
 */
export function retargetGoal(camera: V3, orbitTarget: V3, preset: CameraPreset, cfg: CameraConfig = CAMERA_CONFIG) {
  const offset = new THREE.Vector3(camera.x - orbitTarget.x, camera.y - orbitTarget.y, camera.z - orbitTarget.z)
  if (offset.lengthSq() < 1e-6) offset.set(0, 1, 1)
  offset.setLength(THREE.MathUtils.clamp(offset.length(), cfg.minDistance, cfg.maxDistance))
  const t = new THREE.Vector3(...preset.target)
  t.x = THREE.MathUtils.clamp(t.x, preset.pan.minX, preset.pan.maxX)
  t.z = THREE.MathUtils.clamp(t.z, preset.pan.minZ, preset.pan.maxZ)
  return { target: t, position: t.clone().add(offset) }
}

/** Bounding-sphere radius of a layout item, used to frame it. */
export const itemRadius = (item: Pick<LayoutItem, 'w' | 'd' | 'h'>) => Math.max(Math.hypot(item.w, item.d, item.h) / 2, 0.8)
