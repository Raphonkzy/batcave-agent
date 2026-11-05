import * as THREE from 'three'
import { canvasTexture } from '../../scene3d/textures.ts'
import { fbm, mulberry32, valueNoise } from './random.ts'
// Procedural textures for the Tactical Manor theme: colour, bump and roughness maps drawn from
// seeded noise. Each is built once and cached; nothing here ships as an image file.
type Shade = (u: number, v: number, x: number, y: number) => [number, number, number]
const SIZE = 256
const cache = new Map<string, THREE.Texture>()
function pixels(key: string, shade: Shade, size = SIZE, color = true): THREE.Texture {
  const hit = cache.get(key)
  if (hit) return hit
  const texture = canvasTexture(key, size, size, (ctx) => {
    const image = ctx.createImageData(size, size)
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
      const [r, g, b] = shade(x / size, y / size, x, y)
      const at = (y * size + x) * 4
      image.data[at] = r; image.data[at + 1] = g; image.data[at + 2] = b; image.data[at + 3] = 255
    }
    ctx.putImageData(image, 0, 0)
  })
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  if (!color) texture.colorSpace = THREE.NoColorSpace
  cache.set(key, texture)
  return texture
}
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const hex = (value: string): [number, number, number] => [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)]
const grey = (value: number): [number, number, number] => { const v = Math.max(0, Math.min(255, value * 255)); return [v, v, v] }
const TILE = 4
/** The same texture with its own repeat, for surfaces of a known size (shares the image). */
export function tiled(texture: THREE.Texture, x: number, y: number): THREE.Texture {
  const key = `${texture.uuid}:${x.toFixed(2)}:${y.toFixed(2)}`
  let hit = cache.get(key)
  if (!hit) {
    hit = texture.clone()
    hit.needsUpdate = true
    hit.repeat.set(x, y)
    cache.set(key, hit)
  }
  return hit
}

