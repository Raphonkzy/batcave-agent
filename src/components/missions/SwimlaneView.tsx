import type { MissionItem, MissionsData } from '../../utils/missions/selectors.ts'

export interface SwimlaneViewProps {
  data: MissionsData
  onLocate: (mission: MissionItem) => void
}

export function SwimlaneView({ data, onLocate }: SwimlaneViewProps) {
  const lanes = [
    { id: 'todo', title: 'TRIAGE & TODO', items: [...data.byStatus.triage, ...data.byStatus.todo, ...data.byStatus.ready] },
    { id: 'running', title: 'IN PROGRESS', items: data.byStatus.running },
    { id: 'review', title: 'IN REVIEW', items: data.byStatus.review },
    { id: 'done', title: 'COMPLETED', items: data.byStatus.done },
    ...(data.byStatus.blocked.length > 0
      ? [{ id: 'blocked', title: 'BLOCKED', items: data.byStatus.blocked }]
      : []),
  ]

  const renderCard = (mission: MissionItem) => (
    <article key={mission.id} className="swimlane-card">
      <div className="card-top">
        <span className="mission-id">{mission.id}</span>
        <span className={`badge priority-badge p${mission.priority}`}>P{mission.priority}</span>
      </div>
      <h3 className="card-title">{mission.title}</h3>
      <div className="card-footer">
        {mission.agent ? (
          <div className="card-assignee">
            <span className="dot" />
            <span>{mission.agent.name}</span>
          </div>
        ) : (
          <span className="text-muted unassigned-tag">Unassigned</span>
        )}
        <button
          type="button"
          className="locate-btn"
          onClick={() => onLocate(mission)}
          title="Locate agent in 3D Batcave"
        >
          Locate ↗
        </button>
      </div>
    </article>
  )

  return (
    <div className="missions-swimlane">
      <div className="swimlane-grid">
        {lanes.map((lane) => (
          <div key={lane.id} className="swimlane-column">
            <div className="column-header">
              <h3>{lane.title}</h3>
              <span className="badge muted">{lane.items.length}</span>
            </div>
            <div className="column-cards">
              {lane.items.length === 0 ? (
                <div className="empty-lane">No missions in this lane</div>
              ) : (
                lane.items.map(renderCard)
              )}
            </div>
          </div>
        ))}
      </div>

      {data.byStatus.unassigned.length > 0 && (
        <section className="unassigned-section">
          <div className="unassigned-header">
            <div>
              <h3>UNASSIGNED MISSIONS (TIER 2 PARTIAL ATTRIBUTION)</h3>
              <p>Missions awaiting agent dispatch or lacking explicit Hermes assignee attribution.</p>
            </div>
            <span className="badge muted">{data.byStatus.unassigned.length}</span>
          </div>
          <div className="unassigned-cards">
            {data.byStatus.unassigned.map(renderCard)}
          </div>
        </section>
      )}
    </div>
  )
}
