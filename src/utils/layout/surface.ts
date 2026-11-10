import { Builder, EAST, facingTo, NORTH, SOUTH, WEST } from './builder.ts'
import { CORE_HALF, ELEVATOR, FIREPLACE, NORTH_Z, POOL, SUITE, type Plan } from './dimensions.ts'
import { LEVEL_Y, type Zone } from './types.ts'
// The surface manor: purely residential. Foyer with twin stairs, hearth lounge, billiards room,
// dining hall, butler's pantry, gym, two-storey library, one suite per agent and the terrace with
// pool. Every seat faces the table, desk, hearth or pool it belongs to.
const G = 'surface' as const
/** The stairs stand close to the middle, so the elevator fits in the foyer's north-west corner. */
export const STAIR_X = 3.6
export const STAIR = { w: 1.4, minZ: -6.7, maxZ: -1.2 }
export function buildSurface(b: Builder, p: Plan, zones: Zone[], suiteDoorSide: Map<number, 'east' | 'west'>): void {
  const rect = (id: Zone['id']) => zones.find((zone) => zone.id === id)!.rect
  // Foyer: twin staircases up to the landing, the elevator top, a round centre table.
  for (const side of [-1, 1]) b.item('grandStair', 'grandFoyer', G, side * STAIR_X, (STAIR.minZ + STAIR.maxZ) / 2, STAIR.w, STAIR.maxZ - STAIR.minZ, 3.5, SOUTH, { role: side < 0 ? 'west' : 'east' })
  b.item('elevatorShaft', 'grandFoyer', G, ELEVATOR.x, ELEVATOR.z, ELEVATOR.radius * 2 + 0.2, ELEVATOR.radius * 2 + 0.2, 3)
  buildLobby(b, rect('grandFoyer'))
  // Two purple salons flank a clear central axis; the fireplace hugs the west wall.
  const lounge = rect('hearthLounge')
  b.item('fireplace', 'hearthLounge', G, lounge.minX + FIREPLACE.d / 2, lounge.minZ + 2, FIREPLACE.w, FIREPLACE.d, FIREPLACE.h, EAST)
  const modules = 2 // two balanced salons; never fill circulation with duplicated furniture
  for (let index = 0; index < modules; index += 1) {
    // Keep a 2.1-unit central aisle and clear routes beside the wing doors.
    const cx = index % 2 === 0 ? -3 : 3
    const cz = (lounge.minZ + lounge.maxZ) / 2
    b.item('rug', 'hearthLounge', G, cx, cz, 4.4, 4.2, 0.02)
    b.item('coffeeTable', 'hearthLounge', G, cx, cz - 0.2, 1.2, 0.8, 0.42)
    b.item('chesterfield', 'hearthLounge', G, cx, cz + 1.5, 2.6, 0.95, 0.85, NORTH, { role: 'back' })
    for (const dx of [-0.8, 0, 0.8]) b.stop('sofa', 'hearthLounge', G, cx + dx, cz + 1.4, NORTH, { seated: true })
    for (const side of [-1, 1]) {
      b.item('chesterfield', 'hearthLounge', G, cx + side * 1.55, cz, 1.8, 0.8, 0.85, side < 0 ? EAST : WEST, { role: 'side' })
      for (const dz of [-0.45, 0.45]) b.stop('sofa', 'hearthLounge', G, cx + side * 1.55, cz + dz, side < 0 ? EAST : WEST, { seated: true })
    }
  }
  const west = rect('billiardsRoom').minX
  const cxW = (west + -CORE_HALF) / 2
  // Billiards room.
  b.item('billiardsTable', 'billiardsRoom', G, cxW, -4.5, 2.6, 1.4, 0.8)
  b.item('cueRack', 'billiardsRoom', G, west + 0.12, -4.5, 1.6, 0.15, 1.6, EAST)
  for (const side of [-1, 1]) {
    b.item('leatherChair', 'billiardsRoom', G, cxW + side * 1.6, NORTH_Z + 0.8, 0.9, 0.9, 0.9, SOUTH)
    b.stop('club', 'billiardsRoom', G, cxW + side * 1.6, NORTH_Z + 0.8, SOUTH, { seated: true })
    b.stop('billiards', 'billiardsRoom', G, cxW + side * 2, -4.5, side < 0 ? EAST : WEST)
  }
  b.item('radioCabinet', 'billiardsRoom', G, cxW, NORTH_Z + 0.4, 0.8, 0.5, 1.3, SOUTH)
  // Dining hall: the banquet table with N + 2 high-back chairs, a sideboard on the west wall.
  const dining = rect('diningHall')
  const dzc = (dining.minZ + dining.maxZ) / 2
  b.item('banquetTable', 'diningHall', G, cxW, dzc, 1.2, p.dining.length, 0.76)
  const perWest = Math.ceil(p.dining.chairs / 2)
  for (let chair = 0; chair < p.dining.chairs; chair += 1) {
    const side = chair < perWest ? -1 : 1
    const slot = side < 0 ? chair : chair - perWest
    const z = dzc - p.dining.length / 2 + 0.7 + slot * 0.8
    b.item('highChair', 'diningHall', G, cxW + side * 0.95, z, 0.5, 0.5, 1.2, side < 0 ? EAST : WEST)
    b.stop('dining', 'diningHall', G, cxW + side * 0.95, z, side < 0 ? EAST : WEST, { seated: true })
  }
  b.item('sideboard', 'diningHall', G, west + 0.3, dzc, 1.8, 0.5, 0.9, EAST)
  buildPantryLibraryTerrace(b, p, rect, cxW, west)
  buildGym(b, rect, cxW)
  buildGrandBath(b, rect, cxW, west)
  buildSuites(b, zones, suiteDoorSide)
  buildCorridors(b, zones)
  const entrance = rect('entranceHall')
  b.item('runnerRug', 'entranceHall', G, 0, (entrance.minZ + entrance.maxZ) / 2, 2, 2.6, 0.02)
  for (const side of [-1, 1]) {
    b.item('consoleTable', 'entranceHall', G, side * 3.5, entrance.maxZ - 0.5, 1.7, 0.5, 0.85, NORTH)
    b.item('wallSconce', 'entranceHall', G, side * 2.1, entrance.maxZ - 0.1, 0.18, 0.12, 0.4, NORTH)
  }
  b.stop('arrival', 'entranceHall', G, 0, entrance.maxZ - 1.2, NORTH)
  b.stop('arrival', 'entranceTerrace', G, 0, entrance.maxZ + 2, NORTH)
}
/**
 * Dress the suite corridors as classic luxury hallways: a wine-red runner down the centre, brass
 * wall sconces and slim console tables along the longer wall. Nothing blocks the 1.5-unit path.
 */
