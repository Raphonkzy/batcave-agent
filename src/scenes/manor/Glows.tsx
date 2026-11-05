import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { glowSprite } from './textures.ts'
// Soft additive halos (lamps, lanterns, pods, screens) drawn as one point cloud per call site:
// one draw call however many lamps there are. They only look like light; they are not lights.
export interface Glow { position: [number, number, number]; color: string }
export function Glows({ glows, size, opacity = 0.55, flicker = false, animate = true }: { glows: Glow[]; size: number; opacity?: number; flicker?: boolean; animate?: boolean }) {
  const geometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(glows.flatMap((glow) => glow.position), 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(glows.flatMap((glow) => new THREE.Color(glow.color).toArray()), 3))
    return geometry
  }, [glows])
  const material = useMemo(() => new THREE.PointsMaterial({ map: glowSprite(), size, sizeAttenuation: true, vertexColors: true, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), [size, opacity])
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])
  useFrame(({ clock }) => { if (flicker) material.opacity = animate ? opacity + Math.sin(clock.elapsedTime * 2.3) * 0.05 + Math.sin(clock.elapsedTime * 5.1) * 0.03 : opacity })
  if (glows.length === 0) return null
  return <points geometry={geometry} material={material} frustumCulled={false}/>
}
