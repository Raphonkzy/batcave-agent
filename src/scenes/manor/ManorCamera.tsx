import { useFrame, useThree } from '@react-three/fiber'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { bindPointerGestures } from './pointerGestures.ts'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CameraPreset } from '../../utils/layout/types.ts'
import { CAMERA_CONFIG, focusGoal, pushOutOfBoxes, retargetGoal, type Box, type CameraConfig } from './cameraRig.ts'
// Sims-style camera: left-drag orbits, right/middle-drag pans, wheel zooms, all damped. Smooth flights
// (presets, focus, floor switches, saved views) are damped in useFrame, interrupted by any user input,
// and never touch the orbit angle unless asked to (only `frame`/`reset`/`restoreView` do).
// Solid geometry (walls, floors, large furniture) keeps the camera out of it; the check only runs
// when the camera actually moved. With reduced motion the camera jumps instead of flying.
export interface ManorCameraHandle {
  reset: () => void
  snapRotate: (direction: 1 | -1) => void
  zoom: (direction: 1 | -1) => void
  follow: (target: THREE.Vector3 | null) => void
  /** Move the orbit target onto `target`, keeping the viewing angle. With a `radius` the zoom is eased to frame it. */
  focus: (target: THREE.Vector3, radius?: number) => void
  frame: (preset: CameraPreset) => void
  /** Re-aim at another area (floor switch, recenter) keeping rotation and zoom. */
  retarget: (preset: CameraPreset) => void
  saveView: () => void
  restoreView: () => boolean
}
const KEY_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'])
export const ManorCamera = forwardRef<
  ManorCameraHandle,
  {
    preset: CameraPreset
    panMode: boolean
    keyTarget: HTMLElement | null
    smooth: boolean
    followTarget?: THREE.Vector3 | null
    onFollowEnd?: () => void
    enabled?: boolean
    /** Solid boxes the camera must stay out of (see buildObstacles). */
    obstacles?: readonly Box[]
    config?: Partial<CameraConfig>
  }