function buildCorridors(b: Builder, zones: Zone[]): void {
  for (const zone of zones.filter((item) => item.kind === 'corridor' && item.id.endsWith('Corridor'))) {
    const { minX, maxX, minZ, maxZ } = zone.rect
    const runsZ = maxZ - minZ >= maxX - minX
    const length = runsZ ? maxZ - minZ : maxX - minX
    if (length < 2) continue
    const cx = (minX + maxX) / 2
    const cz = (minZ + maxZ) / 2
    const level = zone.level
    // Central runner rug along the corridor's long axis.
    b.item('runnerRug', zone.id, level, cx, cz, runsZ ? Math.min(1.1, maxX - minX - 0.3) : length - 0.4, runsZ ? length - 0.4 : Math.min(1.1, maxZ - minZ - 0.3), 0.02)
    // Brass wall sconces flush to the wall every ~3.5 units. They hug the wall and carry a small
    // footprint, so the corridor stays a clear circulation path to the suites.
    const wallX = maxX - 0.08
    const wallZ = maxZ - 0.08
    for (let along = (runsZ ? minZ : minX) + 1.2; along <= (runsZ ? maxZ : maxX) - 1.0; along += 3.5) {
      if (runsZ) b.item('wallSconce', zone.id, level, wallX, along, 0.12, 0.12, 0.4, WEST)
      else b.item('wallSconce', zone.id, level, along, wallZ, 0.12, 0.12, 0.4, NORTH)
    }
  }
}
/**
 * The hotel lobby: a curved reception desk against a backlit alabaster wall, an inlaid medallion
 * under the chandelier between the twin staircases, two circular conversation clusters (four tub
 * armchairs round a marble table, on a round plum rug) in front of the stairs' feet, a luggage
 * trolley by the wall and marble urns in the corners. The foot of each staircase stays clear.
 */
