import { LEVEL_Y, type LevelId, type ManorLayoutData, type PathGrid, type Vec3 } from './types.ts'
// Walking routes through the manor. Agents plan on each floor's walking grid (furniture and walls
// are blocked, doors are the gaps), and the route is pulled straight wherever there is a clear
// line of sight. Changing floors goes by the glass elevator or one of the foyer staircases.
export type { Vec3 }
const NEIGHBOURS: [number, number, number][] = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]]
/** Crossing a seat or a bed costs this much more than open floor. */
const SOFT_COST = 6
const ORDER: LevelId[] = ['subterranean', 'surface', 'surfaceUpper']
export const levelOf = (y: number): LevelId => (y < (LEVEL_Y.subterranean + LEVEL_Y.surface) / 2 ? 'subterranean' : y < (LEVEL_Y.surface + LEVEL_Y.surfaceUpper) / 2 ? 'surface' : 'surfaceUpper')
export const gridFor = (layout: ManorLayoutData, level: LevelId): PathGrid => layout.paths.grids.find((grid) => grid.level === level)!
const free = (grid: PathGrid, c: number, r: number) => c >= 0 && r >= 0 && c < grid.cols && r < grid.rows && !grid.blocked[r * grid.cols + c]
const soft = (grid: PathGrid, c: number, r: number) => !!grid.soft?.[r * grid.cols + c]
const cellOf = (grid: PathGrid, res: number, x: number, z: number): [number, number] => [Math.floor((x - grid.minX) / res), Math.floor((z - grid.minZ) / res)]
const centreOf = (grid: PathGrid, res: number, c: number, r: number): [number, number] => [grid.minX + (c + 0.5) * res, grid.minZ + (r + 0.5) * res]
export function isWalkable(layout: ManorLayoutData, grid: PathGrid, x: number, z: number): boolean {
  const [c, r] = cellOf(grid, layout.paths.resolution, x, z)
  return free(grid, c, r)
}
function nearestFree(grid: PathGrid, res: number, x: number, z: number): [number, number] | undefined {
  const [c0, r0] = cellOf(grid, res, x, z)
  for (let radius = 0; radius <= 6; radius += 1) {
    let best: [number, number] | undefined
    let bestDistance = Infinity
    for (let dr = -radius; dr <= radius; dr += 1) for (let dc = -radius; dc <= radius; dc += 1) {
      if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius || !free(grid, c0 + dc, r0 + dr)) continue
      const [cx, cz] = centreOf(grid, res, c0 + dc, r0 + dr)
      const distance = Math.hypot(cx - x, cz - z) + (soft(grid, c0 + dc, r0 + dr) ? 0.75 : 0)
      if (distance < bestDistance) { best = [c0 + dc, r0 + dr]; bestDistance = distance }
    }
    if (best) return best
  }
  return undefined
}
class Heap {
  private keys: number[] = []
  private values: number[] = []
  get size() { return this.keys.length }
  push(key: number, value: number) {
    const { keys, values } = this
    keys.push(key); values.push(value)
    for (let index = keys.length - 1; index > 0;) {
      const parent = (index - 1) >> 1
      if (keys[parent] <= keys[index]) break
      ;[keys[parent], keys[index]] = [keys[index], keys[parent]]
      ;[values[parent], values[index]] = [values[index], values[parent]]
      index = parent
    }
  }
  pop(): number {
    const { keys, values } = this
    const top = values[0]
    const lastKey = keys.pop()!
    const lastValue = values.pop()!
    if (keys.length > 0) {
      keys[0] = lastKey; values[0] = lastValue
      for (let index = 0; ;) {
        const left = index * 2 + 1
        let smallest = index
        if (left < keys.length && keys[left] < keys[smallest]) smallest = left
        if (left + 1 < keys.length && keys[left + 1] < keys[smallest]) smallest = left + 1
        if (smallest === index) break
        ;[keys[smallest], keys[index]] = [keys[index], keys[smallest]]
        ;[values[smallest], values[index]] = [values[index], values[smallest]]
        index = smallest
      }
    }
    return top
  }
}
function aStar(grid: PathGrid, start: [number, number], goal: [number, number]): [number, number][] | undefined {
  const { cols } = grid
  const cost = new Float64Array(cols * grid.rows).fill(Infinity)
  const from = new Int32Array(cols * grid.rows).fill(-1)
  const heap = new Heap()
  const startIndex = start[1] * cols + start[0]
  const goalIndex = goal[1] * cols + goal[0]
  const heuristic = (c: number, r: number) => { const dx = Math.abs(c - goal[0]); const dy = Math.abs(r - goal[1]); return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy) }
  cost[startIndex] = 0
  heap.push(heuristic(...start), startIndex)
  while (heap.size > 0) {
    const at = heap.pop()
    if (at === goalIndex) {
      const route: [number, number][] = []
      for (let node = at; node !== -1; node = from[node]) route.push([node % cols, Math.floor(node / cols)])
      return route.reverse()
    }
    const c = at % cols
    const r = Math.floor(at / cols)
    for (const [dc, dr, step] of NEIGHBOURS) {
      const nc = c + dc
      const nr = r + dr
      if (!free(grid, nc, nr) || (dc !== 0 && dr !== 0 && (!free(grid, c + dc, r) || !free(grid, c, r + dr)))) continue
      const next = nr * cols + nc
      const through = cost[at] + step * (soft(grid, nc, nr) ? SOFT_COST : 1)
      if (through < cost[next]) { cost[next] = through; from[next] = at; heap.push(through + heuristic(nc, nr), next) }
    }
  }
  return undefined
}
/** Clear line of sight between two points, with a little clearance either side, over open floor. */
function visible(grid: PathGrid, res: number, a: [number, number], b: [number, number]): boolean {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1])
  const steps = Math.max(1, Math.ceil(length / 0.12))
  const nx = length > 0 ? -(b[1] - a[1]) / length : 0
  const nz = length > 0 ? (b[0] - a[0]) / length : 0
  for (let step = 0; step <= steps; step += 1) {
    const x = a[0] + ((b[0] - a[0]) * step) / steps
    const z = a[1] + ((b[1] - a[1]) * step) / steps
    for (const side of [0, 0.18, -0.18]) {
      const [c, r] = cellOf(grid, res, x + nx * side, z + nz * side)
      if (!free(grid, c, r) || soft(grid, c, r)) return false
    }
  }
  return true
}
/** Waypoints over one floor, ending exactly at `to`. */
function routeOnFloor(layout: ManorLayoutData, grid: PathGrid, from: [number, number], to: [number, number]): [number, number][] {
  const res = layout.paths.resolution
  if (Math.hypot(to[0] - from[0], to[1] - from[1]) < 0.3) return [to]
  const start = nearestFree(grid, res, from[0], from[1])
  const goal = nearestFree(grid, res, to[0], to[1])
  const cells = start && goal ? aStar(grid, start, goal) : undefined
  if (!cells) return [to]
  const points: [number, number][] = [from, ...cells.map(([c, r]) => centreOf(grid, res, c, r)), to]
  // Pull the route straight: from each anchor, jump to the furthest point still in clear sight.
  const route: [number, number][] = []
  for (let anchor = 0; anchor < points.length - 1;) {
    let furthest = anchor + 1
    for (let candidate = points.length - 1; candidate > anchor + 1; candidate -= 1) {
      if (visible(grid, res, points[anchor], points[candidate])) { furthest = candidate; break }
    }
    route.push(points[furthest])
    anchor = furthest
  }
  return route
}
/** Waypoints from one place to another on any floor; the last point is exactly `to`. */
export function planPath(layout: ManorLayoutData, from: Vec3, to: Vec3): Vec3[] {
  const route: Vec3[] = []
  let level = levelOf(from[1])
  let at: [number, number] = [from[0], from[2]]
  const goal = levelOf(to[1])
  const walk = (target: [number, number]) => {
    for (const [x, z] of routeOnFloor(layout, gridFor(layout, level), at, target)) route.push([x, LEVEL_Y[level], z])
    at = target
  }
  for (let guard = 0; level !== goal && guard < 4; guard += 1) {
    const next = ORDER[ORDER.indexOf(level) + (ORDER.indexOf(goal) > ORDER.indexOf(level) ? 1 : -1)]
    // The way to the next floor whose landing on this floor is nearest.
    const ways = layout.paths.links.flatMap((link) => link.a.level === level && link.b.level === next ? [{ on: link.a, off: link.b, via: link.via }] : link.b.level === level && link.a.level === next ? [{ on: link.b, off: link.a, via: [...link.via].reverse() }] : [])
    const way = ways.sort((p, q) => Math.hypot(p.on.x - at[0], p.on.z - at[1]) - Math.hypot(q.on.x - at[0], q.on.z - at[1]))[0]
    if (!way) break
    walk([way.on.x, way.on.z])
    route.push(...way.via, [way.off.x, LEVEL_Y[next], way.off.z])
    level = next
    at = [way.off.x, way.off.z]
  }
  walk([to[0], to[2]])
  if (route.length === 0) route.push(to)
  route[route.length - 1] = to
  return route
}
/**
 * Stops that cannot be walked to. Each floor's connected open area is the one holding its elevator
 * or stair landing, so a stop counts as reachable only if it is joined to the other floors too.
 */
