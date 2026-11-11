import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CAVE_CEILING, SURFACE_Y } from '../../utils/layout/dimensions.ts'
import { glowSprite } from './textures.ts'
import { box, shape, type Part } from './parts.ts'
import { buildWorldBatches } from './batches.ts'
import { Batches } from './Instanced.tsx'
import { isDeckView, type ManorLayoutData, type ManorView, type QualityProfile } from './ZoneLayout.ts'
// The waterfall from the pool's vanishing edge to the basin: a thick falling sheet with a
// procedural noise shader whose texture scrolls down in useFrame, foam where it lands, and (high
// quality) mist rising from the plunge.
const vertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const fragment = /* glsl */ `
uniform float uOffset;
uniform float uDetail;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  // vUv.y is 0 at the basin (bottom) and 1 at the pool lip (top). The pattern scrolls towards the
  // basin, so the stream reads as falling under gravity.
  vec2 p = vec2(vUv.x * 9.0, vUv.y * 3.0 + uOffset);
  float streaks = noise(vec2(p.x, p.y * 0.35)) * 0.6 + noise(p * 2.3) * 0.4 * uDetail;
  float foam = smoothstep(0.12, 0.0, vUv.y) + smoothstep(0.92, 1.0, vUv.y) * 0.5;
  vec3 deep = vec3(0.33, 0.62, 0.72);
  vec3 white = vec3(0.92, 0.97, 1.0);
  vec3 colour = mix(deep, white, clamp(streaks * 0.9 + foam, 0.0, 1.0));
  float alpha = 0.55 + streaks * 0.35 + foam * 0.2;
  gl_FragColor = vec4(colour, clamp(alpha, 0.0, 0.95));
}`
export function WaterfallMesh({ layout, profile, animate, view }: { layout: ManorLayoutData; profile: QualityProfile; animate: boolean; view: ManorView }) {
  // Independent natural spring: moving the recreational pool must not move the deck waterfall.
  const stream = { z: (layout.chasm.minZ + layout.chasm.maxZ) / 2, width: Math.min(4, layout.chasm.maxZ - layout.chasm.minZ - 1) }
  const x = layout.chasm.minX + 0.5
  // On the deck view the rock above is lifted away, so only the part inside the cave is drawn.
  const top = isDeckView(view) ? CAVE_CEILING : SURFACE_Y + 0.02
  const height = top - layout.chasm.waterY
  const rocks = useMemo(() => {
    const parts: Part[] = []
    // Two irregular rock shoulders enclose the spring without covering the falling channel.
    for (const side of [-1, 1]) for (let row = 0; row < 5; row++) {
      const h = height / 5, cy = layout.chasm.waterY + h * (row + 0.5)
      parts.push(shape('ico', 'wetRock', [x - 0.45, cy, stream.z + side * (stream.width / 2 + 0.55 + (row % 2) * 0.2)], [2.4, h * 1.65, 1.7], [row * 0.21, side * row * 0.4, 0]))
    }
    parts.push(box('wetRock', [x - 0.9, top - 0.28, stream.z], [1.6, 0.4, stream.width + 1.6]))
    return buildWorldBatches(parts)
  }, [height, layout.chasm.waterY, stream.width, stream.z, top, x])
  const material = useMemo(() => new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uOffset: { value: 0 }, uDetail: { value: 1 } } }), [])
  const mist = useRef<THREE.Group>(null)
  const foam = useRef<THREE.Mesh>(null)
  // 18 drifting mist puffs spread across the plunge, each rising and fading on its own phase.
  const puffs = useMemo(() => Array.from({ length: 18 }, (_, index) => ({ dz: ((index % 9) - 4) * 0.42, dx: ((index / 9) | 0) * 0.5, phase: index * 0.21, material: new THREE.SpriteMaterial({ map: glowSprite(), color: '#e6f6ff', transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false }) })), [])
  const foamMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#eaf8ff', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), [])
  material.uniforms.uDetail.value = profile.waterfall === 'full' ? 1 : 0
  useFrame(({ clock }, delta) => {
    const now = clock.elapsedTime
    // Reduced motion freezes the falling texture; low and medium quality scroll a simpler pattern.
    // Subtract so the sampled texture moves down the sheet (towards the basin), not up.
    if (animate) material.uniforms.uOffset.value -= delta * (profile.waterfall === 'full' ? 1.4 : 1.0)
    // The impact foam ring pulses softly where the sheet meets the basin.
    if (foam.current) {
      const pulse = animate ? 0.9 + Math.sin(now * 2.6) * 0.12 + Math.sin(now * 4.1) * 0.06 : 1
      foam.current.scale.set(pulse, pulse, 1)
      foamMaterial.opacity = animate ? 0.38 + Math.sin(now * 2.6) * 0.12 : 0.45
    }
    mist.current?.children.forEach((child, index) => {
      const t = animate ? (now * 0.18 + puffs[index].phase) % 1 : 0.4
      child.position.y = layout.chasm.waterY + 0.3 + t * 2.6
      ;(child as THREE.Sprite).material.opacity = 0.3 * Math.sin(t * Math.PI)
    })
  })
  useEffect(() => () => { material.dispose(); foamMaterial.dispose(); puffs.forEach(puff => puff.material.dispose()) }, [material, foamMaterial, puffs])
  return <group name="CommandDeckWaterfall">
    <Batches batches={rocks} shadows={false}/>
    <mesh position={[x, top - height / 2, stream.z]} material={material}><boxGeometry args={[0.7, height, stream.width]}/></mesh>
    <mesh position={[x - 0.4, top - 0.02, stream.z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.5, stream.width]}/><meshStandardMaterial color="#83b7c0" roughness={0.08} metalness={0.2}/></mesh>
    <mesh ref={foam} position={[x, layout.chasm.waterY + 0.02, stream.z]} rotation={[-Math.PI / 2, 0, 0]} material={foamMaterial}><ringGeometry args={[0.5, 1.7, 28]}/></mesh>
    {profile.mist && <group ref={mist}>{puffs.map((puff, index) => <sprite key={index} position={[x + 0.4 + puff.dx, layout.chasm.waterY + 0.5, stream.z + puff.dz]} scale={[1.8, 1.8, 1]} material={puff.material}/>)}</group>}
  </group>
}
