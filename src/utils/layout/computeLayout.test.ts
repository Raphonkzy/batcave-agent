import { describe, expect, it } from 'vitest'
import { computeLayout, LEVELS } from './computeLayout.ts'
import { ARC_PANELS, ARC_RADIUS, deskGrid, NORTH_Z, POD, SUIT_PODS, WAR_TABLE } from './dimensions.ts'
import { area, footprintOf } from './geometry.ts'
import { partsFor } from '../../scenes/manor/batches.ts'
import { FLAT_TYPES, floorGrid, SOFT_TYPES, MAX_EMPTY_SQUARE, MAX_UNUSED_FRACTION, overlappingItems, reservedAreas, voidReport } from './structure.ts'
import { unreachableStops } from './navigation.ts'
import type { ItemType, LayoutItem, ManorLayoutData } from './types.ts'

const COUNTS = [1, 2, 6, 12, 24, 40]
const of = (layout: ManorLayoutData, type: string) => layout.items.filter((item) => item.type === type)
const report = (layout: ManorLayoutData) => {
  const points = layout.paths.links.flatMap((link) => [link.a, link.b])
  return voidReport(LEVELS.map((level) => floorGrid(layout.zoneList, level)), layout.items, layout.walls, reservedAreas(layout.doors, layout.paths.stops, points))
}

describe('computeLayout: the two levels', () => {
  it('is pure and treats 0 or nonsense as one agent', () => {
    expect(JSON.stringify(computeLayout(12))).toBe(JSON.stringify(computeLayout(12)))
    expect(computeLayout(0).agentCount).toBe(1)
    expect(computeLayout(Number.NaN).agentCount).toBe(1)
  })
  it.each(COUNTS)('N=%i: the deck is at y 0 (basin -2), the manor at y 11 with its upper floor at 14.5', (n) => {
    const layout = computeLayout(n)
    expect(layout.levels.subterranean.y).toBe(0)
    expect(layout.levels.transition).toEqual({ yStart: 4, yEnd: 11 })
    expect(layout.levels.surface.y).toBe(11)
    expect(layout.chasm.floorY).toBe(-2)
    expect(layout.bounds.height).toBe(21)
    expect(layout.elevator).toMatchObject({ bottom: 0, top: 11 })
    const deck = layout.items.filter((item) => item.level === 'subterranean')
    const manor = layout.items.filter((item) => item.level !== 'subterranean')
    // The deck is purely operational; the manor purely residential.
    expect(deck.some((item) => ['bed', 'chesterfield', 'banquetTable', 'billiardsTable', 'tallBookshelf'].includes(item.type))).toBe(false)
    expect(manor.some((item) => ['desk', 'serverBank', 'suitPod', 'warTable', 'tacticalJet', 'holoPanel'].includes(item.type))).toBe(false)
    expect(manor.every((item) => item.y >= 11)).toBe(true)
  })
})

