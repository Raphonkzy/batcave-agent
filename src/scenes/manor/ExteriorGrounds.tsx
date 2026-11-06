import { useMemo, useRef, useLayoutEffect } from 'react'
import * as THREE from 'three'
import { SURFACE_Y } from '../../utils/layout/dimensions.ts'
import { geometryFor, manorMaterials } from './materials.ts'
import { lawnMap, tiled, concreteMap } from './textures.ts'
import { Glows } from './Glows.tsx'
import type { ManorLayoutData, QualityProfile, ManorView } from './ZoneLayout.ts'
import { WORLD_CONFIG } from './worldConfig.ts'

export interface ExteriorGroundsProps {
  layout: ManorLayoutData
  profile: QualityProfile
  view: ManorView
}

const LOT_BOUNDS = {
  minX: WORLD_CONFIG.lot.minX,
  maxX: WORLD_CONFIG.lot.maxX,
  minZ: WORLD_CONFIG.lot.minZ,
  maxZ: WORLD_CONFIG.lot.maxZ,
  gateZ: WORLD_CONFIG.gate.position[2],
  frontDoorZ: WORLD_CONFIG.entrance.threshold[2],
}

export function ExteriorGrounds({ layout, profile, view }: ExteriorGroundsProps) {
  const m = manorMaterials()
  const treeRef = useRef<THREE.InstancedMesh>(null)
  const pillarRef = useRef<THREE.InstancedMesh>(null)

  // 1. Procedural grass material for estate lawn (multi-tone organic lawn)
  const lawnMaterial = useMemo(() => {
    const texture = tiled(lawnMap(), 24, 28)
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.95,
      metalness: 0.05,
      color: '#3d5c34',
    })
  }, [])

  // 2. Driveway cobblestone material
  const drivewayMaterial = useMemo(() => {
    const texture = tiled(concreteMap(), 4, 16)
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.85,
      metalness: 0.1,
      color: '#2a322d',
    })
  }, [])

  // 3. Low stone wall & pillars around perimeter
  const { pillars, hedgePositions, treePositions, lanterns } = useMemo(() => {
    const pList: { x: number; y: number; z: number }[] = []
    const hList: { x: number; y: number; z: number; w: number; d: number }[] = []
    const tList: { x: number; y: number; z: number; scale: number }[] = []
    const lList: [number, number, number][] = []

    const y = SURFACE_Y

    // Perimeter pillars along front wall (Z = LOT_BOUNDS.minZ), leaving 7m opening for gate
    for (let x = LOT_BOUNDS.minX; x <= LOT_BOUNDS.maxX; x += 4) {
      if (Math.abs(x) < 3.5) continue // Grand Gate opening at center
      pList.push({ x, y: y + 0.6, z: LOT_BOUNDS.minZ })
    }

    // Gate pillars
    pList.push({ x: -3.5, y: y + 1.1, z: LOT_BOUNDS.minZ })
    pList.push({ x: 3.5, y: y + 1.1, z: LOT_BOUNDS.minZ })
    lList.push([-3.5, y + 2.4, LOT_BOUNDS.minZ])
    lList.push([3.5, y + 2.4, LOT_BOUNDS.minZ])

    // Side boundary pillars (West wall: X = minX, East wall: X = maxX)
    for (let z = LOT_BOUNDS.minZ + 4; z <= LOT_BOUNDS.maxZ; z += 6) {
      pList.push({ x: LOT_BOUNDS.minX, y: y + 0.6, z })
      if (z < layout.chasm.minZ) {
        pList.push({ x: LOT_BOUNDS.maxX, y: y + 0.6, z })
      }
    }

    // Driveway border hedges (Z = -44 to -12, X = +/- 2.6)
    for (let z = LOT_BOUNDS.minZ + 4; z <= LOT_BOUNDS.frontDoorZ - 4; z += 3.5) {
      hList.push({ x: -2.8, y: y + 0.35, z, w: 0.6, d: 3.2 })
      hList.push({ x: 2.8, y: y + 0.35, z, w: 0.6, d: 3.2 })
    }

    // Gothic pine trees along perimeter corners and driveway buffer
    const treeCoords = [
      [-28, -42], [-22, -44], [-16, -42], [-26, -34], [-28, -26], [-26, -18], [-28, -10],
      [28, -42], [22, -44], [16, -42], [26, -34], [28, -26], [26, -18],
      [-26, 6], [-28, 16], [-26, 26], [-18, 28],
    ]
    const count = Math.ceil(treeCoords.length * (profile.density < 0.8 ? 0.4 : 1.0))
    for (let i = 0; i < count; i++) {
      const [tx, tz] = treeCoords[i]
      tList.push({ x: tx, y, z: tz, scale: 0.85 + (i % 3) * 0.2 })
    }

    // Formal garden roundabout lanterns
    lList.push([-4.0, y + 1.8, -25])
    lList.push([4.0, y + 1.8, -25])

    return { pillars: pList, hedgePositions: hList, treePositions: tList, lanterns: lList }
  }, [layout, profile.density])

  // Instanced pillars matrix setup
  useLayoutEffect(() => {
    const mesh = pillarRef.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    pillars.forEach((p, idx) => {
      dummy.position.set(p.x, p.y, p.z)
      dummy.scale.set(0.6, 1.2, 0.6)
      dummy.updateMatrix()
      mesh.setMatrixAt(idx, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [pillars])

  // Instanced trees matrix setup
  useLayoutEffect(() => {
    const mesh = treeRef.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    treePositions.forEach((t, idx) => {
      dummy.position.set(t.x, t.y + 3.0 * t.scale, t.z)
      dummy.scale.set(t.scale * 1.8, t.scale * 6.0, t.scale * 1.8)
      dummy.updateMatrix()
      mesh.setMatrixAt(idx, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [treePositions])

  const lotWidth = LOT_BOUNDS.maxX - LOT_BOUNDS.minX
  const lotDepth = LOT_BOUNDS.maxZ - LOT_BOUNDS.minZ
  const lotCenterX = (LOT_BOUNDS.minX + LOT_BOUNDS.maxX) / 2
  const lotCenterZ = (LOT_BOUNDS.minZ + LOT_BOUNDS.maxZ) / 2

  const isDeck = view === 'deck' || view === 'hangar'
  if (isDeck) return null

  return (
    <group name="ExteriorGrounds">
      {/* 1. Main Estate Lawn Plane (100% full grass coverage) */}
      <mesh
        position={[lotCenterX, SURFACE_Y - 0.03, lotCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={lawnMaterial}
        receiveShadow
      >
        <planeGeometry args={[lotWidth, lotDepth]} />
      </mesh>

      {/* 2. Extended Surrounding Grounds (>= 3x lot dimensions, lush grass with no void) */}
      <mesh
        position={[lotCenterX, SURFACE_Y - 0.04, lotCenterZ - 15]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={lawnMaterial}
        receiveShadow
      >
        <planeGeometry args={[192, 240]} />
      </mesh>

      {/* 3. Front Terrace Steps right at Door D [0, SURFACE_Y, -8.0] */}
      <mesh
        position={[0, SURFACE_Y + 0.1, -8.75]}
        material={m.stone}
        receiveShadow
      >
        <boxGeometry args={[4.2, 0.2, 1.5]} />
      </mesh>

      {/* 4. Stone Path (2.0m width) connecting terrace to formal garden roundabout */}
      <mesh
        position={[0, SURFACE_Y - 0.02, -14.75]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={drivewayMaterial}
        receiveShadow
      >
        <planeGeometry args={[2.0, 10.5]} />
      </mesh>

      {/* 5. Formal Garden Roundabout (Z = -20 to -30) */}
      <mesh
        position={[0, SURFACE_Y - 0.02, -25.0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={drivewayMaterial}
        receiveShadow
      >
        <circleGeometry args={[5.0, 32]} />
      </mesh>
      {/* Center grass island in roundabout */}
      <mesh
        position={[0, SURFACE_Y - 0.01, -25.0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={lawnMaterial}
        receiveShadow
      >
        <circleGeometry args={[2.2, 24]} />
      </mesh>

      {/* 6. Driveway (4.0m width) connecting roundabout to Grand Gate */}
      <mesh
        position={[0, SURFACE_Y - 0.02, -38.0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={drivewayMaterial}
        receiveShadow
      >
        <planeGeometry args={[4.0, 16.0]} />
      </mesh>

      {/* 7. Instanced Stone Pillars */}
      {pillars.length > 0 && (
        <instancedMesh
          ref={pillarRef}
          args={[geometryFor('box'), m.stone, pillars.length]}
          castShadow={profile.shadows === 'all'}
          receiveShadow
        />
      )}

      {/* 8. Instanced Gothic Pine Trees */}
      {treePositions.length > 0 && (
        <instancedMesh
          ref={treeRef}
          args={[geometryFor('cone'), m.leaf, treePositions.length]}
          castShadow={profile.shadows !== 'none'}
          receiveShadow
        />
      )}

      {/* 9. Formal Boxwood Hedges */}
      {hedgePositions.map((h, i) => (
        <mesh
          key={i}
          position={[h.x, h.y, h.z]}
          material={m.leather}
          castShadow={profile.shadows === 'all'}
          receiveShadow
        >
          <boxGeometry args={[h.w, 0.7, h.d]} />
        </mesh>
      ))}

      {/* 10. Front Gate Ironwork */}
      <group position={[0, SURFACE_Y + 1.2, LOT_BOUNDS.minZ]}>
        <mesh position={[-1.7, 0, 0]} material={m.blackSteel}>
          <boxGeometry args={[3.0, 2.2, 0.08]} />
        </mesh>
        <mesh position={[1.7, 0, 0]} material={m.blackSteel}>
          <boxGeometry args={[3.0, 2.2, 0.08]} />
        </mesh>
      </group>

      {/* 11. Warm Amber Atmospheric Lanterns */}
      <Glows
        glows={lanterns.map((pos) => ({ position: pos, color: '#f2c58a' }))}
        size={2.2}
        opacity={0.65}
        flicker
        animate={true}
      />
    </group>
  )
}
