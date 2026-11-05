import * as THREE from 'three'
import { screenKindFor, type ScreenKind } from '../../components/ui/screenFeeds.ts'
import type { OfficeStation } from '../../types.ts'
import type { Placement } from '../../utils/layout/placements.ts'
import type { LayoutItem, ManorLayoutData } from '../../utils/layout/types.ts'
// Where the screens are (from the layout items that carry them) and what each one shows (from the
// state of the agent working there, or a fixed picture for the shared displays).
export type ScreenSource = 'desk' | 'console' | 'rig' | 'holo' | 'server' | 'catwalk' | 'utility'
export interface ScreenSlot { source: ScreenSource; item: LayoutItem; index: number; matrix: THREE.Matrix4; normal: THREE.Vector3 }
const up = new THREE.Vector3(0, 1, 0)
function place(item: LayoutItem, local: [number, number, number], size: [number, number], tilt = 0, yaw = 0): { matrix: THREE.Matrix4; normal: THREE.Vector3 } {
  const turn = new THREE.Quaternion().setFromAxisAngle(up, item.rotY)
  const position = new THREE.Vector3(...local).applyQuaternion(turn).add(new THREE.Vector3(item.x, item.y, item.z))
  const rotation = turn.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, 0)))
  return { matrix: new THREE.Matrix4().compose(position, rotation, new THREE.Vector3(size[0], size[1], 1)), normal: new THREE.Vector3(0, 0, 1).applyQuaternion(rotation) }
}
/** Every lit screen in the manor (all on the deck: the manor upstairs has none). */
export function screenSlots(layout: ManorLayoutData): ScreenSlot[] {
  const slots: ScreenSlot[] = []
  const add = (source: ScreenSource, item: LayoutItem, index: number, at: { matrix: THREE.Matrix4; normal: THREE.Vector3 }) => slots.push({ source, item, index, ...at })
  for (const item of layout.items) {
    switch (item.type) {
      case 'desk': for (const side of [-1, 1]) add('desk', item, side, place(item, [side * 0.36, 1.06, -0.303], [0.6, 0.33], 0, -side * 0.22)); break
      case 'consoleArc': {
        const rig = item.role === 'barbara'
        for (const x of rig ? [-0.42, 0, 0.42] : [0]) add(rig ? 'rig' : 'console', item, x, place(item, [x, 1.2, -0.163], [0.36, 0.24], 0.15, -x * 0.5))
        break
      }
      case 'holoPanel': for (let tier = 0; tier < 3; tier += 1) add('holo', item, tier, place(item, [0, 0.25 + tier * 0.85 + 0.425, -0.025], [item.w - 0.08, 0.78])); break
      case 'serverTerminal': add('server', item, 0, place(item, [0, 1.35, -0.143], [item.w * 0.8, 0.45], 0.12)); break
      case 'catwalkConsole': add('catwalk', item, 0, place(item, [0, 1.35, -0.143], [item.w * 0.8, 0.45], 0.12)); break
      case 'utilityConsole': add('utility', item, 0, place(item, [0, 1.45, -0.183], [item.w * 0.65, 0.4])); break
      default: break
    }
  }
  return slots
}
const HOLO_CYCLE: ScreenKind[] = ['graphs', 'telemetry', 'topology', 'schedule', 'graphs', 'code', 'telemetry', 'graphs', 'topology']
/** What each slot shows. Desk and role screens follow the agent there; shared displays are fixed. */
export function slotKinds(slots: ScreenSlot[], stations: OfficeStation[], placements: Placement[], briefing: boolean): ScreenKind[] {
  const at = (kind: string, owner?: number) => stations.find((station, index) => placements[index]?.kind === kind && (owner === undefined || Math.max(station.seat, 1) - 1 === owner))
  const profile = (id: string, kind: string) => stations.find((station, index) => station.id.toLowerCase() === id && placements[index]?.kind === kind)
  return slots.map((slot) => {
    switch (slot.source) {
      case 'desk': { const station = at('desk', slot.item.owner); return station ? screenKindFor(station) : 'off' }
      case 'rig': { const station = profile('barbara', 'devRig'); return station ? screenKindFor(station) : 'code' }
      case 'console': return HOLO_CYCLE[Math.abs(Math.round(slot.item.x * 7)) % HOLO_CYCLE.length]
      case 'holo': return briefing && slot.index === 1 ? 'topology' : HOLO_CYCLE[(Number(slot.item.role ?? 0) + slot.index * 4) % HOLO_CYCLE.length]
      case 'server': { const station = profile('jason', 'serverTerminal'); return station ? screenKindFor(station) : 'telemetry' }
      case 'catwalk': { const station = profile('dick', 'catwalk'); return station ? screenKindFor(station) : 'checklist' }
      case 'utility': { const station = profile('alfred', 'utility'); return station ? screenKindFor(station) : 'schedule' }
    }
  })
}
