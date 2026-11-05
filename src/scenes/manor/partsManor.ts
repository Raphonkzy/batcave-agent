import type { LayoutItem } from '../../utils/layout/types.ts'
import { box, cyl, randomFor, shape, type Part } from './parts.ts'
// Parts for the surface manor's furniture: rich woods, velvet, leather, marble and brass.
const BOOK_COLORS = ['#6d1f24', '#1f3a5f', '#2f5a3a', '#8a6a2a', '#4a2a5a', '#c9bfa6', '#6a3a22', '#2a2a2a']
const DUVETS = ['#3b1f4a', '#1f3b4a', '#4a1f26', '#2a3a2a', '#3a2f1f', '#1f2a4a']
const BALLS = ['#f2f2f2', '#d42a2a', '#e8c21a', '#1a4ad4', '#1a1a1a', '#e86a1a']
const legs = (m: Part['m'], w: number, d: number, h: number, inset = 0.06, size = 0.06): Part[] =>
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => box(m, [sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset)], [size, h, size]))
export function manorParts(item: LayoutItem): Part[] | undefined {
  const { w, d, h } = item
  const random = randomFor(item)
  switch (item.type) {
    case 'fireplace': return [
      box('marble', [0, 0.04, 0.2], [w + 0.2, 0.08, d + 0.4]),
      ...[-1, 1].map((side) => box('stone', [side * (w / 2 - 0.3), 0.7, 0], [0.6, 1.4, d])),
      box('stone', [0, 1.55, 0.02], [w, 0.35, d + 0.1]),
      box('stone', [0, 2.55, -0.1], [w * 0.8, 1.95, d - 0.2]),
      box('blackSteel', [0, 0.6, -(d / 2 - 0.1)], [w - 1.2, 1.2, 0.1]),
      ...[-0.25, 0.25].map((x) => cyl('bark', [x, 0.12, -0.1], [0.14, 0.9, 0.14], [0, 0.3, Math.PI / 2])),
      ...[-0.3, 0, 0.3].map((x, index) => shape('cone', 'flame', [x, 0.42 + (index % 2) * 0.06, -0.12], [0.3, 0.5 + (index % 2) * 0.15, 0.3])),
    ]
    case 'chesterfield': {
      const seats = item.role === 'back' ? 3 : 2
      return [
        box('velvet', [0, 0.25, 0], [w, 0.38, d]),
        box('velvet', [0, 0.66, -(d / 2 - 0.11)], [w, 0.5, 0.22]),
        ...[-1, 1].map((side) => cyl('velvet', [side * (w / 2 - 0.15), 0.58, 0], [0.32, d, 0.32], [Math.PI / 2, 0, 0])),
        ...Array.from({ length: seats }, (_, index) => box('velvet', [(index - (seats - 1) / 2) * ((w - 0.6) / seats), 0.5, 0.06], [(w - 0.6) / seats - 0.03, 0.12, d - 0.3])),
        ...legs('brass', w, d, 0.07, 0.1, 0.07),
      ]
    }
    case 'coffeeTable': return [box('oak', [0, 0.37, 0], [w, 0.1, d]), ...legs('oak', w, d, 0.32, 0.1, 0.12), box('brass', [0.2, 0.43, 0], [0.4, 0.02, 0.3])]
    case 'rug': return [box('rug', [0, 0.01, 0], [w, 0.02, d])]
    case 'tallBookshelf': {
      const parts: Part[] = [box('mahogany', [0, h / 2, -(d / 2 - 0.02)], [w, h, 0.04]), ...[-1, 1].map((side) => box('mahogany', [side * (w / 2 - 0.025), h / 2, 0], [0.05, h, d])), box('brass', [0, h + 0.02, 0], [w + 0.04, 0.04, d + 0.04])]
      for (let shelf = 0; shelf < 10; shelf += 1) {
        const y = 0.05 + shelf * 0.52
        parts.push(box('mahogany', [0, y, 0], [w - 0.1, 0.035, d - 0.02]))
        let x = -(w / 2) + 0.08
        for (let book = 0; book < 7 && x < w / 2 - 0.2; book += 1) {
          const bw = 0.12 + random() * 0.08
          const bh = 0.32 + random() * 0.14
          parts.push(box('paper', [x + bw / 2, y + 0.02 + bh / 2, 0], [bw - 0.01, bh, d - 0.12], undefined, BOOK_COLORS[Math.floor(random() * BOOK_COLORS.length)]))
          x += bw + 0.01
        }
      }
      return parts
    }
  }
  return manorParts2(item)
}
function manorParts2(item: LayoutItem): Part[] | undefined {
  const { w, d, h } = item
  const random = randomFor(item)
  switch (item.type) {
    case 'spiralStair': {
      const parts: Part[] = [cyl('brass', [0, h / 2, 0], [0.14, h, 0.14])]
      for (let tread = 0; tread < 12; tread += 1) {
        const angle = (tread / 12) * Math.PI * 2 * 1.1
        parts.push(box('mahogany', [Math.cos(angle) * 0.45, ((tread + 1) * h) / 12, Math.sin(angle) * 0.45], [0.8, 0.05, 0.32], [0, -angle, 0]))
      }
      return parts
    }
    case 'readingChair': case 'leatherChair': case 'armchair': {
      const m = item.type === 'armchair' ? 'velvetCream' : 'leather'
      const k = w / 0.9
      return [
        box(m, [0, 0.21 * k, 0], [0.84 * k, 0.42 * k, 0.8 * k]),
        box(m, [0, 0.7 * k, -0.33 * k], [0.84 * k, (item.type === 'readingChair' ? 0.8 : 0.45) * k, 0.18 * k]),
        ...[-1, 1].map((side) => box(m, [side * 0.35 * k, 0.52 * k, 0], [0.16 * k, 0.24 * k, 0.76 * k])),
        ...(item.type === 'readingChair' ? [-1, 1].map((side) => box(m, [side * 0.36 * k, 0.86 * k, -0.18 * k], [0.12 * k, 0.4 * k, 0.4 * k])) : []),
      ]
    }
    case 'studyDesk': case 'execDesk': return [
      box('mahogany', [0, h - 0.025, 0], [w, 0.05, d]),
      box('leather', [0, h + 0.002, 0.02], [w * 0.6, 0.006, d * 0.6], undefined, '#2a4a2a'),
      ...[-1, 1].map((side) => box('mahogany', [side * (w / 2 - 0.2), (h - 0.05) / 2, 0], [0.38, h - 0.05, d - 0.04])),
      cyl('brass', [w / 2 - 0.2, h + 0.15, -d / 4], [0.03, 0.3, 0.03]),
      box(item.type === 'studyDesk' ? 'bankerGreen' : 'lampWarm', [w / 2 - 0.2, h + 0.32, -d / 4 + 0.05], [0.32, 0.08, 0.14]),
      box('paper', [-w / 4, h + 0.04, 0], [0.22, 0.08, 0.3], undefined, BOOK_COLORS[Math.floor(random() * BOOK_COLORS.length)]),
    ]
    case 'billiardsTable': return [
      box('felt', [0, h - 0.02, 0], [w - 0.2, 0.05, d - 0.2]),
      ...[-1, 1].flatMap((side) => [box('mahogany', [0, h, side * (d / 2 - 0.05)], [w, 0.1, 0.1]), box('mahogany', [side * (w / 2 - 0.05), h, 0], [0.1, 0.1, d])]),
      box('mahogany', [0, h - 0.2, 0], [w - 0.1, 0.3, d - 0.1]),
      ...[-0.9, 0, 0.9].flatMap((x) => [-1, 1].map((side) => cyl('mahogany', [x, (h - 0.3) / 2, side * (d / 2 - 0.25)], [0.18, h - 0.3, 0.18]))),
      ...BALLS.map((color, index) => shape('sphere', 'porcelain', [-0.6 + (index % 3) * 0.08 + (index > 2 ? 0.04 : 0), h + 0.03, (index > 2 ? 0.06 : 0) - 0.03], [0.06, 0.06, 0.06], undefined, color)),
    ]
    case 'cueRack': return [box('mahogany', [0, 1.2, 0], [w, 1.2, 0.05]), ...Array.from({ length: 6 }, (_, index) => box('oak', [-w / 2 + 0.2 + index * 0.24, 1.0, 0.05], [0.025, 1.45, 0.025]))]
    case 'radioCabinet': return [
      box('mahogany', [0, h / 2, 0], [w, h, d]), cyl('mahogany', [0, h, 0], [w, d, 0.5], [Math.PI / 2, 0, 0]),
      box('linen', [0, h * 0.62, d / 2 + 0.005], [w * 0.7, h * 0.35, 0.01], undefined, '#8a7a5a'),
      box('lampWarm', [0, h * 0.35, d / 2 + 0.005], [w * 0.4, 0.06, 0.01]),
      ...[-0.2, 0.2].map((x) => cyl('brass', [x, h * 0.25, d / 2 + 0.02], [0.06, 0.04, 0.06], [Math.PI / 2, 0, 0])),
    ]
    case 'banquetTable': {
      const parts: Part[] = [box('mahogany', [0, h - 0.03, 0], [w, 0.06, d]), box('linen', [0, h + 0.003, 0], [0.4, 0.005, d - 0.2]), box('mahogany', [0, h - 0.12, 0], [w - 0.1, 0.12, d - 0.1])]
      const legCount = Math.max(2, Math.round(d / 1.6))
      for (let leg = 0; leg < legCount; leg += 1) for (const side of [-1, 1]) parts.push(cyl('mahogany', [side * (w / 2 - 0.12), (h - 0.1) / 2, -d / 2 + 0.2 + (leg * (d - 0.4)) / (legCount - 1)], [0.1, h - 0.1, 0.1]))
      const candelabras = Math.max(1, Math.floor(d / 2.4))
      for (let index = 0; index < candelabras; index += 1) {
        const z = -d / 2 + (d * (index + 0.5)) / candelabras
        parts.push(cyl('brass', [0, h + 0.18, z], [0.05, 0.36, 0.05]), box('brass', [0, h + 0.36, z], [0.04, 0.03, 0.5]))
        for (const dz of [-0.22, 0, 0.22]) parts.push(cyl('porcelain', [0, h + 0.45, z + dz], [0.04, 0.16, 0.04]), shape('cone', 'flame', [0, h + 0.56, z + dz], [0.04, 0.07, 0.04]))
      }
      return parts
    }
  }
  return manorParts3(item)
}
function manorParts3(item: LayoutItem): Part[] | undefined {
  const { w, d, h } = item
  const random = randomFor(item)
  switch (item.type) {
    case 'highChair': return [box('velvet', [0, 0.48, 0], [0.46, 0.08, 0.44]), box('mahogany', [0, 0.88, -0.2], [0.46, 0.8, 0.06]), ...legs('darkWood', 0.46, 0.44, 0.45, 0.03, 0.04)]
    case 'sideboard': return [
      box('mahogany', [0, h / 2, 0], [w, h, d]), box('marble', [0, h + 0.02, 0], [w + 0.04, 0.04, d + 0.04]),
      box('blackSteel', [0, h / 2, d / 2 + 0.003], [0.01, h - 0.1, 0.01]), shape('sphere', 'glass', [-w / 4, h + 0.15, 0], [0.16, 0.24, 0.16]), box('silver', [w / 4, h + 0.05, 0], [0.4, 0.02, 0.3]),
    ]
    case 'pantryCounter': return [
      box('darkWood', [0, 0.45, 0], [w, 0.9, d]), box('marble', [0, 0.925, 0], [w + 0.05, 0.05, d + 0.05]),
      box('mahogany', [0, 1.9, -(d / 2 - 0.17)], [w, 0.8, 0.34]), box('glass', [0, 1.9, -(d / 2 - 0.35)], [w - 0.1, 0.7, 0.01]),
      box('chrome', [-0.9, 1.15, -0.1], [0.45, 0.4, 0.35]), box('blackSteel', [-0.9, 1.05, 0.1], [0.3, 0.04, 0.12]),
      shape('sphere', 'silver', [0.3, 1.05, 0], [0.24, 0.2, 0.24]), box('silver', [0.4, 0.955, 0], [0.7, 0.012, 0.36]),
      ...[0.15, 0.6].map((x) => cyl('porcelain', [x, 0.99, 0.08], [0.08, 0.07, 0.08])),
      box('brass', [0.9, 1.42, -0.15], [1.0, 0.03, 0.3]),
      ...Array.from({ length: 6 }, (_, index) => shape('cone', 'glass', [0.55 + index * 0.14, 1.34, -0.15], [0.07, 0.14, 0.07], [Math.PI, 0, 0])),
    ]
    case 'wineRack': return [
      box('darkWood', [0, h / 2, -(d / 2 - 0.02)], [w, h, 0.04]), ...[-1, 1].map((side) => box('darkWood', [side * (w / 2 - 0.03), h / 2, 0], [0.05, h, d])),
      ...Array.from({ length: 20 }, (_, index) => cyl('darkGlass', [-w / 2 + 0.18 + (index % 5) * 0.21, 0.25 + Math.floor(index / 5) * 0.45, 0.02], [0.08, d - 0.05, 0.08], [Math.PI / 2, 0, 0], random() > 0.5 ? '#3a0a12' : '#0f2a14')),
    ]
    case 'teaTrolley': return [
      ...[0.3, 0.8].map((y) => box('mahogany', [0, y, 0], [w, 0.03, d])), ...legs('brass', w, d, 0.85, 0.03, 0.03),
      shape('sphere', 'silver', [-0.15, 0.92, 0], [0.22, 0.2, 0.22]), ...[0.15, 0.3].map((x) => cyl('porcelain', [x, 0.85, 0.05], [0.08, 0.07, 0.08])),
    ]
    case 'bed': return [
      box('mahogany', [0, 0.25, 0], [w, 0.3, d]), box('linen', [0, 0.52, 0.03], [w - 0.1, 0.24, d - 0.15]),
      box('duvet', [0, 0.68, 0.32], [w - 0.06, 0.1, d * 0.62], undefined, DUVETS[(item.owner ?? 0) % DUVETS.length]),
      ...[-0.45, 0.45].map((x) => box('velvetCream', [x, 0.72, -(d / 2 - 0.35)], [0.75, 0.14, 0.34])),
      box('darkWood', [0, 0.95, -(d / 2 + 0.04)], [w + 0.1, 1.1, 0.1]), box('velvet', [0, 1.05, -(d / 2 - 0.02)], [w - 0.2, 0.75, 0.05]),
    ]
    case 'pedestal': return [box('mahogany', [0, 0.27, 0], [w, 0.54, d]), cyl('brass', [0, 0.68, 0], [0.04, 0.28, 0.04]), cyl('lampWarm', [0, 0.88, 0], [0.26, 0.2, 0.26])]
    case 'wardrobe': return [
      box('mahogany', [0, h / 2, 0], [w, h, d]), box('darkWood', [0, h + 0.04, 0], [w + 0.08, 0.08, d + 0.06]),
      box('blackSteel', [0, h / 2, d / 2 + 0.003], [0.01, h - 0.15, 0.01]), ...[-0.06, 0.06].map((x) => box('brass', [x, h * 0.52, d / 2 + 0.02], [0.02, 0.18, 0.02])),
    ]
    case 'privacyScreen': return [-1, 0, 1].flatMap((index) => [box('darkWood', [index * (w / 3), h / 2, 0], [w / 3 - 0.02, h, d]), box('linen', [index * (w / 3), h / 2 + 0.05, 0], [w / 3 - 0.12, h - 0.3, d + 0.01])])
    case 'sunLounger': return [
      box('oak', [0, 0.18, 0], [w, 0.06, d]), ...legs('oak', w, d, 0.16, 0.05, 0.05),
      box('linen', [0, 0.25, 0.15], [w - 0.08, 0.08, d * 0.6]), box('linen', [0, 0.45, -(d / 2 - 0.35)], [w - 0.08, 0.08, 0.7], [0.6, 0, 0]),
    ]
    case 'deskChair': return [box('leather', [0, 0.48, 0], [0.5, 0.08, 0.48]), box('leather', [0, 0.85, -0.22], [0.5, 0.65, 0.07]), ...legs('darkWood', 0.5, 0.48, 0.45, 0.03, 0.045)]
    case 'treadmill': return [
      // Belt along local z; the console stands at the -z end, which the runner faces.
      box('blackSteel', [0, 0.1, 0.1], [w, 0.2, d - 0.2]), box('rubber', [0, 0.205, 0.1], [w - 0.2, 0.01, d - 0.35]),
      ...[-1, 1].map((side) => box('gunmetal', [side * (w / 2 - 0.04), 0.75, -(d / 2 - 0.15)], [0.05, 1.1, 0.05], [0.25, 0, 0])),
      box('gunmetal', [0, 1.3, -(d / 2 - 0.05)], [w - 0.1, 0.06, 0.06]),
      box('darkGlass', [0, 1.38, -(d / 2 - 0.02)], [0.5, 0.26, 0.04], [-0.4, 0, 0]),
    ]
    case 'dumbbellRack': return [
      box('blackSteel', [0, 0.5, -(d / 2 - 0.05)], [w, 1, 0.08]), ...[0.35, 0.75].map((y) => box('gunmetal', [0, y, 0], [w, 0.04, d - 0.06], [-0.2, 0, 0])),
      ...Array.from({ length: 10 }, (_, index) => cyl('blackSteel', [-w / 2 + 0.2 + (index % 5) * ((w - 0.4) / 4), index < 5 ? 0.42 : 0.82, 0.02], [0.1 + (index % 5) * 0.01, 0.3, 0.1 + (index % 5) * 0.01], [0, 0, Math.PI / 2])),
    ]
    case 'weightBench': return [
      // Padded bench along local z, with the bar uprights at the -z end.
      box('leather', [0, 0.45, 0.15], [0.32, 0.08, d - 0.4]), box('blackSteel', [0, 0.22, 0.15], [0.08, 0.44, d - 0.6]),
      ...[-1, 1].map((side) => box('gunmetal', [side * 0.45, 0.6, -(d / 2 - 0.1)], [0.06, 1.2, 0.06])),
      cyl('chrome', [0, 1.12, -(d / 2 - 0.12)], [0.03, 1.5, 0.03], [0, 0, Math.PI / 2]),
      ...[-1, 1].map((side) => cyl('blackSteel', [side * 0.62, 1.12, -(d / 2 - 0.12)], [0.4, 0.06, 0.4], [0, 0, Math.PI / 2])),
    ]
    case 'exerciseMat': return [box('rubber', [0, 0.01, 0], [w, 0.02, d], undefined, '#3a3530')]
    case 'teakDeck': {
      const planks = Math.max(2, Math.round(w / 0.3))
      return Array.from({ length: planks }, (_, index) => box('oak', [-w / 2 + (index + 0.5) * (w / planks), 0.02, 0], [w / planks - 0.02, 0.04, d]))
    }
    case 'sideTable': return [cyl('oak', [0, h - 0.02, 0], [w, 0.04, d]), cyl('brass', [0, h / 2, 0], [0.05, h, 0.05]), cyl('lampWarm', [0, h + 0.18, 0], [0.22, 0.18, 0.22])]
    case 'soakingTub': return [
      // Freestanding marble tub (boxes, so it shares the marble batch) with a still water surface.
      box('marble', [0, 0.28, 0], [w, 0.56, d]),
      box('porcelain', [0, 0.32, 0], [w - 0.14, 0.5, d - 0.14]),
      box('glass', [0, 0.47, 0], [w - 0.2, 0.08, d - 0.2], undefined, '#bfe6f0'),
      box('chrome', [w / 2 - 0.12, 0.72, 0], [0.05, 0.3, 0.05]), box('chrome', [w / 2 - 0.12, 0.84, 0.08], [0.05, 0.05, 0.18]),
    ]
    case 'vanityCounter': return [
      box('marble', [0, 0.82, 0], [w, 0.1, d]), box('darkWood', [0, 0.42, 0], [w - 0.1, 0.78, d - 0.06]),
      box('porcelain', [0, 0.9, 0.02], [0.4, 0.12, 0.3]), box('chrome', [0, 1.0, -0.12], [0.04, 0.22, 0.04]), box('chrome', [0, 1.1, -0.05], [0.04, 0.04, 0.14]),
      // Framed mirror on the wall behind.
      box('mahogany', [0, 1.6, -(d / 2 - 0.02)], [w - 0.2, 0.9, 0.05]), box('chrome', [0, 1.6, -(d / 2 - 0.05)], [w - 0.34, 0.76, 0.01]),
    ]
    case 'showerScreen': return [
      // A tempered-glass walk-in panel in a thin chrome frame, with a steel showerhead.
      box('glass', [0, h / 2, 0], [w, h, d], undefined, '#cfe9f0'),
      box('chrome', [0, 0.02, 0], [w + 0.02, 0.04, d + 0.02]), box('chrome', [0, h, 0], [w + 0.02, 0.04, d + 0.02]),
      box('chrome', [0, h - 0.1, 0], [0.05, 0.4, 0.05]), box('chrome', [0, h - 0.4, 0.16], [0.16, 0.05, 0.16]),
    ]
    case 'consoleTable': return [
      box('mahogany', [0, h - 0.03, 0], [w, 0.06, d]), ...legs('darkWood', w, d, h - 0.06, 0.06, 0.05),
      box('brass', [0, h / 2, 0], [w - 0.1, 0.02, d - 0.04]),
      cyl('porcelain', [w / 4, h + 0.18, 0], [0.12, 0.34, 0.12]), shape('ico', 'leaf', [w / 4, h + 0.42, 0], [0.26, 0.2, 0.26], undefined, '#c24a6a'),
    ]
    case 'wallSconce': return [
      // A flush brass fitting with a warm emissive shade, mounted ~1.6 units up the wall. The shade
      // is a cylinder (not a cone) so it shares the existing cyl|lampWarm batch (pedestal lamps).
      box('brass', [0, 1.6, 0], [w, h * 0.6, d]), cyl('lampWarm', [0, 1.75, 0], [Math.max(w, d) * 0.8, 0.26, Math.max(w, d) * 0.8]),
    ]
    case 'bathWall': return [box('marble', [0, h / 2, 0], [w, h, d]), box('mahogany', [0, h + 0.03, 0], [w + 0.02, 0.06, d + 0.04])]
    case 'sunkenBath': return [
      // A marble kerb around a recessed thermal bath; the water sits a little below the rim.
      box('marble', [0, 0.2, -(d / 2 - 0.2)], [w, 0.4, 0.4]), box('marble', [0, 0.2, d / 2 - 0.2], [w, 0.4, 0.4]),
      box('marble', [-(w / 2 - 0.2), 0.2, 0], [0.4, 0.4, d]), box('marble', [w / 2 - 0.2, 0.2, 0], [0.4, 0.4, d]),
      box('porcelain', [0, 0.1, 0], [w - 0.8, 0.2, d - 0.8]),
      box('glass', [0, 0.22, 0], [w - 0.9, 0.04, d - 0.9], undefined, '#bfe6f0'),
    ]
    case 'bathBench': return [box('marble', [0, h - 0.06, 0], [w, 0.12, d]), box('marble', [0, (h - 0.12) / 2, 0], [w - 0.1, h - 0.12, d - 0.1])]
    case 'vanityRow': return [
      box('marble', [0, 0.9, 0], [w, 0.1, d]), box('blackSteel', [0, 0.45, 0], [w - 0.1, 0.78, d - 0.06]),
      ...[-1.2, -0.4, 0.4, 1.2].flatMap((x) => [box('porcelain', [x, 0.98, 0.04], [0.4, 0.12, 0.3]), box('chrome', [x, 1.08, -0.12], [0.04, 0.2, 0.04])]),
      // Long mahogany-framed mirror on the wall behind.
      box('mahogany', [0, 1.7, -(d / 2 - 0.02)], [w - 0.2, 1.0, 0.05]), box('chrome', [0, 1.7, -(d / 2 - 0.05)], [w - 0.4, 0.84, 0.01]),
    ]
    case 'toiletStall': return [
      // A closed cubicle: three panel walls and a door-height front panel, with a low fixture inside.
      box('mahogany', [0, h / 2, -(d / 2 - 0.03)], [w, h, 0.06]),
      ...[-1, 1].map((side) => box('mahogany', [side * (w / 2 - 0.03), h / 2, 0], [0.06, h, d])),
      box('mahogany', [w / 2 - 0.4, h / 2, d / 2 - 0.03], [w - 0.8, h, 0.06]),
      box('porcelain', [-(w / 2 - 0.5), 0.3, -(d / 2 - 0.4)], [0.5, 0.6, 0.6]),
    ]
    case 'runnerRug': return [box('velvet', [0, 0.01, 0], [w, 0.02, d], undefined, '#3b1119'), ...[-1, 1].map((side) => box('brass', [side * (w / 2 - 0.05), 0.012, 0], [0.025, 0.024, d - 0.1]))]
    case 'wallArt': return [box('mahogany', [0, 1.5, 0], [w, h, d]), box('paper', [0, 1.5, d > w ? 0.01 : 0], [w * 0.8, h * 0.8, d + 0.01], undefined, '#2f4a6a')]
  }
  return undefined
}
