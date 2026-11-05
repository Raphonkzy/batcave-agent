import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { LEVEL_Y, type Zone } from '../../utils/layout/types.ts'
import { carpetMap, checkerMarbleMap, concreteBump, concreteMap, mahoganyMap, marbleMap, parquetMap, pavingMap, steelPlateMap } from './textures.ts'
import { floorStyle, type FloorStyle } from './ZoneLayout.ts'
// Floor finishes. All zones with the same finish are merged into one mesh whose texture
// coordinates are in world units, so the floors cost one draw call per finish however many
// rooms (or suites) there are.
const MAPS: Record<FloorStyle['texture'], () => THREE.Texture> = { checker: checkerMarbleMap, parquet: parquetMap, marble: marbleMap, carpet: carpetMap, paving: pavingMap, grating: steelPlateMap, concrete: concreteMap, mahogany: mahoganyMap }
function mergedPlanes(zones: Zone[], tile: number, lift: number): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  zones.forEach((zone, index) => {
    const { minX, maxX, minZ, maxZ } = zone.rect
    const y = LEVEL_Y[zone.level] + lift
    positions.push(minX, y, minZ, maxX, y, minZ, maxX, y, maxZ, minX, y, maxZ)
    uvs.push(minX / tile, -minZ / tile, maxX / tile, -minZ / tile, maxX / tile, -maxZ / tile, minX / tile, -maxZ / tile)
    const base = index * 4
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2)
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
function slabs(zones: Zone[]): THREE.BufferGeometry {
  const parts = zones.map((zone) => {
    const { minX, maxX, minZ, maxZ } = zone.rect
    return new THREE.BoxGeometry(maxX - minX, 0.3, maxZ - minZ).translate((minX + maxX) / 2, LEVEL_Y[zone.level] - 0.15, (minZ + maxZ) / 2)
  })
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  for (const part of parts) {
    const offset = positions.length / 3
    positions.push(...(part.getAttribute('position').array as Float32Array))
    normals.push(...(part.getAttribute('normal').array as Float32Array))
    indices.push(...Array.from(part.getIndex()!.array, (value) => value + offset))
    part.dispose()
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  return geometry
}
const textures = new Map<string, THREE.Material>()
function floorMaterial(style: FloorStyle): THREE.Material {
  const key = `${style.texture}|${style.color}|${style.roughness}`
  let material = textures.get(key)
  if (!material) {
    const map = MAPS[style.texture]()
    map.wrapS = map.wrapT = THREE.RepeatWrapping
    material = new THREE.MeshStandardMaterial({ map, bumpMap: style.texture === 'concrete' ? concreteBump() : null, color: style.color, roughness: style.roughness, metalness: style.texture === 'grating' ? 0.6 : 0 })
    textures.set(key, material)
  }
  return material
}
const underside = new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.7 })
/** Floors of the given zones; zones of the upper floor also get a slab under them. */
export function Floors({ zones }: { zones: Zone[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, { zones: Zone[]; style: FloorStyle }>()
    for (const zone of zones) {
      const style = floorStyle(zone)
      const key = `${style.texture}|${style.color}|${style.tile}`
      const group = map.get(key)
      if (group) group.zones.push(zone)
      else map.set(key, { zones: [zone], style })
    }
    return [...map.values()].map((group) => ({ ...group, geometry: mergedPlanes(group.zones, group.style.tile, 0.004), material: floorMaterial(group.style) }))
  }, [zones])
  const upper = useMemo(() => {
    const raised = zones.filter((zone) => zone.level === 'surfaceUpper')
    return raised.length > 0 ? slabs(raised) : null
  }, [zones])
  useEffect(() => () => { for (const group of groups) group.geometry.dispose(); upper?.dispose() }, [groups, upper])
  return <>
    {groups.map((group) => <mesh key={`${group.style.texture}${group.style.color}${group.zones.length}`} geometry={group.geometry} material={group.material} receiveShadow/>)}
    {upper && <mesh geometry={upper} material={underside} castShadow receiveShadow/>}
  </>
}
