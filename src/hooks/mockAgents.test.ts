import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lowerQuality, nextQuality, parseQuality } from '../pages/manorQuality.ts'
import { cycleCount, mockOffice, mockStations, parseMockRequest } from './mockAgents.ts'

describe('dev mock crew', () => {
  it('reads ?mockAgents=N, caps it, and supports the 1-40-1 cycle', () => {
    expect(parseMockRequest('?mockAgents=32')).toEqual({ kind: 'count', count: 32 })
    expect(parseMockRequest('?mockAgents=999')).toEqual({ kind: 'count', count: 60 })
    expect(parseMockRequest('?mockAgents=cycle')).toEqual({ kind: 'cycle' })
    expect(parseMockRequest('?mockAgents=-1')).toBeNull()
    expect(parseMockRequest('')).toBeNull()
    expect([0, 39, 40, 77, 78].map(cycleCount)).toEqual([1, 40, 39, 2, 1])
  })
  it('mixes every swarm status and locks at least one agent, deterministically', () => {
    const crew = mockStations(32)
    expect(crew).toHaveLength(32)
    for (const state of ['Working', 'Reviewing', 'Deploying', 'Triage', 'Researching', 'Cron', 'Idle']) expect(crew.some((agent) => agent.state === state), state).toBe(true)
    expect(crew.filter((agent) => agent.privacy === 'locked').length).toBeGreaterThanOrEqual(1)
    expect(mockStations(3).some((agent) => agent.privacy === 'locked')).toBe(true)
    expect(JSON.stringify(mockStations(12))).toBe(JSON.stringify(mockStations(12)))
    expect(crew.slice(0, 7).map((agent) => agent.id)).toEqual(['bruce', 'barbara', 'dick', 'jason', 'tim', 'alfred', 'default'])
    expect(crew.every((agent) => agent.currentTask === '' && agent.activity === '')).toBe(true)
    expect(mockOffice(5).summary.declared).toBe(5)
  })
  it('is only reachable behind import.meta.env.DEV, so production builds drop it', () => {
    const hook = readFileSync(join(process.cwd(), 'src/hooks/useAgents.ts'), 'utf8')
    expect(hook).toMatch(/import\.meta\.env\.DEV && typeof window/)
    expect(hook).toMatch(/if \(import\.meta\.env\.DEV && mock !== null\)/)
  })
})

describe('quality', () => {
  it('defaults to Medium and reads only known values', () => {
    expect(parseQuality(null)).toBe('medium')
    expect(parseQuality('ultra')).toBe('medium')
    expect(parseQuality('high')).toBe('high')
    expect(parseQuality('low')).toBe('low')
  })
  it('steps down one level after 5 slow seconds, never below Low', () => {
    expect(nextQuality('high', 4)).toBe('high')
    expect(nextQuality('high', 5)).toBe('medium')
    expect(nextQuality('medium', 5)).toBe('low')
    expect(nextQuality('low', 50)).toBe('low')
    expect(lowerQuality('high')).toBe('medium')
  })
})