function buildLobby(b: Builder, foyer: Zone['rect']): void {
  b.item('alabasterWall', 'grandFoyer', G, 0, foyer.minZ + 0.12, 5.6, 0.2, 3.4, SOUTH)
  b.item('receptionDesk', 'grandFoyer', G, 0, foyer.minZ + 1.75, 4, 1.5, 1.1, SOUTH)
  b.item('lobbyMedallion', 'grandFoyer', G, 0, -2.4, 5.2, 5.2, 0.04)
  for (const side of [-1, 1]) {
    const cx = side * 3
    const cz = foyer.maxZ - 1.55
    b.item('roundRug', 'grandFoyer', G, cx, cz, 3, 3, 0.02)
    b.item('loungeTable', 'grandFoyer', G, cx, cz, 0.7, 0.7, 0.45)
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = cx + dx * 0.72
      const z = cz + dz * 0.72
      const facing = facingTo(cx - x, cz - z)
      b.item('tubChair', 'grandFoyer', G, x, z, 0.7, 0.7, 0.85, facing)
      b.stop('lobby', 'grandFoyer', G, x, z, facing, { seated: true })
    }
  }
  b.item('luggageTrolley', 'grandFoyer', G, foyer.minX + 0.5, 0.8, 1.2, 0.6, 1.4, EAST)
  for (const [x, z] of [[foyer.maxX - 0.5, foyer.minZ + 0.6], [foyer.minX + 0.5, foyer.maxZ - 0.5], [foyer.maxX - 0.5, foyer.maxZ - 0.5]]) b.item('marbleUrn', 'grandFoyer', G, x, z, 0.7, 0.7, 1.6)
}
function buildPantryLibraryTerrace(b: Builder, p: Plan, rect: (id: Zone['id']) => Zone['rect'], cxW: number, west: number): void {
  // Butler's pantry: service counter on the south wall, wine rack, tea trolley.
  const pantry = rect('butlerPantry')
  b.item('kitchenCounter', 'butlerPantry', G, cxW, pantry.minZ + 0.4, 3.6, 0.7, 0.95, SOUTH)
  b.item('refrigerator', 'butlerPantry', G, pantry.maxX - 0.65, pantry.minZ + 0.65, 0.9, 0.9, 2.1)
  b.item('kitchenIsland', 'butlerPantry', G, cxW, pantry.minZ + 2.5, 2.1, 0.8, 0.95)
  b.item('pantryCounter', 'butlerPantry', G, cxW, pantry.maxZ - 0.4, 3, 0.7, 0.95, NORTH, { role: 'alfred' })
  b.stop('pantry', 'butlerPantry', G, cxW - 0.6, pantry.maxZ - 1.3, SOUTH, { profile: 'alfred' })
  b.stop('pantryBar', 'butlerPantry', G, cxW + 0.8, pantry.maxZ - 1.3, SOUTH)
  b.item('wineRack', 'butlerPantry', G, west + 0.25, pantry.minZ + 2, 1.2, 0.4, 2, EAST)
  b.item('teaTrolley', 'butlerPantry', G, pantry.maxX - 0.6, pantry.maxZ - 0.5, 0.9, 0.5, 0.9)
  // Grand library: shelves to the ceiling on the north and east walls, a spiral stair to the
  // catwalk, the research desk and two reading chairs.
  const library = rect('grandLibrary')
  const east = library.maxX
  for (let x = library.minX + 1; x + 0.8 <= east - 0.5; x += 1.6) b.item('tallBookshelf', 'grandLibrary', G, x, library.minZ + 0.25, 1.6, 0.45, 5.3, SOUTH)
  for (let z = library.minZ + 1.4; z + 0.8 <= library.maxZ - 0.4; z += 1.6) b.item('tallBookshelf', 'grandLibrary', G, east - 0.25, z, 1.6, 0.45, 5.3, WEST)
  b.item('spiralStair', 'grandLibrary', G, east - 1.6, library.maxZ - 1, 1.8, 1.8, 3)
  b.item('studyDesk', 'grandLibrary', G, library.minX + 2, library.minZ + 2.4, 1.4, 0.7, 0.76, SOUTH, { role: 'tim' })
  b.stop('studyDesk', 'grandLibrary', G, library.minX + 2, library.minZ + 3.15, NORTH, { seated: true, profile: 'tim' })
  b.item('deskChair', 'grandLibrary', G, library.minX + 2, library.minZ + 3.15, 0.5, 0.5, 0.95, NORTH)
  // Reading nook: two wing chairs facing each other across a lamp table.
  const nookX = (library.minX + east) / 2 + 0.6
  const nookZ = library.minZ + 3.2
  b.item('sideTable', 'grandLibrary', G, nookX, nookZ, 0.6, 0.6, 0.6)
  for (const side of [-1, 1]) {
    const facing = side < 0 ? EAST : WEST
    b.item('readingChair', 'grandLibrary', G, nookX + side * 0.85, nookZ, 0.9, 0.9, 1, facing)
    b.stop('reading', 'grandLibrary', G, nookX + side * 0.85, nookZ, facing, { seated: true })
  }
  // Terrace: flagstones, sun loungers facing the infinity pool on the cliff edge.
  const terrace = rect('terracePool')
  b.item('infinityPool', 'terracePool', G, terrace.maxX - 3.2 - POOL.w / 2, terrace.minZ + 4, POOL.w, POOL.d, POOL.depth)
  for (let index = 0; index < 3; index += 1) {
    // The first one keeps clear of the door from the lounge.
    const z = terrace.minZ + (index === 0 ? 1.25 : 4.75)
    const x = terrace.minX + (index === 2 ? 3.25 : 1.2)
    b.item('sunLounger', 'terracePool', G, x, z, 0.7, 1.9, 0.45, EAST)
    // Lying with the head on the backrest (west), feet towards the pool.
    b.stop('lounger', 'terracePool', G, x + 0.8, z, EAST)
  }
  b.stop('poolside', 'terracePool', G, terrace.maxX - 3.2 - POOL.w - 0.6, terrace.minZ + 4, EAST)
  void p
}
/** Gym: treadmills facing the west windows, a dumbbell rack on the south wall, a bench, a heavy bag. */
function buildGym(b: Builder, rect: (id: Zone['id']) => Zone['rect'], cxW: number): void {
  const gym = rect('gym')
  for (const z of [gym.minZ + 1.3, gym.minZ + 2.6]) {
    // The console end is against the wall; the runner faces it.
    b.item('treadmill', 'gym', G, gym.minX + 1.05, z, 0.9, 2, 1.4, EAST)
    b.stop('gym', 'gym', G, gym.minX + 1.25, z, WEST, { y: LEVEL_Y.surface + 0.2 })
  }
  b.item('dumbbellRack', 'gym', G, cxW + 1, gym.maxZ - 0.3, 1.8, 0.5, 1, NORTH)
  b.item('weightBench', 'gym', G, cxW + 1, gym.maxZ - 2.2, 1.1, 1.4, 1.2, SOUTH)
  const bagX = gym.maxX - 0.6
  b.item('punchingBag', 'gym', G, bagX, gym.minZ + 1.2, 0.6, 0.6, 3.2, WEST)
  b.stop('gym', 'gym', G, bagX - 0.8, gym.minZ + 1.2, EAST)
}
/**
 * The Grand Communal Spa: a sunken thermal bath in the centre with marble benches beside it, a long
 * four-basin vanity against the north wall, three private water-closet stalls along the inner wall,
 * and a towel bench on the outer wall. The centre stays open for circulation.
 */