export const concreteMap = () => pixels('manor-concrete', (u, v) => mix(hex('#2a2c2f'), hex('#45484c'), fbm(3, u * TILE * 2, v * TILE * 2, 4, TILE * 2)))
export const concreteBump = () => pixels('manor-concrete-bump', (u, v) => grey(fbm(5, u * TILE * 4, v * TILE * 4, 4, TILE * 4)), SIZE, false)
export const rockMap = () => pixels('manor-rock', (u, v) => {
  // Four-octave slate with horizontal sedimentary banding, bright mineral veins, and dark moss
  // settled in the deepest cracks.
  const n = fbm(11, u * 4, v * 4, 4, 4)
  const strata = 0.5 + 0.5 * Math.sin((v * 7 + fbm(29, u * 4, v * 4, 3, 4) * 1.5) * Math.PI * 2)
  const ridge = 1 - Math.abs(fbm(13, u * 4, v * 4, 4, 4) * 2 - 1)
  const crack = Math.pow(1 - Math.abs(fbm(19, u * 5, v * 5, 4, 5) * 2 - 1), 6) // sharp dark fissures
  const base = mix(hex('#181a1d'), hex('#34383e'), n * 0.55 + strata * 0.25 + ridge * 0.2)
  const veined = mix(base, hex('#565b62'), Math.pow(ridge, 3) * 0.5) // light mineral veins
  return mix(veined, hex('#161c14'), crack * 0.8)
})
export const rockBump = () => pixels('manor-rock-bump', (u, v) => {
  const ridge = 1 - Math.abs(fbm(17, u * 4, v * 4, 5, 4) * 2 - 1)
  const crack = Math.pow(1 - Math.abs(fbm(19, u * 5, v * 5, 4, 5) * 2 - 1), 6)
  return grey(ridge * (1 - crack * 0.9))
}, SIZE, false)
export const steelPlateMap = () => pixels('manor-steel-plate', (u, v, x, y) => {
  // Diamond tread plate: raised lozenges on a dark base.
  const cell = 32
  const dx = ((x % cell) / cell - 0.5) * 2
  const dy = ((y % cell) / cell - 0.5) * 2
  const lozenge = Math.max(0, 1 - (Math.abs(dx) + Math.abs(dy)) * 1.2)
  return mix(hex('#25282c'), hex('#4b5158'), lozenge * 0.8 + valueNoise(2, u * 40, v * 40, 40) * 0.2)
})
export const corrugatedMap = () => pixels('manor-corrugated', (u, v) => {
  const ridge = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 16)
  return mix(hex('#2f343a'), hex('#5b636c'), ridge * 0.75 + fbm(7, u * 8, v * 8, 3, 8) * 0.25)
})
export const corrugatedBump = () => pixels('manor-corrugated-bump', (u) => grey(0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 16)), SIZE, false)
export const carbonMap = () => pixels('manor-carbon', (u, v, x, y) => {
  // 2x2 twill weave in two dark tones.
  const cell = 8
  const a = Math.floor(x / cell)
  const b = Math.floor(y / cell)
  const tone = (a + b) % 2 === 0 ? 0.55 + 0.25 * Math.sin((x % cell) / cell * Math.PI) : 0.3 + 0.25 * Math.sin((y % cell) / cell * Math.PI)
  return mix(hex('#0d0f11'), hex('#3a3f46'), tone * (0.85 + 0.15 * valueNoise(4, u * 60, v * 60, 60)))
})
export const mahoganyMap = () => pixels('manor-mahogany', (u, v) => {
  // Long grain: rings stretched along u, bent by noise.
  const bend = fbm(21, u * 3, v * 8, 4, 3) * 6
  const ring = 0.5 + 0.5 * Math.sin((v * 22 + bend) * Math.PI * 2)
  const fine = valueNoise(23, u * 4, v * 120, 4) * 0.25
  return mix(hex('#5c3418'), hex('#9a6234'), Math.min(1, ring * 0.65 + fine + 0.1))
})
export const parquetMap = () => pixels('manor-parquet', (_u, _v, x, y) => {
  // Herringbone-like planks: alternating direction per 64px block with dark seams.
  const block = 64
  const bx = Math.floor(x / block)
  const by = Math.floor(y / block)
  const horizontal = (bx + by) % 2 === 0
  const along = horizontal ? x : y
  const across = horizontal ? y : x
  const plank = Math.floor(across / 16)
  const grain = fbm(plank * 3 + bx * 7 + by * 11, along / 90, across / 30, 3)
  const seam = across % 16 < 1 || along % block < 1 ? 0.45 : 1
  return mix(hex('#6b3d1d'), hex('#a8703c'), grain).map((value) => value * seam) as [number, number, number]
})
export const marbleMap = () => pixels('manor-marble', (u, v) => {
  const warp = fbm(31, u * 3, v * 3, 4, 3) * 2
  const vein = Math.abs(Math.sin((u * 3 + v * 2 + warp) * Math.PI * 2))
  const shade = Math.pow(vein, 0.18)
  return mix(hex('#8a8680'), hex('#f2eee4'), shade * 0.75 + fbm(33, u * 8, v * 8, 3, 8) * 0.25)
})
export const marbleBump = () => pixels('manor-marble-bump', (u, v) => grey(0.7 + 0.3 * fbm(35, u * 16, v * 16, 3, 16)), SIZE, false)
export const velvetMap = () => pixels('manor-velvet', (u, v) => grey(0.82 + 0.18 * valueNoise(41, u * 90, v * 90, 90) * (0.6 + 0.4 * fbm(43, u * 6, v * 6, 3, 6))))
export const fabricMap = () => pixels('manor-fabric', (u, v, x, y) => grey(0.84 + ((x + y) % 4 === 0 ? 0.08 : 0) + 0.08 * valueNoise(47, u * 70, v * 70, 70)))
export const pavingMap = () => pixels('manor-paving', (u, v, x, y) => {
  const tile = 64
  const gx = x % tile
  const gy = y % tile
  const grout = gx < 2 || gy < 2
  const id = Math.floor(x / tile) * 7 + Math.floor(y / tile) * 13
  const tone = 0.35 + 0.35 * (Math.sin(id * 12.9898) * 0.5 + 0.5) + 0.2 * fbm(51 + id, u * 10, v * 10, 3)
  return grout ? hex('#1f2123') : mix(hex('#3a3c3e'), hex('#7a7d80'), tone)
})
export const deckMap = () => pixels('manor-deck', (_u, _v, x, y) => {
  const plank = Math.floor(y / 21)
  const seam = y % 21 < 1.5 ? 0.4 : 1
  const grain = fbm(plank * 5 + 61, x / 120, y / 8, 3)
  return mix(hex('#6d4f35'), hex('#a98259'), grain).map((value) => value * seam) as [number, number, number]
})
export const rugMap = () => pixels('manor-rug', (u, v) => {
  // A border and nested diamonds in plum, cream and gold.
  const du = Math.abs(u - 0.5) * 2
  const dv = Math.abs(v - 0.5) * 2
  const edge = Math.max(du, dv)
  const diamond = du + dv
  let base = hex('#4b2a5c')
  if (edge > 0.9) base = hex('#e9dfc5')
  else if (edge > 0.82) base = hex('#c9a24a')
  else if ((Math.floor(diamond * 6) % 2) === 0) base = hex('#6a3d7e')
  const weave = 0.9 + 0.1 * valueNoise(71, u * 120, v * 120, 120)
  return base.map((value) => value * weave) as [number, number, number]
})
export const waterMap = () => pixels('manor-water', (u, v) => mix(hex('#1b4a5c'), hex('#5fb3c9'), Math.pow(fbm(81, u * 6, v * 6, 4, 6), 1.6)))
export const waterBump = () => pixels('manor-water-bump', (u, v) => grey(fbm(83, u * 8, v * 8, 4, 8)), SIZE, false)
export const fallMap = () => pixels('manor-fall', (u, v) => {
  const streak = Math.pow(valueNoise(91, u * 24, v * 3, 24), 2)
  return mix(hex('#6fb6cf'), hex('#ffffff'), streak)
})
export const leafMap = () => pixels('manor-leaf', (u, v) => mix(hex('#1f4a2c'), hex('#4f8a46'), fbm(95, u * 6, v * 6, 3, 6)))
export const barkMap = () => pixels('manor-bark', (u, v) => mix(hex('#2d2218'), hex('#5a4630'), fbm(97, u * 3, v * 14, 4, 3)))

