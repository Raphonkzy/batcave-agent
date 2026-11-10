import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Vec3 } from '../utils/layout/types.ts'
import { useLocalHour, useReducedMotion } from './manor/hooks.ts'
import { HangarBay } from './manor/HangarBay.tsx'
import { manorMaterials } from './manor/materials.ts'
import { SubterraneanCave } from './manor/SubterraneanCave.tsx'
import { SuitVault } from './manor/SuitVault.tsx'
import type { SuitParts } from './manor/batches.ts'
import { SurfaceManor } from './manor/SurfaceManor.tsx'
import { CliffGrounds, TerracePool } from './manor/TerracePool.tsx'
import { ExteriorGrounds } from './manor/ExteriorGrounds.tsx'
import { VerticalShaft } from './manor/VerticalShaft.tsx'
import { WaterfallMesh } from './manor/WaterfallMesh.tsx'
import { Roof } from './manor/Roof.tsx'
import { Plumbob } from './manor/Plumbob.tsx'
import { lightRig, QUALITY, terraceSun, type ManorLayoutData, type ManorView, type Level, type WallMode, type Quality, type QualityProfile } from './manor/ZoneLayout.ts'
// Root of the Tactical Manor theme (`themeId: "manor"`): the subterranean command deck and the
// surface manor above it, joined by the cliff, the waterfall and the glass elevator. All geometry
// is procedural. There are exactly six real lights; everything else glows by emissive material.
/** Image-based fill from a procedural room (no image file), so six lights are enough. */
function ProceduralEnvironment({ intensity }: { intensity: number }) {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const target = pmrem.fromScene(room, 0.04)
    scene.environment = target.texture
    return () => { scene.environment = null; target.dispose(); pmrem.dispose(); room.dispose?.() }
  }, [gl, scene])
  useEffect(() => { scene.environmentIntensity = intensity }, [scene, intensity])
  return null
}
function Lights({ layout, profile, hour, focus, animate, view }: { layout: ManorLayoutData; profile: QualityProfile; hour: number; focus: Vec3; animate: boolean; view: ManorView }) {
  const rig = useMemo(() => lightRig(layout), [layout])
  const sun = terraceSun(hour)
  // On Medium only the command spot casts shadows, and in the overview the deck it lights is under the rock.
  const commandShadow = profile.shadows === 'all' || (profile.shadows === 'main' && view !== 'overview')
  const hearth = useRef<THREE.PointLight>(null)
  const fill = useRef<THREE.PointLight>(null)
  const targets = useMemo(() => ({ command: new THREE.Object3D(), hangar: new THREE.Object3D(), sun: new THREE.Object3D() }), [])
  useEffect(() => {
    targets.command.position.set(...rig.command.target)
    targets.hangar.position.set(...rig.hangar.target)
    targets.sun.position.set(...rig.sunTarget)
    for (const object of Object.values(targets)) object.updateMatrixWorld()
  }, [rig, targets])
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    if (hearth.current) hearth.current.intensity = animate ? 38 + Math.sin(t * 7.3) * 4 + Math.sin(t * 13.1) * 3 : 38
    if (fill.current) {
      // The fill light follows the camera's focus, so whichever level is in view is lit.
      const k = animate ? Math.min(1, delta * 3) : 1
      fill.current.position.x += (focus[0] - fill.current.position.x) * k
      fill.current.position.y += (focus[1] + 5 - fill.current.position.y) * k
      fill.current.position.z += (focus[2] - fill.current.position.z) * k
    }
  })
  const half = rig.span * 0.75
  return <>
    <spotLight position={rig.command.position} target={targets.command} angle={1.25} penumbra={0.7} intensity={190} decay={2} distance={0} color="#f0f6ff" castShadow={commandShadow} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004}/>
    <spotLight position={rig.hangar.position} target={targets.hangar} angle={1.3} penumbra={0.8} intensity={220} decay={2} distance={0} color="#ffb04a" castShadow={profile.shadows === 'all'} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004}/>
    <pointLight ref={hearth} position={rig.hearth} intensity={38} decay={2} distance={0} color="#ff9944"/>
    <pointLight position={rig.foyer} intensity={60} decay={2} distance={0} color="#ffe2b8"/>
    <directionalLight position={[rig.sunTarget[0] + sun.direction[0], rig.sunTarget[1] + sun.direction[1], rig.sunTarget[2] + sun.direction[2]]} target={targets.sun} intensity={sun.intensity} color={sun.color} castShadow={profile.shadows === 'all'} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0005} shadow-camera-left={-half} shadow-camera-right={half} shadow-camera-top={half} shadow-camera-bottom={-half} shadow-camera-far={half * 5}/>
    <pointLight ref={fill} position={[focus[0], focus[1] + 5, focus[2]]} intensity={45} decay={1.6} distance={0} color="#dfe6f2"/>
    {Object.values(targets).map((object, index) => <primitive key={index} object={object}/>)}
  </>
}
/** Blinking indicators and flickering flames, by material (no lights). */
function Animation({ animate }: { animate: boolean }) {
  const m = manorMaterials()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const a = animate ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 3.1)) : 0.9
    const b = animate ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 3.1 + Math.PI)) : 0.9
    ;(m.blinkA as THREE.MeshBasicMaterial).color.setScalar(a)
    ;(m.blinkB as THREE.MeshBasicMaterial).color.setScalar(b)
    ;(m.flame as THREE.MeshStandardMaterial).emissiveIntensity = animate ? 2.2 + Math.sin(t * 9) * 0.4 + Math.sin(t * 15.7) * 0.25 : 2.3
  })
  return null
}
export interface ThemeManorProps {
  layout: ManorLayoutData
  view: ManorView
  level?: Level
  wallMode?: WallMode
  showUpper: boolean
  quality: Quality
  /** Draws a profile's suit for the vault pods (the same gear the agents wear). */
  suit: SuitParts
  /** Where the camera is looking; the sixth light follows it. */
  focus: Vec3
  /** True while agents brief at the war table (its projection turns amber). */
  briefing?: boolean
  anchors?: MutableRefObject<Map<string, THREE.Object3D>>
  selectedAnchor?: THREE.Object3D | null
  selectedStatus?: string
  hour?: number
  reducedMotion?: boolean
  children?: ReactNode
}
export default function ThemeManor({
  layout,
  view,
  level = 'ground',
  wallMode = 'cutaway',
  showUpper,
  quality,
  suit,
  focus,
  briefing = false,
  anchors,
  selectedAnchor,
  selectedStatus,
  hour,
  reducedMotion,
  children,
}: ThemeManorProps) {
  const localHour = useLocalHour()
  const reduced = useReducedMotion()
  const animate = !(reducedMotion ?? reduced)
  const profile = QUALITY[quality]
  const sun = terraceSun(hour ?? localHour)

  // 3-Level hierarchy:
  // - deck: Command Deck (subterranean cave + hangar + ops room). Surface is hidden.
  // - ground: Grand Manor (ground floor + terrace + pool + grounds). Deck is hidden.
  // - upper: Upper Level (ground floor + upper floor + roof). Deck is hidden.
  const isDeck = level === 'deck' || (view === 'deck' || view === 'hangar')
  const isManor = level === 'ground' || level === 'upper' || (view === 'manor' || view === 'lobby' || view === 'exterior' || view === 'overview')
  const isUpper = level === 'upper' || showUpper

  const reach = layout.camera.overview.maxDistance
  const underground = isDeck && !isManor
  const sky = underground ? '#07090d' : sun.sky

  return <>
    <color attach="background" args={[sky]}/>
    {quality !== 'low' ? <fog attach="fog" args={[underground ? '#07090d' : sun.fog, reach * 0.8, reach * 2.6]}/> : null}
    <ProceduralEnvironment intensity={underground ? 0.28 : sun.daylight ? 0.5 : 0.3}/>
    <Lights layout={layout} profile={profile} hour={hour ?? localHour} focus={focus} animate={animate} view={view}/>
    <Animation animate={animate}/>
    {isDeck && <>
      <SubterraneanCave layout={layout} profile={profile} briefing={briefing} animate={animate} frontOnly={view === 'overview'}/>
      {(view === 'deck' || level === 'deck') && <SuitVault layout={layout} suit={suit}/>}
      <HangarBay layout={layout} animate={animate} shadows={profile.shadows === 'all'}/>
    </>}
    {isManor && <>
      <ExteriorGrounds layout={layout} profile={profile} view={view}/>
      <CliffGrounds layout={layout} profile={profile} grass={view !== 'overview'}/>
      <SurfaceManor layout={layout} profile={profile} showUpper={isUpper} wallMode={wallMode}/>
      <Roof layout={layout} level={level} wallMode={wallMode} quality={quality} reducedMotion={!animate}/>
      <TerracePool layout={layout} profile={profile} animate={animate}/>
    </>}
    <WaterfallMesh layout={layout} profile={profile} animate={animate} view={view}/>
    <VerticalShaft layout={layout} view={view} anchors={anchors}/>
    {selectedAnchor && selectedStatus && (
      <Plumbob anchor={selectedAnchor} status={selectedStatus} reducedMotion={!animate} />
    )}
    {children}
  </>
}
