import { UPPER_EAST_Z, BATH_D, BILLIARDS_D, CATWALK_WIDTH, COMMAND_SOUTH, CORE_HALF, CORRIDOR_W, FORENSICS_SOUTH, FOYER, GYM_D, LANDING_D, LIBRARY, NORTH_Z, PANTRY_D, SERVER_SOUTH, SUITE, TERRACE, VAULT_SOUTH, type Plan } from './dimensions.ts'
import type { BoundingBox, LevelId, NamedZone, Zone, ZoneKind } from './types.ts'
// The rooms of each floor as rectangles. Rooms have walls between them (glass partitions on the
// deck); the hangar, the catwalk and the terrace are open.
const box = (minX: number, maxX: number, minZ: number, maxZ: number): BoundingBox => ({ minX, maxX, minZ, maxZ })
export interface ZonePlan { zones: Zone[]; suiteDoorSide: Map<number, 'east' | 'west'> }
export function buildZones(p: Plan): ZonePlan {
  const zones: Zone[] = []
  const add = (id: Zone['id'], kind: ZoneKind, level: LevelId, rect: BoundingBox, height: number, owner?: number) => zones.push({ id, kind, level, rect, height, ...(owner === undefined ? {} : { owner }) })
  const named = (id: NamedZone, kind: ZoneKind, level: LevelId, rect: BoundingBox, height: number) => add(id, kind, level, rect, height)
  const cw = p.commandW / 2
  const h = p.half
  // Subterranean deck, as walled rooms behind glass partitions: the command center against the
  // north wall with the operations room south of it; the suit vault and the armory on the west;
  // the server room, the forensics lab and the training room on the east; the open hangar across
  // the south and a catwalk over the basin beyond the east wall.
  named('commandAmphitheater', 'room', 'subterranean', box(-cw, cw, NORTH_Z, COMMAND_SOUTH), 4)
  named('operationsRoom', 'room', 'subterranean', box(-cw, cw, COMMAND_SOUTH, p.gridEnd), 4)
  named('suitVault', 'room', 'subterranean', box(-h, -cw, NORTH_Z, VAULT_SOUTH), 4)
  named('armory', 'room', 'subterranean', box(-h, -cw, VAULT_SOUTH, p.gridEnd), 4)
  named('serverBastion', 'room', 'subterranean', box(cw, h, NORTH_Z, SERVER_SOUTH), 4)
  named('forensicsLab', 'room', 'subterranean', box(cw, h, SERVER_SOUTH, FORENSICS_SOUTH), 4)
  named('trainingRoom', 'room', 'subterranean', box(cw, h, FORENSICS_SOUTH, p.gridEnd), 4)
  named('hangarBay', 'open', 'subterranean', box(-h, h, p.gridEnd, p.southZ), 4)
  named('basinCatwalk', 'open', 'subterranean', box(h, h + CATWALK_WIDTH, Math.min(p.gridEnd, p.terraceZ), p.southZ), 4)
  // Surface manor, ground floor.
  const ww = p.ww
  const west = -CORE_HALF - ww
  const east = CORE_HALF + ww
  named('grandFoyer', 'room', 'surface', box(-CORE_HALF, CORE_HALF, NORTH_Z, NORTH_Z + FOYER.d), 7.5)
  named('hearthLounge', 'room', 'surface', box(-CORE_HALF, CORE_HALF, NORTH_Z + FOYER.d, p.terraceZ - 3), 3.5)
  named('entranceHall', 'room', 'surface', box(-CORE_HALF, CORE_HALF, p.terraceZ - 3, p.terraceZ), 3.5)
  named('entranceTerrace', 'outdoor', 'surface', box(-CORE_HALF, CORE_HALF, p.terraceZ, p.terraceZ + TERRACE.d), 0)
  const diningZ = NORTH_Z + BILLIARDS_D
  named('billiardsRoom', 'room', 'surface', box(west, -CORE_HALF, NORTH_Z, diningZ), 3.5)
  named('diningHall', 'room', 'surface', box(west, -CORE_HALF, diningZ, diningZ + p.dining.depth), 3.5)
  named('butlerPantry', 'room', 'surface', box(west, -CORE_HALF, diningZ + p.dining.depth, diningZ + p.dining.depth + PANTRY_D), 3.5)
  const gymZ = diningZ + p.dining.depth + PANTRY_D
  named('gym', 'room', 'surface', box(west, -CORE_HALF, gymZ, gymZ + GYM_D), 3.5)
  named('grandBath', 'room', 'surface', box(west, -CORE_HALF, gymZ + GYM_D, gymZ + GYM_D + BATH_D), 3.5)
  named('grandLibrary', 'room', 'surface', box(CORE_HALF, east, NORTH_Z, NORTH_Z + LIBRARY.d), LIBRARY.height)
  // A private garden court, separated from the entrance axis and connected by an L-shaped promenade.
  named('terracePool', 'outdoor', 'surface', box(west - 20, west - 2, p.terraceZ + 10, p.terraceZ + 18), 0)
  named('poolWalkway', 'outdoor', 'surface', box(west - 4.4, -CORE_HALF, p.terraceZ + 1.8, p.terraceZ + 4.2), 0)
  named('poolGardenLink', 'outdoor', 'surface', box(west - 4.4, west - 2, p.terraceZ + 4.2, p.terraceZ + 10), 0)
  const suiteDoorSide = new Map<number, 'east' | 'west'>()
  let suite = 0
  // A wing of suites along a corridor: one column beside it, or one on each side.
  const wing = (level: LevelId, corridorId: NamedZone, inner: number, outward: 1 | -1, z0: number, count: number) => {
    if (count === 0) return
    const rows = Math.ceil(count / p.sc)
    const corridorMin = p.sc === 1 ? inner : inner + outward * SUITE.w
    const corridor = [corridorMin, corridorMin + outward * CORRIDOR_W].sort((a, b) => a - b)
    named(corridorId, 'corridor', level, box(corridor[0], corridor[1], z0, z0 + rows * SUITE.d), 3.2)
    const columns = p.sc === 1 ? [corridorMin + outward * CORRIDOR_W] : [inner, corridorMin + outward * CORRIDOR_W]
    for (let index = 0; index < count; index += 1) {
      const row = Math.floor(index / p.sc)
      const start = columns[index % p.sc]
      const xs = [start, start + outward * SUITE.w].sort((a, b) => a - b)
      const doorEast = xs[1] <= corridor[0] + 1e-6
      add(`suite-${suite}`, 'suite', level, box(xs[0], xs[1], z0 + row * SUITE.d, z0 + (row + 1) * SUITE.d), 3.2, suite)
      suiteDoorSide.set(suite, doorEast ? 'east' : 'west')
      suite += 1
    }
  }
  // Upper floor: a landing over the back of the foyer, then the west wing of suites.
  named('upperLanding', 'corridor', 'surfaceUpper', box(west, CORE_HALF, NORTH_Z, NORTH_Z + LANDING_D), 3.2)
  wing('surfaceUpper', 'upperCorridor', -CORE_HALF, -1, NORTH_Z + LANDING_D, p.split.upper)
  wing('surface', 'eastCorridor', CORE_HALF, 1, NORTH_Z + LIBRARY.d, p.split.ground)
  // Always provide a master and a guest room, even with a one-agent roster. Assigned
  // suites retain their owners; supplementary rooms are unassigned accommodation.
  const corridorX = CORE_HALF + (p.sc === 1 ? 0 : SUITE.w)
  const roomStart = CORE_HALF + CORRIDOR_W
  const roomEnd = Math.min(east, roomStart + SUITE.w)
  for (let index = p.split.ground; index < 2; index += 1) {
    named(index === 0 ? 'masterBedroom' : 'guestBedroom', 'room', 'surface', box(roomStart, roomEnd, NORTH_Z + LIBRARY.d + index * SUITE.d, NORTH_Z + LIBRARY.d + (index + 1) * SUITE.d), 3.2)
  }
  const privateEnd = NORTH_Z + LIBRARY.d + Math.max(2, Math.ceil(p.split.ground / p.sc)) * SUITE.d
  const corridor = zones.find((zone) => zone.id === 'eastCorridor')
  if (corridor) corridor.rect.maxZ = privateEnd + 1.8
  else named('eastCorridor', 'corridor', 'surface', box(corridorX, corridorX + CORRIDOR_W, NORTH_Z + LIBRARY.d, privateEnd + 1.8), 3.2)
  // A cross-hall reaches the lounge without routing through a bedroom or the library.
  if (corridorX > CORE_HALF) named('privateLink', 'corridor', 'surface', box(CORE_HALF, corridorX, privateEnd, privateEnd + 1.8), 3.2)
  // Upper east wing: a gallery down the east side of the foyer, a link south of the library, then
  // the suites above the ground-floor ones.
  if (p.split.upperEast > 0) {
    const linkEnd = p.sc === 1 ? CORE_HALF + CORRIDOR_W : CORE_HALF + SUITE.w + CORRIDOR_W
    named('upperGallery', 'corridor', 'surfaceUpper', box(CORE_HALF - CORRIDOR_W, CORE_HALF, NORTH_Z + LANDING_D, NORTH_Z + LIBRARY.d), 3.2)
    named('upperEastLink', 'corridor', 'surfaceUpper', box(CORE_HALF - CORRIDOR_W, linkEnd, NORTH_Z + LIBRARY.d, UPPER_EAST_Z), 3.2)
    wing('surfaceUpper', 'upperEastCorridor', CORE_HALF, 1, UPPER_EAST_Z, p.split.upperEast)
  }
  return { zones, suiteDoorSide }
}
