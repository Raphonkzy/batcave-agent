import { useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { wallBoxes, wallHeight, DEFAULT_SIDES, type ViewSides } from './wallGeometry.ts'
import * as THREE from 'three'
import { manorWindows } from './manorArchitecture.ts'
import { estateConfig } from './worldConfig.ts'
import { enclosureBands } from './enclosure.ts'
import { facadeParts } from './facadeParts.ts'
import { LIBRARY } from '../../utils/layout/dimensions.ts'
import { LEVEL_Y, type Zone } from '../../utils/layout/types.ts'
import { buildBatches, buildWorldBatches, keepAt } from './batches.ts'
import { Floors } from './Floors.tsx'
import { Batches, Boxes } from './Instanced.tsx'
import { manorMaterials } from './materials.ts'
import { box, cyl, shape, type Part } from './parts.ts'
import { concreteBump, concreteMap, tiled } from './textures.ts'
import { Glows } from './Glows.tsx'
import type { ManorLayoutData, QualityProfile, WallMode } from './ZoneLayout.ts'
// The surface manor: floors, walls (interactive wallMode: wallsUp, cutaway, wallsDown),
// tall windows, French doors in the suites, chandeliers, the library catwalk and the furniture.
/** Tall windows along the north and west outer walls, French doors on each suite's outer wall. */
function openingParts(layout: ManorLayoutData, zones: Zone[], mode: WallMode, sides: ViewSides): Part[] {
  const parts: Part[] = []
  for (const wall of layout.walls.filter((item) => item.exterior && zones.some((zone) => zone.level === item.level))) {
    if (wallHeight(wall, mode, sides) < wall.height) continue
    const base = LEVEL_Y[wall.level]
    const offset = wall.side === 'north' || wall.side === 'west' ? -0.15 : 0.15
    const openings = manorWindows(wall)
    for (const along of openings) {
      const tall = Math.min(wall.height - 1.2, 2.8)
      const p: Part['p'] = wall.axis === 'x' ? [along, base + 0.9 + tall / 2, wall.at + offset] : [wall.at + offset, base + 0.9 + tall / 2, along]
      const s: Part['s'] = wall.axis === 'x' ? [1.1, tall, 0.34] : [0.34, tall, 1.1]
      parts.push(box('glass', p, s))
      const frame = (alongOffset: number, y: number, span: number, h: number, material: 'stone' | 'brass') => parts.push(box(material, wall.axis === 'x' ? [along + alongOffset, y, p[2]] : [p[0], y, along + alongOffset], wall.axis === 'x' ? [span, h, 0.4] : [0.4, h, span]))
      frame(0, base + 0.88, 1.38, 0.12, 'stone')
      frame(0, base + 0.9 + tall, 1.32, 0.12, 'stone')
      for (const side of [-1, 1]) frame(side * 0.56, p[1], 0.08, tall, 'brass')
      frame(0, p[1], 0.035, tall, 'brass')
      frame(0, p[1], 1.1, 0.035, 'brass')
    }
  }

  // Headers keep deliberate door openings from becoming floor-to-roof voids.
  for (const door of layout.doors.filter(d => zones.some(z => z.level === d.level))) {
    const wall = layout.walls.find(w => w.level === door.level && w.axis === door.axis && Math.abs(w.at-door.at)<1e-6 && (Math.abs(w.to-(door.center-door.width/2))<1e-6 || Math.abs(w.from-(door.center+door.width/2))<1e-6))
    if (!wall) continue
    const h = wallHeight(wall, mode, sides)
    if (h <= 2.5) continue
    const offset = wall.exterior ? (wall.side === 'north' || wall.side === 'west' ? -0.15 : 0.15) : 0
    const p: Part['p'] = door.axis === 'x' ? [door.center, LEVEL_Y[door.level]+(h+2.5)/2, door.at+offset] : [door.at+offset, LEVEL_Y[door.level]+(h+2.5)/2, door.center]
    parts.push(box(wall.exterior ? 'stone' : 'mahogany', p, door.axis === 'x' ? [door.width+0.02,h-2.5,wall.exterior ? 0.3 : 0.15] : [wall.exterior ? 0.3 : 0.15,h-2.5,door.width+0.02]))
  }

  // Pool-facing double doors, open against the jambs: the central 2.8m stays usable.
  const frontZ = estateConfig(layout).entrance.threshold[2]
  const dBase = LEVEL_Y.surface
  parts.push(
    box('stone', [-1.45, dBase + 1.6, frontZ], [0.35, 3.2, 0.4]),
    box('stone', [1.45, dBase + 1.6, frontZ], [0.35, 3.2, 0.4]),
    box('stone', [0, dBase + 3.3, frontZ], [3.25, 0.35, 0.44]),
    box('brass', [0, dBase + 3.52, frontZ], [3.4, 0.08, 0.48]),
    box('glass', [0, dBase + 2.95, frontZ], [2.4, 0.25, 0.1]),
    box('brass', [0, dBase + 2.95, frontZ], [2.5, 0.3, 0.05]),
    box('mahogany', [-1.35, dBase + 1.5, frontZ + 0.62], [0.14, 3.0, 1.18]),
    box('mahogany', [1.35, dBase + 1.5, frontZ + 0.62], [0.14, 3.0, 1.18]),
    box('brass', [-1.24, dBase + 1.3, frontZ + 1.05], [0.06, 0.4, 0.06]),
    box('brass', [1.24, dBase + 1.3, frontZ + 1.05], [0.06, 0.4, 0.06]),
    box('brass', [-1.26, dBase + 0.15, frontZ + 0.62], [0.02, 0.25, 1.14]),
    box('brass', [1.26, dBase + 0.15, frontZ + 0.62], [0.02, 0.25, 1.14])
  )
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
  const entrance = layout.zones.entranceHall
  hang(0, LEVEL_Y.surface + 2.8, (entrance.minZ + entrance.maxZ) / 2, 0.75)
  const kitchen = layout.zones.butlerPantry
  hang((kitchen.minX + kitchen.maxX) / 2, LEVEL_Y.surface + 2.7, (kitchen.minZ + kitchen.maxZ) / 2, 0.55)
  const billiards = layout.items.find((item) => item.type === 'billiardsTable')!
  hang(billiards.x, LEVEL_Y.surface + 2.7, billiards.z, 0.8)
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
export function SurfaceManor({
  layout,
  profile,
  showUpper,
  wallMode = 'cutaway',
}: {
  layout: ManorLayoutData
  profile: QualityProfile
  showUpper: boolean
  wallMode?: WallMode
}) {
  const [sides, setSides] = useState<ViewSides>(DEFAULT_SIDES)
  const direction = useMemo(() => new THREE.Vector3(), [])
  useFrame(({camera}) => {
    if (wallMode !== 'cutaway') return
    camera.getWorldDirection(direction)
    // Hysteresis prevents quadrant flapping at cardinal boundaries.
    const x = Math.abs(direction.x) > 0.18 ? direction.x < 0 ? 'east' : 'west' : sides.x
    const z = Math.abs(direction.z) > 0.18 ? direction.z < 0 ? 'south' : 'north' : sides.z
    if (x !== sides.x || z !== sides.z) setSides({x, z})
  })
  const zones = useMemo(() => layout.zoneList.filter((zone) => zone.level === 'surface' || (showUpper && zone.level === 'surfaceUpper')), [layout, showUpper])
  const shown = useMemo(() => new Set(zones.map((zone) => zone.level)), [zones])
  const furniture = useMemo(() => buildBatches(layout.items.filter((item) => shown.has(item.level)), keepAt(profile.density)), [layout, shown, profile.density])
  const walls = useMemo(() => wallBoxes(layout.walls.filter((wall) => shown.has(wall.level)), wallMode, sides), [layout, shown, wallMode, sides])
  const enclosure = useMemo(() => wallMode === 'wallsUp' ? enclosureBands(layout) : [], [layout, wallMode])
  const lights = useMemo(() => chandeliers(layout), [layout])
  const extras = useMemo(() => buildWorldBatches([...openingParts(layout, zones, wallMode, sides), ...facadeParts(layout, zones, wallMode, sides), ...lights.parts, ...catwalkParts(layout), ...(showUpper ? mezzanineRailing(layout) : [])]), [layout, zones, lights, showUpper, wallMode, sides])
  const m = manorMaterials()
  const plaster = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8dcc2', map: tiled(concreteMap(), 2, 1), bumpMap: tiled(concreteBump(), 2, 1), bumpScale: 0.4, roughness: 0.9 }), [])
  useEffect(() => () => { plaster.dispose() }, [plaster])
  const floorZones = useMemo(() => zones.filter(zone=>zone.kind !== 'outdoor'), [zones])
  const shadows = profile.shadows === 'all'
  return <group>
    <Floors zones={floorZones}/>
    <group name="UpperVolumeEnclosure"><Boxes boxes={enclosure} material={m.stone} shadows={shadows}/></group>
    <Boxes boxes={walls.stone} material={m.stone} shadows={shadows}/>
    <Boxes boxes={walls.wainscot} material={m.mahogany} shadows={shadows}/>
    <Boxes boxes={walls.plaster} material={plaster} shadows={shadows}/>
    <Batches batches={furniture} shadows={shadows}/>
    <Batches batches={extras} shadows={false}/>
    <Glows glows={lights.halos.map((position) => ({ position, color: '#ffd9a0' }))} size={2.4} opacity={0.5}/>
  </group>
}
