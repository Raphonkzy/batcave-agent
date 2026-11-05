import { LEVEL_Y, type ItemType, type LayoutItem, type LevelId, type Stop, type ZoneId } from './types.ts'
/** Collects items and stops with stable, readable ids. */
export class Builder {
  items: LayoutItem[] = []
  stops: Stop[] = []
  private counter = 0
  item(type: ItemType, zone: ZoneId, level: LevelId, x: number, z: number, w: number, d: number, h: number, rotY = 0, extra: Pick<LayoutItem, 'role' | 'owner'> & { y?: number } = {}): LayoutItem {
    this.counter += 1
    const { y, ...rest } = extra
    const item: LayoutItem = { id: `${type}-${this.counter}`, type, zone, level, x, y: y ?? LEVEL_Y[level], z, w, d, h, rotY, ...rest }
    this.items.push(item)
    return item
  }
  stop(kind: string, zone: ZoneId, level: LevelId, x: number, z: number, facing: number, extra: Pick<Stop, 'seated' | 'owner' | 'profile'> & { y?: number } = {}): Stop {
    const { y, ...rest } = extra
    const stop: Stop = { id: `${kind}-${this.stops.length + 1}`, kind, zone, level, x, y: y ?? LEVEL_Y[level], z, facing, ...rest }
    this.stops.push(stop)
    return stop
  }
}
/** Direction an item faces (its local +z) or an agent looks, as a rotation about y. */
export const facingTo = (dx: number, dz: number) => Math.atan2(dx, dz)
export const NORTH = Math.PI
export const SOUTH = 0
export const EAST = Math.PI / 2
export const WEST = -Math.PI / 2
