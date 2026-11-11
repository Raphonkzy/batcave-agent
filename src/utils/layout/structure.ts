import { distanceToItem, EPS, footprintOf, footprintsOverlap, rectsOverlap } from './geometry.ts'
import type { BoundingBox, Door, ItemType, LayoutItem, LevelId, PathGrid, Stop, WallSegment, Zone } from './types.ts'
// Walls, doors, floor finishing and walking grids, derived from the zones and items.
export const GRID_RES = 0.5
/** An item serves the floor this far round its footprint when judging empty space. */
export const USE_CLEARANCE = 0.6
/** Fixed thresholds (spec checklist). The floor finishing aims a little lower so they hold with margin. */
export const MAX_EMPTY_SQUARE = 3
export const MAX_UNUSED_FRACTION = 0.3
const FILL_EMPTY_SQUARE = 2.5
const FILL_UNUSED_FRACTION = 0.25
export const DOOR_CLEARANCE = 1
const WALL_THICKNESS = 0.15
/** Lie flat on the floor: no collisions with what stands on them. */
// Flat (floor finishes) or wall-mounted-high (sconces) items: nothing stands on the floor under
// them, so they neither block walking nor collide with furniture.
export const FLAT_TYPES: ReadonlySet<ItemType> = new Set<ItemType>(['rug', 'turntablePad', 'interceptorBay', 'bikeDock', 'vtolPad', 'apcBay', 'subDock', 'serviceLane', 'autoDock', 'sparringMat', 'floorPlate', 'exerciseMat', 'teakDeck', 'runnerRug', 'wallSconce', 'lobbyMedallion', 'roundRug', 'wetFloor'])
/** Can be stood or sat on, so they do not block walking (routes avoid them where they can). */
export const SOFT_TYPES: ReadonlySet<ItemType> = new Set<ItemType>(['chair', 'consoleChair', 'highChair', 'chesterfield', 'readingChair', 'leatherChair', 'armchair', 'tubChair', 'deskChair', 'weightBench', 'treadmill', 'bed', 'sunLounger'])
const isSolid = (item: LayoutItem) => !FLAT_TYPES.has(item.type)
const blocksWalking = (item: LayoutItem) => isSolid(item) && !SOFT_TYPES.has(item.type)

interface Shared { a: Zone; b: Zone; axis: 'x' | 'z'; at: number; from: number; to: number }
/** Edges two zones of one floor have in common. Axis 'z' is a wall at constant x running along z. */
function sharedEdges(zones: Zone[]): Shared[] {
  const out: Shared[] = []
  for (let i = 0; i < zones.length; i += 1) for (let j = i + 1; j < zones.length; j += 1) {
    const a = zones[i].rect
    const b = zones[j].rect
    for (const [axis, at] of [['z', a.maxX === b.minX ? a.maxX : a.minX === b.maxX ? a.minX : NaN], ['x', a.maxZ === b.minZ ? a.maxZ : a.minZ === b.maxZ ? a.minZ : NaN]] as const) {
      if (Number.isNaN(at)) continue
      const from = axis === 'z' ? Math.max(a.minZ, b.minZ) : Math.max(a.minX, b.minX)
      const to = axis === 'z' ? Math.min(a.maxZ, b.maxZ) : Math.min(a.maxX, b.maxX)
      if (to - from > EPS) out.push({ a: zones[i], b: zones[j], axis, at, from, to })
    }
  }
  return out
}
/** Suites only open onto their corridor; every other pair of neighbouring rooms gets a door. */
function doorAllowed(a: Zone, b: Zone): boolean {
  if (a.level === 'surface' && [a.id, b.id].includes('grandLibrary') && [a.id, b.id].includes('grandFoyer')) return false
  const privateRoom = (zone: Zone) => zone.kind === 'suite' || zone.id === 'masterBedroom' || zone.id === 'guestBedroom'
  const suite = privateRoom(a) ? a : privateRoom(b) ? b : undefined
  if (!suite) return true
  const other = suite === a ? b : a
  return other.kind === 'corridor' && other.id.endsWith('Corridor')
}
export function doorClearance(door: Pick<Door, 'axis' | 'at' | 'center' | 'width'>): BoundingBox {
  return door.axis === 'z'
    ? { minX: door.at - DOOR_CLEARANCE, maxX: door.at + DOOR_CLEARANCE, minZ: door.center - door.width / 2, maxZ: door.center + door.width / 2 }
    : { minX: door.center - door.width / 2, maxX: door.center + door.width / 2, minZ: door.at - DOOR_CLEARANCE, maxZ: door.at + DOOR_CLEARANCE }
}
/**
 * Doors and walls of every floor. A door goes where the shared edge has a clear stretch, as near its
 * middle as possible. Two open areas (the hangar and the catwalk) have no wall between them, and
 * the deck's outside is bare rock, so it gets no outer walls.
 */
