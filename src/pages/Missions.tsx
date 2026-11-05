import { useState } from 'react'
import { usePolling } from '../polling.ts'
import { useAgents } from '../hooks/useAgents.ts'
import { parseMockRequest } from '../hooks/mockAgents.ts'
import { mockTasks, selectMissions, type MissionItem } from '../utils/missions/selectors.ts'
import { SwimlaneView } from '../components/missions/SwimlaneView.tsx'
import { ListView } from '../components/missions/ListView.tsx'
import { FlowView } from '../components/missions/FlowView.tsx'
import type { TaskBoardSnapshot } from '../types.ts'
import type { Page } from '../routes.ts'
import { LoadingState } from '../ui.tsx'

export type MissionsViewMode = 'swimlane' | 'list' | 'flow'

export function Missions({ onNavigate }: { onNavigate?: (page: Page) => void }) {
  const [viewMode, setViewMode] = useState<MissionsViewMode>('swimlane')
  const [selectedAgent, setSelectedAgent] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const board = usePolling<TaskBoardSnapshot>('/api/tasks', 15_000)
  const office = useAgents()

  const isMock = import.meta.env.DEV && typeof window !== 'undefined' && Boolean(parseMockRequest(window.location.search))

  if (board.status === 'pending' && office.status === 'pending') {
    return <LoadingState message="Loading Tactical Missions telemetry..." />
  }

  const tasksData = (board.status === 'ready' && board.data?.tasks?.data?.length)
    ? board.data
    : isMock
      ? { tasks: { availability: 'available' as const, data: mockTasks() }, fetchedAt: new Date().toISOString() }
      : board.status === 'ready'
        ? board.data
        : undefined

  const missionsData = selectMissions(
    tasksData,
    office.status === 'ready' ? office.data : undefined,
    isMock
  )

  const filteredMissions = missionsData.missions.filter((m) => {
    if (selectedAgent !== 'all' && m.assignee !== selectedAgent) return false
    if (searchQuery && !m.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const locateIn3D = (mission: MissionItem) => {
    if (mission && onNavigate) {
      onNavigate('Batcave')
    }
  }

  return (
    <div className="missions-page">
      <div className="missions-header">
        <div>
          <p className="eyebrow">TACTICAL COMMAND &amp; DISPATCH</p>
          <h1 className="missions-title">Active Missions</h1>
          <p className="missions-subtitle">Real-time task attribution and agent execution telemetry</p>
        </div>
        <div className="missions-controls">
          <div className="missions-view-picker" role="group" aria-label="View Mode">
            <button
              type="button"
              className={viewMode === 'swimlane' ? 'active' : ''}
              onClick={() => setViewMode('swimlane')}
            >
              Swimlane
            </button>
            <button
              type="button"
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
            <button
              type="button"
              className={viewMode === 'flow' ? 'active' : ''}
              onClick={() => setViewMode('flow')}
            >
              Flow
            </button>
          </div>
        </div>
      </div>

      <div className="missions-metrics">
        <div className="metric-card">
          <span className="metric-label">TOTAL MISSIONS</span>
          <strong className="metric-value">{missionsData.summary.total}</strong>
        </div>
        <div className="metric-card">
          <span className="metric-label">ASSIGNED</span>
          <strong className="metric-value text-good">{missionsData.summary.assigned}</strong>
        </div>
        <div className="metric-card">
          <span className="metric-label">UNASSIGNED (TIER 2)</span>
          <strong className="metric-value text-warning">{missionsData.summary.unassigned}</strong>
        </div>
        <div className="metric-card">
          <span className="metric-label">ACTIVE CREW</span>
          <strong className="metric-value">{missionsData.activeAgents.length}</strong>
        </div>
      </div>

      <div className="missions-filters">
        <div className="filter-group">
          <label htmlFor="agent-filter">Agent:</label>
          <select
            id="agent-filter"
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
          >
            <option value="all">All Agents</option>
            {missionsData.activeAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.role})
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group search-group">
          <input
            type="search"
            placeholder="Search missions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search missions by title"
          />
        </div>
      </div>

      <div className="missions-content">
        {filteredMissions.length === 0 ? (
          <div className="empty-state">
            <h2>No active missions found</h2>
            <p>Adjust your filter or search criteria to view operational tasks.</p>
          </div>
        ) : viewMode === 'swimlane' ? (
          <SwimlaneView
            data={{
              ...missionsData,
              missions: filteredMissions,
              byStatus: {
                triage: filteredMissions.filter((m) => m.status === 'triage'),
                todo: filteredMissions.filter((m) => m.status === 'todo'),
                ready: filteredMissions.filter((m) => m.status === 'ready'),
                running: filteredMissions.filter((m) => m.status === 'running'),
                review: filteredMissions.filter((m) => m.status === 'review'),
                blocked: filteredMissions.filter((m) => m.status === 'blocked'),
                done: filteredMissions.filter((m) => m.status === 'done'),
                unassigned: filteredMissions.filter((m) => !m.isAssigned),
              },
            }}
            onLocate={locateIn3D}
          />
        ) : viewMode === 'flow' ? (
          <FlowView
            data={{
              ...missionsData,
              missions: filteredMissions,
            }}
            onLocate={locateIn3D}
          />
        ) : (
          <ListView
            data={{
              ...missionsData,
              missions: filteredMissions,
            }}
            onLocate={locateIn3D}
          />
        )}
      </div>
    </div>
  )
}
