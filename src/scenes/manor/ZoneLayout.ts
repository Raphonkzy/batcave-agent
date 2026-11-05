import { computeLayout } from '../../utils/layout/computeLayout.ts'
import { BASIN_Y, CAVE_CEILING, CATWALK_WIDTH, SURFACE_Y } from '../../utils/layout/dimensions.ts'
import type { BoundingBox, ManorLayoutData, Vec3, Zone } from '../../utils/layout/types.ts'
import { mulberry32 } from './random.ts'
// Adapts the result of computeLayout to what the scene draws. No layout logic lives here: only
// shapes derived from the layout (the rock mass, stalactites, the light rig) and drawing styles.
export { computeLayout }
export type { ManorLayoutData }
/** Which part of the manor is in view. The deck view lifts the rock and manor away; the overview shows both. */
export type ManorView = 'deck' | 'hangar' | 'manor' | 'lobby' | 'overview' | 'exterior'
/** The views that look at the deck alone, or at the manor alone (the other level is not drawn). */
export const isDeckView = (view: ManorView) => view === 'deck' || view === 'hangar'
export const isManorView = (view: ManorView) => view === 'manor' || view === 'lobby'
export type Quality = 'high' | 'medium' | 'low'
export interface QualityProfile { shadows: 'all' | 'main' | 'none'; mist: boolean; density: number; screens: 'animated' | 'simple' | 'static'; waterfall: 'full' | 'simple' }
export const QUALITY: Record<Quality, QualityProfile> = {
  high: { shadows: 'all', mist: true, density: 1, screens: 'animated', waterfall: 'full' },
  medium: { shadows: 'main', mist: false, density: 1, screens: 'simple', waterfall: 'simple' },
  low: { shadows: 'none', mist: false, density: 0.5, screens: 'static', waterfall: 'simple' },
}
export interface Block { x: number; y: number; z: number; w: number; h: number; d: number; rotY?: number }
const centre = (rect: BoundingBox, y0: number, y1: number): Block => ({ x: (rect.minX + rect.maxX) / 2, y: (y0 + y1) / 2, z: (rect.minZ + rect.maxZ) / 2, w: rect.maxX - rect.minX, h: y1 - y0, d: rect.maxZ - rect.minZ })
/** The rock: under the deck, behind and west of it, the mass between the levels, and the cliff beyond the chasm. */
export function rockMass(layout: ManorLayoutData) {
  const deck = layout.levels.subterranean.bounds
  const all = layout.bounds
  const west = Math.min(all.minX, deck.minX) - 1.5
  const north = deck.minZ - 1.5
  const south = all.maxZ
  const ledge = layout.chasm.minX
  return {
    /** Rock under the deck floor, and the walls round the deck (the south side is cut away). */
    deck: [
      centre({ minX: west, maxX: deck.maxX - CATWALK_WIDTH, minZ: north, maxZ: south }, BASIN_Y, -0.02),
      centre({ minX: west, maxX: layout.chasm.maxX + 3, minZ: north, maxZ: deck.minZ }, BASIN_Y, CAVE_CEILING + 0.5),
      centre({ minX: west, maxX: deck.minX, minZ: deck.minZ, maxZ: south }, -0.02, CAVE_CEILING + 0.5),
      // East wall of the deck, north of the basin.
      centre({ minX: ledge - CATWALK_WIDTH, maxX: layout.chasm.maxX + 3, minZ: deck.minZ, maxZ: layout.chasm.minZ }, BASIN_Y, CAVE_CEILING + 0.5),
    ],
    /** The mass between the deck ceiling and the manor, and the far cliff past the chasm. */
    cliff: [
      centre({ minX: west, maxX: ledge, minZ: north, maxZ: south }, CAVE_CEILING, SURFACE_Y - 0.02),
      centre({ minX: layout.chasm.maxX, maxX: layout.chasm.maxX + 3, minZ: north, maxZ: south }, BASIN_Y, SURFACE_Y + 0.6),
    ],
    /** The cliff-top grounds the manor stands on. */
    grounds: { minX: west, maxX: ledge, minZ: north, maxZ: south } as BoundingBox,
    basin: { minX: ledge - CATWALK_WIDTH, maxX: layout.chasm.maxX, minZ: layout.chasm.minZ, maxZ: layout.chasm.maxZ } as BoundingBox,
  }
}
/** Seeded jagged blocks on the exposed faces of the rock, so the cliff reads as stone, not a box. */
export function jaggedFaces(layout: ManorLayoutData, density: number): Block[] {
  const random = mulberry32(0x636c6966)
  const { cliff } = rockMass(layout)
  const [mass] = cliff
  const blocks: Block[] = []
  const step = 1.6 / Math.max(0.5, density)
  const front = mass.z + mass.d / 2
  for (let x = mass.x - mass.w / 2; x < mass.x + mass.w / 2; x += step) {
    for (let y = CAVE_CEILING + 0.4; y < SURFACE_Y - 0.4; y += 1.6) {
      const size = 0.9 + random() * 1.3
      blocks.push({ x: x + random() * 0.6, y: y + random() * 0.5, z: front + random() * 0.6 - 0.2, w: size * 1.3, h: size, d: 0.6 + random() * 0.9, rotY: (random() - 0.5) * 0.5 })
    }
  }
  const east = mass.x + mass.w / 2
  for (let z = mass.z - mass.d / 2; z < front; z += step) for (let y = BASIN_Y + 0.6; y < SURFACE_Y - 0.4; y += 1.7) {
    if (y < CAVE_CEILING && z > layout.chasm.minZ) continue
    const size = 0.9 + random() * 1.2
    blocks.push({ x: east + random() * 0.5 - 0.1, y: y + random() * 0.5, z: z + random() * 0.6, w: 0.6 + random() * 0.8, h: size, d: size * 1.3, rotY: (random() - 0.5) * 0.5 })
  }
  return blocks
}
export interface Spike { x: number; y: number; z: number; radius: number; height: number }
/** Stalactites hang from the cave ceiling line along the walls and over the basin; stalagmites rise from the basin. */
export function spikes(layout: ManorLayoutData, density: number): { hanging: Spike[]; standing: Spike[] } {
  const random = mulberry32(0x73706b65)
  const deck = layout.levels.subterranean.bounds
  const hanging: Spike[] = []
  const standing: Spike[] = []
  const step = 0.9 / Math.max(0.5, density)
  const spike = (x: number, z: number, list: Spike[], y: number, scale = 1) => list.push({ x, y, z, radius: (0.12 + random() * 0.2) * scale, height: (0.5 + random() * 1.2) * scale })
  for (let x = deck.minX + 0.4; x < layout.chasm.maxX; x += step) spike(x + random() * 0.3, deck.minZ + 0.2 + random() * 0.4, hanging, CAVE_CEILING)
  for (let z = deck.minZ; z < deck.maxZ; z += step) spike(deck.minX + 0.25 + random() * 0.4, z + random() * 0.3, hanging, CAVE_CEILING)
  for (let z = layout.chasm.minZ; z < layout.chasm.maxZ; z += step * 1.3) {
    spike(layout.chasm.minX + 0.4 + random() * (layout.chasm.maxX - layout.chasm.minX - 0.8), z, hanging, CAVE_CEILING, 1.3)
    if (random() > 0.45) spike(layout.chasm.minX + 0.5 + random() * (layout.chasm.maxX - layout.chasm.minX - 1), z + random(), standing, BASIN_Y, 1.4)
  }
  return { hanging, standing }
}