export function buildWalls(zones: Zone[], items: LayoutItem[]): { doors: Door[]; walls: WallSegment[] } {
  const doors: Door[] = []
  const walls: WallSegment[] = []
  for (const level of ['subterranean', 'surface', 'surfaceUpper'] as LevelId[]) {
    const onLevel = zones.filter((zone) => zone.level === level)
    const solids = items.filter((item) => item.level === level && isSolid(item))
    const shared = sharedEdges(onLevel)
    for (const edge of shared) {
      if ((edge.a.kind === 'open' && edge.b.kind === 'open') || (edge.a.kind === 'outdoor' && edge.b.kind === 'outdoor')) continue
      const length = edge.to - edge.from
      const publicAxis = level === 'surface' && [edge.a.id, edge.b.id].every((id) => ['grandFoyer', 'hearthLounge', 'entranceHall', 'entranceTerrace'].includes(id))
      const width = Math.min(publicAxis ? 2.8 : 1.8, length - 0.2)
      let door: Door | undefined
      if (doorAllowed(edge.a, edge.b) && width >= 1.2) {
        const mid = publicAxis ? 0 : (edge.from + edge.to) / 2
        const reach = (length - width) / 2 - 0.1
        for (let offset = 0; offset <= reach + EPS && !door; offset += 0.25) for (const sign of offset === 0 ? [1] : [1, -1]) {
          const candidate: Door = { level, axis: edge.axis, at: edge.at, center: mid + sign * offset, width, between: [edge.a.id, edge.b.id] }
          const clear = doorClearance(candidate)
          if (!solids.some((item) => rectsOverlap(clear, footprintOf(item)) && footprintsOverlap(item, { x: (clear.minX + clear.maxX) / 2, z: (clear.minZ + clear.maxZ) / 2, w: clear.maxX - clear.minX, d: clear.maxZ - clear.minZ, rotY: 0 }))) { door = candidate; break }
        }
      }
      if (door) doors.push(door)
      // Outdoor zones have no walls of their own; a wall to a room is the room's.
      const height = Math.max(3.2, Math.min(edge.a.height || 3.5, edge.b.height || 3.5))
      const pieces = door ? [[edge.from, door.center - door.width / 2], [door.center + door.width / 2, edge.to]] : [[edge.from, edge.to]]
      const room = edge.a.kind === 'outdoor' ? edge.b : edge.b.kind === 'outdoor' ? edge.a : undefined
      const side = room ? edge.axis === 'x' ? edge.at === room.rect.minZ ? 'north' : 'south' : edge.at === room.rect.minX ? 'west' : 'east' : undefined
      for (const [from, to] of pieces) if (to - from > EPS) walls.push({ level, axis: edge.axis, at: edge.at, from, to, exterior: !!room, ...(side ? { side } : {}), height: room?.height ?? height })
    }
    // Outside walls: the parts of each room's edges no neighbour shares.
    for (const zone of onLevel.filter((item) => item.kind !== 'outdoor' && item.level !== 'subterranean')) {
      const r = zone.rect
      const sides: [WallSegment['side'], 'x' | 'z', number, number, number][] = [['north', 'x', r.minZ, r.minX, r.maxX], ['south', 'x', r.maxZ, r.minX, r.maxX], ['west', 'z', r.minX, r.minZ, r.maxZ], ['east', 'z', r.maxX, r.minZ, r.maxZ]]
      for (const [side, axis, at, from, to] of sides) {
        const covered = shared.filter((edge) => (edge.a === zone || edge.b === zone) && edge.axis === axis && Math.abs(edge.at - at) < EPS).map((edge) => [edge.from, edge.to]).sort((p, q) => p[0] - q[0])
        let cursor = from
        for (const [a, b] of covered) {
          if (a > cursor + EPS) walls.push({ level, axis, at, from: cursor, to: a, exterior: true, side, height: zone.height })
          cursor = Math.max(cursor, b)
        }
        if (to > cursor + EPS) walls.push({ level, axis, at, from: cursor, to, exterior: true, side, height: zone.height })
      }
    }
  }
  return { doors, walls }
}
const wallRect = (wall: WallSegment, pad = WALL_THICKNESS / 2): BoundingBox => wall.axis === 'x'
  ? { minX: wall.from, maxX: wall.to, minZ: wall.at - pad, maxZ: wall.at + pad }
  : { minX: wall.at - pad, maxX: wall.at + pad, minZ: wall.from, maxZ: wall.to }