describe('computeLayout: the subterranean deck (5.1 A)', () => {
  it.each(COUNTS)('N=%i: desks follow the column formula, one 2.6 x 1.2 desk per agent', (n) => {
    const layout = computeLayout(n)
    const desks = of(layout, 'desk')
    expect(desks).toHaveLength(n)
    expect(desks.every((desk) => desk.w === 2.6 && desk.d === 1.2)).toBe(true)
    const { cols, rows } = deskGrid(n)
    expect(layout.deskGrid).toEqual({ cols, rows })
    expect(cols).toBe(Math.max(1, Math.min(6, n, Math.ceil(Math.sqrt(1.5 * n)))))
    expect(new Set(desks.map((desk) => desk.x.toFixed(2))).size).toBe(Math.min(n, cols))
  })
  it('puts the octagonal war table at (0, -1.1) with radius 2.2 and height 0.85, and the display wall on a 6.5-unit, 100 degree arc whose middle stands against the north wall', () => {
    const layout = computeLayout(6)
    const [table] = of(layout, 'warTable')
    expect([table.x, table.z, table.w / 2, table.h]).toEqual([WAR_TABLE.x, WAR_TABLE.z, 2.2, 0.85])
    const panels = of(layout, 'holoPanel')
    expect(panels).toHaveLength(ARC_PANELS)
    for (const panel of panels) expect(Math.hypot(panel.x - WAR_TABLE.x, panel.z - WAR_TABLE.z)).toBeCloseTo(ARC_RADIUS, 6)
    const angles = panels.map((panel) => Math.atan2(panel.z - WAR_TABLE.z, panel.x)).sort((a, b) => a - b)
    const step = angles[1] - angles[0]
    expect(((angles.at(-1)! - angles[0] + step) * 180) / Math.PI).toBeCloseTo(100, 6)
    expect(panels.every((panel) => panel.h === 2.8)).toBe(true)
    // The middle panel's back is within half a unit of the north wall.
    const middle = panels[Math.floor(ARC_PANELS / 2)]
    expect(middle.z - middle.d / 2 - NORTH_Z).toBeLessThan(0.5)
  })
  it.each(COUNTS)('N=%i: walled rooms for command, operations, vault, armory, servers, forensics and training; the hangar stays open', (n) => {
    const layout = computeLayout(n)
    const deck = layout.zoneList.filter((zone) => zone.level === 'subterranean')
    expect(deck.map((zone) => zone.id).sort()).toEqual(['armory', 'basinCatwalk', 'commandAmphitheater', 'forensicsLab', 'hangarBay', 'operationsRoom', 'serverBastion', 'suitVault', 'trainingRoom'])
    expect(of(layout, 'desk').every((desk) => desk.zone === 'operationsRoom')).toBe(true)
    expect(of(layout, 'weaponRack').length).toBeGreaterThanOrEqual(2)
    expect(of(layout, 'weaponRack').every((rack) => rack.zone === 'armory')).toBe(true)
    expect(of(layout, 'sparringMat').length).toBeGreaterThanOrEqual(1)
    expect(of(layout, 'punchingBag').some((bag) => bag.zone === 'trainingRoom')).toBe(true)
    // A glass wall with a door between the command center and the operations room.
    expect(layout.walls.some((wall) => wall.level === 'subterranean' && wall.axis === 'x' && wall.at === layout.zones.operationsRoom.minZ)).toBe(true)
    expect(layout.doors.some((door) => door.between.includes('commandAmphitheater') && door.between.includes('operationsRoom'))).toBe(true)
    expect(layout.walls.some((wall) => wall.level === 'subterranean' && wall.exterior)).toBe(false)
  })
  it.each(COUNTS)('N=%i: exactly five suit pods on the west wall, 2 units apart; none for the steward', (n) => {
    const layout = computeLayout(n)
    const pods = of(layout, 'suitPod')
    expect(pods.map((pod) => pod.role)).toEqual([...SUIT_PODS])
    expect(pods.some((pod) => pod.role === 'alfred')).toBe(false)
    const west = layout.levels.subterranean.bounds.minX
    expect(pods.every((pod) => Math.abs(pod.x - (west + POD.wallOffset)) < 1e-9)).toBe(true)
    for (let index = 1; index < pods.length; index += 1) expect(pods[index].z - pods[index - 1].z).toBeCloseTo(2, 9)
    expect(pods[0].w / 2).toBe(0.65)
  })
})

