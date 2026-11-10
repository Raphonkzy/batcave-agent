import { describe, expect, it } from 'vitest'
import { checkInvariants } from '../../scripts/verify/guard-invariants.ts'

describe('guard-invariants verification harness', () => {
  it('passes on the clean baseline codebase', () => {
    const result = checkInvariants()
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })
})
