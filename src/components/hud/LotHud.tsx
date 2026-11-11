import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { OfficeStation } from '../../types.ts'
import type { Level, WallMode } from '../../scenes/manor/ZoneLayout.ts'
import { agentGear } from '../agent/agentLooks.ts'
import { Icon } from '../ui/Primitives.tsx'
import { BatMark } from '../ui/BatMark.tsx'
import { CrewPortrait } from './CrewPortrait.tsx'

export interface AgentAction { id: string; label: string; onSelect: () => void; pressed?: boolean }

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
  /** Scene commands for the selected agent (move, stop, resume), listed in its menu. */
  agentActions?: AgentAction[]
  /** Quality, lighting and help, shown in the view menu. */
  viewMenu?: ReactNode
}

/** Top to bottom, as the floors are stacked. */
const LEVELS: { id: Level; label: string; short: string }[] = [
  { id: 'upper', label: 'Upper Level', short: '2' },
  { id: 'ground', label: 'Grand Manor', short: '1' },
  { id: 'deck', label: 'Command Deck', short: 'B' },
]

const WALLS: { id: WallMode; label: string; icon: string }[] = [
  { id: 'wallsUp', label: 'Walls up', icon: 'walls-up' },
  { id: 'cutaway', label: 'Walls cutaway', icon: 'walls-cut' },
  { id: 'wallsDown', label: 'Walls down', icon: 'walls-down' },
]

const ZONES: { id: 'exterior' | 'lobby' | 'hangar'; label: string }[] = [
  { id: 'exterior', label: 'Estate grounds' },
  { id: 'lobby', label: 'Manor lobby' },
  { id: 'hangar', label: 'Hangar bay' },
]

const BUSY = new Set(['Working', 'Reviewing', 'Collaborating'])

/** Each agent's colours come from its gear, so the card matches the character in the scene. */
function gearStyle(station: OfficeStation): CSSProperties {
  const { palette } = agentGear(station.id)
  return { '--suit': palette.baseDark, '--glow': palette.accentGlow } as CSSProperties
}

function RoundButton({ icon, label, onClick, pressed, hint, ...rest }: { icon: string; label: string; onClick: () => void; pressed?: boolean; hint?: string } & Record<`aria-${string}`, string | boolean | undefined>) {
  return (
    <button type="button" className={`mo-round-btn${pressed ? ' active' : ''}`} onClick={onClick} aria-label={label} aria-pressed={pressed} title={hint ? `${label} (${hint})` : label} {...rest}>
      <Icon name={icon} size={16} />
    </button>
  )
}

/** One open menu at a time, closed by a click elsewhere or Escape. */
function usePopover() {
  const [open, setOpen] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => { if (!(event.target as Element | null)?.closest?.('.mo-popover-anchor')) setOpen(null) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(null) } }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey, true)
    root.current?.querySelector<HTMLElement>(`[data-popover="${open}"] [role="menuitem"], [data-popover="${open}"] button`)?.focus()
    return () => { window.removeEventListener('pointerdown', onPointer); window.removeEventListener('keydown', onKey, true) }
  }, [open])
  return { open, root, toggle: (id: string) => setOpen((current) => (current === id ? null : id)), close: () => setOpen(null) }
}

