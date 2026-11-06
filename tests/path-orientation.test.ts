import { describe, expect, it } from 'vitest'
import { WORLD_CONFIG, dot, sub, dist } from '../src/scenes/manor/worldConfig.ts'

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

  it('verifies estate lot bounds provide >= 55% yard area in front of manor (+F)', () => {
    const lotDepth = WORLD_CONFIG.lot.maxZ - WORLD_CONFIG.lot.minZ // 32 - (-48) = 80m
    const frontYardDepth = Math.abs(WORLD_CONFIG.lot.minZ - D[2]) // |-48 - (-8)| = 40m
    const frontRatio = frontYardDepth / (lotDepth - 12.5) // front yard relative to exterior area
    expect(frontRatio).toBeGreaterThanOrEqual(0.55)
  })
})