describe('computeLayout: hangar, servers, forensics', () => {
  it.each(COUNTS)('N=%i: three 4.0 x 0.8 x 3.5 server banks and a 3.0 x 1.5 slab', (n) => {
    const layout = computeLayout(n)
    const banks = of(layout, 'serverBank')
    expect(banks).toHaveLength(3)
    expect(banks.every((bank) => bank.w === 4 && bank.d === 0.8 && bank.h === 3.5)).toBe(true)
    const [slab] = of(layout, 'forensicsSlab')
    expect([slab.w, slab.d]).toEqual([3, 1.5])
  })
  it.each(COUNTS)('N=%i: the whole fleet is there: jet, VTOL, interceptor, APC, four bikes and the submersible', (n) => {
    const layout = computeLayout(n)
    expect(of(layout, 'turntablePad')[0].w).toBe(9)
    expect(of(layout, 'interceptorBay').map((bay) => [bay.w, bay.d])).toEqual([[5, 8]])
    for (const type of ['tacticalJet', 'armoredInterceptor', 'assaultVtol', 'combatApc', 'bikeDock', 'submersiblePod']) expect(of(layout, type), type).toHaveLength(1)
    expect(of(layout, 'pursuitBike')).toHaveLength(4)
    expect(of(layout, 'toolChest')).toHaveLength(3)
    expect(of(layout, 'hydraulicLift').length).toBeGreaterThanOrEqual(2)
    expect(of(layout, 'diagBench').length).toBeGreaterThanOrEqual(2)
    // The wet dock is on the catwalk over the basin; everything else is on the hangar deck.
    expect(of(layout, 'submersiblePod')[0].zone).toBe('basinCatwalk')
    const hangar = layout.zones.hangarBay
    const catwalk = layout.zones.basinCatwalk
    for (const item of layout.items.filter((piece) => piece.zone === 'hangarBay' || piece.zone === 'basinCatwalk')) {
      const box = footprintOf(item)
      const room = item.zone === 'hangarBay' ? hangar : catwalk
      expect(box.minX, item.id).toBeGreaterThanOrEqual(room.minX - 1e-9)
      expect(box.maxX, item.id).toBeLessThanOrEqual(room.maxX + 1e-9)
      expect(box.minZ, item.id).toBeGreaterThanOrEqual(room.minZ - 1e-9)
      expect(box.maxZ, item.id).toBeLessThanOrEqual(room.maxZ + 1e-9)
    }
  })
  it.each(COUNTS)('N=%i: no empty parking bay: every pad has a vehicle on it, and a bare floor is never outlined', (n) => {
    const layout = computeLayout(n)
    const vehicles = ['tacticalJet', 'assaultVtol', 'armoredInterceptor', 'combatApc', 'submersiblePod', 'autoDock'].flatMap((type) => of(layout, type))
    const pads = ['turntablePad', 'vtolPad', 'interceptorBay', 'apcBay', 'subDock'].flatMap((type) => of(layout, type))
    for (const pad of pads) {
      const outline = footprintOf(pad)
      const occupied = vehicles.some((vehicle) => {
        const box = footprintOf(vehicle)
        return box.minX >= outline.minX - 1e-9 && box.maxX <= outline.maxX + 1e-9 && box.minZ >= outline.minZ - 1e-9 && box.maxZ <= outline.maxZ + 1e-9
      })
      expect(occupied, pad.id).toBe(true)
    }
    // The bike dock holds its four bikes.
    const [dock] = of(layout, 'bikeDock')
    const box = footprintOf(dock)
    expect(of(layout, 'pursuitBike').every((bike) => bike.x > box.minX && bike.x < box.maxX && bike.z > box.minZ && bike.z < box.maxZ)).toBe(true)
    // Floor finishing in the hangar is a plain plate: nothing of it is drawn in hazard yellow.
    for (const plate of of(layout, 'floorPlate')) expect(partsFor(plate).some((part) => part.m === 'hazard'), plate.id).toBe(false)
  })
  it.each(COUNTS)('N=%i: nothing hangs across or stands in the servicing aisle between the two rows', (n) => {
    const layout = computeLayout(n)
    const hangar = layout.zones.hangarBay
    const aisle = { minZ: hangar.minZ + 9.95, maxZ: hangar.minZ + 11.75 }
    expect(of(layout, 'serviceLane')).toHaveLength(1)
    const blocking = layout.items.filter((item) => item.zone === 'hangarBay' && !FLAT_TYPES.has(item.type)).filter((item) => { const box = footprintOf(item); return box.maxZ > aisle.minZ && box.minZ < aisle.maxZ })
    expect(blocking.map((item) => item.id)).toEqual([])
  })
})

