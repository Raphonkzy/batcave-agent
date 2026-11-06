import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { agentGear } from '../components/agent/agentLooks.ts'
import { Crew } from '../components/agent/Crew.tsx'
import { LabelProjector } from '../components/agent/LabelProjector.tsx'
import { suitParts } from '../components/agent/rig.ts'
import { ScreenGlow, FEED_RATE } from '../components/ui/ScreenGlow.tsx'
import { officeStateBadge } from '../office-state.ts'
import ThemeManor from '../scenes/ThemeManor.tsx'
import { ManorCamera, type ManorCameraHandle } from '../scenes/manor/ManorCamera.tsx'
import { useReducedMotion } from '../scenes/manor/hooks.ts'
import { screenSlots, slotKinds } from '../scenes/manor/screens.ts'
import { computeLayout, QUALITY, type Level, type WallMode } from '../scenes/manor/ZoneLayout.ts'
import type { OfficeStation } from '../types.ts'
import { idlePlan, isBriefing, placementFor, type Placement } from '../utils/layout/placements.ts'
import { FrameReporter, QualityPicker } from './ManorQuality.tsx'
import { useQuality } from './manorQuality.ts'
import { remember, LEVEL_KEY, WALL_MODE_KEY, storedLevel, storedWallMode } from './manorViews.ts'
import { LotHud } from '../components/hud/LotHud.tsx'
import { AgentRadialMenu } from '../components/hud/AgentRadialMenu.tsx'

function useClock(interval: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), interval)
    return () => window.clearInterval(timer)
  }, [interval])
  return now
}

const suit = (profile: string) => suitParts(agentGear(profile))

/**
 * Level visibility filtering:
 * - deck: subterranean command deck & hangar (y < 6)
 * - ground: surface ground floor / lounge / foyer (6 <= y <= 13)
 * - upper: 2nd floor / upper gallery (y > 13)
 */
const shownIn = (level: Level) => (position: THREE.Vector3) => {
  if (level === 'deck') return position.y < 6
  if (level === 'ground') return position.y >= 6 && position.y <= 13
  return position.y > 6 // upper level shows surface + upper floor
}

export const LEVEL_CYCLE: Level[] = ['upper', 'ground', 'deck']

/** Camera Follow Component that reads anchor position on each frame */
function DynamicFollowCamera({
  isFollowing,
  anchor,
  cameraRef,
}: {
  isFollowing: boolean
  anchor: THREE.Object3D | null
  cameraRef: React.RefObject<ManorCameraHandle | null>
}) {
  useFrame(() => {
    if (isFollowing && anchor && anchor.visible) {
      cameraRef.current?.follow(anchor.position)
    }
  })
  return null
}

