import type { ItemType, LayoutItem } from '../../utils/layout/types.ts'
import type { GeoKey, MatKey } from './materials.ts'
import { mulberry32, seedFrom } from './random.ts'
// Every piece of furniture is drawn from simple parts (boxes, cylinders, cones...) so all items of
// a floor share a few instanced meshes. A part's position is local to its item: the origin is the
// centre of the footprint on the floor, +z is the item's front, y is up. `s` scales the unit shape.
export interface Part { g: GeoKey; m: MatKey; p: [number, number, number]; s: [number, number, number]; r?: [number, number, number]; c?: string }
export const box = (m: MatKey, p: Part['p'], s: Part['s'], r?: Part['r'], c?: string): Part => ({ g: 'box', m, p, s, ...(r ? { r } : {}), ...(c ? { c } : {}) })
export const cyl = (m: MatKey, p: Part['p'], s: Part['s'], r?: Part['r'], c?: string): Part => ({ g: 'cyl', m, p, s, ...(r ? { r } : {}), ...(c ? { c } : {}) })
export const shape = (g: GeoKey, m: MatKey, p: Part['p'], s: Part['s'], r?: Part['r'], c?: string): Part => ({ g, m, p, s, ...(r ? { r } : {}), ...(c ? { c } : {}) })
export const randomFor = (item: Pick<LayoutItem, 'id'>) => mulberry32(seedFrom(item.id))
const SIDEWAYS: Part['r'] = [0, 0, Math.PI / 2]
/** Items drawn by their own components (they move, or need special materials). */
export const SPECIAL_TYPES: ReadonlySet<ItemType> = new Set<ItemType>(['suitPod', 'turntablePad', 'tacticalJet', 'infinityPool', 'elevatorShaft'])
const LED_COLORS = ['#00ffcc', '#ffaa00', '#3dff7a', '#5aa0ff']