export function unreachableStops(layout: ManorLayoutData): string[] {
  const res = layout.paths.resolution
  const missing: string[] = []
  for (const grid of layout.paths.grids) {
    const region = new Int32Array(grid.cols * grid.rows).fill(-1)
    const landing = layout.paths.links.flatMap((link) => [link.a, link.b]).find((point) => point.level === grid.level)!
    const seed = nearestFree(grid, res, landing.x, landing.z)
    if (!seed) { missing.push(...layout.paths.stops.filter((stop) => stop.level === grid.level).map((stop) => stop.id)); continue }
    const queue = [seed[1] * grid.cols + seed[0]]
    region[queue[0]] = 1
    for (let head = 0; head < queue.length; head += 1) {
      const c = queue[head] % grid.cols
      const r = Math.floor(queue[head] / grid.cols)
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!free(grid, c + dc, r + dr)) continue
        const next = (r + dr) * grid.cols + c + dc
        if (region[next] === -1) { region[next] = 1; queue.push(next) }
      }
    }
    const linked = (x: number, z: number) => {
      const [c0, r0] = cellOf(grid, res, x, z)
      for (let dr = -2; dr <= 2; dr += 1) for (let dc = -2; dc <= 2; dc += 1) {
        const c = c0 + dc
        const r = r0 + dr
        if (c >= 0 && r >= 0 && c < grid.cols && r < grid.rows && region[r * grid.cols + c] === 1) return true
      }
      return false
    }
    for (const stop of layout.paths.stops.filter((item) => item.level === grid.level)) if (!linked(stop.x, stop.z)) missing.push(stop.id)
    for (const point of layout.paths.links.flatMap((link) => [link.a, link.b]).filter((item) => item.level === grid.level)) if (!linked(point.x, point.z)) missing.push(`link@${point.x},${point.z}`)
  }
  return missing
}
