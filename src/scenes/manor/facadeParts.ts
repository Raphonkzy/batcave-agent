import { LEVEL_Y, type ManorLayoutData, type Zone } from '../../utils/layout/types.ts'
import { box, cyl, type Part } from './parts.ts'
import { wallHeight, type ViewSides } from './wallGeometry.ts'
import { estateConfig } from './worldConfig.ts'
import type { WallMode } from './ZoneLayout.ts'

/** Trim follows actual shell boundaries and the deliberate wall visibility mode. */
export function facadeParts(layout: ManorLayoutData, zones: Zone[], mode: WallMode, sides: ViewSides): Part[] {
  const parts: Part[] = []
  for (const wall of layout.walls.filter(w => w.exterior && zones.some(z => z.level === w.level))) {
    const h = wallHeight(wall, mode, sides), base = LEVEL_Y[wall.level]
    const sign = wall.side === 'north' || wall.side === 'west' ? -1 : 1
    const at = wall.at + sign * .2, length = wall.to - wall.from
    for (const [y, depth, height] of [[base + .16, .5, .3], [base + h - .12, .48, .16], [base + h - .28, .4, .08]]) {
      parts.push(box('stone', wall.axis === 'x' ? [(wall.from + wall.to)/2,y,at] : [at,y,(wall.from+wall.to)/2], wall.axis === 'x' ? [length, height, depth] : [depth,height,length]))
    }
    if (h < wall.height) continue
    for (const along of [wall.from + .18, wall.to - .18]) {
      parts.push(box('stone', wall.axis === 'x' ? [along,base+h/2,at] : [at,base+h/2,along], wall.axis === 'x' ? [.28,h,.48] : [.48,h,.28]))
    }
  }
  if (mode === 'wallsDown') return parts
  const z = estateConfig(layout).entrance.threshold[2], y = LEVEL_Y.surface
  for (const side of [-1,1]) {
    const x = side * 2.15
    parts.push(box('stone',[x,y+.12,z+.8],[.65,.24,.65]),cyl('stone',[x,y+1.65,z+.8],[.36,3.1,.36]),box('stone',[x,y+3.2,z+.8],[.65,.18,.65]),box('brass',[x,y+3.08,z+.8],[.4,.06,.4]))
    parts.push(box('blackSteel',[side*3.3,y+2,z+.26],[.26,.64,.24]),box('lampWarm',[side*3.3,y+2,z+.4],[.16,.44,.08]))
  }
  parts.push(box('stone',[0,y+3.42,z+.65],[5.3,.26,1.9]),box('brass',[0,y+3.59,z+.65],[5.45,.07,1.98]))
  return parts
}
