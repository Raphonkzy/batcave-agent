import { describe, expect, it } from 'vitest'
import { computeLayout } from '../../utils/layout/computeLayout.ts'
import { footprintOf, rectsOverlap } from '../../utils/layout/geometry.ts'
import { isWalkable, gridFor, unreachableStops } from '../../utils/layout/navigation.ts'
import { FLAT_TYPES, doorClearance } from '../../utils/layout/structure.ts'
import { floorStyle } from './ZoneLayout.ts'
import { manorWallPieces, manorWindows } from './manorArchitecture.ts'
import { estateConfig } from './worldConfig.ts'

const counts = [1, 2, 6, 12, 24, 40, 48]
describe('pool-facing Grand Manor architecture', () => {
  it.each(counts)('N=%i: a usable centered entrance leads through foyer and salon to ballroom', (count) => {
    const layout = computeLayout(count)
    const config = estateConfig(layout)
    const grid = gridFor(layout, 'surface')
    for (const pair of [['entranceTerrace', 'entranceHall'], ['entranceHall', 'hearthLounge'], ['hearthLounge', 'grandFoyer']]) {
      const door = layout.doors.find((door) => pair.every((id) => door.between.includes(id as never)))!
      expect(door, pair.join(' → ')).toBeDefined()
      expect(door.center).toBe(0)
      expect(door.width).toBe(2.8)
      expect(layout.items.filter((item) => item.level === 'surface' && !FLAT_TYPES.has(item.type) && rectsOverlap(footprintOf(item), doorClearance(door))).map((item) => item.id)).toEqual([])
    }
    for (let z = layout.zones.hearthLounge.minZ + 1; z < config.entrance.threshold[2] + 5; z += 0.5) {
      expect(isWalkable(layout, grid, 0.25, z), 'central public aisle at z=' + z).toBe(true)
    }
    const pool = layout.items.find((item) => item.type === 'infinityPool')!
    for (let x = 0.25; x < pool.x - pool.w / 2 - 0.4; x += 0.5) expect(isWalkable(layout, grid, x, pool.z)).toBe(true)
    expect(unreachableStops(layout)).toEqual([])
  })

  it.each(counts)('N=%i: preserves formal and recreational identities with a working kitchen', (count) => {
    const layout = computeLayout(count)
    const zone = (id: string) => layout.zoneList.find((zone) => zone.id === id)!
    expect(floorStyle(zone('grandFoyer')).texture).toBe('checker')
    expect(floorStyle(zone('gym')).color).toBe('#55524e')
    expect(floorStyle(zone('grandBath')).texture).toBe('marble')
    expect(layout.zones.gym.maxZ).toBe(layout.zones.grandBath.minZ)
    for (const type of ['grandStair', 'lobbyMedallion', 'chesterfield', 'treadmill', 'dumbbellRack', 'weightBench', 'billiardsTable', 'banquetTable', 'tallBookshelf', 'kitchenCounter', 'kitchenIsland', 'refrigerator', 'wineRack']) expect(layout.items.some((item) => item.type === type), type).toBe(true)
    expect(layout.doors.some((door) => door.between.includes('diningHall') && door.between.includes('butlerPantry'))).toBe(true)
    expect(layout.doors.some((door) => door.between.includes('gym') && door.between.includes('grandBath'))).toBe(true)
    const table = footprintOf(layout.items.find((item) => item.type === 'billiardsTable')!)
    const room = layout.zones.billiardsRoom
    expect(Math.min(table.minX - room.minX, room.maxX - table.maxX, table.minZ - room.minZ, room.maxZ - table.maxZ)).toBeGreaterThanOrEqual(1.5)
    const clearance = { minX: table.minX - 1.2, maxX: table.maxX + 1.2, minZ: table.minZ - 1.2, maxZ: table.maxZ + 1.2 }
    expect(layout.items.filter((item) => item.zone === 'billiardsRoom' && item.type !== 'billiardsTable' && !FLAT_TYPES.has(item.type) && rectsOverlap(footprintOf(item), clearance))).toEqual([])
    expect(layout.items.filter((item) => item.zone === 'grandFoyer' && item.role === 'decor')).toEqual([])
  })

  it.each(counts)('N=%i: has distinct master/guest accommodation, ensuite fixtures and private-only access', (count) => {
    const layout = computeLayout(count)
    const beds = layout.items.filter((item) => item.level === 'surface' && item.type === 'bed')
    const master = beds.find((bed) => bed.role === 'master')!
    const guest = beds.find((bed) => bed.role === 'guest')!
    expect(master).toBeDefined()
    expect(guest).toBeDefined()
    expect(master.w).toBeGreaterThan(guest.w)
    for (const bed of beds) {
      const doors = layout.doors.filter((door) => door.between.includes(bed.zone))
      expect(doors.length).toBeGreaterThan(0)
      expect(doors.every((door) => door.between.includes('eastCorridor'))).toBe(true)
      for (const type of ['wardrobe', 'vanityCounter', 'soakingTub', 'showerScreen', 'toilet']) expect(layout.items.some((item) => item.zone === bed.zone && item.type === type)).toBe(true)
    }
    expect(layout.doors.some((door) => door.between.includes('grandLibrary') && door.between.includes('eastCorridor'))).toBe(true)
    expect(layout.doors.some((door) => door.between.includes('grandLibrary') && door.between.includes('grandFoyer'))).toBe(false)
  })

  it('cuts real apertures and preserves windows on exterior walls only', () => {
    for (const wall of computeLayout(12).walls.filter((wall) => wall.exterior && wall.level === 'surface')) {
      for (const center of manorWindows(wall)) {
        const pieces = manorWallPieces(wall, wall.height)
        expect(pieces.some((piece) => center > piece.from && center < piece.to && 1.5 > piece.bottom && 1.5 < piece.bottom + piece.height)).toBe(false)
        expect(pieces.some((piece) => center > piece.from && center < piece.to && piece.bottom === 0)).toBe(true)
      }
    }
  })
})
