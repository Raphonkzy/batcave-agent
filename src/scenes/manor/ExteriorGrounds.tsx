import { useMemo, useRef, useLayoutEffect } from 'react'
import * as THREE from 'three'
import { SURFACE_Y } from '../../utils/layout/dimensions.ts'
import { geometryFor, manorMaterials } from './materials.ts'
import { lawnMap, tiled, concreteMap } from './textures.ts'
import { Glows } from './Glows.tsx'
import type { ManorLayoutData, QualityProfile, ManorView } from './ZoneLayout.ts'

export interface ExteriorGroundsProps {
  layout: ManorLayoutData
  profile: QualityProfile
  view: ManorView
}

// Estate lot dimensions: 64m wide (X: -32 to 32), 80m deep (Z: -48 to 32)
// Total lot area = 5,120 m² (~3.95x manor footprint)
// Front yard depth: Z = -48 to -8 (40m deep, 90.9% of exterior yard depth)
const LOT_BOUNDS = {
  minX: -32,
  maxX: 32,
  minZ: -48,
  maxZ: 32,
  gateZ: -46,
  frontDoorZ: -8,
}

export function ExteriorGrounds({ layout, profile, view }: ExteriorGroundsProps) {
  const m = manorMaterials()
  const treeRef = useRef<THREE.InstancedMesh>(null)
  const pillarRef = useRef<THREE.InstancedMesh>(null)

  // 1. Procedural grass material for estate lawn
  const lawnMaterial = useMemo(() => {
    const texture = tiled(lawnMap(), 16, 20)
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.95,
      metalness: 0.05,
      color: '#415b36',
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

    // Perimeter pillars along front wall (Z = LOT_BOUNDS.minZ), leaving 6m opening for gate
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

    // Driveway lanterns
    lList.push([-3.2, y + 1.8, -32])
    lList.push([3.2, y + 1.8, -32])
    lList.push([-3.2, y + 1.8, -18])
    lList.push([3.2, y + 1.8, -18])

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
      {/* 1. Main Estate Lawn Plane */}
      <mesh
        position={[lotCenterX, SURFACE_Y - 0.03, lotCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={lawnMaterial}
        receiveShadow
      >
        <planeGeometry args={[lotWidth, lotDepth]} />
      </mesh>

      {/* 2. Extended Surrounding Hills/Terrain to prevent floating island look */}
      <mesh
        position={[lotCenterX, SURFACE_Y - 0.25, lotCenterZ - 15]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={m.rock}
        receiveShadow
      >
        <planeGeometry args={[160, 180]} />
      </mesh>

      {/* 3. Central Cobblestone Driveway */}
      <mesh
        position={[0, SURFACE_Y - 0.02, (LOT_BOUNDS.gateZ + LOT_BOUNDS.frontDoorZ) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={drivewayMaterial}
        receiveShadow
      >
        <planeGeometry args={[4.8, Math.abs(LOT_BOUNDS.frontDoorZ - LOT_BOUNDS.gateZ)]} />
      </mesh>

      {/* 4. Driveway Porte-Cochère Forecourt Circle in front of Manor entrance */}
      <mesh
        position={[0, SURFACE_Y - 0.015, LOT_BOUNDS.frontDoorZ - 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={drivewayMaterial}
        receiveShadow
      >
        <circleGeometry args={[5.5, 24]} />
      </mesh>

      {/* 5. Instanced Stone Pillars */}
      {pillars.length > 0 && (
        <instancedMesh
          ref={pillarRef}
          args={[geometryFor('box'), m.stone, pillars.length]}
          castShadow={profile.shadows === 'all'}
          receiveShadow
        />
      )}

      {/* 6. Instanced Gothic Pine Trees */}
      {treePositions.length > 0 && (
        <instancedMesh
          ref={treeRef}
          args={[geometryFor('cone'), m.leaf, treePositions.length]}
          castShadow={profile.shadows !== 'none'}
          receiveShadow
        />
      )}

      {/* 7. Formal Boxwood Hedges */}
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

      {/* 8. Front Gate Ironwork */}
      <group position={[0, SURFACE_Y + 1.2, LOT_BOUNDS.minZ]}>
        <mesh position={[-1.7, 0, 0]} material={m.blackSteel}>
          <boxGeometry args={[3.0, 2.2, 0.08]} />
        </mesh>
        <mesh position={[1.7, 0, 0]} material={m.blackSteel}>
          <boxGeometry args={[3.0, 2.2, 0.08]} />
        </mesh>
      </group>

      {/* 9. Warm Amber Atmospheric Lanterns */}
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
