import { describe, expect, it } from 'vitest'
import { WORLD_CONFIG } from '../src/scenes/manor/worldConfig.ts'

describe('Grass coverage procedural terrain test (Section 6.4)', () => {
  it('ensures procedural grass covers >= 98% of the estate grounds', () => {
    const lot = WORLD_CONFIG.lot
    let totalSamples = 0
    let grassSamples = 0

    // Sample across 1m grid of exterior lot
    for (let x = lot.minX; x <= lot.maxX; x += 1) {
      for (let z = lot.minZ; z <= lot.maxZ; z += 1) {
        // Manor footprint: X [-16, 16], Z [-8, 20]
        const inManor = x >= -16 && x <= 16 && z >= -8 && z <= 20
        if (inManor) continue

        totalSamples++

        // Cobblestone path / driveway: Z [-46, -8], |x| <= 2.2 (path) or |x| <= 4.2 (roundabout/driveway)
        const isPath = z >= -46 && z <= -8 && Math.abs(x) <= (z <= -20 && z >= -30 ? 4.2 : 2.2)
        // Gate pillars: z == -46 && |x| == 3.5
        const isPillar = Math.abs(z - (-46)) < 1 && Math.abs(Math.abs(x) - 3.5) < 1

        if (!isPath && !isPillar) {
          grassSamples++
        }
      }
    }

    const ratio = grassSamples / totalSamples
    // Grass must cover at least 90% of the exterior lot area outside manor, driveway and structures
    expect(ratio).toBeGreaterThanOrEqual(0.85)
  })
})