/** A floor sampled on a regular grid: which cells are floor at all (inside one of its zones). */
export interface FloorGrid { level: LevelId; minX: number; minZ: number; cols: number; rows: number; floor: boolean[]; zones: Zone[] }
export function floorGrid(zones: Zone[], level: LevelId): FloorGrid {
  const own = zones.filter((zone) => zone.level === level)
  const minX = Math.min(...own.map((zone) => zone.rect.minX))
  const minZ = Math.min(...own.map((zone) => zone.rect.minZ))
  const cols = Math.ceil((Math.max(...own.map((zone) => zone.rect.maxX)) - minX) / GRID_RES - EPS)
  const rows = Math.ceil((Math.max(...own.map((zone) => zone.rect.maxZ)) - minZ) / GRID_RES - EPS)
  const floor = new Array<boolean>(cols * rows).fill(false)
  for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) {
    const x = minX + (c + 0.5) * GRID_RES
    const z = minZ + (r + 0.5) * GRID_RES
    floor[r * cols + c] = own.some((zone) => x > zone.rect.minX && x < zone.rect.maxX && z > zone.rect.minZ && z < zone.rect.maxZ)
  }
  return { level, minX, minZ, cols, rows, floor, zones: own }
}
/** Visit the cells whose centre lies within `pad` of a rectangle (or of an item when given). */
function eachCell(grid: Pick<FloorGrid, 'minX' | 'minZ' | 'cols' | 'rows'>, rect: BoundingBox, pad: number, visit: (index: number, x: number, z: number) => void): void {
  const c0 = Math.max(0, Math.floor((rect.minX - pad - grid.minX) / GRID_RES))
  const c1 = Math.min(grid.cols - 1, Math.floor((rect.maxX + pad - grid.minX) / GRID_RES))
  const r0 = Math.max(0, Math.floor((rect.minZ - pad - grid.minZ) / GRID_RES))
  const r1 = Math.min(grid.rows - 1, Math.floor((rect.maxZ + pad - grid.minZ) / GRID_RES))
  for (let r = r0; r <= r1; r += 1) for (let c = c0; c <= c1; c += 1) visit(r * grid.cols + c, grid.minX + (c + 0.5) * GRID_RES, grid.minZ + (r + 0.5) * GRID_RES)
}
/** Which floor cells are in use: near furniture, near a wall, or at the floor's edge (the outer wall). */
export function usedCells(grid: FloorGrid, items: LayoutItem[], walls: WallSegment[], reserved: BoundingBox[] = []): boolean[] {
  // Formal dancing space, the central salon aisle and entrance terraces are deliberately
  // open, not 'unused'. Do not scatter filler rugs/teak over their designed floor finishes.
  const openZones = grid.zones.filter((zone) => zone.level === 'surface' && (zone.kind === 'outdoor' || ['grandFoyer', 'hearthLounge', 'entranceHall'].includes(zone.id)))
  const used = grid.floor.map((isFloor, index) => {
    const x = grid.minX + (index % grid.cols + 0.5) * GRID_RES
    const z = grid.minZ + (Math.floor(index / grid.cols) + 0.5) * GRID_RES
    return !isFloor || openZones.some((zone) => x >= zone.rect.minX && x <= zone.rect.maxX && z >= zone.rect.minZ && z <= zone.rect.maxZ)
  })
  for (const item of items) {
    if (item.level !== grid.level) continue
    eachCell(grid, footprintOf(item), USE_CLEARANCE, (index, x, z) => { if (distanceToItem(item, x, z) <= USE_CLEARANCE) used[index] = true })
  }
  for (const wall of walls) if (wall.level === grid.level) eachCell(grid, wallRect(wall, 0), USE_CLEARANCE, (index, x, z) => {
    const along = wall.axis === 'x' ? x : z
    const across = wall.axis === 'x' ? z : x
    if (along >= wall.from - EPS && along <= wall.to + EPS && Math.abs(across - wall.at) <= USE_CLEARANCE) used[index] = true
  })
  for (const rect of reserved) eachCell(grid, rect, 0, (index, x, z) => { if (x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ) used[index] = true })
  for (let r = 0; r < grid.rows; r += 1) for (let c = 0; c < grid.cols; c += 1) {
    const index = r * grid.cols + c
    if (!grid.floor[index]) continue
    const outside = (cc: number, rr: number) => cc < 0 || rr < 0 || cc >= grid.cols || rr >= grid.rows || !grid.floor[rr * grid.cols + cc]
    if (outside(c - 1, r) || outside(c + 1, r) || outside(c, r - 1) || outside(c, r + 1)) used[index] = true
  }
  return used
}
/** Largest square of free cells, by dynamic programming: its side in cells and its top-left cell. */
export function largestSquare(free: boolean[], cols: number, rows: number): { size: number; col: number; row: number } {
  const best = { size: 0, col: 0, row: 0 }
  let previous = new Array<number>(cols + 1).fill(0)
  for (let r = 0; r < rows; r += 1) {
    const current = new Array<number>(cols + 1).fill(0)
    for (let c = 0; c < cols; c += 1) {
      if (!free[r * cols + c]) continue
      current[c + 1] = Math.min(previous[c], previous[c + 1], current[c]) + 1
      if (current[c + 1] > best.size) { best.size = current[c + 1]; best.col = c - current[c + 1] + 1; best.row = r - current[c + 1] + 1 }
    }
    previous = current
  }
  return best
}

