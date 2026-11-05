import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Glows } from '../../scenes/manor/Glows.tsx'
import type { ScreenSlot } from '../../scenes/manor/screens.ts'
import { GLOW, screenFeeds, SCREEN_KINDS, type ScreenKind } from './screenFeeds.ts'
// Every lit screen: the picture (emissive, with scanlines baked into its canvas) on the bezel the
// furniture already has, plus a soft additive glow in front of it. One instanced mesh per picture
// and one point cloud for all the glows, so screens add a dozen draw calls at most, and no lights.
/** Redraws per second by quality: animated, simple, or a single still frame. */
export const FEED_RATE = { animated: 12, simple: 4, static: 0 } as const
const plane = new THREE.PlaneGeometry(1, 1)
function KindMesh({ kind, matrices }: { kind: ScreenKind; matrices: THREE.Matrix4[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const material = useMemo(() => new THREE.MeshBasicMaterial({ map: screenFeeds().textures[kind], toneMapped: false }), [kind])
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [matrices])
  return <instancedMesh ref={ref} args={[plane, material, matrices.length]}/>
}
export function ScreenGlow({ slots, kinds, rate, animate }: { slots: ScreenSlot[]; kinds: ScreenKind[]; rate: number; animate: boolean }) {
  const feeds = useMemo(() => screenFeeds(), [])
  const groups = useMemo(() => SCREEN_KINDS.map((kind) => ({ kind, matrices: slots.filter((_, index) => kinds[index] === kind).map((slot) => slot.matrix) })).filter((group) => group.matrices.length > 0), [slots, kinds])
  const glows = useMemo(() => slots.flatMap((slot, index) => {
    const kind = kinds[index]
    if (kind === 'off') return []
    const position = new THREE.Vector3().setFromMatrixPosition(slot.matrix).addScaledVector(slot.normal, 0.08)
    return [{ position: position.toArray() as [number, number, number], color: GLOW[kind] }]
  }), [slots, kinds])
  const last = useRef(-1)
  useLayoutEffect(() => { feeds.update(0); last.current = 0 }, [feeds])
  useFrame(({ clock }) => {
    // Reduced motion and low quality keep a still picture; otherwise redraw at the quality's rate.
    if (!animate || rate === 0) return
    const tick = Math.floor(clock.elapsedTime * rate)
    if (tick === last.current) return
    last.current = tick
    feeds.update(clock.elapsedTime)
  })
  return <>
    {groups.map((group) => <KindMesh key={`${group.kind}:${group.matrices.length}`} kind={group.kind} matrices={group.matrices}/>)}
    <Glows glows={glows} size={0.9} opacity={0.35}/>
  </>
}