describe('computeLayout: the surface manor (5.1 B)', () => {
  it.each(COUNTS)('N=%i: exactly N private suites of at least 5.0 x 4.5, one per agent, on both residential floors', (n) => {
    const layout = computeLayout(n)
    expect(layout.zones.bedroomSuites).toHaveLength(n)
    const suites = layout.zoneList.filter((zone) => zone.kind === 'suite')
    expect(suites.map((zone) => zone.owner).sort((a, b) => a! - b!)).toEqual(Array.from({ length: n }, (_, index) => index))
    expect(suites.every((zone) => zone.rect.maxX - zone.rect.minX >= 5 - 1e-9 && zone.rect.maxZ - zone.rect.minZ >= 4.5 - 1e-9)).toBe(true)
    expect(new Set(suites.map((zone) => zone.level)).size).toBe(n === 1 ? 1 : 2)
    // Each suite has its own bed, desk, wardrobe and privacy screen.
    for (const zone of suites) for (const type of ['bed', 'execDesk', 'wardrobe', 'privacyScreen']) expect(layout.items.filter((item) => item.zone === zone.id && item.type === type)).toHaveLength(1)
    expect(layout.paths.stops.filter((stop) => stop.kind === 'bed').map((stop) => stop.owner).sort((a, b) => a! - b!)).toEqual(Array.from({ length: n }, (_, index) => index))
  })
  it.each(COUNTS)('N=%i: the lobby is 12 x 12.5, the library at least 8 x 6 and 5.5 high, the terrace at least 12 x 6 with an 8 x 4 pool', (n) => {
    const layout = computeLayout(n)
    const size = (rect: { minX: number; maxX: number; minZ: number; maxZ: number }) => [rect.maxX - rect.minX, rect.maxZ - rect.minZ]
    expect(size(layout.zones.grandFoyer)).toEqual([12, 12.5])
    const [lw, ld] = size(layout.zones.grandLibrary)
    expect(lw).toBeGreaterThanOrEqual(8)
    expect(ld).toBeGreaterThanOrEqual(6)
    expect(layout.zoneList.find((zone) => zone.id === 'grandLibrary')!.height).toBe(5.5)
    const [tw, td] = size(layout.zones.terracePool)
    expect(tw).toBeGreaterThanOrEqual(12)
    expect(td).toBeGreaterThanOrEqual(6)
    const [pool] = of(layout, 'infinityPool')
    expect([pool.w, pool.d, pool.h]).toEqual([8, 4, 1])
    // The pool's eastern edge is the cliff edge above the chasm.
    expect(footprintOf(pool).maxX).toBeCloseTo(layout.zones.terracePool.maxX, 9)
    const [fire] = of(layout, 'fireplace')
    expect([fire.w, fire.d, fire.h]).toEqual([3, 1.2, 3.5])
    expect(of(layout, 'highChair')).toHaveLength(n + 2)
    expect(of(layout, 'grandStair')).toHaveLength(2)
    expect(of(layout, 'billiardsTable')).toHaveLength(1)
    // The gym, in the west wing south of the pantry.
    const gym = layout.zoneList.find((zone) => zone.id === 'gym')!
    expect(gym.level).toBe('surface')
    expect(gym.rect.minZ).toBe(layout.zones.butlerPantry.maxZ)
    for (const type of ['treadmill', 'dumbbellRack', 'weightBench', 'punchingBag']) expect(layout.items.some((item) => item.zone === 'gym' && item.type === type), type).toBe(true)
  })
})

/** Unit vector an item faces (its local +z). */
const facing = (item: Pick<LayoutItem, 'rotY'>) => [Math.sin(item.rotY), Math.cos(item.rotY)]
/** What each kind of seat must face, and how far away it may be. */
const SEAT_TARGETS: Partial<Record<ItemType, [ItemType[], number]>> = {
  chair: [['desk'], 1.5], consoleChair: [['consoleArc'], 1.5], highChair: [['banquetTable'], 1.5], leatherChair: [['billiardsTable'], 3.5],
  readingChair: [['sideTable'], 1.2], deskChair: [['studyDesk'], 1.2], armchair: [['execDesk'], 1.2], chesterfield: [['coffeeTable'], 2],
  sunLounger: [['infinityPool'], 14], tubChair: [['loungeTable'], 1.5],
}
/** Pieces that stand with their back to a wall. */
const AGAINST_WALL: ItemType[] = ['alabasterWall', 'luggageTrolley', 'holoPanel', 'suitPod', 'utilityConsole', 'weaponRack', 'armoryLocker', 'diagnosticRack', 'punchingBag', 'fireplace', 'tallBookshelf', 'cueRack', 'radioCabinet', 'sideboard', 'pantryCounter', 'wineRack', 'wardrobe', 'execDesk', 'treadmill', 'dumbbellRack', 'serverBank']

