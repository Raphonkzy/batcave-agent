import { useMemo } from 'react'
import * as THREE from 'three'
import { LIBRARY } from '../../utils/layout/dimensions.ts'
import { LEVEL_Y, type WallSegment, type Zone } from '../../utils/layout/types.ts'
import { buildBatches, buildWorldBatches, keepAt } from './batches.ts'
import { Floors } from './Floors.tsx'
import { Batches, Boxes } from './Instanced.tsx'
import { manorMaterials } from './materials.ts'
import { box, cyl, shape, type Part } from './parts.ts'
import { concreteBump, concreteMap, tiled } from './textures.ts'
import { Glows } from './Glows.tsx'
import type { ManorLayoutData, QualityProfile } from './ZoneLayout.ts'
// The surface manor: floors, walls (a dollhouse cutaway: the south and east outer walls are low),
// tall windows, French doors in the suites, chandeliers, the library catwalk and the furniture.
/** Interior walls stop at this height so the rooms beyond stay visible from above. */
const INTERIOR_WALL = 2.4
const CUTAWAY_WALL = 1
const WAINSCOT = 1
type Box = { x: number; y: number; z: number; w: number; h: number; d: number }
function wallBoxes(walls: WallSegment[]) {
  const wainscot: Box[] = []
  const plaster: Box[] = []
  const stone: Box[] = []
  for (const wall of walls) {
    const length = wall.to - wall.from
    const mid = (wall.from + wall.to) / 2
    const base = LEVEL_Y[wall.level]
    const thick = wall.exterior ? 0.3 : 0.15
    const at = wall.exterior ? wall.at + (wall.side === 'north' ? -0.15 : wall.side === 'south' ? 0.15 : wall.side === 'west' ? -0.15 : 0.15) : wall.at
    const shape = (h: number, y0: number): Box => (wall.axis === 'x' ? { x: mid, y: base + y0 + h / 2, z: at, w: length + (wall.exterior ? 0.3 : 0), h, d: thick } : { x: at, y: base + y0 + h / 2, z: mid, w: thick, h, d: length + (wall.exterior ? 0.3 : 0) })
    if (wall.exterior) {
      const cut = wall.side === 'south' || wall.side === 'east'
      stone.push(shape(cut ? CUTAWAY_WALL : wall.height, 0))
    } else {
      wainscot.push(shape(WAINSCOT, 0))
      plaster.push(shape(INTERIOR_WALL - WAINSCOT, WAINSCOT))
    }
  }
  return { wainscot, plaster, stone }
}
/** Tall windows along the north and west outer walls, French doors on each suite's outer wall. */
function openingParts(layout: ManorLayoutData, zones: Zone[]): Part[] {
  const parts: Part[] = []
  for (const wall of layout.walls.filter((item) => item.exterior && (item.side === 'north' || item.side === 'west') && zones.some((zone) => zone.level === item.level))) {
    const base = LEVEL_Y[wall.level]
    const offset = wall.side === 'north' ? 0.01 : 0.01
    for (let along = wall.from + 1.4; along <= wall.to - 1.2; along += 2.6) {
      const tall = Math.min(wall.height - 1.2, 2.8)
      const p: Part['p'] = wall.axis === 'x' ? [along, base + 0.9 + tall / 2, wall.at + offset] : [wall.at + offset, base + 0.9 + tall / 2, along]
      const s: Part['s'] = wall.axis === 'x' ? [1.1, tall, 0.34] : [0.34, tall, 1.1]
      parts.push(box('glass', p, s), box('brass', [p[0], base + 0.9, p[2]], wall.axis === 'x' ? [1.2, 0.06, 0.36] : [0.36, 0.06, 1.2]), box('brass', [p[0], base + 0.9 + tall, p[2]], wall.axis === 'x' ? [1.2, 0.06, 0.36] : [0.36, 0.06, 1.2]))
    }
  }
  for (const zone of zones.filter((item) => item.kind === 'suite')) {
    const bed = layout.items.find((item) => item.zone === zone.id && item.type === 'bed')!
    const outerX = Math.abs(bed.x - zone.rect.minX) < Math.abs(bed.x - zone.rect.maxX) ? zone.rect.minX : zone.rect.maxX
    const exterior = layout.walls.some((wall) => wall.exterior && wall.level === zone.level && wall.axis === 'z' && Math.abs(wall.at - outerX) < 1e-6 && wall.from <= zone.rect.minZ + 1e-6 && wall.to >= zone.rect.maxZ - 1e-6)
    if (!exterior) continue
    const base = LEVEL_Y[zone.level]
    for (const z of [zone.rect.minZ + 0.8, zone.rect.maxZ - 0.8]) parts.push(box('glass', [outerX, base + 1.2, z], [0.34, 2.2, 0.9]), box('brass', [outerX, base + 2.32, z], [0.36, 0.06, 1.0]))
  }
  return parts
}
/** Crystal chandeliers (emissive, no real light) over the foyer, the lounge sets and the banquet table. */
function chandeliers(layout: ManorLayoutData): { parts: Part[]; halos: [number, number, number][] } {
  const parts: Part[] = []
  const halos: [number, number, number][] = []
  const hang = (x: number, y: number, z: number, size: number) => {
    parts.push(cyl('brass', [x, y + 0.6, z], [0.03, 1.2, 0.03]), shape('torus', 'brass', [x, y, z], [size, 1, size]), shape('ico', 'crystal', [x, y - 0.25, z], [size * 0.35, size * 0.5, size * 0.35]))
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2
      parts.push(shape('ico', 'crystal', [x + Math.cos(angle) * size * 0.5, y - 0.1, z + Math.sin(angle) * size * 0.5], [0.12 * size, 0.2 * size, 0.12 * size]))
    }
    halos.push([x, y - 0.2, z])
  }
  // The lobby's grand chandelier: three polyhedral crystal tiers, widest at the top, over the medallion.
  const medallion = layout.items.find((item) => item.type === 'lobbyMedallion')!
  const top = LEVEL_Y.surface + 6.2
  parts.push(cyl('brass', [medallion.x, top + 0.6, medallion.z], [0.05, 1.2, 0.05]), cyl('brass', [medallion.x, top - 0.8, medallion.z], [0.08, 2.2, 0.08]))
  ;([[1.35, 0, 10], [0.95, -0.7, 8], [0.55, -1.4, 6]] as const).forEach(([radius, drop, count]) => {
    parts.push(shape('torus', 'brass', [medallion.x, top + drop, medallion.z], [radius * 2, 1, radius * 2]))
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2
      parts.push(shape('ico', 'crystal', [medallion.x + Math.cos(angle) * radius, top + drop - 0.28, medallion.z + Math.sin(angle) * radius], [0.2, 0.42, 0.2]))
    }
    halos.push([medallion.x, top + drop - 0.2, medallion.z])
  })
  parts.push(shape('ico', 'crystal', [medallion.x, top - 1.9, medallion.z], [0.34, 0.6, 0.34]))
  for (const table of layout.items.filter((item) => item.type === 'coffeeTable')) hang(table.x, LEVEL_Y.surface + 3, table.z, 1)
  const banquet = layout.items.find((item) => item.type === 'banquetTable')!
  const lamps = Math.max(1, Math.floor(banquet.d / 3))
  for (let index = 0; index < lamps; index += 1) hang(banquet.x, LEVEL_Y.surface + 3, banquet.z - banquet.d / 2 + (banquet.d * (index + 0.5)) / lamps, 1)
  return { parts, halos }
}
/**
 * The mezzanine's glass balustrade with a polished brass handrail, along the landing's edge over the
 * lobby. It leaves a 2.2-wide opening at the head of each staircase, so nothing closes off the stairs.
 */
