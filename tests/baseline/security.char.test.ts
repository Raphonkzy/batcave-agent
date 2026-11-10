import { describe, expect, it } from 'vitest'
import { redactOffice, redactTasks, PRIVATE_TASK } from '../../server/privacy.ts'
import type { OfficeSnapshot, TaskBoardSnapshot } from '../../server/mission-control.ts'
import type { Privacy } from '../../server/profile-lock.ts'

describe('security characterization tests', () => {
  it('correctly withholds and redacts private task details when agent is locked', () => {
    const privacy: Privacy = {
      all: false,
      hidden: new Set(['coder']),
      locked: new Set(['coder']),
    }
    const board: TaskBoardSnapshot = {
      tasks: {
        availability: 'available',
        data: [
          { id: '1', title: 'Classified task', assignee: 'coder', status: 'running' },
          { id: '2', title: 'Public task', assignee: 'bruce', status: 'running' },
        ],
      },
      fetchedAt: '2026-11-05T00:00:00Z',
    }

    const redacted = redactTasks(board, privacy)
    expect(redacted.tasks.data[0].title).toBe(PRIVATE_TASK)
    expect(redacted.tasks.data[0].private).toBe(true)
    expect(redacted.tasks.data[1].title).toBe('Public task')
    expect(redacted.tasks.data[1].private).toBeUndefined()
  })

  it('redacts office stations for hidden agents', () => {
    const privacy: Privacy = {
      all: false,
      hidden: new Set(['agent-x']),
      locked: new Set(['agent-x']),
    }
    const office: OfficeSnapshot = {
      stations: [
        {
          id: 'agent-x',
          name: 'agent-x',
          role: 'specialist',
          room: 'Workspace',
          roomPosition: 'desk',
          state: 'Working',
          currentTask: 'Top Secret Research',
          recentActivity: 'Analyzing payloads',
          activity: 'Kanban: Top Secret Research',
          seat: 1,
          provenance: 'hermes profile',
          freshness: 'fresh',
        },
      ],
      summary: {
        declared: 1,
        active: 1,
        idle: 0,
        offline: 0,
        unknown: 0,
        gatewaysReachable: 1,
        gatewaysDeclared: 1,
      },
      fetchedAt: '2026-11-05T00:00:00Z',
    }

    const redacted = redactOffice(office, privacy)
    expect(redacted.stations[0].privacy).toBe('locked')
    expect(redacted.stations[0].currentTask).toBe('🔒 Private')
    expect(redacted.stations[0].provenance).toBe('🔒 Private (profile lock)')
  })
})