describe('computeLayout: everything faces the right way', () => {
  it.each(COUNTS)('N=%i: every seat faces the table, desk, console or pool it belongs to', (n) => {
    const layout = computeLayout(n)
    const wrong: string[] = []
    for (const seat of layout.items) {
      const rule = SEAT_TARGETS[seat.type]
      if (!rule) continue
      const [types, reach] = rule
      const [fx, fz] = facing(seat)
      const ok = layout.items.some((target) => {
        if (!types.includes(target.type) || target.level !== seat.level) return false
        // Towards the nearest point of the target's footprint (long tables, wide pools).
        const box = footprintOf(target)
        const dx = Math.min(Math.max(seat.x, box.minX), box.maxX) - seat.x
        const dz = Math.min(Math.max(seat.z, box.minZ), box.maxZ) - seat.z
        const distance = Math.hypot(dx, dz)
        return distance > 1e-9 && distance <= reach && (fx * dx + fz * dz) / distance > 0.7
      })
      if (!ok) wrong.push(`${seat.id} in ${seat.zone}`)
    }
    expect(wrong).toEqual([])
  })
  it.each(COUNTS)('N=%i: every seated stop is on a seat and looks the same way as it', (n) => {
    const layout = computeLayout(n)
    const seats = layout.items.filter((item) => SEAT_TARGETS[item.type])
    const angle = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
    const wrong = layout.paths.stops.filter((stop) => stop.seated).filter((stop) => !seats.some((seat) => seat.level === stop.level && Math.hypot(seat.x - stop.x, seat.z - stop.z) <= (seat.type === 'chesterfield' ? 1.3 : 0.35) && angle(seat.rotY, stop.facing) < 1e-6))
    expect(wrong.map((stop) => `${stop.id} in ${stop.zone}`)).toEqual([])
  })
  it.each(COUNTS)('N=%i: wall pieces have their back to a wall and their front to the room', (n) => {
    const layout = computeLayout(n)
    const zones = new Map(layout.zoneList.map((zone) => [zone.id, zone.rect]))
    const wrong: string[] = []
    for (const item of layout.items.filter((piece) => AGAINST_WALL.includes(piece.type))) {
      const rect = zones.get(item.zone)!
      const [fx, fz] = facing(item)
      // Half a unit behind the item's back is outside its room; half a unit in front is inside.
      const back = [item.x - fx * (item.d / 2 + 0.5), item.z - fz * (item.d / 2 + 0.5)]
      const inside = (x: number, z: number) => x > rect.minX && x < rect.maxX && z > rect.minZ && z < rect.maxZ
      const front = [item.x + fx * (item.d / 2 + 0.5), item.z + fz * (item.d / 2 + 0.5)]
      // Server banks stand in rows: only the first needs the wall, the others face the next aisle.
      if (item.type === 'serverBank' || item.type === 'holoPanel') { if (!inside(front[0], front[1])) wrong.push(`${item.id} faces a wall`); continue }
      if (inside(back[0], back[1]) || !inside(front[0], front[1])) wrong.push(`${item.id} (${item.type}) in ${item.zone}`)
    }
    expect(wrong).toEqual([])
  })
  it.each(COUNTS)('N=%i: nothing loose is scattered on the floor; bare floor only gets flat plates, mats, decking or rugs', (n) => {
    const layout = computeLayout(n)
    const finishing = layout.items.filter((item) => item.role === 'decor')
    expect(finishing.filter((item) => !FLAT_TYPES.has(item.type)).map((item) => item.id)).toEqual([])
    expect(finishing.every((item) => item.rotY === 0 && item.w === item.d)).toBe(true)
  })
})

describe('computeLayout: the hotel lobby', () => {
  it.each(COUNTS)('N=%i: a curved reception desk before an alabaster wall, a medallion, and two round clusters of four tub armchairs', (n) => {
    const layout = computeLayout(n)
    expect(of(layout, 'receptionDesk')).toHaveLength(1)
    expect(of(layout, 'alabasterWall')).toHaveLength(1)
    expect(of(layout, 'lobbyMedallion')).toHaveLength(1)
    expect(of(layout, 'loungeTable')).toHaveLength(2)
    expect(of(layout, 'roundRug')).toHaveLength(2)
    expect(of(layout, 'tubChair')).toHaveLength(8)
    // Each cluster: four armchairs round one table, all within 1.1 of it.
    for (const table of of(layout, 'loungeTable')) expect(of(layout, 'tubChair').filter((chair) => Math.hypot(chair.x - table.x, chair.z - table.z) < 1.1)).toHaveLength(4)
    // The desk is curved: more than one piece, set on an arc (its parts do not all share a depth).
    const [desk] = of(layout, 'receptionDesk')
    expect(new Set(partsFor(desk).map((part) => part.p[2].toFixed(2))).size).toBeGreaterThan(3)
    expect(of(layout, 'foyerTable')).toHaveLength(0)
  })
  it.each(COUNTS)('N=%i: both staircases are free at the foot and the head: 2.2 clear, and the railing stays along the flight', (n) => {
    const layout = computeLayout(n)
    const stairs = of(layout, 'grandStair')
    expect(stairs).toHaveLength(2)
    for (const stair of stairs) {
      // 2.2 x 2.2 of open floor at the foot of the flight, on the ground floor.
      const foot = { minX: stair.x - 1.1, maxX: stair.x + 1.1, minZ: stair.z + stair.d / 2, maxZ: stair.z + stair.d / 2 + 2.2 }
      const blockers = layout.items.filter((item) => item.level === 'surface' && item.type !== 'grandStair' && !FLAT_TYPES.has(item.type) && SOFT_TYPES.has(item.type) === false).filter((item) => { const box = footprintOf(item); return box.maxX > foot.minX && box.minX < foot.maxX && box.maxZ > foot.minZ && box.minZ < foot.maxZ })
      expect(blockers.map((item) => item.id), 'foot').toEqual([])
      // And at the head, on the mezzanine: the landing is at least 2.2 deep and holds nothing.
      const landing = layout.zoneList.find((zone) => zone.id === 'upperLanding')!.rect
      expect(landing.maxZ - landing.minZ).toBeGreaterThanOrEqual(2.2 - 1e-9)
      expect(layout.items.filter((item) => item.level === 'surfaceUpper' && item.zone === 'upperLanding').map((item) => item.id), 'head').toEqual([])
      // Nothing of the flight (steps, glass, handrail, balusters) sticks out past its two ends.
      for (const part of partsFor(stair)) {
        expect(part.p[2]).toBeLessThanOrEqual(stair.d / 2 + 0.05)
        expect(part.p[2]).toBeGreaterThanOrEqual(-stair.d / 2 - 0.05)
      }
    }
  })
})

