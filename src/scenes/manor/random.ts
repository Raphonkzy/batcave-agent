/** Seeded random numbers and value noise, so every procedural detail is the same on every load. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
/** A stable 32-bit hash of integer lattice coordinates. */
function lattice(seed: number, x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const smooth = (t: number) => t * t * (3 - 2 * t)
/** Smooth 2D value noise in 0..1. With `wrap`, the pattern tiles every `wrap` lattice cells. */
export function valueNoise(seed: number, x: number, y: number, wrap = 0): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = smooth(x - x0)
  const fy = smooth(y - y0)
  const w = (value: number) => (wrap > 0 ? ((value % wrap) + wrap) % wrap : value)
  const a = lattice(seed, w(x0), w(y0))
  const b = lattice(seed, w(x0 + 1), w(y0))
  const c = lattice(seed, w(x0), w(y0 + 1))
  const d = lattice(seed, w(x0 + 1), w(y0 + 1))
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}
/** Fractal noise in 0..1; tiles when `wrap` is given (frequency doubles each octave). */
export function fbm(seed: number, x: number, y: number, octaves = 4, wrap = 0): number {
  let sum = 0
  let amplitude = 0.5
  let total = 0
  let scale = 1
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += valueNoise(seed + octave * 17, x * scale, y * scale, wrap ? wrap * scale : 0) * amplitude
    total += amplitude
    amplitude /= 2
    scale *= 2
  }
  return sum / total
}
/** FNV-1a hash of a string to a seed. */
export function seedFrom(text: string): number {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
