import { useFrame, useThree } from '@react-three/fiber'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CameraPreset } from '../../utils/layout/types.ts'
// Orbit, pan and zoom, plus smooth flights between the presets (Command Deck, Hangar Bay, Manor Lobby,
// Grand Manor, Full Overview, Exterior). Flights are damped in useFrame; with reduced motion the camera jumps instead.
export interface ManorCameraHandle {
  reset: () => void
  snapRotate: (direction: 1 | -1) => void
  zoom: (direction: 1 | -1) => void
  follow: (target: THREE.Vector3 | null) => void
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
  }
>(function ManorCamera({ preset, panMode, keyTarget, smooth, followTarget }, handle) {
  const { camera, gl, size } = useThree()
  const controls = useRef<OrbitControls | null>(null)
  const flight = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  const activeFollow = useRef<THREE.Vector3 | null>(null)

  useEffect(() => {
    activeFollow.current = followTarget ?? null
  }, [followTarget])

  /**
   * The preset's view, framed within the safe area free of HUD panels,
   * with 8% margin so the whole floor/manor fits across all screen sizes.
   */
  const goal = useMemo(() => () => {
    const target = new THREE.Vector3(...preset.target)
    const offset = new THREE.Vector3(...preset.position).sub(target)

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
        flight.current = goal()
      },
      snapRotate,
      zoom: (direction: 1 | -1) => {
        const orbit = controls.current
        if (!orbit) return
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
        activeFollow.current = target
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
    orbit.screenSpacePanning = false
    orbit.minPolarAngle = 0.15
    orbit.maxPolarAngle = Math.PI / 2 - 0.05
    orbit.keyPanSpeed = 25
    controls.current = orbit
    const start = goal()
    camera.position.copy(start.position)
    orbit.target.copy(start.target)
    orbit.update()
    return () => { orbit.dispose(); controls.current = null }
    // Created once per canvas; later presets fly the camera instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl])
  useEffect(() => {
    const orbit = controls.current
    if (!orbit) return
    orbit.minDistance = preset.minDistance
    orbit.maxDistance = Math.max(preset.maxDistance, goal().position.distanceTo(goal().target) * 1.5)
    flight.current = goal()
  }, [preset, goal])
  useEffect(() => {
    const orbit = controls.current
    if (!orbit) return
    orbit.mouseButtons.LEFT = panMode ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE
    orbit.mouseButtons.RIGHT = panMode ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN
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
      if (camera.position.distanceTo(trip.position) < 0.05 && orbit.target.distanceTo(trip.target) < 0.05) flight.current = null
    } else if (activeFollow.current) {
      const follow = activeFollow.current
      const k = smooth ? 1 - Math.exp(-delta * 4.0) : 1
      const offset = camera.position.clone().sub(orbit.target)
      orbit.target.lerp(follow, k)
      camera.position.copy(orbit.target).add(offset)
    }
    orbit.update()
    // Keep the view over the manor: clamp the target to the preset's pan bounds.
    const { pan } = preset
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