function buildGrandBath(b: Builder, rect: (id: Zone['id']) => Zone['rect'], cxW: number, west: number): void {
  const bath = rect('grandBath')
  const inner = -CORE_HALF // the room's east (inner) wall
  // Vanity with four basins against the north wall; a spa stop in front of it.
  b.item('vanityRow', 'grandBath', G, cxW, bath.minZ + 0.35, 3.2, 0.6, 0.95, SOUTH, { role: 'four' })
  b.stop('spa', 'grandBath', G, cxW, bath.minZ + 1.25, NORTH)
  // Sunken thermal bath towards the west, with a towel bench against the west wall beside it.
  const bathX = (west + cxW) / 2 - 0.2
  b.item('sunkenBath', 'grandBath', G, bathX, bath.minZ + 2.6, 3.0, 2.4, 0.5)
  // Towel/robe bench against the south wall, clear of the sunken bath to its north.
  b.item('bathBench', 'grandBath', G, bathX, bath.maxZ - 0.3, 2.4, 0.5, 0.45, NORTH)
  b.item('showerScreen', 'grandBath', G, west + 0.7, bath.maxZ - 1.5, 1.2, 0.06, 1.9)
  b.item('wetFloor', 'grandBath', G, west + 0.7, bath.maxZ - 1, 1.3, 1.6, 0.02)
  // Three private water-closet stalls along the inner (east) wall, facing west into the room.
  for (let i = 0; i < 3; i += 1) b.item('toiletStall', 'grandBath', G, inner - 0.75, bath.minZ + 1.9 + i * 1.5, 1.4, 1.3, 2.2, WEST)
}
/**
 * One suite per agent: a king bed against the outer wall, a desk, a wardrobe, and an ensuite
 * bathroom in the corner by the door wall (soaking tub, vanity, walk-in glass shower) screened by
 * a half-height marble partition. `at(u)` runs from the outer wall (u 0) to the door wall (u 5).
 */
