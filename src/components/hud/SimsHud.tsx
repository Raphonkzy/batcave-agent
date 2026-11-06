import type { OfficeStation } from '../../types.ts'
import type { ManorView } from '../../scenes/manor/ZoneLayout.ts'
import { StatusDot, Kbd, Icon } from '../ui/Primitives.tsx'

export interface SimsHudProps {
  selectedStation: OfficeStation | null
  currentView: ManorView
  wallMode: 'wallsUp' | 'cutaway' | 'wallsDown'
  onSelectView: (view: ManorView) => void
  onCycleLevel: (dir: 1 | -1) => void
  onSetWallMode: (mode: 'wallsUp' | 'cutaway' | 'wallsDown') => void
  onSnapRotate: (dir: 1 | -1) => void
  onZoom: (dir: 1 | -1) => void
  onResetCamera: () => void
  onFocusAgent: () => void
  onInspectAgent: () => void
  onFollowAgent: () => void
  onNavigateMissions: () => void
  totalStations: number
  activeCount: number
}

const LEVEL_NAMES: Record<ManorView, string> = {
  exterior: 'Exterior Lot',
  manor: 'Grand Manor',
  lobby: 'Manor Lobby',
  deck: 'Command Deck',
  hangar: 'Hangar Bay',
  overview: 'Full Overview',
}

export function SimsHud({
  selectedStation,
  currentView,
  wallMode,
  onSelectView,
  onCycleLevel,
  onSetWallMode,
  onSnapRotate,
  onZoom,
  onResetCamera,
  onFocusAgent,
  onInspectAgent,
  onFollowAgent,
  onNavigateMissions,
  totalStations,
  activeCount,
}: SimsHudProps) {
  return (
    <div className="mo-sims-hud">
      {/* 1. Left Cluster: Selected Agent Panel */}
      <div className="mo-hud-cluster mo-hud-agent">
        {selectedStation ? (
          <div className="mo-agent-summary">
            <div className="mo-agent-avatar">
              {selectedStation.name.charAt(0).toUpperCase()}
            </div>
            <div className="mo-agent-details">
              <div className="mo-agent-row">
                <span className="mo-agent-name">{selectedStation.name}</span>
                <StatusDot status={selectedStation.state} size={8} />
                <span className="mo-agent-state">{selectedStation.state}</span>
              </div>
              <div className="mo-agent-sub">
                <span>{selectedStation.role || 'Agent'}</span>
                <span>·</span>
                <span>{selectedStation.room || 'Station'}</span>
              </div>
            </div>
            <div className="mo-agent-actions">
              <button type="button" className="mo-hud-btn" onClick={onInspectAgent} title="Lihat detail lengkap agent">
                Inspect
              </button>
              <button type="button" className="mo-hud-btn" onClick={onFollowAgent} title="Ikuti kamera (Follow)">
                Follow
              </button>
              <button type="button" className="mo-hud-btn" onClick={onFocusAgent} title="Fokus kamera (F)">
                Locate
              </button>
              <button type="button" className="mo-hud-btn" onClick={onNavigateMissions} title="Buka Missions terfilter">
                Missions
              </button>
            </div>
          </div>
        ) : (
          <div className="mo-agent-empty">
            <span className="mo-agent-empty-hint">Pilih agent di scene 3D</span>
            <span className="mo-agent-empty-tally">
              {activeCount} aktif · {totalStations - activeCount} idle
            </span>
          </div>
        )}
      </div>

      {/* 2. Center Cluster: Level & Wall Dock */}
      <div className="mo-hud-cluster mo-hud-levels">
        <div className="mo-level-switcher">
          <button
            type="button"
            className="mo-level-btn"
            onClick={() => onCycleLevel(-1)}
            title="Lantai atas ([ / PageUp)"
          >
            <Icon name="chevron-up" size={16} />
          </button>
          <div className="mo-level-label">
            <span className="mo-level-sub">LANTAI</span>
            <span className="mo-level-title">{LEVEL_NAMES[currentView] || currentView}</span>
          </div>
          <button
            type="button"
            className="mo-level-btn"
            onClick={() => onCycleLevel(1)}
            title="Lantai bawah (] / PageDown)"
          >
            <Icon name="chevron-down" size={16} />
          </button>
        </div>

        <div className="mo-hud-divider" />

        <div className="mo-wall-segmented" role="group" aria-label="Mode Dinding">
          <button
            type="button"
            className={`mo-wall-btn ${wallMode === 'wallsUp' ? 'active' : ''}`}
            onClick={() => onSetWallMode('wallsUp')}
            title="Walls Up (1)"
          >
            <span className="mo-wall-icon">▣</span>
            <span>Up</span>
          </button>
          <button
            type="button"
            className={`mo-wall-btn ${wallMode === 'cutaway' ? 'active' : ''}`}
            onClick={() => onSetWallMode('cutaway')}
            title="Cutaway (2)"
          >
            <span className="mo-wall-icon">◐</span>
            <span>Cut</span>
          </button>
          <button
            type="button"
            className={`mo-wall-btn ${wallMode === 'wallsDown' ? 'active' : ''}`}
            onClick={() => onSetWallMode('wallsDown')}
            title="Walls Down (3)"
          >
            <span className="mo-wall-icon">▭</span>
            <span>Down</span>
          </button>
        </div>
      </div>

      {/* 3. Right Cluster: Camera Dock */}
      <div className="mo-hud-cluster mo-hud-camera">
        <div className="mo-camera-buttons">
          <button
            type="button"
            className="mo-camera-icon-btn"
            onClick={() => onSnapRotate(-1)}
            title="Putar 90° Kiri (Q)"
          >
            <Icon name="rotate-left" size={16} />
            <Kbd>Q</Kbd>
          </button>
          <button
            type="button"
            className="mo-camera-icon-btn"
            onClick={() => onSnapRotate(1)}
            title="Putar 90° Kanan (E)"
          >
            <Icon name="rotate-right" size={16} />
            <Kbd>E</Kbd>
          </button>
          <button
            type="button"
            className="mo-camera-icon-btn"
            onClick={() => onZoom(1)}
            title="Perbesar Kamera (+)"
          >
            <Icon name="plus" size={16} />
          </button>
          <button
            type="button"
            className="mo-camera-icon-btn"
            onClick={() => onZoom(-1)}
            title="Perkecil Kamera (-)"
          >
            <Icon name="minus" size={16} />
          </button>
          <button
            type="button"
            className="mo-camera-icon-btn"
            onClick={onResetCamera}
            title="Reset Sudut Kamera (R)"
          >
            <Icon name="home" size={16} />
            <Kbd>R</Kbd>
          </button>
          <button
            type="button"
            className="mo-camera-icon-btn"
            onClick={onFocusAgent}
            title="Fokus Agent Terpilih (F)"
          >
            <Icon name="target" size={16} />
            <Kbd>F</Kbd>
          </button>
        </div>

        <div className="mo-hud-divider" />

        <div className="mo-preset-selector">
          <select
            className="mo-preset-select"
            value={currentView}
            onChange={(e) => onSelectView(e.target.value as ManorView)}
            aria-label="Preset Kamera"
          >
            <option value="exterior">Grounds Exterior</option>
            <option value="manor">Grand Manor</option>
            <option value="lobby">Manor Lobby</option>
            <option value="deck">Command Deck</option>
            <option value="hangar">Hangar Bay</option>
            <option value="overview">Full Overview</option>
          </select>
        </div>
      </div>
    </div>
  )
}
