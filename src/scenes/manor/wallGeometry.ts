import { LEVEL_Y, type WallSegment } from '../../utils/layout/types.ts'
import type { WallMode } from './ZoneLayout.ts'
import { manorWallPieces } from './manorArchitecture.ts'
export type WallBox = { x: number; y: number; z: number; w: number; h: number; d: number }
export interface ViewSides { x: 'east' | 'west'; z: 'north' | 'south' }
export const DEFAULT_SIDES: ViewSides = { x: 'east', z: 'south' }
export function wallHeight(wall: WallSegment, mode: WallMode, sides: ViewSides) {
  if (mode === 'wallsDown') return 0.3
  if (mode === 'cutaway' && (wall.side === sides.x || wall.side === sides.z || !wall.exterior)) return 1
  return wall.height
}
/** Shared endpoints plus half-thickness end caps close convex and concave corners. */
export function wallBoxes(walls: WallSegment[], mode: WallMode, sides: ViewSides = DEFAULT_SIDES) {
  const stone: WallBox[] = [], wainscot: WallBox[] = [], plaster: WallBox[] = []
  for (const wall of walls) {
    const height = wallHeight(wall, mode, sides)
    const thick = wall.exterior ? 0.3 : 0.15
    const offset = wall.side === 'north' || wall.side === 'west' ? -thick / 2 : thick / 2
    const at = wall.at + (wall.exterior ? offset : 0)
    const pieces = wall.exterior && ['surface', 'surfaceUpper'].includes(wall.level) ? manorWallPieces(wall, height) : [{from: wall.from, to: wall.to, bottom: 0, height}]
    for (const p of pieces) {
      // Only extend actual wall ends, never narrow an intentional window aperture.
      const from = p.from - (p.from === wall.from ? thick / 2 : 0)
      const to = p.to + (p.to === wall.to ? thick / 2 : 0)
      const box: WallBox = wall.axis === 'x'
        ? {x: (from + to) / 2, y: LEVEL_Y[wall.level] + p.bottom + p.height / 2, z: at, w: to-from, h:p.height, d:thick}
        : {z: (from + to) / 2, y: LEVEL_Y[wall.level] + p.bottom + p.height / 2, x: at, d: to-from, h:p.height, w:thick}
      if (wall.exterior) stone.push(box)
      else if (height <= 1) wainscot.push(box)
      else {
        wainscot.push({...box, h:1, y:LEVEL_Y[wall.level]+0.5})
        plaster.push({...box, h:height-1, y:LEVEL_Y[wall.level]+1+(height-1)/2})
      }
    }
  }
  return {stone, wainscot, plaster}
}
