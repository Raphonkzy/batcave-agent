import { describe, expect, it } from 'vitest'
import { computeLayout } from '../src/utils/layout/computeLayout.ts'
import { WORLD_CONFIG, estateConfig, dot, sub, dist } from '../src/scenes/manor/worldConfig.ts'

describe('Path orientation and lot geometry test (Section 6.4)', () => {
  const { threshold: D, facing: F } = WORLD_CONFIG.entrance
  const path = WORLD_CONFIG.pathPolyline
  const gate = WORLD_CONFIG.gate

  it('ensures no path polyline vertex lies behind the entrance door (-F direction)', () => {
    for (const p of path) {
      const projection = dot(sub(p, D), F)
      expect(projection, `Point [${p.join(', ')}] must be in front of threshold D`).toBeGreaterThanOrEqual(-0.25)
    }
  })

  it('ensures path polyline starts directly at entrance threshold D', () => {
    expect(dist(path[0], D)).toBeLessThanOrEqual(0.5)
  })

  it('ensures path polyline terminates accurately at estate grand gate', () => {
    expect(dist(path[path.length - 1], gate.position)).toBeLessThanOrEqual(1.0)
  })

  it.each([1, 6, 12, 24, 40, 48])('N=%i: keeps the front approach independent of the private pool garden', (count) => {
    const layout = computeLayout(count)
    const config = estateConfig(layout)
    const pool = layout.items.find((item) => item.type === 'infinityPool')!
    expect(config.entrance.facing).toEqual([0, 0, 1])
    expect(config.entrance.threshold[2]).toBe(layout.zones.entranceHall.maxZ)
    expect(dot(sub([pool.x, pool.y, pool.z], config.entrance.threshold), config.entrance.facing)).toBeGreaterThan(0)
    for (const point of [...config.pathPolyline, ...config.poolConnector]) expect(point[2]).toBeGreaterThanOrEqual(config.entrance.threshold[2])
    expect(pool.x + pool.w / 2).toBeLessThan(-6)
    expect(config.poolConnector[1][0]).toBeGreaterThan(pool.x + pool.w / 2)
    expect(config.poolConnector[2][2]).toBe(pool.z)
    const court = layout.zones.terracePool
    expect(court.maxX).toBeLessThan(layout.zones.entranceTerrace.minX)
    for (const id of ['poolWalkway', 'poolGardenLink']) expect(layout.zoneList.some(zone => zone.id === id && zone.kind === 'outdoor')).toBe(true)
    expect(config.gate.position[2]).toBeGreaterThan(layout.zones.terracePool.maxZ)
  })
})

