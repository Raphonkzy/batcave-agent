import { footprintOf } from './geometry.ts'
import { overlappingItems, FLAT_TYPES } from './structure.ts'
import { unreachableStops } from './navigation.ts'
import type { ManorLayoutData, LayoutItem, ItemType } from './types.ts'

export interface LayoutValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

const SEAT_TARGETS: Partial<Record<ItemType, [ItemType[], number]>> = {
  chair: [['desk'], 1.5],
  consoleChair: [['consoleArc'], 1.5],
  highChair: [['banquetTable'], 1.5],
  leatherChair: [['billiardsTable'], 3.5],
  readingChair: [['sideTable'], 1.2],
  deskChair: [['studyDesk'], 1.2],
  armchair: [['execDesk'], 1.2],
  chesterfield: [['coffeeTable', 'fireplace'], 2.5],
  sunLounger: [['infinityPool'], 14],
  tubChair: [['loungeTable', 'coffeeTable'], 1.8],
}

const facing = (item: Pick<LayoutItem, 'rotY'>) => [Math.sin(item.rotY), Math.cos(item.rotY)]

export function validateLayout(layout: ManorLayoutData): LayoutValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. Check for physical AABB / 2D footprint overlaps
  const overlaps = overlappingItems(layout.items)
  for (const [a, b] of overlaps) {
    errors.push(`Overlap detected between ${a.id} (${a.type}) and ${b.id} (${b.type}) in ${a.zone}`)
  }

  // 2. Zone boundaries
  const zones = new Map(layout.zoneList.map((z) => [z.id, z]))
  for (const item of layout.items) {
    const zone = zones.get(item.zone)
    if (!zone) {
      errors.push(`Item ${item.id} has invalid zone ${item.zone}`)
      continue
    }
    const box = footprintOf(item)
    if (
      box.minX < zone.rect.minX - 1e-4 ||
      box.maxX > zone.rect.maxX + 1e-4 ||
      box.minZ < zone.rect.minZ - 1e-4 ||
      box.maxZ > zone.rect.maxZ + 1e-4
    ) {
      errors.push(`Item ${item.id} (${item.type}) exceeds bounds of zone ${item.zone}`)
    }
  }

  // 3. Reachability
  const unreachable = unreachableStops(layout)
  if (unreachable.length > 0) {
    errors.push(`Unreachable stops detected: ${unreachable.join(', ')}`)
  }

  // 4. Seats facing targets
  for (const seat of layout.items) {
    const rule = SEAT_TARGETS[seat.type]
    if (!rule) continue
    const [types, reach] = rule
    const [fx, fz] = facing(seat)
    const ok = layout.items.some((target) => {
      if (!types.includes(target.type) || target.level !== seat.level) return false
      const box = footprintOf(target)
      const dx = Math.min(Math.max(seat.x, box.minX), box.maxX) - seat.x
      const dz = Math.min(Math.max(seat.z, box.minZ), box.maxZ) - seat.z
      const distance = Math.hypot(dx, dz)
      return distance > 1e-9 && distance <= reach && (fx * dx + fz * dz) / distance > 0.65
    })
    if (!ok) {
      warnings.push(`Seat ${seat.id} (${seat.type}) in ${seat.zone} is not facing its expected target within ${reach}m`)
    }
  }

  // 5. Grand staircase clearances (>= 2.2m at foot)
  const stairs = layout.items.filter((i) => i.type === 'grandStair')
  for (const stair of stairs) {
    const foot = {
      minX: stair.x - 1.1,
      maxX: stair.x + 1.1,
      minZ: stair.z + stair.d / 2,
      maxZ: stair.z + stair.d / 2 + 2.2,
    }
    const blockers = layout.items
      .filter((i) => i.level === 'surface' && i.type !== 'grandStair' && !FLAT_TYPES.has(i.type))
      .filter((i) => {
        const box = footprintOf(i)
        return box.maxX > foot.minX && box.minX < foot.maxX && box.maxZ > foot.minZ && box.minZ < foot.maxZ
      })
    if (blockers.length > 0) {
      errors.push(`Staircase ${stair.id} foot is blocked by ${blockers.map((b) => b.id).join(', ')}`)
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  }
}