export function LotHud({
  stations,
  selectedStation,
  currentLevel,
  wallMode,
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
  agentActions = [],
  viewMenu,
}: LotHudProps) {
  const popover = usePopover()
  const busy = stations.filter((s) => BUSY.has(s.state)).length
  const levelIndex = Math.max(0, LEVELS.findIndex((item) => item.id === currentLevel))
  const level = LEVELS[levelIndex]
  const wallIndex = Math.max(0, WALLS.findIndex((item) => item.id === wallMode))
  const wall = WALLS[wallIndex]
  const nextWall = WALLS[(wallIndex + 1) % WALLS.length]
  const selectedGear = selectedStation ? agentGear(selectedStation.id) : undefined
  const pick = (action: () => void) => () => { popover.close(); action() }

  return (
    <div className="mo-lot-hud" role="region" aria-label="3D Manor Controls" ref={popover.root}>
      {/* Bottom left: the crew card. Portrait, status, three actions, and the whole crew below. */}
      <section className="mo-crew-card" aria-label="Crew" style={selectedStation ? gearStyle(selectedStation) : undefined}>
        <div className="mo-crew-main">
          <div className="mo-crew-portrait" data-state={selectedStation?.state.toLowerCase()}>
            {stations.length > 0 && <CrewPortrait profile={selectedStation?.id} />}
            {!selectedStation && <BatMark size={40} className="mo-crew-placeholder" />}
          </div>
          <div className="mo-crew-info">
            {selectedStation ? (
              <>
                <div className="mo-crew-name-row">
                  <button type="button" className="mo-crew-name" onClick={onInspectAgent} title="Open details">{selectedStation.name}</button>
                  {selectedStation.privacy === 'locked' && <Icon name="lock" size={16} className="mo-crew-lock" />}
                </div>
                <div className="mo-crew-status" data-state={selectedStation.state.toLowerCase()}>
                  <span className="mo-crew-state">{selectedStation.state}</span>
                  <span className="mo-crew-role">{selectedGear?.roleTitle ?? selectedStation.role}</span>
                </div>
                <div className="mo-crew-task" title={selectedStation.activity || selectedStation.currentTask}>{selectedStation.activity || selectedStation.currentTask}</div>
              </>
            ) : (
              <>
                <div className="mo-crew-name-row"><span className="mo-crew-name">The crew</span></div>
                <div className="mo-crew-task">{stations.length ? `${busy} on a mission · ${stations.length - busy} standing by` : 'Waiting for the crew…'}</div>
                <div className="mo-crew-hint">Pick a member below or in the scene</div>
              </>
            )}
          </div>
          {selectedStation && (
            <div className="mo-crew-actions" role="toolbar" aria-label={`${selectedStation.name} actions`}>
              <RoundButton icon="target" label="Locate" onClick={onFocusAgent} hint="F" />
              <RoundButton icon="eye" label={isFollowing ? 'Following' : 'Follow'} onClick={onFollowAgent} pressed={isFollowing} />
              <div className="mo-popover-anchor">
                <RoundButton icon="more" label="More actions" onClick={() => popover.toggle('agent')} aria-haspopup="menu" aria-expanded={popover.open === 'agent'} />
                {popover.open === 'agent' && (
                  <div className="mo-popover mo-popover-up" role="menu" aria-label={`${selectedStation.name} menu`} data-popover="agent">
                    <button type="button" role="menuitem" className="mo-popover-item" onClick={pick(onInspectAgent)}><Icon name="info" size={16} />Details</button>
                    <button type="button" role="menuitem" className="mo-popover-item" onClick={pick(onNavigateMissions)}><Icon name="clipboard" size={16} />Missions</button>
                    <button type="button" role="menuitem" className="mo-popover-item" onClick={pick(onNavigateLogs)}><Icon name="terminal" size={16} />Logs</button>
                    {agentActions.length > 0 && <hr className="mo-popover-rule" />}
                    {agentActions.map((action) => (
                      <button key={action.id} type="button" role="menuitem" className={`mo-popover-item${action.pressed ? ' active' : ''}`} aria-pressed={action.pressed} onClick={pick(action.onSelect)}>{action.label}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {stations.length > 0 && (
          <div className="mo-hud-roster" role="list" aria-label="Agent Roster">
            {stations.map((station) => {
              const active = selectedStation?.id === station.id
              return (
                <div role="listitem" key={station.id}>
                  <button
                    type="button"
                    className={`mo-roster-pill${active ? ' active' : ''}`}
                    style={gearStyle(station)}
                    data-state={station.state.toLowerCase()}
                    onClick={() => onSelectStation(station)}
                    title={`${station.name} · ${station.state}`}
                    aria-label={`Select agent ${station.name}`}
                    aria-pressed={active}
                  >
                    {station.name.charAt(0).toUpperCase()}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Bottom right: one dock for the camera, walls, floors and view settings. */}
      <div className="mo-view-dock">
        <span className="mo-floor-name" aria-live="polite">{level.label}</span>
        <div className="mo-dock" role="toolbar" aria-label="View">
          <RoundButton icon="rotate-left" label="Rotate left 90 degrees" onClick={() => onSnapRotate(-1)} hint="Q" />
          <RoundButton icon="rotate-right" label="Rotate right 90 degrees" onClick={() => onSnapRotate(1)} hint="E" />
          <RoundButton icon="minus" label="Zoom out" onClick={() => onZoom(-1)} />
          <RoundButton icon="plus" label="Zoom in" onClick={() => onZoom(1)} />
          <RoundButton icon="home" label="Reset camera" onClick={onResetCamera} hint="R" />
          <span className="mo-dock-rule" aria-hidden="true" />
          <span role="group" aria-label="Wall Mode" className="mo-dock-group">
            <RoundButton icon={wall.icon} label={`${wall.label}. Switch to ${nextWall.label.toLowerCase()}`} onClick={() => onSetWallMode(nextWall.id)} hint="1, 2, 3" />
          </span>
          <span className="mo-dock-rule" aria-hidden="true" />
          <span role="group" aria-label="Floors" className="mo-dock-group mo-floor-control">
            <button type="button" className="mo-floor-step" onClick={() => onCycleLevel(-1)} disabled={levelIndex === 0} aria-label="Move one level up" title="Up a floor ([ or PageUp)"><Icon name="chevron-up" size={16} /></button>
            <span className="mo-floor-badge" title={level.label}>{level.short}</span>
            <button type="button" className="mo-floor-step" onClick={() => onCycleLevel(1)} disabled={levelIndex === LEVELS.length - 1} aria-label="Move one level down" title="Down a floor (] or PageDown)"><Icon name="chevron-down" size={16} /></button>
          </span>
          <span className="mo-dock-rule" aria-hidden="true" />
          <div className="mo-popover-anchor">
            <RoundButton icon="settings" label="View, areas and help" onClick={() => popover.toggle('view')} pressed={popover.open === 'view'} aria-haspopup="dialog" aria-expanded={popover.open === 'view'} />
            {popover.open === 'view' && (
              <div className="mo-popover mo-popover-up mo-popover-end mo-view-menu" data-popover="view" aria-label="View settings">
                <div className="mo-popover-label">Go to</div>
                {ZONES.map((zone) => (
                  <button key={zone.id} type="button" role="menuitem" className="mo-popover-item" onClick={pick(() => onFocusZone?.(zone.id))}>{zone.label}</button>
                ))}
                {viewMenu && <><hr className="mo-popover-rule" />{viewMenu}</>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
