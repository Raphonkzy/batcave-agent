import { Builder, EAST, facingTo, NORTH, SOUTH, WEST } from './builder.ts'
import { APC_BAY, ARC_HEIGHT, ARC_PANELS, ARC_RADIUS, ARC_SPAN, BIKE_DOCK, CATWALK_WIDTH, CONSOLE_RADIUS, CONSOLE_SEAT_RADIUS, DESK_D, DESK_GRID_Z, DESK_PITCH_X, DESK_PITCH_Z, DESK_W, ELEVATOR, FORENSICS_SLAB, GEAR_BENCH, INTERCEPTOR_BAY, NORTH_Z, POD, SERVER_BANK, SPARRING_MAT, SUB_DOCK, SUIT_PODS, TURNTABLE_DIAMETER, VTOL_PAD, WAR_TABLE, WEAPON_RACK, type Plan } from './dimensions.ts'
import type { BoundingBox, NamedZone, Zone } from './types.ts'
// The subterranean command deck: purely operational, one walled room per job. Every piece stands
// against a wall facing into its room, or in a straight row down the room's middle.
const L = 'subterranean' as const
type Rect = (id: NamedZone) => BoundingBox
/** Centres along a line, `pitch` apart, starting at `from` and ending no later than `to`. */
const along = (from: number, to: number, pitch: number) => {
  const out: number[] = []
  for (let at = from; at <= to + 1e-9; at += pitch) out.push(at)
  return out
}
export function buildSubterranean(b: Builder, p: Plan, zones: Zone[]): void {
  const rect: Rect = (id) => zones.find((zone) => zone.id === id)!.rect
  buildCommand(b, rect)
  buildOperations(b, p)
  buildVaultAndArmory(b, rect)
  buildServersForensicsTraining(b, rect)
  buildHangar(b, p)
  buildPatrol(b, p, zones, rect)
}
function buildCommand(b: Builder, rect: Rect): void {
  const { x: tx, z: tz, radius } = WAR_TABLE
  const room = rect('commandAmphitheater')
  // Display wall: panels on an arc round the war table, its middle against the north wall.
  for (let index = 0; index < ARC_PANELS; index += 1) {
    const angle = -Math.PI / 2 - ARC_SPAN / 2 + ((index + 0.5) * ARC_SPAN) / ARC_PANELS
    const x = tx + ARC_RADIUS * Math.cos(angle)
    const z = tz + ARC_RADIUS * Math.sin(angle)
    b.item('holoPanel', 'commandAmphitheater', L, x, z, 2 * (ARC_RADIUS - 0.15) * Math.sin(ARC_SPAN / ARC_PANELS / 2) - 0.02, 0.3, ARC_HEIGHT, facingTo(tx - x, tz - z), { role: String(index) })
  }
  // The curved console in front of it; operators sit on the inner side facing the wall. The
  // middle segment is the lead developer's multi-monitor rig.
  const segments = 7
  const span = (120 * Math.PI) / 180
  for (let index = 0; index < segments; index += 1) {
    const angle = -Math.PI / 2 - span / 2 + ((index + 0.5) * span) / segments
    const cx = Math.cos(angle)
    const cz = Math.sin(angle)
    const rig = index === Math.floor(segments / 2)
    b.item('consoleArc', 'commandAmphitheater', L, tx + CONSOLE_RADIUS * cx, tz + CONSOLE_RADIUS * cz, 2 * CONSOLE_RADIUS * Math.sin(span / segments / 2) - 0.1, 0.7, 0.9, facingTo(-cx, -cz), rig ? { role: 'barbara' } : {})
    const sx = tx + CONSOLE_SEAT_RADIUS * cx
    const sz = tz + CONSOLE_SEAT_RADIUS * cz
    b.item('consoleChair', 'commandAmphitheater', L, sx, sz, 0.5, 0.5, 0.5, facingTo(cx, cz))
    b.stop(rig ? 'devRig' : 'console', 'commandAmphitheater', L, sx, sz, facingTo(cx, cz), { seated: true, ...(rig ? { profile: 'barbara' } : {}) })
  }
  // The octagonal war table, with standing places round it for briefings.
  b.item('warTable', 'commandAmphitheater', L, tx, tz, radius * 2, radius * 2, WAR_TABLE.height, 0)
  for (let index = 0; index < 8; index += 1) {
    const angle = Math.PI / 8 + (index * Math.PI) / 4
    const x = tx + (radius + 0.55) * Math.cos(angle)
    const z = tz + (radius + 0.55) * Math.sin(angle)
    b.stop('warRing', 'commandAmphitheater', L, x, z, facingTo(tx - x, tz - z))
  }
  b.stop('warCommand', 'commandAmphitheater', L, tx, tz + radius + 0.55, NORTH, { profile: 'bruce' })
  b.stop('warSync', 'commandAmphitheater', L, tx + radius + 0.55, tz, WEST, { profile: 'default' })
  // The glass elevator in the north-west corner behind the end of the display wall, and two
  // diagnostic racks against the north wall in the opposite corner.
  b.item('elevatorShaft', 'commandAmphitheater', L, ELEVATOR.x, ELEVATOR.z, ELEVATOR.radius * 2 + 0.1, ELEVATOR.radius * 2 + 0.1, 4)
  for (const x of [-ELEVATOR.x - 0.5, -ELEVATOR.x + 0.5]) b.item('diagnosticRack', 'commandAmphitheater', L, x, room.minZ + 0.4, 0.9, 0.7, 2, SOUTH)
}
/** One desk per agent in straight rows, all facing the glass wall and the command center. */
function buildOperations(b: Builder, p: Plan): void {
  for (let index = 0; index < p.n; index += 1) {
    const x = -p.gridW / 2 + DESK_PITCH_X / 2 + (index % p.cols) * DESK_PITCH_X
    const zc = DESK_GRID_Z + Math.floor(index / p.cols) * DESK_PITCH_Z + DESK_PITCH_Z / 2
    b.item('desk', 'operationsRoom', L, x, zc - 0.3, DESK_W, DESK_D, 0.75, SOUTH, { owner: index })
    b.item('chair', 'operationsRoom', L, x, zc + 0.65, 0.5, 0.5, 0.5, NORTH)
    b.stop('desk', 'operationsRoom', L, x, zc + 0.65, NORTH, { seated: true, owner: index })
  }
}
/** Middle of the free band between two lines of furniture (or walls), for a central row. */
const middle = (from: number, to: number) => (from + to) / 2
function buildVaultAndArmory(b: Builder, rect: Rect): void {
  const vault = rect('suitVault')
  // Exactly five suit pods on the west rock wall, two units apart, facing into the vault.
  SUIT_PODS.forEach((profile, index) => {
    b.item('suitPod', 'suitVault', L, vault.minX + POD.wallOffset, NORTH_Z + 1.5 + index * POD.spacing, POD.baseRadius * 2, POD.baseRadius * 2, POD.baseHeight + POD.glassHeight + POD.capHeight, EAST, { role: profile })
  })
  // The steward's utility sub-station against the north wall.
  const utilityX = (vault.minX + vault.maxX) / 2 + 1
  b.item('utilityConsole', 'suitVault', L, utilityX, vault.minZ + 0.3, 1.6, 0.6, 1.2, SOUTH, { role: 'alfred' })
  b.stop('utility', 'suitVault', L, utilityX, vault.minZ + 1.2, NORTH, { profile: 'alfred' })
  // A long maintenance bench down the middle, facing the pods.
  const podFront = vault.minX + POD.wallOffset + POD.baseRadius + 0.6
  const benchX = middle(podFront, vault.maxX - 0.6)
  b.item('suitBench', 'suitVault', L, benchX, -2, 1, 6.8, 0.9, 0)
  // Armory: weapon racks along the west rock wall, gear benches in a row down the middle.
  const armory = rect('armory')
  for (const z of along(armory.minZ + 0.2 + WEAPON_RACK.w / 2, armory.maxZ - 0.2 - WEAPON_RACK.w / 2, WEAPON_RACK.pitch)) {
    b.item('weaponRack', 'armory', L, armory.minX + WEAPON_RACK.d / 2, z, WEAPON_RACK.w, WEAPON_RACK.d, WEAPON_RACK.h, EAST)
  }
  const gearX = middle(armory.minX + WEAPON_RACK.d + 0.6, armory.maxX - 0.6)
  // Doors open in the middle of the north and south walls, so the row keeps 1 unit clear of both.
  for (const z of along(armory.minZ + 1.1 + GEAR_BENCH.d / 2, armory.maxZ - 1 - GEAR_BENCH.d / 2, GEAR_BENCH.pitch)) {
    b.item('gearBench', 'armory', L, gearX, z, GEAR_BENCH.w, GEAR_BENCH.d, GEAR_BENCH.h, 0)
  }
}
function buildServersForensicsTraining(b: Builder, rect: Rect): void {
  // Server room: three parallel banks along the east wall, a terminal at their south end.
  const servers = rect('serverBastion')
  for (let bank = 0; bank < SERVER_BANK.count; bank += 1) {
    const x = servers.maxX - 0.6 - bank * (SERVER_BANK.depth + SERVER_BANK.aisle)
    b.item('serverBank', 'serverBastion', L, x, NORTH_Z + 0.5 + SERVER_BANK.length / 2, SERVER_BANK.length, SERVER_BANK.depth, SERVER_BANK.height, WEST)
  }
  const terminalX = servers.maxX - 0.6 - (SERVER_BANK.depth + SERVER_BANK.aisle)
  b.item('serverTerminal', 'serverBastion', L, terminalX, -3.0, 1.2, 0.6, 1.1, SOUTH, { role: 'jason' })
  b.stop('serverTerminal', 'serverBastion', L, terminalX, -2.25, NORTH, { profile: 'jason' })
  // Forensics lab: evidence lockers along the east wall, the diagnostic slab in the middle.
  const lab = rect('forensicsLab')
  for (const z of along(lab.minZ + 0.9, lab.maxZ - 0.75, 0.9)) b.item('armoryLocker', 'forensicsLab', L, lab.maxX - 0.3, z, 0.7, 0.6, 2, WEST)
  const slabX = middle(lab.minX + 0.6, lab.maxX - 1.8)
  const slabZ = lab.minZ + 2.4
  b.item('forensicsSlab', 'forensicsLab', L, slabX, slabZ, FORENSICS_SLAB.w, FORENSICS_SLAB.d, 0.95, SOUTH, { role: 'tim' })
  b.stop('forensics', 'forensicsLab', L, slabX, slabZ + 1.35, NORTH, { profile: 'tim' })
  // Training room: heavy bags along the east wall, sparring mats in a row down the middle.
  const gym = rect('trainingRoom')
  for (const z of along(gym.minZ + 1, gym.maxZ - 0.8, 1.8)) b.item('punchingBag', 'trainingRoom', L, gym.maxX - 0.6, z, 0.6, 0.6, 3.2, WEST)
  const matX = middle(gym.minX + 0.6, gym.maxX - 1.5)
  for (const z of along(gym.minZ + 0.6 + SPARRING_MAT / 2, gym.maxZ - 0.6 - SPARRING_MAT / 2, SPARRING_MAT + 0.6)) {
    b.item('sparringMat', 'trainingRoom', L, matX, z, SPARRING_MAT, SPARRING_MAT, 0.06, 0)
    b.stop('sparring', 'trainingRoom', L, matX, z, NORTH, { y: 0.06 })
  }
}
/**
 * The hangar: two rows of vehicles with a servicing aisle between them, every pad under a vehicle.
 * Front row (north): the turntable jet, the assault VTOL, the armoured interceptor, the automaton's
 * dock. Back row (south): the combat APC, the four-bike dock with its charging posts, and the
 * workshop (two lifts, a workbench, diagnostic benches, tool chests). The wet dock with the recon
 * submersible stands on the catwalk beside the back row. Everything is placed from the bay's own
 * edges, so it scales with the width of the deck.
 */