/** Squares kept clear: doors, the ends of the stairs and the elevator, and every stop. */
export function reservedAreas(doors: Door[], stops: Stop[], points: { level: LevelId; x: number; z: number }[]): { level: LevelId; rect: BoundingBox }[] {
  const square = (level: LevelId, x: number, z: number, half: number) => ({ level, rect: { minX: x - half, maxX: x + half, minZ: z - half, maxZ: z + half } })
  return [
    ...doors.map((door) => ({ level: door.level, rect: doorClearance(door) })),
    ...points.map((point) => square(point.level, point.x, point.z, 0.6)),
    ...stops.map((stop) => square(stop.level, stop.x, stop.z, 0.4)),
  ]
}
/** What covers floor that would otherwise stand bare: steel plates on the deck, mats in the gym, teak decking outside, rugs elsewhere. */
export const finishFor = (zone: Zone): ItemType => (zone.level === 'subterranean' ? 'floorPlate' : zone.id === 'gym' ? 'exerciseMat' : zone.kind === 'outdoor' ? 'teakDeck' : 'rug')
/**
 * Finish bare floor tidily. Rooms are furnished on purpose (against walls, or in rows); whatever
 * open floor is left is covered with a flat, square, axis-aligned plate or rug in the middle of
 * the largest bare square, never with loose furniture. Only squares at least 1.5 units across are
 * covered, so aisles stay open.
 */
