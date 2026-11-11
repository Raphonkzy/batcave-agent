import { useEffect, useMemo } from 'react'
import { estateBoundary } from './estateBoundary.ts'
import { EstateGate, type EstateGateProps } from './EstateGate.tsx'
import * as THREE from 'three'
import { SURFACE_Y } from '../../utils/layout/dimensions.ts'
import { buildWorldBatches } from './batches.ts'
import { Batches } from './Instanced.tsx'
import { Glows } from './Glows.tsx'
import { box, cyl, shape, type Part } from './parts.ts'
import { lawnMap, pavingMap, tiled } from './textures.ts'
import type { ManorLayoutData, QualityProfile, ManorView } from './ZoneLayout.ts'
import { estateConfig } from './worldConfig.ts'
import { gardenTree } from './landscape.ts'
import { poolFootprint, subtractFootprint } from './poolGeometry.ts'

export interface ExteriorGroundsProps { layout: ManorLayoutData; profile: QualityProfile; view: ManorView; gate?: Omit<EstateGateProps, 'position' | 'shadows'> }
/** Pool-facing entrance grounds. The former -Z driveway/roundabout is restored to lawn. */
export function ExteriorGrounds({ layout, profile, view, gate }: ExteriorGroundsProps) {
  const config = useMemo(() => estateConfig(layout), [layout])
  const lawn = useMemo(() => new THREE.MeshStandardMaterial({ map: tiled(lawnMap(), 36, 40), color: '#526b3d', roughness: 0.95 }), [])
  const lawnPatches = useMemo(() => {
    const pool=layout.items.find(item=>item.type==='infinityPool')!
    return subtractFootprint({minX:-96,maxX:96,minZ:-110,maxZ:130},poolFootprint(pool))
  }, [layout])
  const paving = useMemo(() => new THREE.MeshStandardMaterial({ map: tiled(pavingMap(), 2, 12), color: '#ded4be', roughness: 0.82 }), [])
  const { batches, lamps } = useMemo(() => {
    const parts: Part[] = estateBoundary(layout)
    const lamps: [number, number, number][] = []
    const y = SURFACE_Y
    const front = config.entrance.threshold[2]
    for (const side of [-1, 1]) {
      // Low clipped boxwood and urns mark the terrace, leaving a generous central opening.
      for (const x of [3.1, 5.2]) {
        parts.push(box('stone', [side * x, y + 0.25, front + 0.65], [0.7, 0.5, 0.7]), shape('sphere', 'leaf', [side * x, y + 0.85, front + 0.65], [0.75, 0.8, 0.75]))
      }
      for (let z = front + 7; z < config.gate.position[2] - 1; z += 4) {
        parts.push(box('leaf', [side * 2.7, y + 0.35, z], [0.6, 0.7, 2.6]))
      }
      for (const z of [front + 1.5, front + 8, front + 16, config.gate.position[2]]) {
        const x = side * (z === front + 1.5 ? 2.2 : 3.5)
        parts.push(cyl('blackSteel', [x, y + 0.9, z], [0.08, 1.8, 0.08]), box('lampWarm', [x, y + 1.9, z], [0.24, 0.34, 0.24]), shape('cone', 'brass', [x, y + 2.14, z], [0.4, 0.2, 0.4]))
        lamps.push([x, y + 1.9, z])
      }
      const gx = side * 3.8
      parts.push(box('stone', [gx, y + 1.1, config.gate.position[2]], [0.7, 2.2, 0.7]))
      const count = profile.density < 0.8 ? 4 : 8
      for (let i = 0; i < count; i += 1) {
        const x = side < 0 ? config.lot.minX + 2.5 : config.lot.maxX - 2.5
        const z = -14 + i * 6.4
        parts.push(...gardenTree(x, y, z, i + (side < 0 ? 20 : 100)))
      }
    }
    return { batches: buildWorldBatches(parts), lamps }
  }, [config, layout, profile.density])
  useEffect(() => () => { lawn.map?.dispose(); paving.map?.dispose(); lawn.dispose(); paving.dispose() }, [lawn, paving])
  if (view === 'deck' || view === 'hangar') return null
  const z = config.entrance.threshold[2]
  return <group name="PoolFacingEntranceGrounds">
    {lawnPatches.map((rect,index)=><mesh key={index} position={[(rect.minX+rect.maxX)/2, SURFACE_Y - 0.04, (rect.minZ+rect.maxZ)/2]} rotation={[-Math.PI / 2, 0, 0]} material={lawn} receiveShadow><planeGeometry args={[rect.maxX-rect.minX,rect.maxZ-rect.minZ]}/></mesh>)}
    {/* Terrace is a walkable layout zone, rendered by TerracePool at the same Y as the house. */}
    <mesh name="front-approach" position={[0, SURFACE_Y + 0.006, (z + 6 + config.gate.position[2]) / 2]} rotation={[-Math.PI / 2, 0, 0]} material={paving} receiveShadow><planeGeometry args={[config.pathWidth, config.gate.position[2] - z - 6]}/></mesh>
    <Batches batches={batches} shadows={profile.shadows === 'all'}/>
    {gate && <EstateGate {...gate} position={config.gate.position} shadows={profile.shadows === 'all'}/>}
    <Glows glows={lamps.map((position) => ({ position, color: '#ffdda8' }))} size={1.8} opacity={0.5}/>
  </group>
}
