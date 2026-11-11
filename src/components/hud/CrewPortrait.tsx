import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { agentGear } from '../agent/agentLooks.ts'
import { characterParts, PIVOTS, type Bone } from '../agent/rig.ts'
import { Batches } from '../../scenes/manor/Instanced.tsx'
import { buildWorldBatches } from '../../scenes/manor/batches.ts'

// A head-and-shoulders portrait of one crew member for the crew card. It draws the same
// procedural model the 3D scene uses (agentGear + characterParts), in its own small canvas, so
// the scene itself is not touched. Rendering is on demand: one frame per change, no animation loop.

const BONES = Object.keys(PIVOTS) as Bone[]

function Figure({ profile }: { profile: string }) {
  const bones = useMemo(() => {
    const parts = characterParts(agentGear(profile))
    return BONES.map((bone) => ({ bone, pivot: PIVOTS[bone], batches: buildWorldBatches(parts.filter((part) => part.bone === bone)) }))
  }, [profile])
  // dispose={null}: the geometries and materials are shared with the 3D scene and must survive here.
  return (
    <group dispose={null} rotation={[0, -0.42, 0]}>
      {bones.map(({ bone, pivot, batches }) => (
        <group key={bone} position={pivot}>
          <Batches batches={batches} shadows={false} />
        </group>
      ))}
    </group>
  )
}

/**
 * Lit only by a procedural room environment: no light objects, so the scene's six-light budget
 * (checked across src/components too) is untouched. The accent glow comes from the card behind.
 */
function Environment() {
  const { gl, scene, camera, invalidate } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const target = pmrem.fromScene(room, 0.04)
    scene.environment = target.texture
    scene.environmentIntensity = 1.35
    camera.lookAt(0, 1.38, 0)
    invalidate()
    return () => { scene.environment = null; target.dispose(); pmrem.dispose(); room.dispose?.() }
  }, [gl, scene, camera, invalidate])
  return null
}

/** On-demand rendering does not repaint when a child is removed, so ask for a frame on every change. */
function Repaint({ token }: { token: string }) {
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => { invalidate() }, [token, invalidate])
  return null
}

/**
 * The canvas stays mounted (one WebGL context for the session); `profile` undefined clears it to
 * transparent, so nothing of the previous agent stays behind the empty-state mark.
 */
export function CrewPortrait({ profile }: { profile?: string }) {
  return (
    <Canvas
      className="mo-portrait-canvas"
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      camera={{ position: [0, 1.6, 3.5], fov: 24, near: 0.1, far: 20 }}
      aria-hidden="true"
    >
      <Environment />
      <Repaint token={profile ?? ''} />
      {profile && <Figure key={profile} profile={profile} />}
    </Canvas>
  )
}
