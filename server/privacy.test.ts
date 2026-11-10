import { describe, expect, it } from 'vitest'
import { redactUsage } from './privacy.js'
import type { UsageSnapshot } from './mission-control.js'
import type { Privacy } from './profile-lock.js'

const usage: UsageSnapshot = {
  days: 7, fetchedAt: 'now',
  agents: [{ agent: 'coder', availability: 'available', usage: {
    days: 7, sessions: 1, messages: 2, toolCalls: 3, inputTokens: 4, outputTokens: 5, totalTokens: 9, costUsd: 0.1,
    models: [{ model: 'model', sessions: 1, tokens: 9 }], tools: [{ tool: 'terminal', calls: 3 }], sources: [{ source: 'cli', sessions: 1, tokens: 9 }],
    topSession: { tokens: 9, date: 'private-date' },
  } }, { agent: 'offline', availability: 'unavailable', error: 'Not available' }],
  totals: { sessions: 1, messages: 2, toolCalls: 3, inputTokens: 4, outputTokens: 5, totalTokens: 9, costUsd: 0.1 },
  models: [{ model: 'model', sessions: 1, tokens: 9 }], sources: [{ source: 'cli', sessions: 1, tokens: 9 }], tools: [{ tool: 'terminal', calls: 3 }],
}
const privacy = (hidden: string[], all = false): Privacy => ({ hidden: new Set(hidden), locked: new Set(['coder']), all })

describe('profile-lock usage accounting policy', () => {
  it.each([privacy(['coder']), privacy([], true)])('withholds session details but intentionally preserves accounting, including fail-closed mode', (state) => {
    const result = redactUsage(usage, state)
    expect(JSON.stringify(result)).not.toContain('private-date')
    expect(result.agents[0].usage).toEqual({ ...usage.agents[0].usage, topSession: undefined })
    expect(result.totals).toEqual(usage.totals)
    expect(result.models).toEqual(usage.models)
    expect(result.sources).toEqual(usage.sources)
    expect(result.tools).toEqual(usage.tools)
    expect(result.agents[0].agent).toBe('coder')
    expect(result.agents[1]).toEqual(usage.agents[1])
    expect(usage.agents[0].usage?.topSession?.date).toBe('private-date')
  })

  it('returns full session details when unlocked or when a different profile is locked', () => {
    expect(redactUsage(usage, privacy([]))).toBe(usage)
    expect(redactUsage(usage, privacy(['other'])).agents[0]).toBe(usage.agents[0])
  })
})
