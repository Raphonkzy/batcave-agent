import type { MockOnlyState, OfficeSnapshot, OfficeState, OfficeStation } from '../types.ts'
// A made-up crew for trying the 3D scenes at any size, in development only. Nothing here reaches
// the server, and production builds drop it (the only caller is behind `import.meta.env.DEV`).
const NAMED = ['bruce', 'barbara', 'dick', 'jason', 'tim', 'alfred', 'default']
/** What each named profile is busy with in the mock (its role's typical state). */
const NAMED_STATE: Record<string, OfficeState | MockOnlyState> = { bruce: 'Triage', barbara: 'Working', dick: 'Reviewing', jason: 'Deploying', tim: 'Researching', alfred: 'Cron', default: 'Working' }
const MIX: (OfficeState | MockOnlyState)[] = ['Working', 'Working', 'Reviewing', 'Deploying', 'Triage', 'Researching', 'Cron', 'Idle', 'Idle', 'Collaborating']
export const MOCK_MAX = 60
/** Seconds per step when the URL asks for `?mockAgents=cycle` (1 up to 40 and back down). */
export const CYCLE_STEP_MS = 1500
export type MockRequest = { kind: 'count'; count: number } | { kind: 'cycle' }
export function parseMockRequest(search: string): MockRequest | null {
  const value = new URLSearchParams(search).get('mockAgents')
  if (value === null) return null
  if (value === 'cycle') return { kind: 'cycle' }
  const count = Number.parseInt(value, 10)
  return Number.isFinite(count) && count >= 0 ? { kind: 'count', count: Math.min(count, MOCK_MAX) } : null
}
/** Crew size at a given step of the 1 -> 40 -> 1 cycle. */
export const cycleCount = (step: number) => { const phase = step % 78; return phase < 40 ? phase + 1 : 79 - phase }
function mulberry(seed: number) {
  let state = seed >>> 0
  return () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
/** A realistic mix of states, deterministic per crew size; at least one agent is profile-locked. */
export function mockStations(count: number): OfficeStation[] {
  const random = mulberry(0x6d6f636b)
  return Array.from({ length: count }, (_, index) => {
    const id = index < NAMED.length ? NAMED[index] : `agent-${String(index + 1).padStart(2, '0')}`
    const state = NAMED_STATE[id] ?? MIX[Math.floor(random() * MIX.length)]
    // The eighth agent (or the last one, in a small crew) is locked, plus about one in eight more.
    const locked = index === Math.min(7, count - 1) || (index >= NAMED.length && random() < 0.12)
    const idle = state === 'Idle'
    return {
      id, name: id, role: 'Mock', state,
      room: idle ? 'Lounge' : 'Workspace',
      roomPosition: state === 'Collaborating' ? 'meeting-area' : idle ? 'lounge' : 'desk',
      currentTask: '', recentActivity: '', activity: '',
      seat: index + 1, provenance: 'mock', freshness: 'mock',
      ...(locked ? { privacy: 'locked' as const } : {}),
    }
  })
}
export function mockOffice(count: number): OfficeSnapshot {
  const stations = mockStations(count)
  const tally = (state: string) => stations.filter((station) => station.state === state).length
  return {
    stations,
    fetchedAt: new Date(0).toISOString(),
    summary: { declared: count, active: count - tally('Idle') - tally('Offline') - tally('Unknown'), idle: tally('Idle'), offline: tally('Offline'), unknown: tally('Unknown'), gatewaysReachable: 0, gatewaysDeclared: 0 },
  }
}
