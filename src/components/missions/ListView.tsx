import type { MissionItem, MissionsData } from '../../utils/missions/selectors.ts'

export interface ListViewProps {
  data: MissionsData
  onLocate: (mission: MissionItem) => void
}

export function ListView({ data, onLocate }: ListViewProps) {
  return (
    <div className="missions-list-view">
      <div className="missions-list-table">
        <div className="table-header">
          <span>ID</span>
          <span>PRIORITY</span>
          <span>MISSION TITLE</span>
          <span>ASSIGNED AGENT</span>
          <span>STATUS</span>
          <span>ACTION</span>
        </div>
        {data.missions.map((mission) => (
          <div key={mission.id} className="table-row">
            <span className="mission-id">{mission.id}</span>
            <span className={`badge priority-badge p${mission.priority}`}>P{mission.priority}</span>
            <span className="mission-title-col">
              <strong>{mission.title}</strong>
              {mission.isPrivate && <span className="badge muted">🔒 Private</span>}
            </span>
            <span className="mission-assignee-col">
              {mission.agent ? (
                <span className="agent-tag">
                  <span className="dot" /> {mission.agent.name}
                </span>
              ) : (
                <span className="text-muted">Unassigned</span>
              )}
            </span>
            <span>
              <span className={`badge status-${mission.status}`}>{mission.status.toUpperCase()}</span>
            </span>
            <span>
              <button
                type="button"
                className="locate-btn"
                onClick={() => onLocate(mission)}
                title="Locate agent in 3D Batcave"
              >
                Locate in 3D ↗
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
