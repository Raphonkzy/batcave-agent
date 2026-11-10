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
import { Pill, SegmentedControl, Icon, Stat } from '../components/ui/Primitives.tsx'

export type MissionsViewMode = 'swimlane' | 'list' | 'flow'

function getInitialAgent(): string {
  if (typeof window === 'undefined') return 'all'
  const hash = window.location.hash
  const match = hash.match(/[?&]agent=([^&]+)/)
  if (match) return decodeURIComponent(match[1])
  const searchMatch = window.location.search.match(/[?&]agent=([^&]+)/)
  if (searchMatch) return decodeURIComponent(searchMatch[1])
  return 'all'
}

export function Missions({ onNavigate }: { onNavigate?: (page: Page) => void }) {
  const [viewMode, setViewMode] = useState<MissionsViewMode>('swimlane')
  const [selectedAgent, setSelectedAgent] = useState<string>(getInitialAgent)
  const [searchQuery, setSearchQuery] = useState('')

  const board = usePolling<TaskBoardSnapshot>('/api/tasks', 15_000)
  const office = useAgents()

  const isMock = import.meta.env.DEV && typeof window !== 'undefined' && Boolean(parseMockRequest(window.location.search))

  if (board.status === 'pending' && office.status === 'pending') {
    return <LoadingState message="Loading Missions telemetry..." />
  }

  const tasksData =
    board.status === 'ready' && board.data?.tasks?.data?.length
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

  const attributionTier = missionsData.summary.unassigned > 0 ? 'TIER 2' : 'TIER 1'

  return (
    <div className="mo-page-missions">
      <header className="mo-page-header">
        <div className="mo-header-with-actions">
          <div>
            <div className="mo-title-with-pill">
              <h1 className="mo-page-title">Missions</h1>
              {isMock && <Pill variant="accent">SIMULATION</Pill>}
              <Pill variant="muted">{attributionTier} ATTRIBUTION</Pill>
            </div>
            <p className="mo-page-description">
              Real-time relationship mapping between active tasks and executing agents.
            </p>
          </div>

          <SegmentedControl
            options={[
              { label: 'Swimlane', value: 'swimlane' },
              { label: 'List', value: 'list' },
              { label: 'Flow Graph', value: 'flow' },
            ]}
            value={viewMode}
            onChange={(val) => setViewMode(val as MissionsViewMode)}
          />
        </div>
      </header>

      {/* Metrics Row */}
      <div className="mo-metrics-top-row" style={{ marginBottom: 24 }}>
        <div className="mo-stat-card">
          <Stat label="TOTAL MISSIONS" value={missionsData.summary.total} sub="All active tasks" />
        </div>
        <div className="mo-stat-card">
          <Stat label="CONNECTED TO AGENTS" value={missionsData.summary.assigned} sub="Attributed tasks" />
        </div>
        <div className="mo-stat-card">
          <Stat
            label="UNASSIGNED (TIER 2)"
            value={missionsData.summary.unassigned}
            sub="No definitive relation"
          />
        </div>
        <div className="mo-stat-card">
          <Stat
            label="ACTIVE CREW"
            value={missionsData.activeAgents.length}
            sub="Detected agents"
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mo-filter-bar">
        <div className="mo-filter-tally">
          <strong>{filteredMissions.length}</strong> missions displayed
        </div>

        <div className="mo-filter-controls">
          <div className="mo-search-box">
            <Icon name="search" size={16} />
            <input
              type="text"
              placeholder="Search mission title…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mo-search-input"
            />
          </div>

          <label className="mo-select-wrapper">
            <span className="mo-select-label">Agent:</span>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="mo-select-input"
            >
              <option value="all">All Agents</option>
              {missionsData.activeAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* View Content */}
      <div className="mo-missions-content">
        {filteredMissions.length === 0 ? (
          <div className="mo-empty-state mo-panel">
            <p>No active missions match the current filter criteria.</p>
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