export interface FloorStyle { texture: 'checker' | 'parquet' | 'marble' | 'carpet' | 'paving' | 'grating' | 'concrete' | 'mahogany'; color: string; roughness: number; tile: number }
/** Floor finish per zone: steel and concrete below, marble, parquet and carpet above. */
export function floorStyle(zone: Zone): FloorStyle {
  // The training room has a sprung wooden floor; the gym a dark rubber one.
  if (zone.id === 'trainingRoom') return { texture: 'parquet', color: '#8a6a4a', roughness: 0.5, tile: 3 }
  if (zone.id === 'gym') return { texture: 'concrete', color: '#55524e', roughness: 0.95, tile: 3 }
  if (zone.level === 'subterranean') return zone.id === 'hangarBay' ? { texture: 'grating', color: '#8d949c', roughness: 0.45, tile: 2.4 } : zone.id === 'basinCatwalk' ? { texture: 'grating', color: '#ffffff', roughness: 0.5, tile: 1.5 } : { texture: 'grating', color: '#c8ced6', roughness: 0.5, tile: 2 }
  switch (zone.kind) {
    case 'suite': return { texture: 'carpet', color: '#3d2a5a', roughness: 1, tile: 4.5 }
    case 'corridor': return { texture: 'parquet', color: '#c99a6a', roughness: 0.45, tile: 3 }
    case 'outdoor': return { texture: 'paving', color: '#d8d2c6', roughness: 0.85, tile: 3 }
    default: break
  }
  switch (zone.id) {
    case 'grandFoyer': return { texture: 'checker', color: '#ffffff', roughness: 0.15, tile: 2 }
    case 'butlerPantry': case 'diningHall': return { texture: 'marble', color: '#ffffff', roughness: 0.2, tile: 3 }
    case 'grandLibrary': return { texture: 'parquet', color: '#8a5a3a', roughness: 0.45, tile: 3 }
    default: return { texture: 'parquet', color: '#ffffff', roughness: 0.4, tile: 3 }
  }
}
/** The six real lights (section 6.2): positions and aims, from the layout. */
export interface LightRig { command: { position: Vec3; target: Vec3 }; hangar: { position: Vec3; target: Vec3 }; hearth: Vec3; foyer: Vec3; sunTarget: Vec3; span: number }
export const MAX_REAL_LIGHTS = 6
export function lightRig(layout: ManorLayoutData): LightRig {
  const war = layout.items.find((item) => item.type === 'warTable')!
  const pad = layout.items.find((item) => item.type === 'turntablePad')!
  const fire = layout.items.find((item) => item.type === 'fireplace')!
  const lobby = layout.items.find((item) => item.type === 'lobbyMedallion')!
  const terrace = layout.zones.terracePool
  const b = layout.bounds
  return {
    command: { position: [war.x, CAVE_CEILING - 0.15, war.z + 1], target: [war.x, 0, war.z + 3] },
    hangar: { position: [layout.zones.hangarBay.minX + (layout.zones.hangarBay.maxX - layout.zones.hangarBay.minX) * 0.45, CAVE_CEILING - 0.15, pad.z], target: [pad.x + 4, 0, pad.z] },
    hearth: [fire.x, SURFACE_Y + 1.2, fire.z + 1.4],
    // The lobby's light hangs with its chandelier, over the medallion.
    foyer: [lobby.x, SURFACE_Y + 5.2, lobby.z],
    sunTarget: [(terrace.minX + terrace.maxX) / 2, SURFACE_Y, (b.minZ + b.maxZ) / 2],
    span: Math.max(b.maxX - b.minX, b.maxZ - b.minZ),
  }
}
export interface TerraceSun { daylight: boolean; color: string; intensity: number; sky: string; fog: string; direction: Vec3 }
/** The Terrace follows the browser's local clock: daylight from 06:00 to 18:00, cool moonlight otherwise. */
export function terraceSun(hour: number): TerraceSun {
  const h = ((hour % 24) + 24) % 24
  if (h >= 6 && h < 18) {
    const t = (h - 6) / 12
    const elevation = Math.sin(t * Math.PI)
    return { daylight: true, color: elevation < 0.3 ? '#ffd2a0' : '#fff4e0', intensity: 1.4 + elevation * 1.6, sky: '#7fb8d8', fog: '#8fb8cc', direction: [Math.cos(t * Math.PI) * -14, 8 + elevation * 16, 10] }
  }
  return { daylight: false, color: '#88aaff', intensity: 0.7, sky: '#0b1020', fog: '#0e1424', direction: [-10, 18, 12] }
}
/** Which levels a view shows. */
export const showsDeck = (view: ManorView) => !isManorView(view)
export const showsManor = (view: ManorView) => !isDeckView(view)
