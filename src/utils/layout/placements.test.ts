import { describe, expect, it } from 'vitest'
import { agentGear, fallbackHue, VAULT_PROFILES } from '../../components/agent/agentLooks.ts'
import { characterParts, suitParts } from '../../components/agent/rig.ts'
import { mockStations } from '../../hooks/mockAgents.ts'
import { computeLayout } from './computeLayout.ts'
import { gridFor, isWalkable, levelOf, planPath } from './navigation.ts'
import { IDLE_STOP_MS, idlePlan, placementFor, STEWARD_MS } from './placements.ts'
import type { Vec3 } from './types.ts'

const station = (id: string, state: string, seat = 1, room: 'Workspace' | 'Lounge' = 'Workspace') => ({ id, seat, state, room, roomPosition: state === 'Collaborating' ? 'meeting-area' : 'desk' }) as Parameters<typeof placementFor>[0]

describe('placements', () => {
  const layout = computeLayout(12)
  it('puts each named profile at its role station while busy', () => {
    expect(placementFor(station('bruce', 'Working'), layout).kind).toBe('warCommand')
    expect(placementFor(station('barbara', 'Working'), layout)).toMatchObject({ kind: 'devRig', seated: true })
    expect(placementFor(station('dick', 'Reviewing'), layout).kind).toBe('catwalk')
    expect(placementFor(station('jason', 'Working'), layout).kind).toBe('serverTerminal')
    expect(placementFor(station('jason', 'Deploying'), layout).kind).toBe('workbench')
    expect(placementFor(station('tim', 'Working'), layout).kind).toBe('forensics')
    expect(placementFor(station('tim', 'Researching'), layout).kind).toBe('studyDesk')
    expect(placementFor(station('alfred', 'Cron'), layout, 0).kind).toBe('utility')
    expect(placementFor(station('alfred', 'Cron'), layout, STEWARD_MS).kind).toBe('pantry')
    expect(placementFor(station('default', 'Working'), layout).kind).toBe('warSync')
    expect(placementFor(station('default', 'Idle'), layout).kind).toBe('patrol')
    expect(placementFor(station('default', 'Offline'), layout).kind).toBe('sentry')
  })
  it('seats everyone else at their own desk, and gathers briefings round the war table', () => {
    const desks = [1, 2, 3, 4, 5].map((seat) => placementFor(station(`agent-${seat}`, 'Working', seat), layout).position.join(','))
    expect(new Set(desks).size).toBe(5)
    expect(placementFor(station('agent-9', 'Collaborating', 9), layout, 0, 2).kind).toBe('warRing')
    expect(placementFor(station('agent-9', 'Offline', 9), layout)).toMatchObject({ kind: 'desk', seated: false })
  })
  it.each([1, 6, 12, 24, 40])('N=%i: idle agents rest in the manor without sharing spots, and sleepers use their own suite', (n) => {
    const big = computeLayout(n)
    const seats = Array.from({ length: n }, (_, index) => index + 1)
    for (const time of [0, IDLE_STOP_MS, IDLE_STOP_MS * 7]) {
      const plan = idlePlan(big, seats, time)
      expect(plan.size).toBe(n)
      const spots = [...plan.values()].map((item) => item.placement.position.join(','))
      expect(new Set(spots).size).toBe(spots.length)
      expect([...plan.values()].every((item) => item.placement.position[1] >= 11)).toBe(true)
    }
    const asleep = idlePlan(big, seats, 0, seats)
    for (const seat of seats) {
      const bed = asleep.get(seat)!.placement
      const suite = big.zoneList.find((zone) => zone.owner === seat - 1)!
      expect(bed.pose).toBe('lie')
      expect(bed.position[0]).toBeGreaterThanOrEqual(suite.rect.minX)
      expect(bed.position[0]).toBeLessThanOrEqual(suite.rect.maxX)
    }
  })
})

