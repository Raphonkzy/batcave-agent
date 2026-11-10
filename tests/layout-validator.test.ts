import { describe, expect, it } from 'vitest'
import { computeLayout } from '../src/utils/layout/computeLayout.ts'
import { validateLayout } from '../src/utils/layout/validator.ts'

describe('LayoutValidator suite', () => {
  it.each([1, 6, 12, 24, 40])('N=%i passes comprehensive layout validation with zero errors', (n) => {
    const layout = computeLayout(n)
    const result = validateLayout(layout)
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
  })
})
