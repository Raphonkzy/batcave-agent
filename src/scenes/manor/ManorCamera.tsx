import { useFrame, useThree } from '@react-three/fiber'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { bindPointerGestures } from './pointerGestures.ts'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CameraPreset } from '../../utils/layout/types.ts'
// Orbit, pan and zoom, plus smooth flights between the presets (Command Deck, Hangar Bay, Manor Lobby,
// Grand Manor, Full Overview, Exterior). Flights are damped in useFrame; with reduced motion the camera jumps instead.
export interface ManorCameraHandle {
  reset: () => void
  snapRotate: (direction: 1 | -1) => void
  zoom: (direction: 1 | -1) => void
  follow: (target: THREE.Vector3 | null) => void
  focus: (target: THREE.Vector3) => void
  frame: (preset: CameraPreset) => void
}
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
  }
>(function ManorCamera({ preset, panMode, keyTarget, smooth, followTarget, onFollowEnd, enabled = true }, handle) {
  const { camera, gl, size } = useThree()
  const controls = useRef<OrbitControls | null>(null)
  const flight = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  const activeFollow = useRef<THREE.Vector3 | null>(null)
  const onFollowEndRef = useRef(onFollowEnd)
  onFollowEndRef.current = onFollowEnd

  useEffect(() => {
    activeFollow.current = followTarget ?? null
  }, [followTarget])

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

  const snapRotate = useCallback((direction: 1 | -1) => {
    const orbit = controls.current
    if (!orbit) return
    activeFollow.current = null
    onFollowEndRef.current?.()
    const offset = camera.position.clone().sub(orbit.target)
    const angle = (direction * Math.PI) / 2
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
    flight.current = {
      position: orbit.target.clone().add(offset),
      target: orbit.target.clone(),
    }
  }, [camera])

  useImperativeHandle(
    handle,
    () => ({
      reset: () => {
        activeFollow.current = null
        onFollowEndRef.current?.()
        flight.current = goal()
      },
      frame: (next: CameraPreset) => {
        activeFollow.current = null
        onFollowEndRef.current?.()
        flight.current = goal(next)
      },
      snapRotate,
      zoom: (direction: 1 | -1) => {
        const orbit = controls.current
        if (!orbit) return
        activeFollow.current = null
        onFollowEndRef.current?.()
        const offset = camera.position.clone().sub(orbit.target)
        // dir > 0 zoom in, dir < 0 zoom out
        const factor = direction > 0 ? 0.8 : 1.25
        const newLen = THREE.MathUtils.clamp(
          offset.length() * factor,
          orbit.minDistance,
          orbit.maxDistance
        )
        offset.setLength(newLen)
        flight.current = {
          position: orbit.target.clone().add(offset),
          target: orbit.target.clone(),
        }
      },
      follow: (target: THREE.Vector3 | null) => {
        flight.current = null
        activeFollow.current = target
      },
      focus: (target: THREE.Vector3) => {
        const orbit = controls.current
        if (!orbit) return
        activeFollow.current = null
        onFollowEndRef.current?.()
        flight.current = {target: target.clone(), position: target.clone().add(camera.position.clone().sub(orbit.target))}
      },
    }),
    [goal, snapRotate, camera]
  )
  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement)
    // Tuned for smooth interaction: damped, slightly slower than the defaults, and never dipping
    // below the horizon of the target (that would put the camera inside the rock).
    orbit.enableDamping = true
    orbit.dampingFactor = 0.06
    orbit.rotateSpeed = 0.7
    orbit.panSpeed = 0.7
    orbit.zoomSpeed = 0.9
    orbit.screenSpacePanning = true
    orbit.minPolarAngle = 0.15
    orbit.maxPolarAngle = Math.PI / 2 - 0.05
    orbit.keyPanSpeed = 25
    const interrupt = () => {
      flight.current = null
      activeFollow.current = null
      onFollowEndRef.current?.()
    }
    const releaseGestures = bindPointerGestures(gl.domElement, orbit)
    orbit.addEventListener('start', interrupt)
    controls.current = orbit
    const start = goal()
    camera.position.copy(start.position)
    orbit.target.copy(start.target)
    orbit.update()
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
    orbit.minDistance = 2
    orbit.maxDistance = Math.max(300, preset.maxDistance, camera.position.distanceTo(orbit.target))
    // Floor/cutaway changes update reset framing, not the current camera or target.
    // Explicit frame/reset flights are owned by their initiating action.
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
    orbit.listenToKeyEvents(keyTarget)
    return () => orbit.stopListenToKeyEvents()
  }, [keyTarget])
  useFrame((_, delta) => {
    const orbit = controls.current
    if (!orbit) return
    const trip = flight.current
    if (trip) {
      const k = smooth ? 1 - Math.exp(-delta * 3.2) : 1
      camera.position.lerp(trip.position, k)
      orbit.target.lerp(trip.target, k)
      if (camera.position.distanceTo(trip.position) < 0.05 && orbit.target.distanceTo(trip.target) < 0.05) {
        camera.position.copy(trip.position); orbit.target.copy(trip.target); flight.current = null
      }
    } else if (activeFollow.current) {
      const follow = activeFollow.current
      const k = smooth ? 1 - Math.exp(-delta * 4.0) : 1
      const offset = camera.position.clone().sub(orbit.target)
      orbit.target.lerp(follow, k)
      camera.position.copy(orbit.target).add(offset)
    }
    // OrbitControls damping is frame-based; normalize it for software/slow GPUs.
    orbit.dampingFactor = 1 - Math.exp(-Math.max(delta, 1 / 240) * 12)
    orbit.update()
    // Keep targets above the active floor, even after keyboard pan.
    const floor = -10
    if (camera.position.y < floor + 0.5) camera.position.y = floor + 0.5
    // Keep the view over the manor: clamp the target to the preset's pan bounds.
    const pan = { minX: -200, maxX: 200, minZ: -200, maxZ: 300 }
    const x = Math.min(Math.max(orbit.target.x, pan.minX), pan.maxX)
    const z = Math.min(Math.max(orbit.target.z, pan.minZ), pan.maxZ)
    if (x !== orbit.target.x || z !== orbit.target.z) {
      const shift = new THREE.Vector3(x - orbit.target.x, 0, z - orbit.target.z)
      orbit.target.add(shift)
      camera.position.add(shift)
    }
  })
  return null
})
