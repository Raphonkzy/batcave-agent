import type { WallSegment } from '../../utils/layout/types.ts'

/** Shared by shell meshing and window placement: same openings, never glass in a solid wall. */
export function manorWindows(wall: WallSegment): number[] {
  if (!wall.exterior || !['surface', 'surfaceUpper'].includes(wall.level)) return []
  const out: number[] = []
  for (let along = wall.from + 1.4; along <= wall.to - 1.2; along += 2.6) out.push(along)
  return out
}
export interface WallPiece { from: number; to: number; bottom: number; height: number }
export function manorWallPieces(wall: WallSegment, visibleHeight: number): WallPiece[] {
  const out: WallPiece[] = []
  const add = (from: number, to: number, bottom: number, top: number) => {
    if (to > from && top > bottom) out.push({ from, to, bottom, height: top - bottom })
  }
  const top = 0.9 + Math.min(wall.height - 1.2, 2.8)
  let cursor = wall.from
  for (const center of manorWindows(wall)) {
    add(cursor, center - 0.55, 0, visibleHeight)
    add(center - 0.55, center + 0.55, 0, Math.min(0.9, visibleHeight))
    add(center - 0.55, center + 0.55, top, visibleHeight)
    cursor = center + 0.55
  }
  add(cursor, wall.to, 0, visibleHeight)
  return out
}
