import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import type * as THREE from 'three'
import { Batches } from './Instanced.tsx'
import { buildWorldBatches } from './batches.ts'
import { advanceGate, gateLeafParts, GATE_HINGE_X, GATE_OPEN_ANGLE } from './gateGeometry.ts'
import type { Vec3 } from '../../utils/layout/types.ts'

export interface EstateGateProps {
  position: Vec3
  open: boolean
  selected: boolean
  interactive: boolean
  reducedMotion: boolean
  shadows: boolean
  onSelect: () => void
  onSettled: (open: boolean) => void
}

export function EstateGate({ position, open, selected, interactive, reducedMotion, shadows, onSelect, onSettled }: EstateGateProps) {
  const left = useRef<THREE.Group>(null), right = useRef<THREE.Group>(null)
  const angle = useRef(open ? GATE_OPEN_ANGLE : 0)
  const settled = useRef<boolean | null>(null)
  const [hovered, setHovered] = useState(false)
  const batches = useMemo(() => buildWorldBatches(gateLeafParts(selected || hovered)), [selected, hovered])
  useFrame((_, delta) => {
    const next = advanceGate(angle.current, open, delta, reducedMotion)
    angle.current = next
    if (left.current) left.current.rotation.y = next
    if (right.current) right.current.rotation.y = Math.PI - next
    const target = open ? GATE_OPEN_ANGLE : 0
    if (next !== target) settled.current = null
    else if (settled.current !== open) { settled.current = open; onSettled(open) }
  })
  const select = (event: ThreeEvent<MouseEvent>) => {
    if (!interactive || event.button !== 0 || event.delta > 4) return
    event.stopPropagation()
    onSelect()
  }
  return <group name="EstateEntranceGate" position={position} onClick={select}
    onPointerOver={event => { if (interactive) { event.stopPropagation(); setHovered(true) } }}
    onPointerOut={() => setHovered(false)}>
    <group name="EstateGateLeft" ref={left} position={[-GATE_HINGE_X, 0, 0]} rotation={[0, angle.current, 0]}>
      <Batches batches={batches} shadows={shadows}/>
    </group>
    <group name="EstateGateRight" ref={right} position={[GATE_HINGE_X, 0, 0]} rotation={[0, Math.PI - angle.current, 0]}>
      <Batches batches={batches} shadows={shadows}/>
    </group>
  </group>
}
