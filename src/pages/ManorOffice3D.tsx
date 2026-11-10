import { Canvas } from '@react-three/fiber'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { agentGear } from '../components/agent/agentLooks.ts'
import { Crew } from '../components/agent/Crew.tsx'
import { LabelProjector } from '../components/agent/LabelProjector.tsx'
import { suitParts } from '../components/agent/rig.ts'
import { ScreenGlow, FEED_RATE } from '../components/ui/ScreenGlow.tsx'
import { officeStateBadge } from '../office-state.ts'
import ThemeManor from '../scenes/ThemeManor.tsx'
import { ManorCamera, type ManorCameraHandle } from '../scenes/manor/ManorCamera.tsx'
import { buildObstacles, itemRadius } from '../scenes/manor/cameraRig.ts'
import { useReducedMotion } from '../scenes/manor/hooks.ts'
import { screenSlots, slotKinds } from '../scenes/manor/screens.ts'
import { computeLayout, QUALITY, type Level, type WallMode } from '../scenes/manor/ZoneLayout.ts'
import type { OfficeStation } from '../types.ts'
import { idlePlan, isBriefing, placementFor, type Placement } from '../utils/layout/placements.ts'
import { FrameReporter, QualityPicker } from './ManorQuality.tsx'
import { useQuality } from './manorQuality.ts'
import { remember, LEVEL_CYCLE, LEVEL_KEY, WALL_MODE_KEY, storedLevel, storedWallMode } from './manorViews.ts'
import { LotHud } from '../components/hud/LotHud.tsx'
import { InteractionLayer } from '../scenes/manor/InteractionLayer.tsx'
import { MOVABLE, VEHICLES, titleOf, placementError, withEdits } from '../scenes/manor/simulation.ts'
import type { LayoutItem, Vec3 } from '../utils/layout/types.ts'
import { canCommandMove } from '../utils/layout/navigation.ts'
import { AgentRadialMenu } from '../components/hud/AgentRadialMenu.tsx'
import { GateActions } from '../components/hud/GateActions.tsx'
import { estateConfig } from '../scenes/manor/worldConfig.ts'
import { EnvironmentControls, useEnvironment } from './EnvironmentControls.tsx'

function useClock(interval: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), interval)
    return () => window.clearInterval(timer)
  }, [interval])
  return now
}

/** Bounding radius used to frame a character when focusing it. */
const CHARACTER_RADIUS = 2.4
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


