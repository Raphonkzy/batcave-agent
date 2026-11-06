import { Canvas } from '@react-three/fiber'
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
import { computeLayout, isDeckView, QUALITY, type ManorView } from '../scenes/manor/ZoneLayout.ts'
import type { OfficeStation } from '../types.ts'
import { idlePlan, isBriefing, placementFor, type Placement } from '../utils/layout/placements.ts'
import { FrameReporter, QualityPicker } from './ManorQuality.tsx'
import { useQuality } from './manorQuality.ts'
import { remember, SLEEP_KEY, stored, UPPER_KEY, VIEW_KEY } from './manorViews.ts'
import { SimsHud } from '../components/hud/SimsHud.tsx'
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

const shownIn = (view: ManorView, upper: boolean, hangarZ: number) => (position: THREE.Vector3) => {
  if (position.y > 13 && !upper) return false
  if (isDeckView(view)) return position.y < 6
  if (view === 'manor' || view === 'lobby') return position.y > 6
  return position.y > 6 || position.z > hangarZ
}

const LEVEL_CYCLE: ManorView[] = ['exterior', 'manor', 'lobby', 'deck', 'hangar', 'overview']

export default function ManorOffice3D({
  stations,
  onSelect,
}: {
  stations: OfficeStation[]
  onSelect: (station: OfficeStation, trigger: HTMLElement | null) => void
}) {
  const layout = useMemo(() => computeLayout(stations.length), [stations.length])
  const [view, setView] = useState<ManorView>(() => stored(VIEW_KEY, ['exterior', 'deck', 'hangar', 'manor', 'lobby', 'overview'] as const, 'deck'))
  const [showUpper] = useState(() => stored(UPPER_KEY, ['on', 'off'] as const, 'on') === 'on')
  const [wallMode, setWallMode] = useState<'wallsUp' | 'cutaway' | 'wallsDown'>('cutaway')
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [radialMenu, setRadialMenu] = useState<{ station: OfficeStation; x: number; y: number } | null>(null)
  const [sleep] = useState(() => stored(SLEEP_KEY, ['on', 'off'] as const, 'off') === 'on')
  const [panMode] = useState(false)
  const [keyTarget, setKeyTarget] = useState<HTMLElement | null>(null)
  const { quality, choice, setChoice, report } = useQuality()
  const camera = useRef<ManorCameraHandle>(null)
  const anchors = useRef(new Map<string, THREE.Object3D>())
  const labels = useRef(new Map<string, HTMLElement>())
  const reduced = useReducedMotion()
  const now = useClock(2000)

  const exteriorPreset = useMemo(
    () => ({
      position: [0, 34, -56] as [number, number, number],
      target: [0, 12, -10] as [number, number, number],
      minDistance: 8,
      maxDistance: 140,
      pan: { minX: -36, maxX: 36, minZ: -52, maxZ: 36 },
    }),
    []
  )

  const preset =
    view === 'exterior'
      ? exteriorPreset
      : {
          deck: layout.camera.commandDeck,
          hangar: layout.camera.hangarBay,
          manor: layout.camera.grandManor,
          lobby: layout.camera.manorLobby,
          overview: layout.camera.overview,
        }[view]

  const followTarget = useMemo(() => {
    if (!selectedAgentId) return null
    const anchor = anchors.current.get(`agent-${selectedAgentId}`)
    return anchor ? anchor.position.clone() : null
  }, [selectedAgentId])

  const idleSeats = stations.filter((station) => station.state === 'Idle' && station.room === 'Lounge').map((station) => station.seat)
  const rest = idlePlan(layout, idleSeats, now, sleep ? idleSeats : [])
  let briefingIndex = 0

  const choose = (next: ManorView) => {
    setView(next)
    remember(VIEW_KEY, next)
  }

  const cycleLevel = (dir: 1 | -1) => {
    const idx = LEVEL_CYCLE.indexOf(view)
    const nextIdx = Math.max(0, Math.min(LEVEL_CYCLE.length - 1, idx + dir))
    choose(LEVEL_CYCLE[nextIdx])
  }

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
        camera.current?.reset()
      } else if (e.key === '1') {
        e.preventDefault()
        setWallMode('wallsUp')
      } else if (e.key === '2') {
        e.preventDefault()
        setWallMode('cutaway')
      } else if (e.key === '3') {
        e.preventDefault()
        setWallMode('wallsDown')
      } else if (e.key === '[' || e.key === 'PageUp') {
        e.preventDefault()
        cycleLevel(-1)
      } else if (e.key === ']' || e.key === 'PageDown') {
        e.preventDefault()
        cycleLevel(1)
      } else if (e.key.toLowerCase() === 'f') {
        if (selectedAgentId) {
          const anchor = anchors.current.get(`agent-${selectedAgentId}`)
          if (anchor) camera.current?.follow(anchor.position)
        }
      } else if (e.key === 'Escape') {
        setSelectedAgentId(null)
        setRadialMenu(null)
        camera.current?.follow(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [view, selectedAgentId])

  const placements: Placement[] = stations.map((station) =>
    rest.get(station.seat)?.placement && station.state === 'Idle' && station.room === 'Lounge'
      ? rest.get(station.seat)!.placement
      : placementFor(station, layout, now, isBriefing(station) ? briefingIndex++ : 0)
  )

  const briefing = stations.some(isBriefing)
  const slots = useMemo(() => screenSlots(layout), [layout])
  const kindsKey = stations.map((station, index) => `${station.id}:${station.state}:${station.privacy ?? ''}:${placements[index].kind}`).join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const kinds = useMemo(() => slotKinds(slots, stations, placements, briefing), [slots, kindsKey, briefing])
  const visible = useMemo(() => shownIn(view, showUpper, layout.zones.hangarBay.minZ), [view, showUpper, layout])
  const profile = QUALITY[quality]

  const selectedStation = stations.find((s) => s.id === selectedAgentId) || null
  const activeCount = stations.filter((s) => s.state !== 'Idle').length

  const handleAgentClick = (station: OfficeStation, event: React.MouseEvent<HTMLElement>) => {
    setSelectedAgentId(station.id)
    const rect = event.currentTarget.getBoundingClientRect()
    setRadialMenu({
      station,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
  }

  return (
    <div
      className="office-3d manor-3d"
      ref={setKeyTarget}
      tabIndex={0}
      role="region"
      aria-label="Tactical Manor 3D view. Drag to rotate, right-drag or two fingers to pan, scroll to zoom, arrow keys pan when focused."
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: preset.position, fov: 40, near: 0.3, far: 400 }}
        gl={{ antialias: quality !== 'low' }}
      >
        <ThemeManor
          layout={layout}
          view={view}
          showUpper={showUpper}
          quality={quality}
          suit={suit}
          focus={preset.target}
          anchors={anchors}
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
              setSelectedAgentId(station.id)
              onSelect(station, null)
            }}
          />
          {isDeckView(view) && <ScreenGlow slots={slots} kinds={kinds} rate={FEED_RATE[profile.screens]} animate={!reduced} />}
        </ThemeManor>
        <LabelProjector anchors={anchors} labels={labels} />
        <ManorCamera ref={camera} preset={preset} panMode={panMode} keyTarget={keyTarget} smooth={!reduced} followTarget={followTarget} />
        <FrameReporter onSample={report} />
      </Canvas>

      {/* Floating 3D Agent Labels & Diamond Status Marker */}
      <div className="office-3d-labels">
        {stations.map((station, index) => {
          const badge = officeStateBadge(station.state)
          const resting = station.state === 'Idle' && station.room === 'Lounge' ? placements[index].label : undefined
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
              onClick={(event) => handleAgentClick(station, event)}
              aria-label={`${station.name}. ${station.state}.${station.privacy === 'locked' ? ' Locked.' : ''}${resting ? ` ${resting}.` : ''} Buka aksi agent.`}
            >
              {isSelected && <span className="mo-diamond-marker" />}
              {resting && <span className={`speech speech-3d speech-idle${placements[index].pose === 'lie' ? ' speech-sleep' : ''}`}>{resting}</span>}
              <span className="agent-tag-row">
                <span className="pixel-station-name">{station.name}</span>
                <span className={`badge ${badge.tone}`}>{station.state}</span>
                {station.privacy === 'locked' && <span className="badge muted">🔒 Locked</span>}
              </span>
            </button>
          )
        })}
      </div>

      {/* Radial Menu on Agent Click */}
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
            const anchor = anchors.current.get(`agent-${radialMenu.station.id}`)
            if (anchor) camera.current?.follow(anchor.position)
          }}
          onLocate={() => {
            const anchor = anchors.current.get(`agent-${radialMenu.station.id}`)
            if (anchor) camera.current?.follow(anchor.position)
          }}
          onMissions={() => {
            window.location.hash = '#/missions'
          }}
          onLogs={() => {
            window.location.hash = '#/logs'
          }}
        />
      )}

      {/* The Sims Style 3-Cluster Bottom HUD */}
      <SimsHud
        selectedStation={selectedStation}
        currentView={view}
        wallMode={wallMode}
        onSelectView={choose}
        onCycleLevel={cycleLevel}
        onSetWallMode={setWallMode}
        onSnapRotate={(d) => camera.current?.snapRotate(d)}
        onZoom={() => {}}
        onResetCamera={() => camera.current?.reset()}
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
          if (selectedAgentId) {
            const anchor = anchors.current.get(`agent-${selectedAgentId}`)
            if (anchor) camera.current?.follow(anchor.position)
          }
        }}
        onNavigateMissions={() => {
          window.location.hash = '#/missions'
        }}
        totalStations={stations.length}
        activeCount={activeCount}
      />

      <QualityPicker quality={quality} choice={choice} onChoose={setChoice} />
    </div>
  )
}
