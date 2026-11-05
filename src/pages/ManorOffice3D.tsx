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
import { computeLayout, isDeckView, isManorView, QUALITY, type ManorView } from '../scenes/manor/ZoneLayout.ts'
import type { OfficeStation } from '../types.ts'
import { idlePlan, isBriefing, placementFor, type Placement } from '../utils/layout/placements.ts'
import { FrameReporter, QualityPicker } from './ManorQuality.tsx'
import { useQuality } from './manorQuality.ts'
import { remember, SLEEP_KEY, stored, UPPER_KEY, VIEW_KEY, VIEWS } from './manorViews.ts'
// The 3D view in the Tactical Manor theme. Its own page component, so the Day and Night scenes
// stay exactly as they were. Every control and tag here is in English.
function useClock(interval: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), interval); return () => window.clearInterval(timer) }, [interval])
  return now
}
const suit = (profile: string) => suitParts(agentGear(profile))
/** Whether an agent's feet are on a floor the view shows (the upper floor can be hidden). */
const shownIn = (view: ManorView, upper: boolean, hangarZ: number) => (position: THREE.Vector3) => {
  if (position.y > 13 && !upper) return false
  if (isDeckView(view)) return position.y < 6
  if (view === 'manor' || view === 'lobby') return position.y > 6
  // Overview: on the deck only the hangar shows under the cliff's edge.
  return position.y > 6 || position.z > hangarZ
}
export default function ManorOffice3D({ stations, onSelect }: { stations: OfficeStation[]; onSelect: (station: OfficeStation, trigger: HTMLElement | null) => void }) {
  const layout = useMemo(() => computeLayout(stations.length), [stations.length])
  const [view, setView] = useState<ManorView>(() => stored(VIEW_KEY, ['exterior', 'deck', 'hangar', 'manor', 'lobby', 'overview'] as const, 'deck'))
  const [showUpper, setShowUpper] = useState(() => stored(UPPER_KEY, ['on', 'off'] as const, 'on') === 'on')
  const [wallMode, setWallMode] = useState<'wallsUp' | 'cutaway' | 'wallsDown'>('cutaway')
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [sleep, setSleep] = useState(() => stored(SLEEP_KEY, ['on', 'off'] as const, 'off') === 'on')
  const [panMode, setPanMode] = useState(false)
  const [keyTarget, setKeyTarget] = useState<HTMLElement | null>(null)
  const { quality, choice, setChoice, report } = useQuality()
  const camera = useRef<ManorCameraHandle>(null)
  const anchors = useRef(new Map<string, THREE.Object3D>())
  const labels = useRef(new Map<string, HTMLElement>())
  const reduced = useReducedMotion()
  const now = useClock(2000)

  const exteriorPreset = useMemo(() => ({
    position: [0, 34, -56] as [number, number, number],
    target: [0, 12, -10] as [number, number, number],
    minDistance: 8,
    maxDistance: 140,
    pan: { minX: -36, maxX: 36, minZ: -52, maxZ: 36 },
  }), [])

  const preset = view === 'exterior'
    ? exteriorPreset
    : {
        deck: layout.camera.commandDeck,
        hangar: layout.camera.hangarBay,
        manor: layout.camera.grandManor,
        lobby: layout.camera.manorLobby,
        overview: layout.camera.overview,
      }[view]

  // Follow cam tracking position
  const followTarget = useMemo(() => {
    if (!selectedAgentId) return null
    const anchor = anchors.current.get(`agent-${selectedAgentId}`)
    return anchor ? anchor.position.clone() : null
  }, [selectedAgentId])
  // Idle agents rest in the manor (or sleep in their own suites); busy ones go to their stations.
  const idleSeats = stations.filter((station) => station.state === 'Idle' && station.room === 'Lounge').map((station) => station.seat)
  const rest = idlePlan(layout, idleSeats, now, sleep ? idleSeats : [])
  let briefingIndex = 0
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
      } else if (e.key === '[') {
        e.preventDefault()
        const idx = VIEWS.findIndex((v) => v.view === view)
        if (idx > 0) choose(VIEWS[idx - 1].view)
      } else if (e.key === ']') {
        e.preventDefault()
        const idx = VIEWS.findIndex((v) => v.view === view)
        if (idx < VIEWS.length - 1) choose(VIEWS[idx + 1].view)
      } else if (e.key.toLowerCase() === 'f') {
        if (selectedAgentId) {
          const anchor = anchors.current.get(`agent-${selectedAgentId}`)
          if (anchor) camera.current?.follow(anchor.position)
        }
      } else if (e.key === 'Escape') {
        setSelectedAgentId(null)
        camera.current?.follow(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [view, selectedAgentId])

  const placements: Placement[] = stations.map((station) => rest.get(station.seat)?.placement && station.state === 'Idle' && station.room === 'Lounge' ? rest.get(station.seat)!.placement : placementFor(station, layout, now, isBriefing(station) ? briefingIndex++ : 0))
  const briefing = stations.some(isBriefing)
  const slots = useMemo(() => screenSlots(layout), [layout])
  const kindsKey = stations.map((station, index) => `${station.id}:${station.state}:${station.privacy ?? ''}:${placements[index].kind}`).join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const kinds = useMemo(() => slotKinds(slots, stations, placements, briefing), [slots, kindsKey, briefing])
  const visible = useMemo(() => shownIn(view, showUpper, layout.zones.hangarBay.minZ), [view, showUpper, layout])
  const profile = QUALITY[quality]
  const choose = (next: ManorView) => { setView(next); remember(VIEW_KEY, next) }
  return <div className="office-3d manor-3d" ref={setKeyTarget} tabIndex={0} role="region" aria-label="Tactical Manor 3D view. Drag to rotate, right-drag or two fingers to pan, scroll to zoom, arrow keys pan when focused.">
    <Canvas shadows dpr={[1, 2]} camera={{ position: preset.position, fov: 40, near: 0.3, far: 400 }} gl={{ antialias: quality !== 'low' }}>
      <ThemeManor layout={layout} view={view} showUpper={showUpper} quality={quality} suit={suit} focus={preset.target} anchors={anchors} briefing={briefing}>
        <Crew layout={layout} stations={stations} placements={placements} visible={visible} animate={!reduced} shadows={profile.shadows !== 'none'} anchors={anchors} onSelect={(index) => onSelect(stations[index], null)}/>
        {isDeckView(view) && <ScreenGlow slots={slots} kinds={kinds} rate={FEED_RATE[profile.screens]} animate={!reduced}/>}
      </ThemeManor>
      <LabelProjector anchors={anchors} labels={labels}/>
      <ManorCamera ref={camera} preset={preset} panMode={panMode} keyTarget={keyTarget} smooth={!reduced} followTarget={followTarget}/>
      <FrameReporter onSample={report}/>
    </Canvas>
    <div className="office-3d-labels">
      {stations.map((station, index) => {
        const badge = officeStateBadge(station.state)
        const resting = station.state === 'Idle' && station.room === 'Lounge' ? placements[index].label : undefined
        const register = (element: HTMLElement | null) => { if (element) labels.current.set(`agent-${station.id}`, element); else labels.current.delete(`agent-${station.id}`) }
        return <button key={station.id} ref={register} type="button" className={`agent-tag-3d state-${station.state.toLowerCase()}`} onClick={(event) => { setSelectedAgentId(station.id); onSelect(station, event.currentTarget) }} aria-label={`${station.name}. ${station.state}.${station.privacy === 'locked' ? ' Locked.' : ''}${resting ? ` ${resting}.` : ''} Open station details.`}>
          {resting && <span className={`speech speech-3d speech-idle${placements[index].pose === 'lie' ? ' speech-sleep' : ''}`}>{resting}</span>}
          <span className="agent-tag-row"><span className="pixel-station-name">{station.name}</span><span className={`badge ${badge.tone}`}>{station.state}</span>{station.privacy === 'locked' && <span className="badge muted">🔒 Locked</span>}</span>
        </button>
      })}
    </div>
    <div className="manor-camera-widget" role="group" aria-label="Camera">
      {VIEWS.map((item) => <button key={item.view} type="button" className={view === item.view ? 'active' : ''} aria-pressed={view === item.view} title={item.title} onClick={() => choose(item.view)}>{item.label}</button>)}
      <button type="button" className={showUpper ? 'active' : ''} aria-pressed={showUpper} title="Show or hide the upper floor of suites" onClick={() => { setShowUpper(!showUpper); remember(UPPER_KEY, showUpper ? 'off' : 'on') }}>Upper Floor</button>
      <div className="sims-dock-divider" />
      <button type="button" onClick={() => camera.current?.snapRotate(-1)} title="Snap rotate 90° left (Q)">↺ Q</button>
      <button type="button" onClick={() => camera.current?.snapRotate(1)} title="Snap rotate 90° right (E)">↻ E</button>
      <button type="button" className={wallMode === 'cutaway' ? 'active' : ''} onClick={() => setWallMode(wallMode === 'cutaway' ? 'wallsUp' : wallMode === 'wallsUp' ? 'wallsDown' : 'cutaway')} title="Cycle wall modes: Cutaway / Walls Up / Walls Down">
        {wallMode === 'cutaway' ? '✂ Cutaway' : wallMode === 'wallsUp' ? '🏛 Walls Up' : '⛶ Walls Down'}
      </button>
    </div>
    <QualityPicker quality={quality} choice={choice} onChoose={setChoice}/>
    <small className="office-3d-hint manor-hint">Drag to rotate · right-drag, two fingers or Pan to move · scroll to zoom · click an agent for details</small>
    <div className="office-3d-tools">
      <button type="button" className={sleep ? 'active sleep' : ''} aria-pressed={sleep} onClick={() => { const next = !sleep; setSleep(next); remember(SLEEP_KEY, next ? 'on' : 'off'); if (next && idleSeats.length > 0 && !isManorView(view)) choose('manor') }} title="Send every idle agent to sleep in their own suite">💤 Sleep</button>
      <button type="button" className={panMode ? 'active' : ''} aria-pressed={panMode} onClick={() => setPanMode((value) => !value)} title="Drag moves the view instead of rotating it">✥ Pan</button>
      <button type="button" onClick={() => camera.current?.reset()} title="Back to this camera's starting view">↺ Reset view</button>
    </div>
  </div>
}
