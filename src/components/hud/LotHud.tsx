import { useState } from 'react'
import type { OfficeStation } from '../../types.ts'
import type { Level, WallMode } from '../../scenes/manor/ZoneLayout.ts'
import { StatusDot, Kbd, Icon } from '../ui/Primitives.tsx'

export interface LotHudProps {
  stations: OfficeStation[]
  selectedStation: OfficeStation | null
  currentLevel: Level
  wallMode: WallMode
  onSelectLevel: (level: Level) => void
  onCycleLevel: (dir: 1 | -1) => void
  onSetWallMode: (mode: WallMode) => void
  onSnapRotate: (dir: 1 | -1) => void
  onZoom: (dir: 1 | -1) => void
  onResetCamera: () => void
  onFocusAgent: () => void
  onInspectAgent: () => void
  onFollowAgent: () => void
  isFollowing?: boolean
  onSelectStation: (station: OfficeStation) => void
  onFocusZone?: (zone: 'hangar' | 'lobby' | 'exterior') => void
  onNavigateMissions: () => void
  onNavigateLogs: () => void
}

const LEVEL_CONFIG: { id: Level; label: string }[] = [
  { id: 'upper', label: 'Lantai 2' },
  { id: 'ground', label: 'Grand Manor' },
  { id: 'deck', label: 'Command Deck' },
]