function mezzanineRailing(layout: ManorLayoutData): Part[] {
  const landing = layout.zones.upperLanding
  const foyer = layout.zones.grandFoyer
  const y = LEVEL_Y.surfaceUpper
  const z = landing.maxZ - 0.05
  const stairs = layout.items.filter((item) => item.type === 'grandStair').map((item) => item.x).sort((p, q) => p - q)
  const bounds = [foyer.minX, ...stairs.flatMap((x) => [x - 1.1, x + 1.1]), foyer.maxX]
  const parts: Part[] = []
  for (let index = 0; index < bounds.length; index += 2) {
    const from = bounds[index]
    const to = bounds[index + 1]
    if (to - from < 0.2) continue
    parts.push(box('glass', [(from + to) / 2, y + 0.55, z], [to - from, 1.0, 0.04]), box('brass', [(from + to) / 2, y + 1.07, z], [to - from, 0.06, 0.09]), box('brass', [(from + to) / 2, y + 0.03, z], [to - from, 0.05, 0.08]))
    for (let x = from; x <= to + 1e-6; x += 1.2) parts.push(cyl('brass', [x, y + 0.55, z], [0.05, 1.0, 0.05]))
  }
  return parts
}
/** The library's catwalk at y 14 along its shelves, with a brass rail. */
function catwalkParts(layout: ManorLayoutData): Part[] {
  const library = layout.zones.grandLibrary
  const y = LIBRARY.catwalkY
  const width = library.maxX - library.minX
  return [
    box('mahogany', [(library.minX + library.maxX) / 2, y, library.minZ + 0.9], [width - 0.5, 0.08, 0.8]),
    box('brass', [(library.minX + library.maxX) / 2, y + 0.95, library.minZ + 1.28], [width - 0.5, 0.04, 0.04]),
    box('mahogany', [library.maxX - 0.9, y, (library.minZ + library.maxZ) / 2 + 0.4], [0.8, 0.08, library.maxZ - library.minZ - 2.4]),
    box('brass', [library.maxX - 1.28, y + 0.95, (library.minZ + library.maxZ) / 2 + 0.4], [0.04, 0.04, library.maxZ - library.minZ - 2.4]),
  ]
}
export function SurfaceManor({ layout, profile, showUpper }: { layout: ManorLayoutData; profile: QualityProfile; showUpper: boolean }) {
  const zones = useMemo(() => layout.zoneList.filter((zone) => zone.level === 'surface' || (showUpper && zone.level === 'surfaceUpper')), [layout, showUpper])
  const shown = useMemo(() => new Set(zones.map((zone) => zone.level)), [zones])
  const furniture = useMemo(() => buildBatches(layout.items.filter((item) => shown.has(item.level)), keepAt(profile.density)), [layout, shown, profile.density])
  const walls = useMemo(() => wallBoxes(layout.walls.filter((wall) => shown.has(wall.level))), [layout, shown])
  const lights = useMemo(() => chandeliers(layout), [layout])
  const extras = useMemo(() => buildWorldBatches([...openingParts(layout, zones), ...lights.parts, ...catwalkParts(layout), ...(showUpper ? mezzanineRailing(layout) : [])]), [layout, zones, lights, showUpper])
  const m = manorMaterials()
  const plaster = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8dcc2', map: tiled(concreteMap(), 2, 1), bumpMap: tiled(concreteBump(), 2, 1), bumpScale: 0.4, roughness: 0.9 }), [])
  const shadows = profile.shadows === 'all'
  return <group>
    <Floors zones={zones.filter((zone) => zone.kind !== 'outdoor')}/>
    <Boxes boxes={walls.stone} material={m.stone} shadows={shadows}/>
    <Boxes boxes={walls.wainscot} material={m.mahogany} shadows={shadows}/>
    <Boxes boxes={walls.plaster} material={plaster} shadows={shadows}/>
    <Batches batches={furniture} shadows={shadows}/>
    <Batches batches={extras} shadows={false}/>
    <Glows glows={lights.halos.map((position) => ({ position, color: '#ffd9a0' }))} size={2.4} opacity={0.5}/>
  </group>
}
