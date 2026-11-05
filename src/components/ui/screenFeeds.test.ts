import { describe, expect, it } from 'vitest'
import { cycleCount } from '../../hooks/mockAgents.ts'
import { screenSlots, slotKinds } from '../../scenes/manor/screens.ts'
import { computeLayout } from '../../utils/layout/computeLayout.ts'
import { planPath } from '../../utils/layout/navigation.ts'
import { placementFor } from '../../utils/layout/placements.ts'
import type { OfficeStation } from '../../types.ts'
import { drawFeed, screenKindFor, SCREEN_KINDS } from './screenFeeds.ts'

/** A canvas context that accepts every call and records which methods were used. */
function recorder() {
  const calls = new Set<string>()
  const ctx = new Proxy({}, {
    get: (_, name: string) => (name === 'createRadialGradient' || name === 'createLinearGradient' ? () => ({ addColorStop: () => undefined }) : () => { calls.add(name) }),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D
  return { ctx, calls }
}
const agent = (id: string, state: string, extra: Partial<OfficeStation> = {}) => ({ id, name: id, role: '', room: 'Workspace', roomPosition: 'desk', state, currentTask: 'SECRET TASK TEXT', recentActivity: 'secret', activity: 'secret', seat: 1, provenance: '', freshness: '', ...extra }) as OfficeStation

describe('screens', () => {
  it('never draw text: every picture is made of shapes', () => {
    for (const kind of SCREEN_KINDS) {
      const { ctx, calls } = recorder()
      for (const time of [0, 1.3, 40]) drawFeed(ctx, kind, time)
      expect(calls.has('fillText') || calls.has('strokeText'), kind).toBe(false)
    }
  })
  it('follow the state and the role only; a locked agent always shows the padlock', () => {
    expect(screenKindFor(agent('barbara', 'Working'))).toBe('code')
    expect(screenKindFor(agent('dick', 'Working'))).toBe('checklist')
    expect(screenKindFor(agent('jason', 'Deploying'))).toBe('telemetry')
    expect(screenKindFor(agent('tim', 'Researching'))).toBe('graphs')
    expect(screenKindFor(agent('bruce', 'Triage'))).toBe('topology')
    expect(screenKindFor(agent('alfred', 'Cron'))).toBe('schedule')
    expect(screenKindFor(agent('anyone', 'Idle'))).toBe('idle')
    expect(screenKindFor(agent('anyone', 'Unknown'))).toBe('unknown')
    for (const state of ['Working', 'Reviewing', 'Idle', 'Triage']) expect(screenKindFor(agent('barbara', state, { privacy: 'locked' }))).toBe('locked')
  })
  it.each([1, 12, 40])('N=%i: two screens per desk, the console rig, the display wall and the role terminals', (n) => {
    const layout = computeLayout(n)
    const slots = screenSlots(layout)
    expect(slots.filter((slot) => slot.source === 'desk')).toHaveLength(2 * n)
    expect(slots.filter((slot) => slot.source === 'rig')).toHaveLength(3)
    expect(slots.filter((slot) => slot.source === 'holo')).toHaveLength(21)
    for (const source of ['server', 'catwalk', 'utility'] as const) expect(slots.filter((slot) => slot.source === source)).toHaveLength(1)
  })
  it('shows a desk screen for the agent at that desk, a screensaver while it idles there, and nothing once it has left', () => {
    const layout = computeLayout(2)
    const crew = [agent('agent-1', 'Working', { seat: 1 }), agent('agent-2', 'Idle', { seat: 2, room: 'Lounge' })]
    const placements = crew.map((station) => placementFor(station, layout))
    const slots = screenSlots(layout)
    const kinds = slotKinds(slots, crew, placements, false)
    const desk = (owner: number) => kinds.filter((_, index) => slots[index].source === 'desk' && slots[index].item.owner === owner)
    expect(desk(0)).toEqual(['code', 'code'])
    expect(desk(1)).toEqual(['idle', 'idle'])
    const away = slotKinds(slots, crew, [placements[0], { ...placements[1], kind: 'sofa' }], false)
    expect(away.filter((_, index) => slots[index].source === 'desk' && slots[index].item.owner === 1)).toEqual(['off', 'off'])
  })
})

describe('growing and shrinking the crew', () => {
  it('re-plans walkers from the old layout to the new one at every size from 1 to 40 and back', () => {
    let previous = computeLayout(cycleCount(0))
    for (let step = 1; step < 78; step += 1) {
      const layout = computeLayout(cycleCount(step))
      const stops = layout.paths.stops
      for (const stop of previous.paths.stops.filter((_, index) => index % 9 === 0)) {
        const target = stops[(Math.abs(Math.round(stop.x * 13)) + step) % stops.length]
        const route = planPath(layout, [stop.x, stop.y, stop.z], [target.x, target.y, target.z])
        expect(route.at(-1)).toEqual([target.x, target.y, target.z])
        expect(route.every((point) => point.every(Number.isFinite))).toBe(true)
      }
      previous = layout
    }
    expect(cycleCount(39)).toBe(40)
    expect(cycleCount(77)).toBe(2)
  }, 30_000) // 78 layouts with route planning: slow on purpose
})
