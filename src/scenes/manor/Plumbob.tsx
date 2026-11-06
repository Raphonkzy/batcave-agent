import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

export function Plumbob({
  anchor,
  status,
  reducedMotion = false,
}: {
  anchor: THREE.Object3D | null
  status: string
  reducedMotion?: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const norm = status.toLowerCase()
  let color = '#7c808a' // idle
  if (norm === 'working' || norm === 'active') color = '#7bd3a0'
  else if (norm === 'collaborating' || norm === 'collab') color = '#8fb8ff'
  else if (norm === 'reviewing' || norm === 'review') color = '#c9a7ff'
  else if (norm === 'deploying' || norm === 'deploy') color = '#ffb86b'
  else if (norm === 'triage' || norm === 'error' || norm === 'failed') color = '#ff7a7a'

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.4,
    })
  }, [color])

  const geometry = useMemo(() => {
    const geo = new THREE.OctahedronGeometry(0.24, 0)
    geo.scale(0.8, 1.8, 0.8)
    return geo
  }, [])

  useFrame(({ clock }) => {
    if (!meshRef.current || !anchor || !anchor.visible) return
    const pos = anchor.position
    const t = clock.elapsedTime
    const bob = reducedMotion ? 0 : Math.sin(t * 3.5) * 0.08
    meshRef.current.position.set(pos.x, pos.y + 0.5 + bob, pos.z)
    if (!reducedMotion) {
      meshRef.current.rotation.y += 0.025
    }
  })

  if (!anchor || !anchor.visible) return null

  return <mesh ref={meshRef} geometry={geometry} material={material} castShadow={false} receiveShadow={false} />
}