export function LotHud({
  stations,
  selectedStation,
  currentLevel,
  wallMode,
  onSelectLevel,
  onCycleLevel,
  onSetWallMode,
  onSnapRotate,
  onZoom,
  onResetCamera,
  onFocusAgent,
  onInspectAgent,
  onFollowAgent,
  isFollowing = false,
  onSelectStation,
  onFocusZone,
  onNavigateMissions,
  onNavigateLogs,
}: LotHudProps) {
  const [focusOpen, setFocusOpen] = useState(false)

  // Agent counts per level
  const counts: Record<Level, number> = {
    deck: stations.filter((s) => s.room === 'Workspace' || !s.room).length,
    ground: stations.filter((s) => s.room === 'Lounge').length,
    upper: 0,
  }

  const activeCount = stations.filter((s) => s.state !== 'Idle').length

  return (
    <div className="mo-lot-hud" role="region" aria-label="Kontrol 3D Manor">
      {/* 1. Left Cluster: Roster + Selected Agent Panel */}
      <div className="mo-hud-cluster mo-hud-agent">
        {/* Roster strip at top */}
        <div className="mo-hud-roster" role="list" aria-label="Daftar Agent">
          {stations.map((station) => {
            const isSel = selectedStation?.id === station.id
            return (
              <button
                key={station.id}
                type="button"
                className={`mo-roster-pill ${isSel ? 'active' : ''}`}
                onClick={() => onSelectStation(station)}
                title={`${station.name} (${station.state})`}
                aria-label={`Pilih agent ${station.name}`}
              >
                <span className="mo-roster-avatar">{station.name.charAt(0).toUpperCase()}</span>
                <StatusDot status={station.state} size={6} />
              </button>
            )
          })}
        </div>

        {/* Selected Agent Summary */}
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
                {selectedStation.privacy === 'locked' && (
                  <span className="mo-pill mo-pill-muted">🔒 Terkunci</span>
                )}
              </div>
              <div className="mo-agent-sub">
                <span className="text-muted">{selectedStation.role || 'Agent'}</span>
                <span>·</span>
                <span className="text-muted">{selectedStation.room || 'Station'}</span>
                {selectedStation.currentTask && (
                  <>
                    <span>·</span>
                    <span className="mo-agent-task font-mono" title={selectedStation.currentTask}>
                      {selectedStation.currentTask}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="mo-agent-actions">
              <button
                type="button"
                className="mo-hud-btn"
                onClick={onInspectAgent}
                title="Lihat detail lengkap agent"
              >
                Inspect
              </button>
              <button
                type="button"
                className={`mo-hud-btn ${isFollowing ? 'active' : ''}`}
                onClick={onFollowAgent}
                title="Ikuti agent di scene 3D (Esc untuk lepas)"
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button
                type="button"
                className="mo-hud-btn"
                onClick={onFocusAgent}
                title="Fokus kamera ke agent (F)"
              >
                Locate
              </button>
              <button
                type="button"
                className="mo-hud-btn"
                onClick={onNavigateMissions}
                title="Buka Missions terfilter"
              >
                Missions
              </button>
              <button
                type="button"
                className="mo-hud-btn"
                onClick={onNavigateLogs}
                title="Buka Logs terfilter"
              >
                Logs
              </button>
            </div>
          </div>
        ) : (
          <div className="mo-agent-empty">
            <span className="mo-agent-empty-hint">Pilih agent di scene atau roster</span>
            <span className="mo-agent-empty-tally font-mono">
              {activeCount} aktif · {stations.length - activeCount} idle
            </span>
          </div>
        )}
      </div>

      {/* 2. Center Cluster: Level Elevator Panel & Wall Dock */}
      <div className="mo-hud-cluster mo-hud-levels">
        {/* Elevator Lift Panel (3 Buttons Vertikal) */}
        <div className="mo-lift-panel">
          <div className="mo-lift-buttons">
            {LEVEL_CONFIG.map((lvl) => {
              const isActive = currentLevel === lvl.id
              return (
                <button
                  key={lvl.id}
                  type="button"
                  className={`mo-lift-btn ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectLevel(lvl.id)}
                  title={`Pindah ke level ${lvl.label}`}
                >
                  <span className="mo-lift-label">{lvl.label}</span>
                  <span className="mo-lift-count font-mono">{counts[lvl.id] ?? 0}</span>
                </button>
              )
            })}
          </div>

          <div className="mo-lift-arrows">
            <button
              type="button"
              className="mo-lift-arrow-btn"
              onClick={() => onCycleLevel(-1)}
              title="Naik level ([ / PageUp])"
              aria-label="Naik satu lantai"
            >
              <Icon name="chevron-up" size={16} />
            </button>
            <button
              type="button"
              className="mo-lift-arrow-btn"
              onClick={() => onCycleLevel(1)}
              title="Turun level (] / PageDown)"
              aria-label="Turun satu lantai"
            >
              <Icon name="chevron-down" size={16} />
            </button>
          </div>
        </div>

        {/* Wall Mode Segmented Control */}
        <div className="mo-wall-control" role="group" aria-label="Mode Dinding">
          <button
            type="button"
            className={`mo-wall-btn ${wallMode === 'wallsUp' ? 'active' : ''}`}
            onClick={() => onSetWallMode('wallsUp')}
            title="Dinding Penuh & Atap (Tombol 1)"
          >
            <span className="mo-wall-icon">▣</span>
            <span className="mo-wall-text">Up</span>
            <Kbd>1</Kbd>
          </button>
          <button
            type="button"
            className={`mo-wall-btn ${wallMode === 'cutaway' ? 'active' : ''}`}
            onClick={() => onSetWallMode('cutaway')}
            title="Dinding Terpotong Kamera (Tombol 2)"
          >
            <span className="mo-wall-icon">◐</span>
            <span className="mo-wall-text">Cut</span>
            <Kbd>2</Kbd>
          </button>
          <button
            type="button"
            className={`mo-wall-btn ${wallMode === 'wallsDown' ? 'active' : ''}`}
            onClick={() => onSetWallMode('wallsDown')}
            title="Dinding Rendah Terbuka (Tombol 3)"
          >
            <span className="mo-wall-icon">▭</span>
            <span className="mo-wall-text">Down</span>
            <Kbd>3</Kbd>
          </button>
        </div>
      </div>

      {/* 3. Right Cluster: Camera Controls */}
      <div className="mo-hud-cluster mo-hud-camera">
        <div className="mo-camera-row">
          <button
            type="button"
            className="mo-cam-btn"
            onClick={() => onSnapRotate(-1)}
            title="Putar kiri 90° (Q)"
            aria-label="Putar kiri 90 derajat"
          >
            <Icon name="rotate-left" size={16} />
            <Kbd>Q</Kbd>
          </button>
          <button
            type="button"
            className="mo-cam-btn"
            onClick={() => onSnapRotate(1)}
            title="Putar kanan 90° (E)"
            aria-label="Putar kanan 90 derajat"
          >
            <Icon name="rotate-right" size={16} />
            <Kbd>E</Kbd>
          </button>
          <button
            type="button"
            className="mo-cam-btn"
            onClick={() => onZoom(-1)}
            title="Perjauh kamera (-)"
            aria-label="Zoom out"
          >
            <Icon name="minus" size={16} />
          </button>
          <button
            type="button"
            className="mo-cam-btn"
            onClick={() => onZoom(1)}
            title="Perdekat kamera (+)"
            aria-label="Zoom in"
          >
            <Icon name="plus" size={16} />
          </button>
        </div>

        <div className="mo-camera-row">
          <button
            type="button"
            className="mo-cam-btn mo-cam-btn-text"
            onClick={onResetCamera}
            title="Kembalikan posisi kamera (R)"
          >
            <Icon name="home" size={16} />
            <span>Reset</span>
            <Kbd>R</Kbd>
          </button>
          <button
            type="button"
            className="mo-cam-btn mo-cam-btn-text"
            onClick={onFocusAgent}
            title="Fokus ke agent terpilih (F)"
          >
            <Icon name="target" size={16} />
            <span>Fokus</span>
            <Kbd>F</Kbd>
          </button>

          {/* Popover Fokus Zona (5.4) */}
          <div className="mo-focus-popover-wrapper">
            <button
              type="button"
              className="mo-cam-btn mo-cam-btn-text"
              onClick={() => setFocusOpen(!focusOpen)}
              title="Pilihan Fokus Zona"
              aria-haspopup="true"
              aria-expanded={focusOpen}
            >
              <span>Zona</span>
              <Icon name="chevron-down" size={16} />
            </button>

            {focusOpen && (
              <div className="mo-focus-popover" role="menu">
                <button
                  type="button"
                  className="mo-popover-item"
                  onClick={() => {
                    setFocusOpen(false)
                    onFocusZone?.('exterior')
                  }}
                  role="menuitem"
                >
                  Tampak Luar (Atap)
                </button>
                <button
                  type="button"
                  className="mo-popover-item"
                  onClick={() => {
                    setFocusOpen(false)
                    onFocusZone?.('lobby')
                  }}
                  role="menuitem"
                >
                  Lobby Grand Manor
                </button>
                <button
                  type="button"
                  className="mo-popover-item"
                  onClick={() => {
                    setFocusOpen(false)
                    onFocusZone?.('hangar')
                  }}
                  role="menuitem"
                >
                  Hangar Bay Deck
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
