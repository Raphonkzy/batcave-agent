import type { OfficeStation } from '../../types.ts'
import type { ManorLayoutData, Stop, Vec3 } from './types.ts'
// Where each agent is: its role's workstation while busy, its own desk otherwise, the war table
// for briefings, the manor while idle, and its own suite to sleep. Only the station's id, seat,
// room and state are read; never any task, log, session or memory text.
export interface Placement { position: Vec3; facing: number; seated: boolean; pose?: 'lie'; height?: number; label?: string; kind: string }
type StationLike = Pick<OfficeStation, 'id' | 'seat' | 'state' | 'room' | 'roomPosition'>
const BUSY = new Set(['Working', 'Reviewing', 'Deploying', 'Triage', 'Researching', 'Cron', 'Collaborating'])
const SEATED_WORK = new Set(['Working', 'Reviewing', 'Deploying', 'Researching', 'Cron'])
/** English labels for what an agent is doing at a stop (shown in its 2D tag). */
export const STOP_LABELS: Record<string, string> = {
  sofa: 'Relaxing by the hearth', club: 'Reading by the radio', billiards: 'Playing billiards', reading: 'Reading in the library',
  dining: 'Dining in the hall', pantryBar: 'Coffee in the pantry', lounger: 'Sunning on the terrace', poolside: 'By the infinity pool',
  suiteDesk: 'Writing in their suite', bed: 'Sleeping in their suite', patrol: 'Patrolling the deck', sentry: 'Standing sentry in the hangar',
  gym: 'Working out in the gym', lobby: 'Chatting in the lobby',
}
const LIE: Record<string, number> = { bed: 0.62, lounger: 0.4 }
function at(stop: Stop, seated = stop.seated ?? false): Placement {
  const lie = LIE[stop.kind]
  return { position: [stop.x, stop.y, stop.z], facing: stop.facing, seated: lie === undefined && seated, ...(lie !== undefined ? { pose: 'lie' as const, height: lie } : {}), kind: stop.kind, ...(STOP_LABELS[stop.kind] ? { label: STOP_LABELS[stop.kind] } : {}) }
}
const stops = (layout: ManorLayoutData, kind: string, filter: (stop: Stop) => boolean = () => true) => layout.paths.stops.filter((stop) => stop.kind === kind && filter(stop))
const forProfile = (layout: ManorLayoutData, kind: string, profile: string) => stops(layout, kind, (stop) => stop.profile === profile)[0]
const owned = (layout: ManorLayoutData, kind: string, seat: number) => {
  const list = stops(layout, kind)
  return list.find((stop) => stop.owner === (Math.max(seat, 1) - 1) % list.length) ?? list[0]
}
/** The automaton walks its patrol, one point every 20 seconds. */
export const PATROL_MS = 20_000
/** The steward alternates between the deck's utility sub-station and the pantry, a minute each. */
export const STEWARD_MS = 64_000
/** A busy agent's place: the role station for named profiles, otherwise its own desk. */
function busyPlacement(station: StationLike, layout: ManorLayoutData, time: number, briefingIndex: number): Placement {
  const id = station.id.toLowerCase()
  if (station.state === 'Collaborating' || (station.state === 'Triage' && id !== 'bruce')) {
    const ring = stops(layout, 'warRing')
    return at(ring[briefingIndex % ring.length])
  }
  switch (id) {
    case 'bruce': return at(forProfile(layout, 'warCommand', 'bruce'))
    case 'barbara': return at(forProfile(layout, 'devRig', 'barbara'), true)
    case 'dick': return at(forProfile(layout, 'catwalk', 'dick'))
    case 'jason': return at(forProfile(layout, station.state === 'Deploying' ? 'workbench' : 'serverTerminal', 'jason'))
    case 'tim': return station.state === 'Researching' ? at(forProfile(layout, 'studyDesk', 'tim'), true) : at(forProfile(layout, 'forensics', 'tim'))
    case 'alfred': return Math.floor(time / STEWARD_MS) % 2 === 0 ? at(forProfile(layout, 'utility', 'alfred')) : at(forProfile(layout, 'pantry', 'alfred'))
    case 'default': return at(forProfile(layout, 'warSync', 'default'))
    default: return at(owned(layout, 'desk', station.seat), SEATED_WORK.has(station.state))
  }
}
export function placementFor(station: StationLike, layout: ManorLayoutData, time = 0, briefingIndex = 0): Placement {
  const id = station.id.toLowerCase()
  if (id === 'default' && !BUSY.has(station.state)) {
    if (station.state === 'Idle') {
      const patrol = stops(layout, 'patrol')
      return at(patrol[Math.floor(time / PATROL_MS) % patrol.length])
    }
    return at(forProfile(layout, 'sentry', 'default'))
  }
  if (BUSY.has(station.state)) return busyPlacement(station, layout, time, briefingIndex)
  // Offline, Unknown, or Idle without a lounge placement: standing by its own desk.
  return at(owned(layout, 'desk', station.seat), false)
}

/** Time an idle agent spends at one stop, walking included. */
export const IDLE_STOP_MS = 32_000
/** The manor is for rest: idle agents wander between these, in this order. */
export const IDLE_ROUTE = ['sofa', 'lobby', 'billiards', 'reading', 'pantryBar', 'lounger', 'gym', 'dining', 'poolside', 'club', 'sofa', 'suiteDesk', 'reading', 'lobby', 'lounger', 'gym']
export interface IdleAssignment { kind: string; placement: Placement }
/**
 * Where each idle agent is at a given time. Deterministic: only the clock and the seats matter.
 * Each seat starts at a different point of the route; an agent whose stop is full moves on, so no
 * two share a spot while free ones remain. Suite stops are the agent's own. `sleepers` go to bed.
 */
export function idlePlan(layout: ManorLayoutData, seats: number[], time: number, sleepers: number[] = []): Map<number, IdleAssignment> {
  const plan = new Map<number, IdleAssignment>()
  const taken = new Map<string, number>()
  const step = Math.floor(time / IDLE_STOP_MS)
  for (const seat of sleepers) plan.set(seat, { kind: 'bed', placement: at(owned(layout, 'bed', seat)) })
  for (const seat of [...seats].filter((item) => !plan.has(item)).sort((a, b) => a - b)) {
    const start = step + (Math.max(seat, 1) - 1) * 3
    let chosen: IdleAssignment | undefined
    for (let offset = 0; offset < IDLE_ROUTE.length && !chosen; offset += 1) {
      const kind = IDLE_ROUTE[(start + offset) % IDLE_ROUTE.length]
      if (kind === 'suiteDesk') { chosen = { kind, placement: at(owned(layout, 'suiteDesk', seat)) }; break }
      const spots = stops(layout, kind)
      const used = taken.get(kind) ?? 0
      if (used < spots.length) { taken.set(kind, used + 1); chosen = { kind, placement: at(spots[used]) } }
    }
    plan.set(seat, chosen ?? { kind: 'suiteDesk', placement: at(owned(layout, 'suiteDesk', seat)) })
  }
  return plan
}
/** True while an agent counts as briefing at the war table (its projection turns amber). */
export const isBriefing = (station: Pick<OfficeStation, 'state'>) => station.state === 'Collaborating' || station.state === 'Triage'