describe('routes to every placement', () => {
  it.each([1, 6, 12, 24, 40])('N=%i: every mock agent can walk from its desk to where it goes, never through furniture or walls', (n) => {
    const layout = computeLayout(n)
    const crew = mockStations(n)
    const stray: string[] = []
    crew.forEach((agent) => {
      const from = placementFor({ ...agent, state: 'Offline' }, layout).position
      const to = placementFor(agent, layout, 0).position as Vec3
      const route = planPath(layout, from, to)
      expect(route.at(-1)).toEqual(to)
      let previous = from
      for (const point of route) {
        if (Math.abs(point[1] - previous[1]) < 1) {
          const grid = gridFor(layout, levelOf(point[1]))
          const steps = Math.max(1, Math.ceil(Math.hypot(point[0] - previous[0], point[2] - previous[2]) / 0.1))
          for (let step = 1; step <= steps; step += 1) {
            const x = previous[0] + ((point[0] - previous[0]) * step) / steps
            const z = previous[2] + ((point[2] - previous[2]) * step) / steps
            // Stepping into the elevator tube is the one place a route may enter a blocked cell.
            const inLift = Math.hypot(x - layout.elevator.x, z - layout.elevator.z) < layout.elevator.radius + 0.75
            const near = inLift || Math.hypot(x - to[0], z - to[2]) < 0.9 || Math.hypot(x - from[0], z - from[2]) < 0.9
            if (!near && !isWalkable(layout, grid, x, z)) stray.push(`${agent.id}@${x.toFixed(1)},${z.toFixed(1)}`)
          }
        }
        previous = point
      }
    })
    expect(stray).toEqual([])
  })
})

describe('agentLooks', () => {
  it('maps the named profiles to their role, colours and gear, and the default profile to the automaton', () => {
    expect(agentGear('bruce')).toMatchObject({ roleTitle: 'Tactical Commander', palette: { accentGlow: '#ffaa00' }, headMesh: 'command-helm', fallback: false })
    expect(agentGear('Barbara').palette.accentGlow).toBe('#ffd000')
    expect(agentGear('dick').palette.accentGlow).toBe('#00a8ff')
    expect(agentGear('jason').palette.accentGlow).toBe('#ff1a1a')
    expect(agentGear('tim').palette.accentGlow).toBe('#00e676')
    expect(agentGear('alfred')).toMatchObject({ handItem: 'cane', palette: { accentGlow: '#ffe0a3' } })
    expect(agentGear('default')).toMatchObject({ body: 'automaton', headMesh: 'automaton-optic-cluster', torsoMesh: 'ballistic-chassis', palette: { accentGlow: '#a855f7', baseDark: '#141518' } })
  })
  it('falls back to a deterministic mix for any other profile, the eighth agent on, and OpenCode', () => {
    const names = ['opencode', ...Array.from({ length: 30 }, (_, index) => `agent-${index + 8}`)]
    for (const name of names) {
      const look = agentGear(name)
      expect(look).toEqual(agentGear(name))
      expect(look.fallback).toBe(true)
      expect(look.palette.accentGlow).toMatch(/^#[0-9a-f]{6}$/)
    }
    expect(new Set(names.map((name) => agentGear(name).palette.accentGlow)).size).toBeGreaterThan(20)
    // Fallback hues stay clear of the named profiles' colours.
    for (let seed = 0; seed < 500; seed += 1) for (const taken of [40, 49, 203, 0, 147, 39, 271]) {
      const gap = Math.abs(fallbackHue(seed) - taken)
      expect(Math.min(gap, 360 - gap)).toBeGreaterThanOrEqual(18)
    }
  })
  it('builds the automaton with reverse-joint legs, a violet optic and a thruster pack; humans with a head and four limbs', () => {
    const robot = characterParts(agentGear('default'))
    expect(robot.filter((part) => part.bone === 'legL').length).toBeGreaterThanOrEqual(4)
    expect(robot.some((part) => part.bone === 'head' && part.c === '#a855f7')).toBe(true)
    expect(robot.some((part) => part.g === 'tri')).toBe(true)
    const person = characterParts(agentGear('agent-12'))
    for (const bone of ['head', 'armL', 'armR', 'legL', 'legR'] as const) expect(person.some((part) => part.bone === bone)).toBe(true)
  })
  it('has suits for exactly the five vault operatives, none for the steward', () => {
    expect([...VAULT_PROFILES]).toEqual(['bruce', 'barbara', 'dick', 'jason', 'tim'])
    for (const profile of VAULT_PROFILES) expect(suitParts(agentGear(profile)).length).toBeGreaterThan(2)
  })
})
