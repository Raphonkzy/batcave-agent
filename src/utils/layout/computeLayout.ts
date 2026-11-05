import { Builder } from './builder.ts'
import { BASIN_Y, CAVE_CEILING, CHASM_WIDTH, ELEVATOR, MANOR_TOP, NORTH_Z, plan, SURFACE_Y } from './dimensions.ts'
import { buildSubterranean } from './subterranean.ts'
import { buildSurface, STAIR, STAIR_X } from './surface.ts'
import { buildWalls, finishBareFloor, floorGrid, reservedAreas, walkingGrid, type FloorGrid } from './structure.ts'
import { GRID_RES } from './structure.ts'
import { buildZones } from './zones.ts'
import { LEVEL_Y, type BoundingBox, type CameraPreset, type LevelId, type LevelLink, type ManorLayoutData, type NamedZone, type Vec3, type Zone } from './types.ts'
// The single source of truth for the Tactical Manor: a pure function from the crew size to every
// zone, item, wall, door, stop, walking grid and camera preset. The scene only draws what it returns.
export const LEVELS: LevelId[] = ['subterranean', 'surface', 'surfaceUpper']
const bbox = (rects: BoundingBox[]): BoundingBox => ({
  minX: Math.min(...rects.map((rect) => rect.minX)), maxX: Math.max(...rects.map((rect) => rect.maxX)),
  minZ: Math.min(...rects.map((rect) => rect.minZ)), maxZ: Math.max(...rects.map((rect) => rect.maxZ)),
})
function preset(rect: BoundingBox, y: number, view: 'top' | 'iso'): CameraPreset {
  const cx = (rect.minX + rect.maxX) / 2
  const cz = (rect.minZ + rect.maxZ) / 2
  const span = Math.max(rect.maxX - rect.minX, rect.maxZ - rect.minZ)
  const target: Vec3 = [cx, y, cz]
  const position: Vec3 = view === 'top' ? [cx, y + span * 0.78 + 4, cz + span * 0.62 + 4] : [cx + span * 0.62, y + span * 0.55 + 6, cz + span * 1.0 + 6]
  return { target, position, minDistance: 5, maxDistance: span * 2.4 + 12, pan: { minX: rect.minX - 3, maxX: rect.maxX + 3, minZ: rect.minZ - 3, maxZ: rect.maxZ + 3 } }
}
export function computeLayout(agentCount: number): ManorLayoutData {
  const p = plan(agentCount)
  const { zones, suiteDoorSide } = buildZones(p)
  const b = new Builder()
  buildSubterranean(b, p, zones)
  buildSurface(b, p, zones, suiteDoorSide)
  const { doors, walls } = buildWalls(zones, b.items)
  // Agents step into the cab from the west on the deck and from the south in the foyer (the stairs
  // stand east of it there).
  const links: LevelLink[] = [
    { kind: 'elevator', a: { level: 'subterranean', x: ELEVATOR.x - 1.6, z: ELEVATOR.z }, b: { level: 'surface', x: ELEVATOR.x, z: ELEVATOR.z + 1.6 }, via: [[ELEVATOR.x, LEVEL_Y.subterranean, ELEVATOR.z], [ELEVATOR.x, LEVEL_Y.surface, ELEVATOR.z]] },
    ...[-1, 1].map((side): LevelLink => ({ kind: 'stairs', a: { level: 'surface', x: side * STAIR_X, z: STAIR.maxZ + 0.5 }, b: { level: 'surfaceUpper', x: side * STAIR_X, z: NORTH_Z + 0.75 }, via: [] })),
  ]
  const points = links.flatMap((link) => [link.a, link.b])
  const reserved = reservedAreas(doors, b.stops, points)
  const floors: FloorGrid[] = LEVELS.map((level) => floorGrid(zones, level))
  for (const grid of floors) {
    finishBareFloor(grid, b.items, walls, reserved.filter((item) => item.level === grid.level).map((item) => item.rect), (type, zone, x, z, w, d, h) => b.item(type, zone.id, zone.level, x, z, w, d, h, 0, { role: 'decor' }))
  }
  const grids = floors.map((grid) => walkingGrid(grid, LEVEL_Y[grid.level], b.items, walls))
  const cave = bbox(zones.filter((zone) => zone.level === 'subterranean').map((zone) => zone.rect))
  const manor = bbox(zones.filter((zone) => zone.level !== 'subterranean').map((zone) => zone.rect))
  const all = bbox([cave, manor])
  const named = Object.fromEntries(zones.filter((zone) => zone.kind !== 'suite').map((zone) => [zone.id, zone.rect])) as Record<NamedZone, BoundingBox>
  // A floor with no suites still has its corridor key, as an empty box at the wing's start.
  for (const id of ['eastCorridor', 'upperCorridor', 'upperGallery', 'upperEastLink', 'upperEastCorridor'] as const) named[id] ??= { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }
  const suites = zones.filter((zone): zone is Zone & { owner: number } => zone.kind === 'suite').sort((a, c) => a.owner - c.owner).map((zone) => zone.rect)
  const basin = named.basinCatwalk
  return {
    agentCount: p.n,
    bounds: { ...all, height: MANOR_TOP - BASIN_Y },
    levels: { subterranean: { y: LEVEL_Y.subterranean, bounds: cave }, transition: { yStart: CAVE_CEILING, yEnd: SURFACE_Y }, surface: { y: SURFACE_Y, bounds: manor } },
    zones: { ...named, bedroomSuites: suites },
    zoneList: zones,
    items: b.items,
    walls,
    doors,
    paths: { resolution: GRID_RES, grids, stops: b.stops, links },
    camera: {
      commandDeck: preset(cave, 2.5, 'top'),
      // The fleet: the hangar's two rows and the wet dock beside them, seen from the aisle side.
      hangarBay: preset(bbox([named.hangarBay, named.basinCatwalk]), 1, 'top'),
      grandManor: preset(manor, 13.5, 'top'),
      // The lobby: the foyer and the front of the lounge, close enough to read the reception desk.
      manorLobby: { ...preset({ minX: -7, maxX: 7, minZ: NORTH_Z, maxZ: 6 }, 12.5, 'top'), minDistance: 4 },
      overview: preset(all, 6, 'iso'),
    },
    chasm: { minX: basin.maxX, maxX: basin.maxX + CHASM_WIDTH - 2, minZ: basin.minZ, maxZ: basin.maxZ, waterY: BASIN_Y + 0.4, floorY: BASIN_Y },
    elevator: { x: ELEVATOR.x, z: ELEVATOR.z, radius: ELEVATOR.radius, bottom: LEVEL_Y.subterranean, top: LEVEL_Y.surface },
    deskGrid: { cols: p.cols, rows: p.rows },
  }
}
export type { ManorLayoutData }