export function deckParts(item: LayoutItem): Part[] | undefined {
  const { w, d, h } = item
  switch (item.type) {
    case 'holoPanel': return [
      box('gunmetal', [0, 0.1, 0], [w, 0.2, d]),
      box('blackSteel', [0, h / 2, -0.09], [w, h, 0.12]),
      ...[0, 1, 2].flatMap((tier) => [box('ledCyan', [0, 0.25 + tier * 0.85, 0], [w, 0.02, 0.03])]),
      box('ledCyan', [0, h - 0.02, -0.05], [w, 0.03, 0.06]),
    ]
    case 'consoleArc': {
      const monitors = item.role === 'barbara' ? [-0.42, 0, 0.42] : [0]
      return [
        box('blackSteel', [0, 0.4, 0], [w, 0.8, d]),
        box('carbon', [0, 0.83, 0.02], [w, 0.06, d + 0.06], [-0.12, 0, 0]),
        box('ledCyan', [0, 0.87, d / 2 - 0.1], [w * 0.8, 0.01, 0.06]),
        ...monitors.flatMap((x) => [box('gunmetal', [x, 1.2, -0.18], [0.4, 0.28, 0.03], [0.15, -x * 0.5, 0]), cyl('gunmetal', [x, 0.98, -0.2], [0.05, 0.2, 0.05])]),
      ]
    }
    case 'consoleChair': case 'chair': return [
      box('rubber', [0, 0.46, 0], [0.46, 0.07, 0.44]),
      box('carbon', [0, 0.78, -0.2], [0.44, 0.5, 0.06], [-0.12, 0, 0]),
      cyl('chrome', [0, 0.24, 0], [0.06, 0.44, 0.06]),
      box('chrome', [0, 0.04, 0], [0.46, 0.04, 0.06]), box('chrome', [0, 0.04, 0], [0.06, 0.04, 0.46]),
    ]
    case 'warTable': return [
      shape('oct', 'gunmetal', [0, 0.38, 0], [w * 0.92, 0.76, d * 0.92]),
      shape('oct', 'darkGlass', [0, 0.8, 0], [w, 0.08, d]),
      shape('oct', 'ledAmber', [0, 0.845, 0], [w + 0.06, 0.012, d + 0.06]),
      shape('oct', 'blackSteel', [0, 0.05, 0], [w + 0.4, 0.1, d + 0.4]),
    ]
    case 'desk': return [
      box('carbon', [0, 0.73, 0], [w, 0.05, d]),
      box('blackSteel', [-(w / 2 - 0.05), 0.35, 0], [0.05, 0.7, d - 0.1]), box('blackSteel', [w / 2 - 0.05, 0.35, 0], [0.05, 0.7, d - 0.1]),
      box('blackSteel', [0, 0.45, -(d / 2 - 0.05)], [w - 0.1, 0.4, 0.03]),
      ...[-1, 1].flatMap((side) => [box('gunmetal', [side * 0.36, 1.06, -0.32], [0.66, 0.38, 0.03], [0, -side * 0.22, 0]), cyl('gunmetal', [side * 0.36, 0.85, -0.36], [0.05, 0.22, 0.05])]),
      box('rubber', [0, 0.765, 0.15], [0.5, 0.02, 0.15]),
      box('ledCyan', [0, 0.757, d / 2], [w, 0.012, 0.012]),
    ]
    case 'utilityConsole': return [
      box('gunmetal', [0, 0.5, 0], [w, 1, d]),
      box('darkGlass', [0, 1.04, 0.04], [w, 0.04, d], [-0.4, 0, 0]),
      box('ledAmber', [0, 0.9, d / 2 + 0.005], [w * 0.8, 0.02, 0.01]),
      box('gunmetal', [0, 1.45, -0.2], [w * 0.7, 0.45, 0.03]),
    ]
    case 'armoryLocker': return [
      box('gunmetal', [0, h / 2, 0], [w, h, d]),
      box('blackSteel', [0, h / 2, d / 2 + 0.003], [0.02, h - 0.1, 0.01]),
      box('chrome', [0.08, h * 0.55, d / 2 + 0.02], [0.03, 0.2, 0.03]),
      box('ledGreen', [0.25, h - 0.15, d / 2 + 0.005], [0.06, 0.03, 0.01]),
    ]
  }
  return deckParts2(item)
}
function deckParts2(item: LayoutItem): Part[] | undefined {
  const { w, d, h } = item
  switch (item.type) {
    case 'serverBank': {
      const random = randomFor(item)
      const parts: Part[] = [box('blackSteel', [0, h / 2, 0], [w, h, d]), box('ledCyan', [0, h + 0.01, d / 2 - 0.05], [w, 0.02, 0.04])]
      for (let unit = 0; unit < 10; unit += 1) {
        const y = 0.3 + unit * 0.31
        parts.push(box('gunmetal', [0, y, d / 2 + 0.005], [w - 0.1, 0.03, 0.01]))
        for (let led = 0; led < 6; led += 1) parts.push(box(random() > 0.5 ? 'blinkA' : 'blinkB', [-w / 2 + 0.3 + led * 0.12, y + 0.1, d / 2 + 0.01], [0.05, 0.05, 0.01], undefined, LED_COLORS[Math.floor(random() * LED_COLORS.length)]))
      }
      return parts
    }
    case 'serverTerminal': case 'catwalkConsole': return [
      box('gunmetal', [0, 0.45, 0], [0.45, 0.9, 0.35]),
      box('darkGlass', [0, 0.95, 0.02], [w, 0.05, d], [-0.4, 0, 0]),
      box('gunmetal', [0, 1.35, -0.16], [w * 0.85, 0.5, 0.03], [0.12, 0, 0]),
      box(item.type === 'catwalkConsole' ? 'ledCyan' : 'ledRed', [0, 0.9, d / 2 + 0.01], [w * 0.7, 0.02, 0.01]),
    ]
    case 'forensicsSlab': return [
      box('blackSteel', [0, 0.42, 0], [w * 0.7, 0.84, d * 0.6]),
      box('chrome', [0, 0.9, 0], [w, 0.1, d]),
      box('ledCyan', [0, 0.955, d / 2], [w, 0.012, 0.012]),
      ...[-1, 1].map((side) => box('gunmetal', [side * (w / 2 - 0.1), 1.35, -(d / 2 - 0.08)], [0.08, 2.7, 0.08])),
      box('gunmetal', [0, 2.65, -(d / 2 - 0.08)], [w, 0.08, 0.08]),
      ...[-0.6, 0.6].flatMap((x) => [box('gunmetal', [x, 2.3, -0.3], [0.06, 0.06, 0.9], [0.65, 0, 0]), box('ledCyan', [x, 1.98, 0.08], [0.18, 0.05, 0.18])]),
    ]
    case 'diagnosticRack': return [
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => box('gunmetal', [sx * (w / 2 - 0.03), h / 2, sz * (d / 2 - 0.03)], [0.05, h, 0.05])),
      ...[0.4, 0.9, 1.4, 1.9].map((y) => box('blackSteel', [0, y, 0], [w - 0.05, 0.04, d - 0.05])),
      box('darkGlass', [0, 0.6, 0], [w * 0.7, 0.3, d * 0.7]), box('blinkA', [0.2, 0.62, d * 0.36], [0.05, 0.05, 0.01], undefined, '#00ffcc'),
      box('darkGlass', [0, 1.1, 0], [w * 0.6, 0.25, d * 0.6]), box('blinkB', [-0.2, 1.12, d * 0.31], [0.05, 0.05, 0.01], undefined, '#ffaa00'),
    ]
    case 'interceptorBay': return [
      box('grating', [0, 0.01, 0], [w - 0.6, 0.02, d - 0.6]),
      box('hazard', [0, 0.02, d / 2 - 0.15], [w, 0.03, 0.3]), box('hazard', [0, 0.02, -(d / 2 - 0.15)], [w, 0.03, 0.3]),
      box('hazard', [w / 2 - 0.15, 0.02, 0], [0.3, 0.03, d - 0.6]), box('hazard', [-(w / 2 - 0.15), 0.02, 0], [0.3, 0.03, d - 0.6]),
    ]
    case 'armoredInterceptor': return [
      box('blackSteel', [0, 0.6, 0], [w - 0.2, 0.5, d - 0.2]),
      box('carbon', [0, 1.02, -0.2], [w - 0.4, 0.38, 3.4]),
      box('darkGlass', [0, 1.38, -0.35], [1.5, 0.34, 1.7], [-0.08, 0, 0]),
      box('blackSteel', [0, 0.82, d / 2 - 0.5], [w - 0.3, 0.3, 1.2], [0.35, 0, 0]),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].flatMap(([sx, sz]) => [cyl('rubber', [sx * (w / 2 - 0.1), 0.45, sz * 1.65], [0.9, 0.5, 0.9], SIDEWAYS), shape('oct', 'chrome', [sx * (w / 2 - 0.02), 0.45, sz * 1.65], [0.38, 0.52, 0.38], SIDEWAYS)]),
      ...[-1, 1].flatMap((side) => [box('blackSteel', [side * 0.9, 1.4, -(d / 2 - 0.35)], [0.08, 0.55, 0.7]), box('ledRed', [side * 0.5, 0.62, -(d / 2) + 0.02], [0.25, 0.16, 0.04])]),
      box('ledWhite', [0, 0.86, d / 2 - 0.02], [w - 0.6, 0.04, 0.03]),
    ]
    case 'pursuitBike': return [
      ...[-0.75, 0.75].map((z) => cyl('rubber', [0, 0.31, z], [0.62, 0.16, 0.62], SIDEWAYS)),
      box('carbon', [0, 0.62, 0], [0.2, 0.25, 1.3]),
      box('blackSteel', [0, 0.82, 0.2], [0.32, 0.22, 0.6]),
      box('rubber', [0, 0.8, -0.38], [0.28, 0.08, 0.5]),
      box('chrome', [0, 0.72, 0.62], [0.05, 0.62, 0.05], [0.4, 0, 0]),
      box('chrome', [0, 1.0, 0.72], [0.62, 0.03, 0.03]),
      box('ledWhite', [0, 0.92, 0.95], [0.36, 0.015, 0.02]),
    ]
  }
  return deckParts3(item)
}
function deckParts3(item: LayoutItem): Part[] | undefined {
  const { w, d, h } = item
  switch (item.type) {
    case 'workbench': return [
      box('gunmetal', [0, 0.92, 0], [w, 0.06, d]),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => box('blackSteel', [sx * (w / 2 - 0.05), 0.45, sz * (d / 2 - 0.05)], [0.06, 0.9, 0.06])),
      box('carbon', [0, 1.5, -(d / 2 - 0.02)], [w, 1, 0.04]),
      ...[-0.8, -0.4, 0, 0.4, 0.8].map((x, index) => box('chrome', [x, 1.45 + (index % 2) * 0.15, -(d / 2 - 0.06)], [0.05, 0.35, 0.03])),
      box('gunmetal', [w / 2 - 0.3, 1.02, 0.1], [0.3, 0.14, 0.2]),
      box('ledWhite', [0, 2.0, -(d / 2 - 0.1)], [w - 0.2, 0.03, 0.05]),
    ]
    case 'autoDock': return [
      shape('oct', 'gunmetal', [0, h / 2, 0], [w, h, d]),
      shape('torus', 'ledViolet', [0, h + 0.01, 0], [w * 0.8, 1, d * 0.8]),
    ]
    case 'weaponRack': return [
      // A steel wall panel with racked gear: long cases on the rails, helmets on the shelf above.
      box('blackSteel', [0, h / 2, -(d / 2 - 0.03)], [w, h, 0.06]),
      ...[0.55, 1.15].map((y) => box('gunmetal', [0, y, -0.05], [w - 0.1, 0.04, 0.12])),
      ...[-0.55, -0.2, 0.15, 0.5].map((x) => box('carbon', [x, 0.95, 0.02], [0.12, 1.1, 0.1])),
      box('gunmetal', [0, 1.75, 0], [w - 0.1, 0.04, d - 0.04]),
      ...[-0.45, 0, 0.45].map((x) => shape('sphere', 'carbon', [x, 1.9, 0], [0.26, 0.22, 0.28])),
      box('ledAmber', [0, h - 0.06, -0.02], [w - 0.2, 0.02, 0.02]),
    ]
    case 'gearBench': return [
      box('gunmetal', [0, 0.86, 0], [w, 0.06, d]), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => box('blackSteel', [sx * (w / 2 - 0.05), 0.42, sz * (d / 2 - 0.05)], [0.06, 0.84, 0.06])),
      box('blackSteel', [0, 0.2, 0], [w - 0.1, 0.04, d - 0.1]),
      ...[-0.45, 0.35].map((z) => box('carbon', [0, 0.97, z], [0.55, 0.16, 0.6])),
      box('ledCyan', [0, 0.895, d / 2], [w, 0.012, 0.012]),
    ]
    case 'suitBench': return [
      // Maintenance table for the suits: a steel top, a scanner bar and two tool arms.
      box('gunmetal', [0, 0.88, 0], [w, 0.06, d]), box('blackSteel', [0, 0.42, 0], [w * 0.6, 0.84, d - 0.4]),
      box('ledCyan', [0, 0.915, 0], [0.04, 0.01, d - 0.3]),
      ...[-d / 3, d / 3].flatMap((z) => [cyl('chrome', [0, 1.35, z], [0.06, 0.9, 0.06]), box('gunmetal', [0, 1.78, z], [0.5, 0.06, 0.08]), box('ledCyan', [0.22, 1.7, z], [0.06, 0.1, 0.06])]),
      ...[-1.6, 0, 1.6].map((z) => box('carbon', [0, 0.97, z], [0.5, 0.12, 0.7])),
    ]
    case 'sparringMat': return [
      box('rubber', [0, 0.03, 0], [w, 0.06, d], undefined, '#2a3440'),
      box('hazard', [0, 0.062, 0], [w * 0.55, 0.004, 0.06]), box('hazard', [0, 0.062, 0], [0.06, 0.004, d * 0.55]),
      ...[-1, 1].flatMap((side) => [box('ledAmber', [side * (w / 2 - 0.05), 0.065, 0], [0.04, 0.004, d - 0.1]), box('ledAmber', [0, 0.065, side * (d / 2 - 0.05)], [w - 0.1, 0.004, 0.04])]),
    ]
    case 'punchingBag': return [
      // Hangs from a steel bracket under the cave ceiling.
      cyl('blackSteel', [0, 0.04, 0], [w, 0.08, w]),
      cyl('chrome', [0, 2.9, 0], [0.03, 1.2, 0.03]),
      cyl('leather', [0, 1.6, 0], [w * 0.75, 1.3, w * 0.75], undefined, '#3a1a1a'),
      cyl('rubber', [0, 2.28, 0], [w * 0.78, 0.06, w * 0.78]), cyl('rubber', [0, 0.92, 0], [w * 0.78, 0.06, w * 0.78]),
      box('gunmetal', [0, h - 0.05, -0.2], [0.1, 0.1, 0.6]),
    ]
    case 'floorPlate': {
      // A flush inset plate, a shade darker than the grating, with a thin seam. Never an outline in
      // a bright colour: a bare floor must not read as an empty parking bay.
      const edge = (c: string) => [-1, 1].flatMap((side) => [box('gunmetal', [side * (w / 2 - 0.05), 0.014, 0], [0.08, 0.004, d], undefined, c), box('gunmetal', [0, 0.014, side * (d / 2 - 0.05)], [w, 0.004, 0.08], undefined, c)])
      return [box('gunmetal', [0, 0.008, 0], [w, 0.012, d], undefined, '#3a3f45'), ...edge('#23272c')]
    }
  }
  return undefined
}

/** A dark mannequin, standing at the origin, facing +z. */
export const mannequinParts = (): Part[] => [
  box('mannequin', [-0.11, 0.35, 0], [0.16, 0.66, 0.18]), box('mannequin', [0.11, 0.35, 0], [0.16, 0.66, 0.18]),
  box('mannequin', [0, 0.98, 0], [0.46, 0.58, 0.28]),
  box('mannequin', [-0.31, 0.95, 0], [0.11, 0.5, 0.13]), box('mannequin', [0.31, 0.95, 0], [0.11, 0.5, 0.13]),
  shape('sphere', 'mannequin', [0, 1.5, 0], [0.36, 0.4, 0.34]),
]
