import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { fullManorShell } from './enclosure.ts'
import { roofPlan } from './roofPlan.ts'
import type { ManorLayoutData, Level, WallMode, Quality } from './ZoneLayout.ts'
import { manorMaterials } from './materials.ts'

interface RoofProps {
  layout: ManorLayoutData
  level: Level
  wallMode: WallMode
  quality: Quality
  reducedMotion?: boolean
}

/**
 * Procedural Hip/Gable Roof per manor wing (Section 5.3):
 * - Core foyer/lounge hip roof
 * - West wing hip roof
 * - East wing / Grand Library roof
 * - Small stone chimney / dormer above the hearth
 * - Dark brass/copper ridge caps
 * - Procedural slate shingle tiles
 * - Total draw calls <= 4 (merged geometry per material)
 * - Only visible when level === 'upper' && wallMode === 'wallsUp'
 */
export function Roof({ layout, level, wallMode, quality, reducedMotion = false }: RoofProps) {
  const groupRef = useRef<THREE.Group>(null)
  const isVisible = fullManorShell(level, wallMode)
  const animProgress = useRef(isVisible ? 1 : 0)

  const materials = useMemo(() => {
    const mats = manorMaterials()
    // Slate shingle material with tile bump and dark tone
    const slateMaterial = mats.stone.clone() as THREE.MeshStandardMaterial
    slateMaterial.color.set('#2a2e36')
    slateMaterial.roughness = 0.85
    slateMaterial.metalness = 0.15
    slateMaterial.transparent = true
    slateMaterial.opacity = 1

    // Dark copper/brass ridge cap trim material
    const trimMaterial = mats.brass.clone() as THREE.MeshStandardMaterial
    trimMaterial.color.set('#5c4d32')
    trimMaterial.metalness = 0.8
    trimMaterial.roughness = 0.4
    trimMaterial.transparent = true
    trimMaterial.opacity = 1

    // Chimney stone
    const chimneyMaterial = mats.stone.clone() as THREE.MeshStandardMaterial
    chimneyMaterial.color.set('#453f39')
    chimneyMaterial.roughness = 0.95
    chimneyMaterial.transparent = true
    chimneyMaterial.opacity = 1

    return { slate: slateMaterial, trim: trimMaterial, chimney: chimneyMaterial }
  }, [])

  // Build merged geometries for shingles, trim, and chimney
  const { shingleGeo, trimGeo, chimneyGeo } = useMemo(() => {
    const shingleGeos: THREE.BufferGeometry[] = []
    const trimGeos: THREE.BufferGeometry[] = []
    const chimneyGeos: THREE.BufferGeometry[] = []

    const sections = roofPlan(layout)
    const roofHeight = 2.4
    const baseY = Math.max(...sections.map(s=>s.y))

    // Hip Geometry generator
    function addHipRoof(x0: number, x1: number, z0: number, z1: number, yBase: number, yPeak: number) {
      const w = x1 - x0
      const d = z1 - z0
      const midX = (x0 + x1) / 2
      const isLongZ = d >= w

      const rZ0 = isLongZ ? z0 + w * 0.4 : (z0 + z1) / 2
      const rZ1 = isLongZ ? z1 - w * 0.4 : (z0 + z1) / 2
      const rX0 = isLongZ ? midX : x0 + d * 0.4
      const rX1 = isLongZ ? midX : x1 - d * 0.4

      const vertices: number[] = [
        // South slope
        x0, yBase, z1,  x1, yBase, z1,  rX1, yPeak, rZ1,
        x0, yBase, z1,  rX1, yPeak, rZ1,  rX0, yPeak, rZ1,

        // North slope
        x1, yBase, z0,  x0, yBase, z0,  rX0, yPeak, rZ0,
        x1, yBase, z0,  rX0, yPeak, rZ0,  rX1, yPeak, rZ0,

        // West slope
        x0, yBase, z0,  x0, yBase, z1,  rX0, yPeak, rZ1,
        x0, yBase, z0,  rX0, yPeak, rZ1,  rX0, yPeak, rZ0,

        // East slope
        x1, yBase, z1,  x1, yBase, z0,  rX1, yPeak, rZ0,
        x1, yBase, z1,  rX1, yPeak, rZ0,  rX1, yPeak, rZ1,
      ]

      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
      geo.computeVertexNormals()
      shingleGeos.push(geo)
      // A second closed surface and fascia give the slate a physical edge, not a paper plane.
      const underside = geo.clone().translate(0, -.12, 0)
      const positions = underside.getAttribute('position')
      for (let i=0;i<positions.count;i+=3) {
        const a = new THREE.Vector3().fromBufferAttribute(positions,i)
        const c = new THREE.Vector3().fromBufferAttribute(positions,i+2)
        positions.setXYZ(i,c.x,c.y,c.z); positions.setXYZ(i+2,a.x,a.y,a.z)
      }
      underside.computeVertexNormals(); shingleGeos.push(underside)
      // Slate courses follow each slope; merged into the existing trim draw call.
      for (let t=.12;t<.96;t+=.12) {
        const yy=yBase+(yPeak-yBase)*t+.012
        for (const side of [-1,1]) {
          const zz=side<0?z0+(rZ0-z0)*t:z1+(rZ1-z1)*t
          const xx=side<0?x0+(rX0-x0)*t:x1+(rX1-x1)*t
          const horizontal=new THREE.BoxGeometry(Math.max(.1,w*(1-t)+(rX1-rX0)*t),.025,.025)
          horizontal.translate(midX,yy,zz);trimGeos.push(horizontal)
          const vertical=new THREE.BoxGeometry(.025,.025,Math.max(.1,d*(1-t)+(rZ1-rZ0)*t))
          vertical.translate(xx,yy,(z0+z1)/2);trimGeos.push(vertical)
        }
      }

      // Ridge Cap Trim
      const ridgeLen = Math.max(0.2, Math.hypot(rX1 - rX0, rZ1 - rZ0))
      const ridgeGeo = new THREE.BoxGeometry(0.3, 0.12, ridgeLen + 0.2)
      if (!isLongZ) ridgeGeo.rotateY(Math.PI / 2)
      ridgeGeo.translate((rX0 + rX1) / 2, yPeak + 0.05, (rZ0 + rZ1) / 2)
      trimGeos.push(ridgeGeo)

      // Eave Fascia Trim around perimeter
      const fasciaThickness = 0.15
      const fasciaDepth = 0.2
      // South eave
      const eS = new THREE.BoxGeometry(w, fasciaDepth, fasciaThickness)
      eS.translate(midX, yBase - fasciaDepth / 2, z1)
      trimGeos.push(eS)
      // North eave
      const eN = new THREE.BoxGeometry(w, fasciaDepth, fasciaThickness)
      eN.translate(midX, yBase - fasciaDepth / 2, z0)
      trimGeos.push(eN)
      // West eave
      const eW = new THREE.BoxGeometry(fasciaThickness, fasciaDepth, d)
      eW.translate(x0, yBase - fasciaDepth / 2, (z0 + z1) / 2)
      trimGeos.push(eW)
      // East eave
      const eE = new THREE.BoxGeometry(fasciaThickness, fasciaDepth, d)
      eE.translate(x1, yBase - fasciaDepth / 2, (z0 + z1) / 2)
      trimGeos.push(eE)
    }

    // Every indoor footprint is covered, at its actual highest wall elevation.
    for (const section of sections) {
      const rise = Math.min(roofHeight, (section.maxX-section.minX)*0.3, (section.maxZ-section.minZ)*0.3)
      addHipRoof(section.minX-0.18,section.maxX+0.18,section.minZ-0.18,section.maxZ+0.18,section.y,section.y+Math.max(0.25,rise))
    }

    // 4. Chimney over Hearth
    const fire = layout.items.find((item) => item.type === 'fireplace')
    if (fire) {
      const chimW = 1.2
      const chimD = 1.0
      const chimH = 2.4
      const cap = new THREE.BoxGeometry(chimW+.24,.18,chimD+.24)
      cap.translate(fire.x,baseY+roofHeight+.7,fire.z);chimneyGeos.push(cap)
      const chimGeo = new THREE.BoxGeometry(chimW, chimH, chimD)
      chimGeo.translate(fire.x, baseY + roofHeight - 0.5, fire.z)
      chimneyGeos.push(chimGeo)

      // Chimney pot on top
      const potGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.6, 8)
      potGeo.translate(fire.x - 0.25, baseY + roofHeight + 0.8, fire.z)
      chimneyGeos.push(potGeo)

      const potGeo2 = new THREE.CylinderGeometry(0.2, 0.25, 0.6, 8)
      potGeo2.translate(fire.x + 0.25, baseY + roofHeight + 0.8, fire.z)
      chimneyGeos.push(potGeo2)
    }

    // Merge buffers
    const merge = (geos: THREE.BufferGeometry[]): THREE.BufferGeometry => {
      if (geos.length === 0) return new THREE.BufferGeometry()
      geos = geos.map(g => { if (!g.index) return g; const flat = g.toNonIndexed(); g.dispose(); return flat })
      let totalVerts = 0
      for (const g of geos) {
        totalVerts += g.attributes.position.count
      }
      const pos = new Float32Array(totalVerts * 3)
      const norm = new Float32Array(totalVerts * 3)
      let offset = 0
      for (const g of geos) {
        const p = g.attributes.position.array as Float32Array
        const n = g.attributes.normal?.array as Float32Array
        pos.set(p, offset * 3)
        if (n) norm.set(n, offset * 3)
        offset += g.attributes.position.count
      }
      const merged = new THREE.BufferGeometry()
      merged.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      merged.setAttribute('normal', new THREE.BufferAttribute(norm, 3))
      geos.forEach(g => g.dispose())
      return merged
    }

    return {
      shingleGeo: merge(shingleGeos),
      trimGeo: merge(trimGeos),
      chimneyGeo: merge(chimneyGeos),
    }
  }, [layout])

  useEffect(() => () => { shingleGeo.dispose(); trimGeo.dispose(); chimneyGeo.dispose() }, [shingleGeo, trimGeo, chimneyGeo])
  useEffect(() => () => { Object.values(materials).forEach(m => m.dispose()) }, [materials])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const target = isVisible ? 1 : 0
    if (reducedMotion) {
      animProgress.current = target
    } else {
      const k = 1 - Math.exp(-delta * 8)
      animProgress.current = THREE.MathUtils.lerp(animProgress.current, target, k)
    }

    const t = animProgress.current
    groupRef.current.visible = t > 0.01
    // Lift up 1.5 units while fading in/out
    groupRef.current.position.y = (1 - t) * 1.5
    materials.slate.opacity = t
    materials.trim.opacity = t
    materials.chimney.opacity = t
  })

  const castShadow = quality === 'high'

  return (
    <group name="ManorRoof" ref={groupRef} visible={isVisible}>
      <mesh geometry={shingleGeo} material={materials.slate} castShadow={castShadow} receiveShadow={false} />
      <mesh geometry={trimGeo} material={materials.trim} castShadow={castShadow} receiveShadow={false} />
      <mesh geometry={chimneyGeo} material={materials.chimney} castShadow={castShadow} receiveShadow={false} />
    </group>
  )
}
