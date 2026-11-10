import fs from 'node:fs'
import path from 'node:path'
import { computeLayout } from '../../src/utils/layout/computeLayout.ts'
import { mockStations } from '../../src/hooks/mockAgents.ts'
import { placementFor, idlePlan, isBriefing, type Placement } from '../../src/utils/layout/placements.ts'
import type { OfficeStation, OfficeState, MockOnlyState } from '../../src/types.ts'

export interface AgentMappingEntry {
  id: string
  seat: number
  state: OfficeState | MockOnlyState
  room: string
  kind: string
  zone: string
  stopId: string
  seated: boolean
  pose?: string
}

export interface ZoneCapacity {
  zone: string
  level: string
  kind: string
  stopCount: number
  stopsByKind: Record<string, number>
}

export interface MappingRun {
  agentCount: number
  mode: string
  agents: AgentMappingEntry[]
  zoneCapacities: ZoneCapacity[]
}

export function computeMapping(agentCount: number, stateOverride?: OfficeState | MockOnlyState): MappingRun {
  const layout = computeLayout(agentCount)
  const stations: OfficeStation[] = mockStations(agentCount).map((s) => {
    if (stateOverride) {
      const isIdle = stateOverride === 'Idle'
      return {
        ...s,
        state: stateOverride,
        room: isIdle ? 'Lounge' : 'Workspace',
        roomPosition: stateOverride === 'Collaborating' ? 'meeting-area' : isIdle ? 'lounge' : 'desk',
      }
    }
    return s
  })

  const now = 100_000 // fixed deterministic timestamp
  const idleSeats = stations.filter((station) => station.state === 'Idle' && station.room === 'Lounge').map((station) => station.seat)
  const rest = idlePlan(layout, idleSeats, now, [])

  let briefingIndex = 0
  const placements: Placement[] = stations.map((station) =>
    rest.get(station.seat)?.placement && station.state === 'Idle' && station.room === 'Lounge'
      ? rest.get(station.seat)!.placement
      : placementFor(station, layout, now, isBriefing(station) ? briefingIndex++ : 0)
  )

  const stopMap = new Map(layout.paths.stops.map((stop) => [`${stop.x.toFixed(2)},${stop.y.toFixed(2)},${stop.z.toFixed(2)}`, stop]))

  const agents: AgentMappingEntry[] = stations.map((station, index) => {
    const pl = placements[index]
    const key = `${pl.position[0].toFixed(2)},${pl.position[1].toFixed(2)},${pl.position[2].toFixed(2)}`
    let stop = stopMap.get(key)
    if (!stop) {
      // Find nearest stop if exact match not found
      let minDist = Number.POSITIVE_INFINITY
      for (const s of layout.paths.stops) {
        const d = Math.hypot(s.x - pl.position[0], s.y - pl.position[1], s.z - pl.position[2])
        if (d < minDist) {
          minDist = d
          stop = s
        }
      }
    }

    return {
      id: station.id,
      seat: station.seat,
      state: station.state,
      room: station.room,
      kind: pl.kind,
      zone: stop?.zone ?? 'unknown',
      stopId: stop?.id ?? 'unknown',
      seated: pl.seated,
      ...(pl.pose ? { pose: pl.pose } : {}),
    }
  })

  // Capacities
  const zoneCapacities: ZoneCapacity[] = layout.zoneList.map((z) => {
    const stopsInZone = layout.paths.stops.filter((s) => s.zone === z.id)
    const byKind: Record<string, number> = {}
    for (const s of stopsInZone) {
      byKind[s.kind] = (byKind[s.kind] ?? 0) + 1
    }
    return {
      zone: z.id,
      level: z.level,
      kind: z.kind,
      stopCount: stopsInZone.length,
      stopsByKind: byKind,
    }
  })

  return {
    agentCount,
    mode: stateOverride ? `single-${stateOverride}` : 'deterministic-mix',
    agents,
    zoneCapacities,
  }
}

export function generateAllMappings(): MappingRun[] {
  const runs: MappingRun[] = []
  // Deterministic mix for N = 0 to 45
  for (let n = 0; n <= 45; n += 1) {
    runs.push(computeMapping(n))
  }
  // Single states for sample counts (e.g. N = 1, 6, 12, 24, 40)
  const singleStates: (OfficeState | MockOnlyState)[] = [
    'Idle',
    'Working',
    'Reviewing',
    'Collaborating',
    'Offline',
    'Unknown',
    'Deploying',
    'Triage',
    'Researching',
    'Cron',
  ]
  for (const st of singleStates) {
    for (const n of [1, 6, 12, 24, 40]) {
      runs.push(computeMapping(n, st))
    }
  }
  return runs
}

if (import.meta.url.endsWith(process.argv[1])) {
  const root = process.cwd()
  const outPath = path.join(root, 'docs/batcave-redesign/BASELINE/mapping.golden.json')
  const data = generateAllMappings()
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8')
  console.log(`Saved golden mapping with ${data.length} runs to ${outPath}`)
}
