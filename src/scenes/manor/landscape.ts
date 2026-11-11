import { box, cyl, shape, type Part } from './parts.ts'
import { mulberry32 } from './random.ts'

/** Broadleaf trees share instanced primitives; seeded crowns vary without asset downloads. */
export function gardenTree(x: number, y: number, z: number, seed: number): Part[] {
  const random = mulberry32(seed)
  const height = 3.8 + random() * 2.5
  const width = 2.5 + random() * 1.4
  const parts: Part[] = [cyl('bark', [x, y + height * 0.35, z], [0.28, height * 0.7, 0.28])]
  for (let i = 0; i < 5; i++) {
    const angle = i * 2.4 + random() * 0.5
    const reach = width * (0.2 + random() * 0.2)
    const dx = Math.cos(angle) * reach, dz = Math.sin(angle) * reach
    parts.push(cyl('bark', [x + dx * 0.45, y + height * 0.62, z + dz * 0.45], [0.1, height * 0.38, 0.1], [Math.sin(angle) * 0.6, 0, -Math.cos(angle) * 0.6]))
    parts.push(shape('ico', 'leaf', [x + dx, y + height * (0.66 + random() * 0.22), z + dz], [width * (0.65 + random() * 0.3), height * (0.32 + random() * 0.2), width * 0.72], [random(), angle, random() * 0.4], ['#456c38', '#5f7b40', '#365c3d'][seed % 3]))
  }
  parts.push(box('stone', [x, y + 0.06, z], [0.6, 0.12, 0.6]))
  return parts
}
