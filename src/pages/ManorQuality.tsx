import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { QUALITY_LABELS, QUALITY_LEVELS } from './manorQuality.ts'
import type * as THREE from 'three'
import type { Quality } from '../scenes/manor/ZoneLayout.ts'
// Quality setting (High / Medium / Low), kept per browser under `batcave.quality`, with an automatic
// step down when the frame rate stays below 30 FPS for 5 seconds in a row.
export function QualityPicker({ quality, choice, onChoose }: { quality: Quality; choice: Quality; onChoose: (quality: Quality) => void }) {
  return <div className="manor-quality" role="group" aria-label="Quality">
    <span>Quality</span>
    {QUALITY_LEVELS.map((level) => <button key={level} type="button" className={quality === level ? 'active' : ''} aria-pressed={quality === level} onClick={() => onChoose(level)} title={level === choice ? `${QUALITY_LABELS[level]} (saved in this browser)` : `Switch to ${QUALITY_LABELS[level]}`}>{QUALITY_LABELS[level]}</button>)}
    {quality !== choice && <small title="The frame rate stayed below 30 FPS for 5 seconds">auto-lowered</small>}
  </div>
}
declare global {
  interface Window {
    __batcaveRenderStats?: {
      fps: number
      calls: number
      triangles: number
      lights: number
      meshes: number
      casters: number
      geometries?: number
      textures?: number
      quality?: string
      frameTimes?: number[]
      p50?: number
      p95?: number
    }
    __ruangRenderStats?: unknown
  }
}
/** Samples the frame rate once a second; in development or with ?debugStats also publishes draw calls and stats. */
export function FrameReporter({ onSample }: { onSample: (fps: number) => void }) {
  const { gl, scene } = useThree()
  const frames = useRef(0)
  const since = useRef(performance.now())
  const lastFrame = useRef(performance.now())
  const frameDeltas = useRef<number[]>([])

  useFrame(() => {
    frames.current += 1
    const now = performance.now()
    const delta = now - lastFrame.current
    lastFrame.current = now
    if (frameDeltas.current.length < 300) {
      frameDeltas.current.push(delta)
    }

    if (now - since.current < 1000) return
    const fps = (frames.current * 1000) / (now - since.current)
    frames.current = 0
    since.current = now
    onSample(fps)

    const isDebugStats = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debugStats')
    if (import.meta.env.DEV || isDebugStats) {
      let lights = 0
      let meshes = 0
      let casters = 0
      scene.traverseVisible((object) => {
        if ((object as THREE.Light).isLight) lights += 1
        if ((object as THREE.Mesh).isMesh || (object as THREE.Sprite).isSprite) { meshes += 1; if (object.castShadow) casters += 1 }
      })

      const sortedDeltas = [...frameDeltas.current].sort((a, b) => a - b)
      const p50 = sortedDeltas[Math.floor(sortedDeltas.length * 0.5)] ?? 0
      const p95 = sortedDeltas[Math.floor(sortedDeltas.length * 0.95)] ?? 0

      const stats = {
        fps: Math.round(fps * 10) / 10,
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        lights,
        meshes,
        casters,
        p50: Math.round(p50 * 10) / 10,
        p95: Math.round(p95 * 10) / 10,
      }
      window.__batcaveRenderStats = stats
      window.__ruangRenderStats = stats
    }
  })
  return null
}