>(function ManorCamera({ preset, panMode, keyTarget, smooth, followTarget, onFollowEnd, enabled = true, obstacles, config }, handle) {
  const { camera, gl, size } = useThree()
  const cfg = useMemo<CameraConfig>(() => ({ ...CAMERA_CONFIG, ...config }), [config])
  const cfgRef = useRef(cfg)
  cfgRef.current = cfg
  const controls = useRef<OrbitControls | null>(null)
  const flight = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  const activeFollow = useRef<THREE.Vector3 | null>(null)
  const onFollowEndRef = useRef(onFollowEnd)
  onFollowEndRef.current = onFollowEnd
  const solids = useRef<readonly Box[]>([])
  const checked = useRef(new THREE.Vector3())
  const dirty = useRef(true)
  const saved = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  const scratch = useRef({ offset: new THREE.Vector3(), resolved: new THREE.Vector3(), shift: new THREE.Vector3() })

  useEffect(() => {
    activeFollow.current = followTarget ?? null
  }, [followTarget])
  useEffect(() => { solids.current = obstacles ?? []; dirty.current = true }, [obstacles])

  /**
   * The preset's view, framed within the safe area free of HUD panels,
   * with 8% margin so the whole floor/manor fits across all screen sizes.
   */
  const goal = useMemo(() => (framing = preset) => {
    const target = new THREE.Vector3(...framing.target)
    const offset = new THREE.Vector3(...framing.position).sub(target)

    let hudTop = 0
    let hudBottom = 0
    if (typeof window !== 'undefined') {
      hudTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hud-top')) || 0
      hudBottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hud-bottom')) || 0
    }

    const effectiveHeight = Math.max(size.height - hudTop - hudBottom, 200)
    const effectiveAspect = size.width / effectiveHeight

    // Scale distance based on effective aspect with 8% margin
    const distMultiplier = Math.max(1, 1.25 / effectiveAspect) * 1.08
    offset.setLength(offset.length() * distMultiplier)

    // Center building between top bar and bottom HUD
    const verticalShift = ((hudBottom - hudTop) / Math.max(size.height, 1)) * 0.1
    const adjustedTarget = target.clone().add(new THREE.Vector3(0, verticalShift * offset.length() * 0.2, 0))

    return { position: adjustedTarget.clone().add(offset), target: adjustedTarget }
  }, [preset, size.width, size.height])

  const stopFollow = useCallback(() => {
    activeFollow.current = null
    onFollowEndRef.current?.()
  }, [])
  /** Start a flight whose end point is already clear of solids, so it can always finish. */
  const fly = useCallback((next: { position: THREE.Vector3; target: THREE.Vector3 }) => {
    if (solids.current.length) pushOutOfBoxes(next.position, next.position, solids.current, cfgRef.current.collisionMargin)
    flight.current = next
  }, [])

  const snapRotate = useCallback((direction: 1 | -1) => {
    const orbit = controls.current
    if (!orbit) return
    stopFollow()
    const offset = camera.position.clone().sub(orbit.target)
    const angle = (direction * Math.PI) / 2
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
    fly({
      position: orbit.target.clone().add(offset),
      target: orbit.target.clone(),
    })
  }, [camera, fly, stopFollow])

  useImperativeHandle(
    handle,
    () => ({
      reset: () => {
        stopFollow()
        fly(goal())
      },
      frame: (next: CameraPreset) => {
        stopFollow()
        fly(goal(next))
      },
      retarget: (next: CameraPreset) => {
        const orbit = controls.current
        if (!orbit) return
        stopFollow()
        fly(retargetGoal(camera.position, orbit.target, next, cfgRef.current))
      },
      snapRotate,
      zoom: (direction: 1 | -1) => {
        const orbit = controls.current
        if (!orbit) return
        stopFollow()
        const offset = camera.position.clone().sub(orbit.target)
        // dir > 0 zoom in, dir < 0 zoom out
        const factor = direction > 0 ? 0.8 : 1.25
        const newLen = THREE.MathUtils.clamp(
          offset.length() * factor,
          orbit.minDistance,
          orbit.maxDistance
        )
        offset.setLength(newLen)
        fly({
          position: orbit.target.clone().add(offset),
          target: orbit.target.clone(),
        })
      },
      follow: (target: THREE.Vector3 | null) => {
        flight.current = null
        activeFollow.current = target
      },
      focus: (target: THREE.Vector3, radius?: number) => {
        const orbit = controls.current
        if (!orbit) return
        stopFollow()
        const perspective = camera as THREE.PerspectiveCamera
        fly(focusGoal(camera.position, orbit.target, target, radius, perspective.fov ?? 40, size.width / Math.max(size.height, 1), cfgRef.current))
      },
      saveView: () => {
        const orbit = controls.current
        if (orbit) saved.current = { position: camera.position.clone(), target: orbit.target.clone() }
      },
      restoreView: () => {
        const view = saved.current
        if (!view) return false
        stopFollow()
        fly({ position: view.position.clone(), target: view.target.clone() })
        return true
      },
    }),
    [goal, snapRotate, camera, fly, stopFollow, size.width, size.height]
  )
  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement)
    const c = cfgRef.current
    // Damped, slightly slower than the defaults, and never dipping below the horizon of the
    // target or fully top-down (that would put the camera inside the rock / flip the view).
    orbit.enableDamping = true
    orbit.dampingFactor = 0.06
    orbit.rotateSpeed = c.rotateSpeed
    orbit.panSpeed = c.panSpeed
    orbit.zoomSpeed = c.zoomSpeed
    orbit.screenSpacePanning = true
    orbit.minPolarAngle = c.minPolarAngle
    orbit.maxPolarAngle = c.maxPolarAngle
    orbit.keyPanSpeed = 25
    const interrupt = () => {
      flight.current = null
      activeFollow.current = null
      onFollowEndRef.current?.()
    }
    const releaseGestures = bindPointerGestures(gl.domElement, orbit, c.dragThreshold)
    orbit.addEventListener('start', interrupt)
    controls.current = orbit
    const start = goal()
    camera.position.copy(start.position)
    orbit.target.copy(start.target)
    orbit.update()
    checked.current.copy(camera.position)
    return () => { releaseGestures(); orbit.removeEventListener('start', interrupt); orbit.dispose(); controls.current = null }
    // Created once per canvas; later presets fly the camera instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl])
  // Numeric preset identity: unrelated renders/resizes must never restart a flight.
  const presetKey = JSON.stringify(preset)
  useEffect(() => {
    const orbit = controls.current
    if (!orbit) return
    activeFollow.current = null
    onFollowEndRef.current?.()
    orbit.minDistance = cfgRef.current.minDistance
    orbit.maxDistance = Math.max(cfgRef.current.maxDistance, preset.maxDistance, camera.position.distanceTo(orbit.target))
    // Floor/cutaway changes update reset framing, not the current camera or target.
    // Explicit frame/reset/retarget flights are owned by their initiating action.
    // Numeric changes alone never start a flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetKey])
  useEffect(() => { if (controls.current) controls.current.enabled = enabled }, [enabled])
  useEffect(() => {
    const orbit = controls.current
    if (!orbit) return
    orbit.mouseButtons.LEFT = THREE.MOUSE.ROTATE
    orbit.mouseButtons.MIDDLE = THREE.MOUSE.PAN
    orbit.mouseButtons.RIGHT = THREE.MOUSE.PAN
    orbit.touches.ONE = panMode ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE
  }, [panMode])
  useEffect(() => {
    const orbit = controls.current
    if (!orbit || !keyTarget) return
    // Arrow-key panning must not fire while typing or while operating sliders, buttons and links
    // that live inside the scene region. OrbitControls listens on a proxy that only receives
    // keystrokes aimed at the region itself, so other handlers (Escape, shortcuts) are untouched.
    const proxy = new EventTarget()
    const forward = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null
      if (el && el !== keyTarget && (el.isContentEditable || KEY_TAGS.has(el.tagName) || el.closest('[role="dialog"], [role="menu"]'))) return
      const copy = new KeyboardEvent('keydown', { key: event.key, code: event.code, ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey, altKey: event.altKey, cancelable: true })
      proxy.dispatchEvent(copy)
      if (copy.defaultPrevented) event.preventDefault()
    }
    keyTarget.addEventListener('keydown', forward)
    orbit.listenToKeyEvents(proxy as unknown as HTMLElement)
    return () => { keyTarget.removeEventListener('keydown', forward); orbit.stopListenToKeyEvents() }
  }, [keyTarget])
  useFrame((_, delta) => {
    const orbit = controls.current
    if (!orbit) return
    const s = scratch.current
    const trip = flight.current
    if (trip) {
      const k = smooth ? 1 - Math.exp(-delta * cfg.flightRate) : 1
      camera.position.lerp(trip.position, k)
      orbit.target.lerp(trip.target, k)
      if (camera.position.distanceTo(trip.position) < 0.05 && orbit.target.distanceTo(trip.target) < 0.05) {
        camera.position.copy(trip.position); orbit.target.copy(trip.target); flight.current = null
      }
    } else if (activeFollow.current) {
      const follow = activeFollow.current
      const k = smooth ? 1 - Math.exp(-delta * cfg.followRate) : 1
      const offset = s.offset.copy(camera.position).sub(orbit.target)
      orbit.target.lerp(follow, k)
      camera.position.copy(orbit.target).add(offset)
    }
    // OrbitControls damping is frame-based; normalize it for software/slow GPUs.
    orbit.dampingFactor = 1 - Math.exp(-Math.max(delta, 1 / 240) * cfg.dampingRate)
    orbit.update()
    // Keep targets above the active floor, even after keyboard pan.
    const floor = -10
    if (camera.position.y < floor + 0.5) camera.position.y = floor + 0.5
    // Keep the view over the manor: clamp the target to the pan bounds.
    const pan = cfg.panBounds
    const x = Math.min(Math.max(orbit.target.x, pan.minX), pan.maxX)
    const z = Math.min(Math.max(orbit.target.z, pan.minZ), pan.maxZ)
    if (x !== orbit.target.x || z !== orbit.target.z) {
      const shift = s.shift.set(x - orbit.target.x, 0, z - orbit.target.z)
      orbit.target.add(shift)
      camera.position.add(shift)
    }
    // Obstruction: only when the camera moved (or the geometry changed). The camera is pushed out
    // of the box it entered through the side it came from, so it slides along walls instead of
    // jumping. Small corrections are applied at once; large ones (e.g. walls raised around the
    // camera) are eased in.
    const boxes = solids.current
    if (boxes.length && (dirty.current || camera.position.distanceToSquared(checked.current) > 1e-6)) {
      dirty.current = false
      s.resolved.copy(camera.position)
      if (pushOutOfBoxes(s.resolved, checked.current, boxes, cfg.collisionMargin)) {
        const distance = s.resolved.distanceTo(camera.position)
        if (distance <= cfg.snapLimit) camera.position.copy(s.resolved)
        else camera.position.lerp(s.resolved, smooth ? 1 - Math.exp(-delta * 10) : 1)
        camera.lookAt(orbit.target)
        if (distance > cfg.snapLimit) dirty.current = true
      }
      checked.current.copy(camera.position)
    }
  })
  return null
})