export default function ManorOffice3D({
  stations,
  onSelect,
}: {
  stations: OfficeStation[]
  onSelect: (station: OfficeStation, trigger: HTMLElement | null) => void
}) {
  const layout = useMemo(() => computeLayout(stations.length), [stations.length])
  const [level, setLevel] = useState<Level>(storedLevel)
  const [wallMode, setWallMode] = useState<WallMode>(storedWallMode)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [radialMenu, setRadialMenu] = useState<{ station: OfficeStation; x: number; y: number } | null>(null)
  const [zoneFocus, setZoneFocus] = useState<'hangar' | 'lobby' | 'exterior' | null>(null)
  const [keyTarget, setKeyTarget] = useState<HTMLElement | null>(null)
  const { quality, choice, setChoice, report } = useQuality()
  const camera = useRef<ManorCameraHandle>(null)
  const anchors = useRef(new Map<string, THREE.Object3D>())
  const labels = useRef(new Map<string, HTMLElement>())
  const hudContainerRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const now = useClock(2000)

  // Measure HUD height for safe-area framing
  useEffect(() => {
    if (!hudContainerRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return
      const h = entry.contentRect.height
      document.documentElement.style.setProperty('--hud-bottom', `${h + 16}px`)
      document.documentElement.style.setProperty('--hud-top', '48px')
    })
    ro.observe(hudContainerRef.current)
    return () => ro.disconnect()
  }, [])

  // Camera preset resolution based on level and wallMode
  const exteriorPreset = useMemo(
    () => ({
      position: [0, 34, -54] as [number, number, number],
      target: [0, 12, -8] as [number, number, number],
      minDistance: 8,
      maxDistance: 140,
      pan: { minX: -36, maxX: 36, minZ: -52, maxZ: 36 },
    }),
    []
  )

  const preset = useMemo(() => {
    if (zoneFocus === 'hangar') return layout.camera.hangarBay
    if (zoneFocus === 'lobby') return layout.camera.manorLobby
    if (zoneFocus === 'exterior') return exteriorPreset

    if (level === 'deck') return layout.camera.commandDeck
    if (level === 'ground') return layout.camera.grandManor
    // upper level
    if (wallMode === 'wallsUp') return exteriorPreset
    return {
      position: [0, 28, 22] as [number, number, number],
      target: [0, 14.5, 4] as [number, number, number],
      minDistance: 6,
      maxDistance: 100,
      pan: layout.camera.grandManor.pan,
    }
  }, [level, wallMode, zoneFocus, layout, exteriorPreset])

  const idleSeats = stations
    .filter((station) => station.state === 'Idle' && station.room === 'Lounge')
    .map((station) => station.seat)
  const rest = idlePlan(layout, idleSeats, now, [])
  let briefingIndex = 0

  const handleSelectLevel = (nextLevel: Level) => {
    setZoneFocus(null)
    setLevel(nextLevel)
    remember(LEVEL_KEY, nextLevel)
  }

  const handleCycleLevel = (dir: 1 | -1) => {
    setZoneFocus(null)
    const idx = LEVEL_CYCLE.indexOf(level)
    const nextIdx = Math.max(0, Math.min(LEVEL_CYCLE.length - 1, idx + dir))
    const next = LEVEL_CYCLE[nextIdx]
    setLevel(next)
    remember(LEVEL_KEY, next)
  }

  const handleSetWallMode = (nextMode: WallMode) => {
    setWallMode(nextMode)
    remember(WALL_MODE_KEY, nextMode)
  }

  const handleFocusZone = (zone: 'hangar' | 'lobby' | 'exterior') => {
    setZoneFocus(zone)
    if (zone === 'hangar') {
      setLevel('deck')
      remember(LEVEL_KEY, 'deck')
    } else if (zone === 'lobby') {
      setLevel('ground')
      remember(LEVEL_KEY, 'ground')
    } else if (zone === 'exterior') {
      setLevel('upper')
      remember(LEVEL_KEY, 'upper')
      setWallMode('wallsUp')
      remember(WALL_MODE_KEY, 'wallsUp')
    }
  }

  // Unified agent selection
  const selectAgent = (
    station: OfficeStation,
    x?: number,
    y?: number,
    _source: 'mesh' | 'label' | 'roster' = 'label'
  ) => {
    setSelectedAgentId(station.id)
    // Auto switch level if agent is on a different level
    const agentLevel: Level = station.room === 'Lounge' ? 'ground' : 'deck'
    if (agentLevel !== level) {
      setLevel(agentLevel)
      remember(LEVEL_KEY, agentLevel)
      setZoneFocus(null)
    }

    const posX = x ?? window.innerWidth / 2
    const posY = y ?? window.innerHeight / 2
    setRadialMenu({ station, x: posX, y: posY })

    // Center camera on agent
    const anchor = anchors.current.get(`agent-${station.id}`)
    if (anchor) camera.current?.follow(anchor.position)
  }

  // Keyboard shortcut handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      if (document.querySelector('[role="dialog"]')) return

      if (e.key.toLowerCase() === 'q') {
        e.preventDefault()
        camera.current?.snapRotate(-1)
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault()
        camera.current?.snapRotate(1)
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        setZoneFocus(null)
        camera.current?.reset()
      } else if (e.key === '1') {
        e.preventDefault()
        handleSetWallMode('wallsUp')
      } else if (e.key === '2') {
        e.preventDefault()
        handleSetWallMode('cutaway')
      } else if (e.key === '3') {
        e.preventDefault()
        handleSetWallMode('wallsDown')
      } else if (e.key === '[' || e.key === 'PageUp') {
        e.preventDefault()
        handleCycleLevel(-1) // UP
      } else if (e.key === ']' || e.key === 'PageDown') {
        e.preventDefault()
        handleCycleLevel(1) // DOWN
      } else if (e.key.toLowerCase() === 'f') {
        if (selectedAgentId) {
          const anchor = anchors.current.get(`agent-${selectedAgentId}`)
          if (anchor) camera.current?.follow(anchor.position)
        }
      } else if (e.key === 'Escape') {
        setSelectedAgentId(null)
        setRadialMenu(null)
        setIsFollowing(false)
        camera.current?.follow(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [level, selectedAgentId, wallMode])

  const placements: Placement[] = stations.map((station) =>
    rest.get(station.seat)?.placement && station.state === 'Idle' && station.room === 'Lounge'
      ? rest.get(station.seat)!.placement
      : placementFor(station, layout, now, isBriefing(station) ? briefingIndex++ : 0)
  )

  const briefing = stations.some(isBriefing)
  const slots = useMemo(() => screenSlots(layout), [layout])
  const kindsKey = stations
    .map((station, index) => `${station.id}:${station.state}:${station.privacy ?? ''}:${placements[index].kind}`)
    .join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const kinds = useMemo(() => slotKinds(slots, stations, placements, briefing), [slots, kindsKey, briefing])
  const visible = useMemo(() => shownIn(level), [level])
  const profile = QUALITY[quality]

  const selectedStation = stations.find((s) => s.id === selectedAgentId) || null
  const selectedAnchor = selectedAgentId ? anchors.current.get(`agent-${selectedAgentId}`) ?? null : null

  return (
    <div
      className="office-3d manor-3d"
      ref={setKeyTarget}
      tabIndex={0}
      role="region"
      aria-label="3D Manor Dollhouse View"
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: preset.position, fov: 40, near: 0.3, far: 400 }}
        gl={{ antialias: quality !== 'low' }}
        onPointerMissed={() => {
          setSelectedAgentId(null)
          setRadialMenu(null)
          setIsFollowing(false)
          camera.current?.follow(null)
        }}
      >
        <ThemeManor
          layout={layout}
          view={level === 'deck' ? 'deck' : 'manor'}
          level={level}
          wallMode={wallMode}
          showUpper={level === 'upper'}
          quality={quality}
          suit={suit}
          focus={preset.target}
          anchors={anchors}
          selectedAnchor={selectedAnchor}
          selectedStatus={selectedStation?.state}
          briefing={briefing}
        >
          <Crew
            layout={layout}
            stations={stations}
            placements={placements}
            visible={visible}
            animate={!reduced}
            shadows={profile.shadows !== 'none'}
            anchors={anchors}
            onSelect={(index) => {
              const station = stations[index]
              if (station) {
                selectAgent(station, window.innerWidth / 2, window.innerHeight / 2, 'mesh')
              }
            }}
          />
          {level === 'deck' && (
            <ScreenGlow slots={slots} kinds={kinds} rate={FEED_RATE[profile.screens]} animate={!reduced} />
          )}
        </ThemeManor>
        <LabelProjector anchors={anchors} labels={labels} />
        <ManorCamera ref={camera} preset={preset} panMode={false} keyTarget={keyTarget} smooth={!reduced} />
        <DynamicFollowCamera isFollowing={isFollowing} anchor={selectedAnchor} cameraRef={camera} />
        <FrameReporter onSample={report} />
      </Canvas>

      {/* Floating 2D Agent Labels (Visible only on active level) */}
      <div className="office-3d-labels">
        {stations.map((station, index) => {
          const badge = officeStateBadge(station.state)
          const resting =
            station.state === 'Idle' && station.room === 'Lounge' ? placements[index].label : undefined
          const register = (element: HTMLElement | null) => {
            if (element) labels.current.set(`agent-${station.id}`, element)
            else labels.current.delete(`agent-${station.id}`)
          }
          const isSelected = selectedAgentId === station.id

          return (
            <button
              key={station.id}
              ref={register}
              type="button"
              className={`agent-tag-3d state-${station.state.toLowerCase()} ${isSelected ? 'selected' : ''}`}
              onClick={(event) => {
                event.stopPropagation()
                const rect = event.currentTarget.getBoundingClientRect()
                selectAgent(station, rect.left + rect.width / 2, rect.top + rect.height / 2, 'label')
              }}
              onDoubleClick={(event) => {
                event.stopPropagation()
                selectAgent(station)
                setIsFollowing((prev) => !prev)
              }}
              aria-label={`${station.name}. ${station.state}.${station.privacy === 'locked' ? ' Locked.' : ''}${resting ? ` ${resting}.` : ''} Buka aksi agent.`}
            >
              {isSelected && <span className="mo-diamond-marker" />}
              {resting && (
                <span
                  className={`speech speech-3d speech-idle${placements[index].pose === 'lie' ? ' speech-sleep' : ''}`}
                >
                  {resting}
                </span>
              )}
              <span className="agent-tag-row">
                <span className="pixel-station-name">{station.name}</span>
                <span className={`badge ${badge.tone}`}>{station.state}</span>
                {station.privacy === 'locked' && <span className="badge muted">🔒 Locked</span>}
              </span>
            </button>
          )
        })}
      </div>

      {/* Radial Menu on Agent Click (5 Read-Only Actions) */}
      {radialMenu && (
        <AgentRadialMenu
          agent={{
            id: radialMenu.station.id,
            name: radialMenu.station.name,
            state: radialMenu.station.state,
            task: radialMenu.station.currentTask,
            model: radialMenu.station.role,
          }}
          x={radialMenu.x}
          y={radialMenu.y}
          onClose={() => setRadialMenu(null)}
          onInspect={() => {
            onSelect(radialMenu.station, null)
          }}
          onFollow={() => {
            setIsFollowing((prev) => !prev)
            const anchor = anchors.current.get(`agent-${radialMenu.station.id}`)
            if (anchor) camera.current?.follow(anchor.position)
          }}
          onLocate={() => {
            const anchor = anchors.current.get(`agent-${radialMenu.station.id}`)
            if (anchor) camera.current?.follow(anchor.position)
          }}
          onMissions={() => {
            window.location.hash = `#/missions?agent=${encodeURIComponent(radialMenu.station.id)}`
          }}
          onLogs={() => {
            window.location.hash = `#/logs?agent=${encodeURIComponent(radialMenu.station.id)}`
          }}
        />
      )}

      {/* Floating 3-Cluster Bottom HUD */}
      <div ref={hudContainerRef}>
        <LotHud
          stations={stations}
          selectedStation={selectedStation}
          currentLevel={level}
          wallMode={wallMode}
          onSelectLevel={handleSelectLevel}
          onCycleLevel={handleCycleLevel}
          onSetWallMode={handleSetWallMode}
          onSnapRotate={(d) => camera.current?.snapRotate(d)}
          onZoom={(d) => camera.current?.zoom(d)}
          onResetCamera={() => {
            setZoneFocus(null)
            camera.current?.reset()
          }}
          onFocusAgent={() => {
            if (selectedAgentId) {
              const anchor = anchors.current.get(`agent-${selectedAgentId}`)
              if (anchor) camera.current?.follow(anchor.position)
            }
          }}
          onInspectAgent={() => {
            if (selectedStation) onSelect(selectedStation, null)
          }}
          onFollowAgent={() => {
            setIsFollowing((prev) => !prev)
            if (selectedAgentId) {
              const anchor = anchors.current.get(`agent-${selectedAgentId}`)
              if (anchor) camera.current?.follow(anchor.position)
            }
          }}
          isFollowing={isFollowing}
          onSelectStation={(station) => selectAgent(station)}
          onFocusZone={handleFocusZone}
          onNavigateMissions={() => {
            if (selectedStation) {
              window.location.hash = `#/missions?agent=${encodeURIComponent(selectedStation.id)}`
            } else {
              window.location.hash = '#/missions'
            }
          }}
          onNavigateLogs={() => {
            if (selectedStation) {
              window.location.hash = `#/logs?agent=${encodeURIComponent(selectedStation.id)}`
            } else {
              window.location.hash = '#/logs'
            }
          }}
        />
      </div>

      {/* Top-Right Quality Picker */}
      <div className="mo-quality-anchor">
        <QualityPicker quality={quality} choice={choice} onChoose={setChoice} />
      </div>
    </div>
  )
}
