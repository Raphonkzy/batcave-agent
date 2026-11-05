import { useMemo } from 'react'
import * as THREE from 'three'
import { POD } from '../../utils/layout/dimensions.ts'
import type { LayoutItem } from '../../utils/layout/types.ts'
import { buildWorldBatches, type SuitParts } from './batches.ts'
import { Batches } from './Instanced.tsx'
import { cyl, mannequinParts, shape, type Part } from './parts.ts'
import { Glows } from './Glows.tsx'
import type { ManorLayoutData } from './ZoneLayout.ts'
// The suit vault: exactly five glass pods on the west rock wall, each with a dark mannequin
// wearing that operative's suit, lit from below by an emissive ring and a fake uplight. The
// steward has no pod. The suits are drawn by `suitParts` (the same gear the agents wear).
function podParts(pod: LayoutItem, suit: SuitParts): Part[] {
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pod.rotY)
  const place = (part: Part, lift: number): Part => {
    const p = new THREE.Vector3(...part.p).applyQuaternion(turn)
    const r = part.r ? new THREE.Euler().setFromQuaternion(turn.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...part.r)))) : new THREE.Euler(0, pod.rotY, 0)
    return { ...part, p: [pod.x + p.x, pod.y + lift + p.y, pod.z + p.z], r: [r.x, r.y, r.z] }
  }
  const glassTop = POD.baseHeight + POD.glassHeight
  return [
    cyl('gunmetal', [pod.x, POD.baseHeight / 2, pod.z], [POD.baseRadius * 2, POD.baseHeight, POD.baseRadius * 2]),
    shape('torus', 'ledCyan', [pod.x, POD.baseHeight + 0.01, pod.z], [POD.glassRadius * 2, 1, POD.glassRadius * 2]),
    cyl('glass', [pod.x, POD.baseHeight + POD.glassHeight / 2, pod.z], [POD.glassRadius * 2, POD.glassHeight, POD.glassRadius * 2]),
    cyl('gunmetal', [pod.x, glassTop + POD.capHeight / 2, pod.z], [POD.baseRadius * 2, POD.capHeight, POD.baseRadius * 2]),
    shape('torus', 'ledCyan', [pod.x, glassTop - 0.02, pod.z], [POD.glassRadius * 2, 1, POD.glassRadius * 2]),
    ...[...mannequinParts(), ...suit(pod.role ?? '')].map((part) => place(part, POD.baseHeight + 0.05)),
  ]
}
export function SuitVault({ layout, suit }: { layout: ManorLayoutData; suit: SuitParts }) {
  const pods = useMemo(() => layout.items.filter((item) => item.type === 'suitPod'), [layout])
  const batches = useMemo(() => buildWorldBatches(pods.flatMap((pod) => podParts(pod, suit))), [pods, suit])
  return <group>
    <Batches batches={batches}/>
    <Glows glows={pods.map((pod) => ({ position: [pod.x, POD.baseHeight + 0.5, pod.z], color: '#00ffcc' }))} size={1.8} opacity={0.45}/>
  </group>
}