function ManorWorld({
  stations,
  onSelect,
  isFullscreen = false,
  onToggleFullscreen,
}: {
  stations: OfficeStation[]
  onSelect: (station: OfficeStation, trigger: HTMLElement | null) => void
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
}) {
  const base = useMemo(() => computeLayout(stations.length), [stations.length])
  const [edits, setEdits] = useState<Record<string, LayoutItem>>({})
  const layout = useMemo(() => withEdits(base, edits), [base, edits])
  const [selectedObject, setSelectedObject] = useState<string | null>(null)
  const [gateOpen, setGateOpen] = useState(true)
  const [gateMoving, setGateMoving] = useState(false)
  const gateSelected = selectedObject === 'estate-entrance-gate'
  const gatePosition = useMemo(() => estateConfig(layout).gate.position, [layout])
  const [preview, setPreview] = useState<LayoutItem | null>(null)
  const [snapping, setSnapping] = useState(true)
  const [commanding, setCommanding] = useState(false)
  const [commands, setCommands] = useState<Record<string, Vec3>>({})
  const [feedback, setFeedback] = useState('')
  const object = layout.items.find(i => i.id === selectedObject) ?? null
  const rotationError = useMemo(() => object && VEHICLES.has(object.type) ? placementError(layout,{...object,rotY:object.rotY+Math.PI}) : null, [object,layout])
  const cancelMode = () => { setPreview(null); setCommanding(false); setFeedback('') }
  const commit = () => {
    if (!preview) return
    const error = placementError(layout, preview)
    if (error) { setFeedback(error); return }
    setEdits(old => ({...old, [preview.id]: preview})); setPreview(null); setFeedback('Placement confirmed')
  }
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
  const environment = useEnvironment()
  const now = useClock(2000)

  // Measure HUD height for safe-area framing
  useEffect(() => {
    const hud = hudContainerRef.current?.querySelector('.mo-lot-hud')
    if (!hud) return
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return
      const h = entry.contentRect.height
      document.documentElement.style.setProperty('--hud-bottom', `${h + 16}px`)
      document.documentElement.style.setProperty('--hud-top', '48px')
    })
    ro.observe(hud)
    return () => ro.disconnect()
  }, [])

  // Camera preset resolution based on level and wallMode
  const exteriorPreset = useMemo(
    () => ({
      position: [6, 27, layout.zones.entranceHall.maxZ + 34] as [number, number, number],
      target: [0, 12, layout.zones.entranceHall.maxZ - 5] as [number, number, number],
      minDistance: 8,
      maxDistance: 140,
      pan: { minX: -36, maxX: 36, minZ: -20, maxZ: layout.zones.entranceHall.maxZ + 28 },
    }),
    [layout]
  )

  const initialCamera = useRef({position: base.camera.grandManor.position, fov:40, near:0.3, far:600})
  const presetFor = useCallback((lv: Level, mode: WallMode, zone: 'hangar' | 'lobby' | 'exterior' | null) => {
    if (zone === 'hangar') return layout.camera.hangarBay
    if (zone === 'lobby') return layout.camera.manorLobby
    if (zone === 'exterior') return exteriorPreset

    if (lv === 'deck') return layout.camera.commandDeck
    if (lv === 'ground') return layout.camera.grandManor
    // upper level
    if (mode === 'wallsUp') return exteriorPreset
    return {
      position: [0, 28, 22] as [number, number, number],
      target: [0, 14.5, 4] as [number, number, number],
      minDistance: 6,
      maxDistance: 100,
      pan: layout.camera.grandManor.pan,
    }
  }, [layout, exteriorPreset])
  const preset = useMemo(() => presetFor(level, wallMode, zoneFocus), [presetFor, level, wallMode, zoneFocus])
  // Solid geometry for camera obstruction; rebuilt only when the layout, floor or wall mode changes.
  const obstacles = useMemo(() => buildObstacles(layout, level, wallMode), [layout, level, wallMode])

  const idleSeats = stations
    .filter((station) => station.state === 'Idle' && station.room === 'Lounge')
    .map((station) => station.seat)
  const rest = idlePlan(layout, idleSeats, now, [])
  let briefingIndex = 0

  const handleSelectLevel = (nextLevel: Level) => {
    setIsFollowing(false)
    camera.current?.follow(null)
    setPreview(null); setCommanding(false); setSelectedObject(null)
    setZoneFocus(null)
    setLevel(nextLevel)
    remember(LEVEL_KEY, nextLevel)
    // Same rotation and zoom, new target on the destination floor.
    if (nextLevel !== level) camera.current?.retarget(presetFor(nextLevel, wallMode, null))
  }

  const handleCycleLevel = useCallback((dir: 1 | -1) => {
    setIsFollowing(false); camera.current?.follow(null)
    setPreview(null); setCommanding(false); setSelectedObject(null)
    setZoneFocus(null)
    const idx = LEVEL_CYCLE.indexOf(level)
    const nextIdx = Math.max(0, Math.min(LEVEL_CYCLE.length - 1, idx + dir))
    const next = LEVEL_CYCLE[nextIdx]
    setLevel(next)
    remember(LEVEL_KEY, next)
    if (next !== level) camera.current?.retarget(presetFor(next, wallMode, null))
  }, [level, wallMode, presetFor])

  const handleSetWallMode = useCallback((nextMode: WallMode) => {
    setWallMode(nextMode)
    remember(WALL_MODE_KEY, nextMode)
  }, [])

  const handleFocusZone = (zone: 'hangar' | 'lobby' | 'exterior') => {
    setIsFollowing(false); camera.current?.follow(null)
    setPreview(null); setCommanding(false); setSelectedObject(null)
    setZoneFocus(zone)
    // Recenter on the zone without changing the viewing angle or zoom.
    camera.current?.retarget(presetFor(level, wallMode, zone))
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
    focusCamera = true
  ) => {
    setSelectedObject(null); setPreview(null); setCommanding(false)
    setSelectedAgentId(station.id)
    // Auto switch level if agent is on a different level
    const currentAnchor = anchors.current.get('agent-'+station.id)
    const agentLevel: Level = currentAnchor ? currentAnchor.position.y < 6 ? 'deck' : currentAnchor.position.y < 16 ? 'ground' : 'upper' : station.room === 'Lounge' ? 'ground' : 'deck'
    if (agentLevel !== level) {
      setLevel(agentLevel)
      remember(LEVEL_KEY, agentLevel)
      setZoneFocus(null)
    }

    const posX = x ?? window.innerWidth / 2
    const posY = y ?? window.innerHeight / 2
    setRadialMenu({ station, x: posX, y: posY })

    // Center camera on agent
    // A plain click in the 3D view only selects; double-click (or F) focuses.
    const anchor = anchors.current.get(`agent-${station.id}`)
    if (focusCamera && anchor) camera.current?.focus(anchor.position, CHARACTER_RADIUS)
  }

  // Keyboard shortcut handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      if (document.querySelector('[role="dialog"]')) return
      if (e.key !== 'Escape' && target?.closest('button, a, [role="menu"]')) return

      if (preview) {
        if (e.key === 'Escape') { e.preventDefault(); setPreview(null) }
        else if (e.key.toLowerCase() === 'r') { e.preventDefault(); setPreview(p => p ? {...p, rotY:p.rotY+Math.PI/2} : null) }
        else if (e.key.toLowerCase() === 'g') { e.preventDefault(); setSnapping(s=>!s) }
        return
      }
      if (e.key.toLowerCase() === 'q') {
        e.preventDefault()
        camera.current?.snapRotate(-1)
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault()
        camera.current?.snapRotate(1)
      } else if (e.key === 'Home' || e.key.toLowerCase() === 'r') {
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
        const selected = layout.items.find(i=>i.id===selectedObject)
        e.preventDefault()
        if (gateSelected) camera.current?.focus(new THREE.Vector3(gatePosition[0],gatePosition[1]+1,gatePosition[2]), 5)
        else if (selected) camera.current?.focus(new THREE.Vector3(selected.x,selected.y+selected.h/2,selected.z), itemRadius(selected))
        else if (selectedAgentId) {
          const anchor = anchors.current.get(`agent-${selectedAgentId}`)
          if (anchor) camera.current?.focus(anchor.position, CHARACTER_RADIUS)
        }
      } else if (e.key.toLowerCase() === 'z') {
        e.preventDefault()
        onToggleFullscreen?.()
      } else if (e.key === 'Escape') {
        setSelectedObject(null)
        setCommanding(false)
        setSelectedAgentId(null)
        setRadialMenu(null)
        setIsFollowing(false)
        camera.current?.follow(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleCycleLevel, handleSetWallMode, selectedAgentId, onToggleFullscreen, preview, selectedObject, layout, gateSelected, gatePosition])

  const placements: Placement[] = stations.map((station) =>
    commands[station.id] ? { position:commands[station.id], facing:0, seated:false, kind:'command', label:'Moving to destination' } :
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
        dpr={[1, quality === 'high' ? 1.75 : quality === 'medium' ? 1.25 : 1]}
        camera={initialCamera.current}
        gl={{ antialias: quality !== 'low' }}
        onPointerMissed={(event) => {
          if (event.button !== 0) return
          if (preview || commanding) return
          setSelectedObject(null)
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
          hour={environment.settings.realtime ? undefined : environment.settings.hour}
          sunAzimuth={environment.settings.azimuth}
          sunIntensity={environment.settings.intensity}
          suit={suit}
          focus={preset.target}
          anchors={anchors}
          selectedAnchor={selectedAnchor}
          selectedStatus={selectedStation?.state}
          briefing={briefing}
          gate={{ open: gateOpen, selected: gateSelected, interactive: !preview && !commanding, reducedMotion: reduced,
            onSelect: () => { setSelectedObject('estate-entrance-gate'); setSelectedAgentId(null); setRadialMenu(null); setIsFollowing(false); camera.current?.follow(null) },
            onSettled: () => setGateMoving(false) }}
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
                selectAgent(station, window.innerWidth / 2, window.innerHeight / 2, false)
              }
            }}
            onFocus={(index) => {
              const station = stations[index]
              const anchor = station && anchors.current.get(`agent-${station.id}`)
              if (anchor) camera.current?.focus(anchor.position, CHARACTER_RADIUS)
            }}
          />
          {level === 'deck' && (
            <ScreenGlow slots={slots} kinds={kinds} rate={FEED_RATE[profile.screens]} animate={!reduced} />
          )}
        </ThemeManor>
        <InteractionLayer layout={layout} level={level} selected={object} preview={preview} commanding={commanding}
          destination={selectedAgentId ? commands[selectedAgentId] ?? null : null}
          onFocus={i=>camera.current?.focus(new THREE.Vector3(i.x,i.y+i.h/2,i.z), itemRadius(i))}
          onSelect={i=>{setSelectedObject(i.id);setSelectedAgentId(null);setRadialMenu(null);setIsFollowing(false);camera.current?.follow(null)}}
          onPreview={p=>setPreview(i=>i?{...i,x:snapping?Math.round(p[0]*2)/2:p[0],z:snapping?Math.round(p[2]*2)/2:p[2]}:null)}
          onGround={p=>{
            if(preview){commit();return}
            if(!selectedAgentId)return
            const anchor=anchors.current.get('agent-'+selectedAgentId)
            if(!anchor || !canCommandMove(layout,[anchor.position.x,anchor.position.y-2.05,anchor.position.z],p)){setFeedback('Choose reachable open floor on the character’s current level');return}
            setCommands(c=>({...c,[selectedAgentId]:p}));setCommanding(false);setFeedback('Movement command issued')
          }}/>
        <LabelProjector anchors={anchors} labels={labels} />
        <ManorCamera ref={camera} preset={preset} obstacles={obstacles} panMode={false} keyTarget={keyTarget} smooth={!reduced} enabled={!preview && !commanding} followTarget={isFollowing && selectedAnchor ? selectedAnchor.position : null} onFollowEnd={() => setIsFollowing(false)} />
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
                selectAgent(station, rect.left + rect.width / 2, rect.top + rect.height / 2)
              }}
              onDoubleClick={(event) => {
                event.stopPropagation()
                selectAgent(station)
                setIsFollowing((prev) => !prev)
              }}
              aria-label={`${station.name}. ${station.state}.${station.privacy === 'locked' ? ' Locked.' : ''}${resting ? ` ${resting}.` : ''} Open agent actions.`}
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

      {gateSelected && level !== 'deck' && <GateActions open={gateOpen} moving={gateMoving}
        onToggle={() => { setGateOpen(open => !open); setGateMoving(true) }}
        onFocus={() => camera.current?.focus(new THREE.Vector3(gatePosition[0], gatePosition[1] + 1, gatePosition[2]), 5)}
        onClose={() => { setSelectedObject(null); keyTarget?.focus() }}/>}
      {object && <section className="mo-context-panel" aria-label="Object actions">
        <button className="mo-hud-btn" aria-label="Close object actions" onClick={()=>{cancelMode();setSelectedObject(null)}}>Close</button>
        <h3>{titleOf(object)}</h3>
        <p>{object.zone} · {object.level}</p>
        <p className="font-mono">{object.w.toFixed(1)} × {object.d.toFixed(1)} × {object.h.toFixed(1)} m</p>
        {VEHICLES.has(object.type) && <p>Original tactical design · graphite armor · {object.type === 'pursuitBike' ? 'two-wheel pursuit' : object.type === 'assaultVtol' || object.type === 'tacticalJet' ? 'aerial platform' : 'special operations platform'}</p>}
        <div className="mo-context-actions">
          <button className="mo-hud-btn" onClick={()=>camera.current?.focus(new THREE.Vector3(object.x,object.y+object.h/2,object.z), itemRadius(object))}>Focus camera</button>
          {MOVABLE.has(object.type) && !preview && <button className="mo-hud-btn" onClick={()=>setPreview({...object})}>Move / rotate</button>}
          {VEHICLES.has(object.type) && object.type!=='tacticalJet' && <button className="mo-hud-btn" disabled={!!rotationError} title={rotationError ?? 'Turn vehicle within its existing parking footprint'} onClick={()=>{const next={...object,rotY:object.rotY+Math.PI};if(!rotationError)setEdits(e=>({...e,[next.id]:next}))}}>Rotate display 180°</button>}
          {preview && <>
            <button className="mo-hud-btn" onClick={()=>setPreview(p=>p?{...p,rotY:p.rotY+Math.PI/2}:null)}>Rotate (R)</button>
            <button className="mo-hud-btn" aria-pressed={snapping} onClick={()=>setSnapping(s=>!s)}>Snap {snapping?'on':'off'} (G)</button>
            <button className="mo-hud-btn" disabled={!!placementError(layout,preview)} onClick={commit}>Confirm placement</button>
            <button className="mo-hud-btn" onClick={cancelMode}>Cancel</button>
            <p>{placementError(layout,preview) ?? 'Valid placement · click floor to confirm'}</p>
          </>}
        </div>
        <small>Scene-session changes only; runtime agents are unaffected.</small>
      </section>}
      {selectedStation && <div className="mo-command-strip">
        <button className="mo-hud-btn" aria-pressed={commanding} onClick={()=>{setCommanding(c=>!c);setRadialMenu(null)}}>{commanding?'Choose ground destination':'Move character'}</button>
        {commands[selectedStation.id] && <button className="mo-hud-btn" onClick={()=>{
          const a=anchors.current.get('agent-'+selectedStation.id)
          if(a)setCommands(c=>({...c,[selectedStation.id]:[a.position.x,a.position.y-2.05,a.position.z]}))
          setCommanding(false)
        }}>Stop here</button>}
        <button className="mo-hud-btn" onClick={()=>{setCommands(c=>{const next={...c};delete next[selectedStation.id];return next});setCommanding(false)}}>Resume routine</button>
      </div>}
      {feedback && <output className="mo-scene-feedback" aria-live="polite">{feedback}</output>}
      <details className="mo-controls-help"><summary>Controls & help</summary><p>Left click: select · left drag: rotate · right/middle drag: pan · wheel: zoom</p><p>Q/E: rotate · R/Home: reset view · F: focus selection · 1/2/3: walls · Esc: cancel</p><p>Select objects to inspect. Loose furnishings support Move; R rotates, G toggles 0.5 m snapping. Select a character, then Move character and click open floor. Dragging interrupts camera flights/follow.</p>{level !== 'deck' && <p><button className="mo-hud-btn" onClick={() => { setSelectedObject('estate-entrance-gate'); setSelectedAgentId(null); setRadialMenu(null); setIsFollowing(false); camera.current?.follow(null) }}>Inspect estate gate</button></p>}<QualityPicker quality={quality} choice={choice} onChoose={setChoice}/><EnvironmentControls settings={environment.settings} onChange={environment.update}/></details>

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
          }}
          onLocate={() => {
            const anchor = anchors.current.get(`agent-${radialMenu.station.id}`)
            if (anchor) camera.current?.focus(anchor.position, CHARACTER_RADIUS)
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
              if (anchor) camera.current?.focus(anchor.position, CHARACTER_RADIUS)
            }
          }}
          onInspectAgent={() => {
            if (selectedStation) onSelect(selectedStation, null)
          }}
          onFollowAgent={() => {
            setIsFollowing((prev) => !prev)
          }}
          isFollowing={isFollowing}
          onSelectStation={(station) => selectAgent(station)}
          onFocusZone={handleFocusZone}
          onNavigateMissions={() => {
            window.location.hash = selectedStation ? `#/missions?agent=${encodeURIComponent(selectedStation.id)}` : '#/missions'
          }}
          onNavigateLogs={() => {
            window.location.hash = selectedStation ? `#/logs?agent=${encodeURIComponent(selectedStation.id)}` : '#/logs'
          }}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
        />
      </div>
    </div>
  )
}

const Showcase = lazy(() => import('./CharacterShowcase.tsx'))
export default function ManorOffice3D(props: Parameters<typeof ManorWorld>[0]) {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('characterShowcase')) return <Suspense fallback={<p role="status">Loading character audit…</p>}><Showcase/></Suspense>
  return <ManorWorld {...props}/>
}