describe('computeLayout: quality', () => {
  it.each([...COUNTS, 48])('N=%i: nothing overlaps, and every item stays inside its own zone', (n) => {
    const layout = computeLayout(n)
    expect(overlappingItems(layout.items).map(([a, b]) => `${a.id}/${b.id}`)).toEqual([])
    const zones = new Map(layout.zoneList.map((zone) => [zone.id, zone]))
    const outside = layout.items.filter((item) => {
      const zone = zones.get(item.zone)!
      const box = footprintOf(item)
      return zone.level !== item.level || box.minX < zone.rect.minX - 1e-6 || box.maxX > zone.rect.maxX + 1e-6 || box.minZ < zone.rect.minZ - 1e-6 || box.maxZ > zone.rect.maxZ + 1e-6
    })
    expect(outside.map((item) => item.id)).toEqual([])
  })
  it.each(COUNTS)('N=%i: no empty floor over 3 x 3 and at most 30%% unused floor, on every level', (n) => {
    for (const level of report(computeLayout(n))) {
      expect(level.largestEmptySquare, level.level).toBeLessThanOrEqual(MAX_EMPTY_SQUARE)
      expect(level.unusedFraction, level.level).toBeLessThanOrEqual(MAX_UNUSED_FRACTION)
    }
  })
  it.each(COUNTS)('N=%i: every stop, stair and elevator landing is joined to the rest of the manor', (n) => {
    expect(unreachableStops(computeLayout(n))).toEqual([])
  })
  it.each(COUNTS)('N=%i: the zones of a floor never overlap', (n) => {
    const layout = computeLayout(n)
    for (const level of LEVELS) {
      const zones = layout.zoneList.filter((zone) => zone.level === level)
      for (let a = 0; a < zones.length; a += 1) for (let b = a + 1; b < zones.length; b += 1) {
        const r = zones[a].rect
        const s = zones[b].rect
        const overlap = Math.max(0, Math.min(r.maxX, s.maxX) - Math.max(r.minX, s.minX)) * Math.max(0, Math.min(r.maxZ, s.maxZ) - Math.max(r.minZ, s.minZ))
        expect(overlap, `${zones[a].id}/${zones[b].id}`).toBeLessThan(1e-9)
      }
      expect(zones.reduce((sum, zone) => sum + area(zone.rect), 0)).toBeGreaterThan(0)
    }
  })
  it.each(COUNTS)('N=%i: the three camera presets frame the deck, the manor and both', (n) => {
    const { camera, levels } = computeLayout(n)
    expect(camera.commandDeck.target[1]).toBe(2.5)
    expect(camera.grandManor.target[1]).toBe(13.5)
    expect(camera.commandDeck.position[1]).toBeGreaterThan(camera.commandDeck.target[1])
    expect(camera.overview.maxDistance).toBeGreaterThan(camera.overview.minDistance)
    expect(camera.commandDeck.pan.minX).toBeLessThan(levels.subterranean.bounds.minX)
    expect(camera.grandManor.pan.maxZ).toBeGreaterThan(levels.surface.bounds.maxZ)
  })
  it('grows with the crew', () => {
    const small = computeLayout(1).bounds
    const large = computeLayout(40).bounds
    expect(large.maxX - large.minX).toBeGreaterThan(small.maxX - small.minX)
    expect(large.maxZ - large.minZ).toBeGreaterThan(small.maxZ - small.minZ)
  })
})
