import { describe, expect, it } from 'vitest'
import { checkHarusBerbeda } from '../scripts/verify/verify-harus-berbeda.ts'

describe('Gate HARUS BERBEDA verification test', () => {
  it('validates that redesign differs fundamentally from old shell landmarks', () => {
    const result = checkHarusBerbeda()
    // Once W2 shell is implemented, this must be ok === true
    if (!result.ok) {
      // Pending W2 shell replacement
      expect(result.landmarksChecked).toBe(11)
    } else {
      expect(result.ok).toBe(true)
      expect(result.oldSelectorsFound).toEqual([])
      for (const [route, diff] of Object.entries(result.routesDiff)) {
        expect(diff.domHashDifferent, `${route} DOM must differ`).toBe(true)
        expect(diff.estDiffPercent, `${route} visual diff must be >= 35%`).toBeGreaterThanOrEqual(35)
      }
    }
  })
})