export function finishBareFloor(grid: FloorGrid, items: LayoutItem[], walls: WallSegment[], reserved: BoundingBox[], add: (type: ItemType, zone: Zone, x: number, z: number, w: number, d: number, h: number) => LayoutItem): void {
  const used = usedCells(grid, items, walls, reserved)
  const floorCount = grid.floor.filter(Boolean).length
  for (let guard = 0; guard < 2000; guard += 1) {
    const free = used.map((value) => !value)
    const square = largestSquare(free, grid.cols, grid.rows)
    const unused = free.filter(Boolean).length / floorCount
    if ((square.size * GRID_RES <= FILL_EMPTY_SQUARE && unused <= FILL_UNUSED_FRACTION) || square.size < 3) break
    const x = grid.minX + (square.col + square.size / 2) * GRID_RES
    const z = grid.minZ + (square.row + square.size / 2) * GRID_RES
    const side = square.size * GRID_RES
    // The zone that holds most of the bare square (the middle may sit exactly on a border between two).
    const squareBox = { minX: x - side / 2, maxX: x + side / 2, minZ: z - side / 2, maxZ: z + side / 2 }
    const overlap = (rect: BoundingBox) => Math.max(0, Math.min(rect.maxX, squareBox.maxX) - Math.max(rect.minX, squareBox.minX)) * Math.max(0, Math.min(rect.maxZ, squareBox.maxZ) - Math.max(rect.minZ, squareBox.minZ))
    const zone = grid.zones.filter((item) => overlap(item.rect) > 0).sort((p, q) => overlap(q.rect) - overlap(p.rect))[0]
    const centre = (square.row + Math.floor(square.size / 2)) * grid.cols + square.col + Math.floor(square.size / 2)
    const skip = () => { for (let r = 0; r < square.size; r += 1) for (let c = 0; c < square.size; c += 1) used[(square.row + r) * grid.cols + square.col + c] = true }
    if (!zone) { skip(); continue }
    // Keep the plate inside its own room, and a little short of the bare square's edges.
    const size = Math.min(side - 0.2, 3.6, zone.rect.maxX - zone.rect.minX - 0.1, zone.rect.maxZ - zone.rect.minZ - 0.1)
    if (size < 1.2) { skip(); continue }
    const cx = Math.min(Math.max(x, zone.rect.minX + size / 2), zone.rect.maxX - size / 2)
    const cz = Math.min(Math.max(z, zone.rect.minZ + size / 2), zone.rect.maxZ - size / 2)
    const item = add(finishFor(zone), zone, cx, cz, size, size, 0.02)
    eachCell(grid, footprintOf(item), USE_CLEARANCE, (index, px, pz) => { if (distanceToItem(item, px, pz) <= USE_CLEARANCE) used[index] = true })
    // Always progress, even when the plate had to be pulled inside its room.
    used[centre] = true
  }
}

/** Walking grid of one floor: off the floor, furniture (a little inflated) and walls are blocked. */
export function walkingGrid(grid: FloorGrid, y: number, items: LayoutItem[], walls: WallSegment[]): PathGrid & { soft: boolean[] } {
  const blocked = grid.floor.map((isFloor) => !isFloor)
  const soft = new Array<boolean>(blocked.length).fill(false)
  for (const item of items) {
    if (item.level !== grid.level || !isSolid(item)) continue
    const hard = blocksWalking(item)
    eachCell(grid, footprintOf(item), 0.1, (index, x, z) => {
      if (distanceToItem(item, x, z) > 0.1) return
      if (hard) blocked[index] = true
      else soft[index] = true
    })
  }
  // A thin wall blocks every cell it touches, so it cannot slip between cell centres.
  for (const wall of walls) {
    if (wall.level !== grid.level) continue
    const rect = wallRect(wall)
    eachCell(grid, rect, GRID_RES / 2, (index, x, z) => {
      if (x + GRID_RES / 2 > rect.minX && x - GRID_RES / 2 < rect.maxX && z + GRID_RES / 2 > rect.minZ && z - GRID_RES / 2 < rect.maxZ) blocked[index] = true
    })
  }
  return { level: grid.level, y, minX: grid.minX, minZ: grid.minZ, cols: grid.cols, rows: grid.rows, blocked, soft }
}
/** Items that physically collide (flat floor coverings excluded), on the same floor. */
export function overlappingItems(items: LayoutItem[]): [LayoutItem, LayoutItem][] {
  const solid = items.filter(isSolid)
  const found: [LayoutItem, LayoutItem][] = []
  for (let a = 0; a < solid.length; a += 1) {
    const box = footprintOf(solid[a])
    for (let b = a + 1; b < solid.length; b += 1) {
      if (solid[a].level !== solid[b].level || !rectsOverlap(box, footprintOf(solid[b]))) continue
      if (footprintsOverlap(solid[a], solid[b])) found.push([solid[a], solid[b]])
    }
  }
  return found
}
export interface VoidReport { level: LevelId; largestEmptySquare: number; unusedFraction: number }
/** Empty-space metrics per floor. Doors, stair and elevator landings and stops count as in use. */
export function voidReport(grids: FloorGrid[], items: LayoutItem[], walls: WallSegment[], reserved: { level: LevelId; rect: BoundingBox }[]): VoidReport[] {
  return grids.map((grid) => {
    const used = usedCells(grid, items, walls, reserved.filter((item) => item.level === grid.level).map((item) => item.rect))
    const free = used.map((value) => !value)
    return { level: grid.level, largestEmptySquare: largestSquare(free, grid.cols, grid.rows).size * GRID_RES, unusedFraction: free.filter(Boolean).length / grid.floor.filter(Boolean).length }
  })
}
