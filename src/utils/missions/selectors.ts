import type { OfficeSnapshot, OfficeStation, Task, TaskBoardSnapshot } from '../../types.ts'

export type StandardMissionStatus = 'triage' | 'todo' | 'ready' | 'running' | 'review' | 'blocked' | 'done'

export interface MissionItem {
  id: string
  title: string
  status: StandardMissionStatus
  rawStatus: string
  priority: number
  assignee?: string
  agent?: OfficeStation
  isAssigned: boolean
  board: string
  isPrivate: boolean
  isSimulated?: boolean
}

export interface MissionsByStatus {
  triage: MissionItem[]
  todo: MissionItem[]
  ready: MissionItem[]
  running: MissionItem[]
  review: MissionItem[]
  blocked: MissionItem[]
  done: MissionItem[]
  unassigned: MissionItem[]
}

export interface MissionsSummary {
  total: number
  assigned: number
  unassigned: number
  byStatus: Record<StandardMissionStatus, number>
}

export interface MissionsData {
  missions: MissionItem[]
  byStatus: MissionsByStatus
  summary: MissionsSummary
  activeAgents: OfficeStation[]
}

export function normalizeStatus(raw: string): StandardMissionStatus {
  const s = raw.toLowerCase().trim()
  if (s === 'triage' || s === 'backlog') return 'triage'
  if (s === 'todo' || s === 'open') return 'todo'
  if (s === 'ready') return 'ready'
  if (s === 'running' || s === 'in-progress' || s === 'working') return 'running'
  if (s === 'review' || s === 'reviewing') return 'review'
  if (s === 'blocked') return 'blocked'
  if (s === 'done' || s === 'completed' || s === 'closed') return 'done'
  return 'todo'
}

export function selectMissions(
  boardSnapshot: TaskBoardSnapshot | undefined,
  officeSnapshot: OfficeSnapshot | undefined,
  isSimulated = false
): MissionsData {
  const tasks: Task[] = boardSnapshot?.tasks?.data ?? []
  const stations: OfficeStation[] = officeSnapshot?.stations ?? []
  const stationMap = new Map(stations.map((s) => [s.id.toLowerCase(), s]))

  const missions: MissionItem[] = tasks.map((t, index) => {
    const rawStatus = t.status || 'todo'
    const status = normalizeStatus(rawStatus)
    const assignee = t.assignee ? t.assignee.trim().toLowerCase() : undefined
    const agent = assignee ? stationMap.get(assignee) : undefined
    const isAssigned = Boolean(assignee)

    return {
      id: t.id ?? `task-${index}-${t.title.slice(0, 10)}`,
      title: t.title,
      status,
      rawStatus,
      priority: t.priority ?? 2,
      assignee,
      agent,
      isAssigned,
      board: t.board ?? 'default',
      isPrivate: Boolean(t.private),
      isSimulated,
    }
  })

  const byStatus: MissionsByStatus = {
    triage: [],
    todo: [],
    ready: [],
    running: [],
    review: [],
    blocked: [],
    done: [],
    unassigned: [],
  }

  const statusCounts: Record<StandardMissionStatus, number> = {
    triage: 0,
    todo: 0,
    ready: 0,
    running: 0,
    review: 0,
    blocked: 0,
    done: 0,
  }

  let assignedCount = 0
  let unassignedCount = 0

  for (const m of missions) {
    statusCounts[m.status] += 1
    byStatus[m.status].push(m)
    if (m.isAssigned) {
      assignedCount += 1
    } else {
      unassignedCount += 1
      byStatus.unassigned.push(m)
    }
  }

  const activeAgents = stations.filter((s) => s.state !== 'Offline' && s.state !== 'Unknown')

  return {
    missions,
    byStatus,
    summary: {
      total: missions.length,
      assigned: assignedCount,
      unassigned: unassignedCount,
      byStatus: statusCounts,
    },
    activeAgents,
  }
}

/** Mock tasks for development & preview (?mockAgents=N) */
export function mockTasks(): Task[] {
  return [
    { id: 'm-01', title: 'Tactical Perimeter & Intruder Countermeasures', status: 'running', assignee: 'bruce', priority: 1, board: 'tactical' },
    { id: 'm-02', title: 'Batcomputer Core Shader & UI Engine Overhaul', status: 'running', assignee: 'barbara', priority: 1, board: 'engineering' },
    { id: 'm-03', title: 'Hangar Fleet Telemetry & Jet Avionics Diagnostics', status: 'review', assignee: 'dick', priority: 2, board: 'operations' },
    { id: 'm-04', title: 'CI/CD Pipeline Hardening & Container Hygiene', status: 'running', assignee: 'jason', priority: 1, board: 'infra' },
    { id: 'm-05', title: 'Cryptographic Forensics & Architectural Layout Analysis', status: 'running', assignee: 'tim', priority: 2, board: 'research' },
    { id: 'm-06', title: 'Tactical Manor Vault Hygiene & Routine Server Backup', status: 'running', assignee: 'alfred', priority: 3, board: 'stewardship' },
    { id: 'm-07', title: 'Investigate Subterranean River Flow Anomalies', status: 'todo', priority: 3, board: 'tactical' },
    { id: 'm-08', title: 'Update Defensive Satellite Uplink & Ground Radar', status: 'blocked', priority: 2, board: 'engineering' },
    { id: 'm-09', title: 'Audit Auxiliary Battery Storage in Hangar Sub-Level', status: 'ready', priority: 2, board: 'infra' },
    { id: 'm-10', title: 'Re-index Batcave Archive & Historical Cold Case Logs', status: 'done', assignee: 'tim', priority: 3, board: 'research' },
  ]
}