function buildSuites(b: Builder, zones: Zone[], doorSide: Map<number, 'east' | 'west'>): void {
  const groundRooms = zones.filter((item) => item.level === G && (item.kind === 'suite' || item.id === 'masterBedroom' || item.id === 'guestBedroom'))
  for (const zone of zones.filter((item) => item.kind === 'suite' || item.id === 'masterBedroom' || item.id === 'guestBedroom')) {
    const owner = zone.owner
    const master = zone.level === G && zone === groundRooms[0]
    const doorEast = owner !== undefined && doorSide.get(owner) === 'east'
    const { minX, maxX, minZ, maxZ } = zone.rect
    const at = (u: number) => (doorEast ? minX + u : maxX - u)
    const toDoor = doorEast ? EAST : WEST
    const level = zone.level
    // Bedroom in the north part (its proven layout); a wall-hugging ensuite strip in the south
    // part. No partition crosses the room, so the suite stays one connected, reachable space.
    const bedMaxZ = maxZ - SUITE.ensuite
    const zc = (minZ + bedMaxZ) / 2
    b.item('bed', zone.id, level, at(1.1), zc, master ? 2.4 : 2, 2.2, 0.6, toDoor, { owner, role: master ? 'master' : zone.level === G ? 'guest' : undefined })
    for (const dz of master ? [-1.55, 1.55] : [-1.3, 1.3]) b.item('pedestal', zone.id, level, at(0.25), zc + dz, 0.45, 0.45, 0.55)
    b.item('execDesk', zone.id, level, at(3.4), minZ + 0.35, 1.4, 0.6, 0.76, SOUTH, { owner })
    b.item('armchair', zone.id, level, at(3.4), minZ + 1, 0.6, 0.6, 0.9, NORTH)
    // Wardrobe against the door wall at the bedroom's south end, facing into the room (fromDoor).
    const fromDoor = doorEast ? WEST : EAST
    b.item('wardrobe', zone.id, level, at(4.7), bedMaxZ - 0.95, 1.5, 0.55, 2.2, fromDoor)
    b.item('privacyScreen', zone.id, level, at(3.2), bedMaxZ - 0.1, 1.2, 0.08, 1.8, EAST)
    if (owner !== undefined) {
      b.stop('bed', zone.id, level, at(2), zc, toDoor, { owner })
      b.stop('suiteDesk', zone.id, level, at(3.4), minZ + 1, NORTH, { seated: true, owner })
    }
    // Ensuite along the south wall: a freestanding tub in the outer corner, a vanity, and a walk-in
    // glass shower in the door-wall corner. All hug the outer and south walls; the inner edge stays
    // open so the agent can still cross, and a low marble kerb reads as the bathroom threshold.
    b.item('soakingTub', zone.id, level, at(1.0), maxZ - 0.75, 1.7, 0.9, 0.55, SOUTH)
    b.item('vanityCounter', zone.id, level, at(2.5), maxZ - 0.3, 1.2, 0.5, 0.95, NORTH)
    b.item('showerScreen', zone.id, level, at(4.1), maxZ - 0.9, 0.06, 1.4, 1.9, toDoor)
    if (level === G) {
      b.item('wetFloor', zone.id, level, (minX + maxX) / 2, maxZ - 1, maxX - minX - 0.1, 1.9, 0.02)
      b.item('toilet', zone.id, level, at(3.35), maxZ - 0.4, 0.5, 0.65, 0.7, NORTH)
    }
  }
}
