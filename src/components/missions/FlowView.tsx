import { useMemo, useRef, useState, useEffect } from 'react'
import type { MissionItem, MissionsData } from '../../utils/missions/selectors.ts'

export interface FlowViewProps {
  data: MissionsData
  onLocate: (mission: MissionItem) => void
}

interface Connection {
  agentId: string
  missionId: string
  y1: number
  y2: number
}

export function FlowView({ data, onLocate }: FlowViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const agentRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const missionRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [connections, setConnections] = useState<Connection[]>([])

  const assignedMissions = useMemo(() => data.missions.filter((m) => m.isAssigned && m.agent), [data.missions])
  const unassignedMissions = useMemo(() => data.missions.filter((m) => !m.isAssigned), [data.missions])

  // Extract unique agents who have assigned missions
  const activeAssignedAgents = useMemo(() => {
    const ids = new Set(assignedMissions.map((m) => m.assignee!))
    return data.activeAgents.filter((a) => ids.has(a.id.toLowerCase()))
  }, [assignedMissions, data.activeAgents])

  // Compute connection bezier points relative to container
  useEffect(() => {
    const updateLines = () => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const list: Connection[] = []

      assignedMissions.forEach((m) => {
        const agentEl = agentRefs.current.get(m.assignee!)
        const missionEl = missionRefs.current.get(m.id)
        if (agentEl && missionEl) {
          const aRect = agentEl.getBoundingClientRect()
          const mRect = missionEl.getBoundingClientRect()
          const y1 = aRect.top + aRect.height / 2 - containerRect.top
          const y2 = mRect.top + mRect.height / 2 - containerRect.top
          list.push({
            agentId: m.assignee!,
            missionId: m.id,
            y1,
            y2,
          })
        }
      })
      setConnections(list)
    }

    const timer = setTimeout(updateLines, 100)
    window.addEventListener('resize', updateLines)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateLines)
    }
  }, [assignedMissions, activeAssignedAgents])

  return (
    <div className="missions-flow-view" ref={containerRef}>
      <div className="flow-columns-wrapper">
        {/* Left Column: Active Agents */}
        <div className="flow-column agents-column">
          <div className="flow-column-header">
            <h3>DISPATCHED AGENTS</h3>
            <span className="badge muted">{activeAssignedAgents.length}</span>
          </div>
          <div className="flow-nodes">
            {activeAssignedAgents.map((agent) => (
              <div
                key={agent.id}
                ref={(el) => {
                  if (el) agentRefs.current.set(agent.id.toLowerCase(), el)
                  else agentRefs.current.delete(agent.id.toLowerCase())
                }}
                className="agent-flow-node"
              >
                <div className="agent-flow-head">
                  <span className="dot" />
                  <strong>{agent.name}</strong>
                </div>
                <span className="agent-flow-role">{agent.role}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center: SVG Bezier Connections */}
        <div className="flow-svg-container">
          <svg className="flow-svg" aria-hidden="true">
            <defs>
              <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#4fb986" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#f2c58a" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            {connections.map((c, i) => {
              const x1 = 0
              const x2 = 140
              const dx = (x2 - x1) * 0.5
              const d = `M ${x1} ${c.y1} C ${x1 + dx} ${c.y1}, ${x2 - dx} ${c.y2}, ${x2} ${c.y2}`
              return (
                <path
                  key={`${c.agentId}-${c.missionId}-${i}`}
                  d={d}
                  fill="none"
                  stroke="url(#flowGradient)"
                  strokeWidth="2.5"
                  className="flow-path"
                />
              )
            })}
          </svg>
        </div>

        {/* Right Column: Assigned Missions */}
        <div className="flow-column missions-column">
          <div className="flow-column-header">
            <h3>IN-FLIGHT MISSIONS</h3>
            <span className="badge muted">{assignedMissions.length}</span>
          </div>
          <div className="flow-nodes">
            {assignedMissions.map((mission) => (
              <div
                key={mission.id}
                ref={(el) => {
                  if (el) missionRefs.current.set(mission.id, el)
                  else missionRefs.current.delete(mission.id)
                }}
                className="mission-flow-node"
              >
                <div className="flow-card-top">
                  <span className="mission-id">{mission.id}</span>
                  <span className={`badge priority-badge p${mission.priority}`}>P{mission.priority}</span>
                </div>
                <h4 className="flow-card-title">{mission.title}</h4>
                <div className="flow-card-footer">
                  <span className={`badge status-${mission.status}`}>{mission.status.toUpperCase()}</span>
                  <button
                    type="button"
                    className="locate-btn"
                    onClick={() => onLocate(mission)}
                    title="Locate agent in 3D Batcave"
                  >
                    Locate ↗
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Unassigned Tasks in Separate Cluster */}
      {unassignedMissions.length > 0 && (
        <div className="flow-unassigned-cluster">
          <div className="unassigned-header">
            <h3>UNLINKED MISSIONS (UNASSIGNED TIER 2)</h3>
            <span className="badge muted">{unassignedMissions.length}</span>
          </div>
          <div className="unassigned-cards">
            {unassignedMissions.map((mission) => (
              <div key={mission.id} className="mission-flow-node unassigned-flow-node">
                <div className="flow-card-top">
                  <span className="mission-id">{mission.id}</span>
                  <span className={`badge priority-badge p${mission.priority}`}>P{mission.priority}</span>
                </div>
                <h4 className="flow-card-title">{mission.title}</h4>
                <div className="flow-card-footer">
                  <span className={`badge status-${mission.status}`}>{mission.status.toUpperCase()}</span>
                  <span className="text-muted unassigned-tag">Awaiting Dispatch</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