/** Soft round glow, for additive sprites (mist, lantern halos, screen glow). */
export function glowSprite(): THREE.Texture {
  return canvasTexture('manor-glow', 64, 64, (ctx) => {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.35)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)
  })
}
/** Pre-seeded random for placing rocks, books and similar details. */
export const detailRandom = (seed: number) => mulberry32(seed)

/** Noise for helmets and clothes, seeded from the profile name: different per agent, the same for a profile. */
export function gearTexture(seed: number): THREE.Texture {
  return pixels(`manor-gear-${seed}`, (u, v) => grey(0.62 + 0.38 * fbm(seed & 0xffff, u * 6, v * 6, 4, 6)), 64)
}
/** Polished black-and-white checkered marble, for the foyer. */
export const checkerMarbleMap = () => pixels('manor-checker', (u, v, x, y) => {
  const black = (Math.floor(x / 64) + Math.floor(y / 64)) % 2 === 0
  const vein = Math.pow(Math.abs(Math.sin((u * 5 + v * 3 + fbm(37, u * 4, v * 4, 3, 4) * 2) * Math.PI * 2)), 0.25)
  const seam = x % 64 < 1 || y % 64 < 1 ? 0.6 : 1
  return (black ? mix(hex('#0d0d0f'), hex('#3a3a40'), (1 - vein) * 0.5) : mix(hex('#cfcac0'), hex('#f7f4ec'), vein)).map((value) => value * seam) as [number, number, number]
})
/** Yellow and black hazard stripes, for the hangar pads. */
export const hazardMap = () => pixels('manor-hazard', (u, v, x, y) => {
  const stripe = Math.floor((x + y) / 32) % 2 === 0
  return mix(stripe ? hex('#e8b417') : hex('#141414'), hex('#000000'), 0.15 * valueNoise(101, u * 40, v * 40, 40))
})
/** Low-pile carpet for the suites and corridor runners. */
export const carpetMap = () => pixels('manor-carpet', (u, v, x, y) => {
  const border = Math.min(x, y, 255 - x, 255 - y) < 10
  const tone = 0.85 + 0.15 * valueNoise(103, u * 120, v * 120, 120)
  return (border ? hex('#a8873f') : hex('#ffffff')).map((value) => value * tone) as [number, number, number]
})
/** Cliff-top lawn. */
export const lawnMap = () => pixels('manor-lawn', (u, v) => mix(hex('#1d3320'), hex('#3f6b3a'), fbm(107, u * 10, v * 10, 4, 10)))
