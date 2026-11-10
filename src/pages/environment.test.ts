// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { ENVIRONMENT_KEY, readEnvironment } from './EnvironmentControls.tsx'
afterEach(() => localStorage.clear())
describe('environment preferences', () => {
  it('defaults to the real local clock', () => expect(readEnvironment()).toEqual({ realtime: true, hour: 12, azimuth: 0, intensity: 1 }))
  it('sanitizes untrusted stored preferences', () => {
    localStorage.setItem(ENVIRONMENT_KEY, JSON.stringify({realtime:false,hour:99,azimuth:-999,intensity:8}))
    expect(readEnvironment()).toEqual({realtime:false,hour:24,azimuth:-180,intensity:2})
    localStorage.setItem(ENVIRONMENT_KEY, 'null')
    expect(readEnvironment().realtime).toBe(true)
    localStorage.setItem(ENVIRONMENT_KEY, '{broken')
    expect(readEnvironment().hour).toBe(12)
  })
})
