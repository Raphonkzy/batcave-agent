import { describe, expect, it } from 'vitest'
import { selectMissions, mockTasks, normalizeStatus } from '../src/utils/missions/selectors.ts'
import type { TaskBoardSnapshot, OfficeSnapshot } from '../src/types.ts'

describe('Missions selectors & data attribution tests', () => {
  it('correctly normalizes varied status strings', () => {
    expect(normalizeStatus('running')).toBe('running')
    expect(normalizeStatus('in-progress')).toBe('running')
    expect(normalizeStatus('review')).toBe('review')
    expect(normalizeStatus('backlog')).toBe('triage')
    expect(normalizeStatus('completed')).toBe('done')
    expect(normalizeStatus('blocked')).toBe('blocked')
    expect(normalizeStatus('unknown-status')).toBe('todo')
  })

  it('accurately attributes tasks with valid assignee without guessing unassigned ones', () => {
    const tasks = mockTasks()
    const board: TaskBoardSnapshot = {
      tasks: { availability: 'available', data: tasks },
      fetchedAt: '2026-11-05T00:00:00Z',
    }
    const office: OfficeSnapshot = {
      stations: [
        { id: 'bruce', name: 'Bruce', role: 'Tactical Commander', room: 'Workspace', roomPosition: 'command', state: 'Triage', currentTask: '', recentActivity: '', activity: '', seat: 1, provenance: 'mock', freshness: 'mock' },
        { id: 'barbara', name: 'Barbara', role: 'Lead Engineer', room: 'Workspace', roomPosition: 'rig', state: 'Working', currentTask: '', recentActivity: '', activity: '', seat: 2, provenance: 'mock', freshness: 'mock' },
      ],
      summary: { declared: 2, active: 2, idle: 0, offline: 0, unknown: 0, gatewaysReachable: 2, gatewaysDeclared: 2 },
      fetchedAt: '2026-11-05T00:00:00Z',
    }

    const data = selectMissions(board, office)
    expect(data.missions.length).toBe(tasks.length)

    // Check Bruce's assigned mission
    const bruceMission = data.missions.find((m) => m.id === 'm-01')
    expect(bruceMission?.isAssigned).toBe(true)
    expect(bruceMission?.assignee).toBe('bruce')
    expect(bruceMission?.agent?.name).toBe('Bruce')

    // Check unassigned tasks
    const unassignedMission = data.missions.find((m) => m.id === 'm-07')
    expect(unassignedMission?.isAssigned).toBe(false)
    expect(unassignedMission?.assignee).toBeUndefined()
    expect(unassignedMission?.agent).toBeUndefined()

    // Check unassigned list in byStatus
    expect(data.byStatus.unassigned.length).toBe(data.summary.unassigned)
    expect(data.byStatus.unassigned.every((m) => !m.isAssigned)).toBe(true)
  })
})
