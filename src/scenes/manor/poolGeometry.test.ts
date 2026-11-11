import { describe, expect, it } from 'vitest'
import { computeLayout } from '../../utils/layout/computeLayout.ts'
import { canCommandMove } from '../../utils/layout/navigation.ts'
import { poolPaving, subtractFootprint } from './poolGeometry.ts'
import { gardenTree } from './landscape.ts'
import { terraceSun } from './ZoneLayout.ts'

describe('private garden geometry', () => {
  it.each([1, 6, 12, 40, 48])('keeps pool volume free of paving and reachable for %i crew', count => {
    const layout = computeLayout(count), pool = layout.items.find(item => item.type === 'infinityPool')!
    const zone = layout.zoneList.find(zone => zone.id === 'terracePool')!
    const paving = poolPaving(zone, pool)
    const area = paving.reduce((sum, item) => sum + (item.rect.maxX - item.rect.minX) * (item.rect.maxZ - item.rect.minZ), 0)
    expect(area).toBeCloseTo((zone.rect.maxX - zone.rect.minX) * (zone.rect.maxZ - zone.rect.minZ) - pool.w * pool.d)
    for (const {rect} of paving) expect(pool.x > rect.minX && pool.x < rect.maxX && pool.z > rect.minZ && pool.z < rect.maxZ).toBe(false)
    const stop = layout.paths.stops.find(stop => stop.kind === 'poolside')!
    expect(canCommandMove(layout, [0.25, 11, layout.zones.entranceHall.maxZ + 2.5], [stop.x, 11, stop.z])).toBe(true)
  })
  it('clips ground openings safely at surface edges', () => {
    const ground={minX:0,maxX:10,minZ:0,maxZ:10}
    const patches=subtractFootprint(ground,{minX:-2,maxX:4,minZ:2,maxZ:6})
    expect(patches.reduce((sum,r)=>sum+(r.maxX-r.minX)*(r.maxZ-r.minZ),0)).toBe(84)
    expect(patches.every(r=>r.minX>=0 && r.maxX<=10 && r.minZ>=0 && r.maxZ<=10)).toBe(true)
    expect(subtractFootprint(ground,{minX:11,maxX:12,minZ:0,maxZ:1})).toEqual([ground])
  })
  it('varies trees with branches and broad foliage instead of cones', () => {
    const signatures = new Set()
    for (let seed = 0; seed < 8; seed++) {
      const parts = gardenTree(0, 11, 0, seed)
      expect(parts.some(part => part.g === 'cone')).toBe(false)
      expect(parts.filter(part => part.m === 'bark').length).toBeGreaterThan(2)
      expect(parts.every(part => part.s.every(value => value > 0))).toBe(true)
      signatures.add(JSON.stringify(parts))
    }
    expect(signatures.size).toBe(8)
  })
  it('distinguishes sunrise, noon, sunset and moonlight', () => {
    expect(terraceSun(12).intensity).toBeGreaterThan(terraceSun(6).intensity)
    expect(terraceSun(12).sky).not.toBe(terraceSun(17.5).sky)
    expect(terraceSun(0).intensity).toBeLessThan(terraceSun(12).intensity)
    expect(terraceSun(6).direction).not.toEqual(terraceSun(17.5).direction)
  })
})