function buildHangar(b: Builder, p: Plan): void {
  const h = p.half
  const e = -h
  const z0 = p.gridEnd
  const row1 = z0 + 5.4
  // The back row stands against the hangar's south wall (the rock), whatever the bay's depth.
  const backWall = p.southZ
  const row2 = backWall - 2.7
  // Each row is spread over the full width with equal gaps, so no wide strip is left bare.
  const spread = (widths: number[]) => {
    const gap = Math.max(1, (2 * h - widths.reduce((sum, width) => sum + width, 0)) / (widths.length + 1))
    let cursor = e + gap
    return widths.map((width) => { const centre = cursor + width / 2; cursor += width + gap; return centre })
  }
  // Front row, west to east: the turntable jet, the assault VTOL, the interceptor, the automaton's dock.
  const [padX, vtolX, bayX, dockX] = spread([TURNTABLE_DIAMETER, VTOL_PAD.w, INTERCEPTOR_BAY.w, 2.2])
  b.item('turntablePad', 'hangarBay', L, padX, row1, TURNTABLE_DIAMETER, TURNTABLE_DIAMETER, 0.12)
  b.item('tacticalJet', 'hangarBay', L, padX, row1, 7.2, 7.2, 2.2, SOUTH, { y: 0.12 })
  b.item('vtolPad', 'hangarBay', L, vtolX, row1, VTOL_PAD.w, VTOL_PAD.d, 0.05)
  b.item('assaultVtol', 'hangarBay', L, vtolX, row1, 7.4, 6.4, 3.0, SOUTH, { y: 0.05 })
  b.item('interceptorBay', 'hangarBay', L, bayX, row1, INTERCEPTOR_BAY.w, INTERCEPTOR_BAY.d, 0.05)
  b.item('armoredInterceptor', 'hangarBay', L, bayX, row1, 2.6, 5.2, 1.6, SOUTH, { y: 0.05 })
  b.item('autoDock', 'hangarBay', L, dockX, row1, 2.2, 2.2, 0.15)
  b.stop('sentry', 'hangarBay', L, dockX, row1, SOUTH, { profile: 'default', y: 0.15 })
  // The servicing aisle between the rows is a marked lane: walkable, and kept clear.
  // It fills whatever depth the bay has between the front row's south edge and the back row's north edge.
  const laneFrom = z0 + 10.0
  const laneTo = row2 - 2.5
  b.item('serviceLane', 'hangarBay', L, 0, (laneFrom + laneTo) / 2, 2 * h - 2, laneTo - laneFrom, 0.02)
  // Back row, west to east: the APC (lying east-west, nose east), the bike dock, the workshop.
  const stripW = 2.4 + 0.3 + 2 + 0.3 + 2 + 0.5 + 3.8
  const [apcX, bikesX, shopX] = spread([APC_BAY.w, BIKE_DOCK.w, stripW])
  const start = shopX - stripW / 2
  b.item('apcBay', 'hangarBay', L, apcX, row2, APC_BAY.w, APC_BAY.d, 0.05)
  b.item('combatApc', 'hangarBay', L, apcX, row2, 3.8, 7.6, 2.9, EAST, { y: 0.05 })
  b.item('bikeDock', 'hangarBay', L, bikesX, row2, BIKE_DOCK.w, BIKE_DOCK.d, BIKE_DOCK.h)
  for (const dx of [-1.65, -0.55, 0.55, 1.65]) b.item('pursuitBike', 'hangarBay', L, bikesX + dx, row2 - 0.1, 0.6, 2.1, 1.1, NORTH, { y: BIKE_DOCK.h })
  // Diagnostic racks on the back wall, either side of the bike dock's charging posts.
  for (const dx of [-1.4, 1.4]) b.item('diagnosticRack', 'hangarBay', L, bikesX + dx, backWall - 0.4, 0.9, 0.7, 2, NORTH)
  // Workshop: two lifts above a strip of benches along the back wall.
  for (const [index, lx] of [start + 1.7, start + 1.7 + 4.2].entries()) b.item('hydraulicLift', 'hangarBay', L, lx, row2 - 1.2, 3.4, 2.4, 2.4, SOUTH, { role: String(index) })
  let x = start
  const bench = (type: 'workbench' | 'diagBench', width: number, depth: number, height: number) => {
    const item = b.item(type, 'hangarBay', L, x + width / 2, backWall - depth / 2 - 0.05, width, depth, height, NORTH, type === 'workbench' ? { role: 'jason' } : {})
    x += width + 0.3
    return item
  }
  const work = bench('workbench', 2.4, 0.9, 0.95)
  b.stop('workbench', 'hangarBay', L, work.x, work.z - 0.85, SOUTH, { profile: 'jason' })
  bench('diagBench', 2, 0.8, 1.6)
  bench('diagBench', 2, 0.8, 1.6)
  x += 0.2
  for (let i = 0; i < 3; i += 1) { b.item('toolChest', 'hangarBay', L, x + 0.55, backWall - 0.4, 1.1, 0.7, 1.1, NORTH); x += 1.3 }
  // The wet dock over the basin: steel grating, with the recon submersible in its cradle.
  const wetX = h + CATWALK_WIDTH / 2
  b.item('subDock', 'basinCatwalk', L, wetX, row2, SUB_DOCK.w, SUB_DOCK.d, 0.06)
  b.item('submersiblePod', 'basinCatwalk', L, wetX, row2, 2.4, 4.8, 1.7, SOUTH, { y: 0.06 })
  // Catwalk console over the basin, looking back across the hangar.
  b.item('catwalkConsole', 'basinCatwalk', L, h + 0.3, row1, 1.2, 0.5, 1.1, EAST, { role: 'dick' })
  b.stop('catwalk', 'basinCatwalk', L, h + 1.2, row1, WEST, { profile: 'dick' })
}
/** The automaton's round: vault, command center, armory, training room, hangar. */
function buildPatrol(b: Builder, p: Plan, zones: Zone[], rect: Rect): void {
  const armory = rect('armory')
  const command = rect('commandAmphitheater')
  const mat = b.stops.find((stop) => stop.kind === 'sparring')!
  const bench = b.items.find((item) => item.type === 'suitBench')!
  const gear = b.items.find((item) => item.type === 'gearBench')!
  const dock = b.stops.find((stop) => stop.kind === 'sentry')!
  const aisleZ = p.gridEnd + 10.85
  const pad = b.items.find((item) => item.type === 'turntablePad')!
  const points: [number, number][] = [
    [bench.x + 1.3, 0.5],
    [command.maxX - 1.5, command.maxZ - 0.9],
    [middle(gear.x + gear.w / 2, armory.maxX), gear.z],
    [mat.x, mat.z],
    [dock.x - 1, aisleZ],
    [pad.x, aisleZ],
  ]
  points.forEach(([x, z], index) => {
    const zone = zones.find((item) => item.level === L && x > item.rect.minX && x < item.rect.maxX && z > item.rect.minZ && z < item.rect.maxZ)!
    b.stop('patrol', zone.id, L, x, z, index * 1.3, { profile: 'default' })
  })
}
