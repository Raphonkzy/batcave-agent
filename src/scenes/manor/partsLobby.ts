import type { LayoutItem } from '../../utils/layout/types.ts'
import { box, cyl, shape, type Part } from './parts.ts'
// The hotel lobby: the curved Nero Marquina reception desk with fluted mahogany panelling, the
// backlit alabaster wall with its brass clocks and key cubbies, the inlaid floor medallion, tub
// armchairs on round plum rugs, the twin marble staircases with glass railings and brass handrails,
// and the lobby's small furnishings. All shared shapes and materials: no new draw calls.
const FACE_Z: Part['r'] = [Math.PI / 2, 0, 0]
const PLUM = '#3b1119'
const WARM_SLAB = '#f6dcae'
const rad = (degrees: number) => (degrees * Math.PI) / 180
function stair(item: LayoutItem): Part[] {
  const { d, h } = item
  const steps = 16
  const dir = item.role === 'west' ? -1 : 1 // which side of the hall the stair climbs along
  const inner = -dir // the side that faces the hall's centre: the only open side, so the only railing
  const treadW = 1.0
  const run = d / steps
  // The flight bows gently out towards its wall at mid-height: a sweep, kept inside the footprint.
  const bow = (t: number) => dir * 0.2 * Math.sin(Math.PI * t)
  const slope = (t: number) => (-dir * 0.2 * Math.PI * Math.cos(Math.PI * t)) / d
  const parts: Part[] = []
  const edge: { x: number; y: number; z: number }[] = []
  for (let step = 0; step < steps; step += 1) {
    const t = (step + 0.5) / steps
    const top = ((step + 1) * h) / steps
    const x = bow(t)
    const z = d / 2 - t * d
    const yaw = Math.atan(slope(t))
    parts.push(box('marble', [x, top / 2, z], [treadW, top, run * 1.04], [0, yaw, 0]), box('brass', [x, top + 0.012, z + run / 2 - 0.025], [treadW, 0.025, 0.04], [0, yaw, 0]))
    edge.push({ x: x + inner * (treadW / 2 - 0.04), y: top, z })
  }
  // Glass panels on the open (hall) side only, a brass handrail along the slope, and standoff
  // balusters every fourth step. Nothing crosses the foot or the head of the flight.
  const pitch = Math.atan2(h, d)
  for (let step = 0; step < steps; step += 2) {
    const a = edge[step]
    const b = edge[Math.min(step + 1, steps - 1)]
    parts.push(box('glass', [(a.x + b.x) / 2, (a.y + b.y) / 2 + 0.52, (a.z + b.z) / 2], [0.03, 0.9, run * 2.05]))
  }
  for (let step = 0; step < steps; step += 1) {
    const a = edge[step]
    parts.push(box('brass', [a.x, a.y + 1.0, a.z], [0.06, 0.05, run * 1.08], [pitch, 0, 0]))
    if (step % 4 === 1) parts.push(cyl('brass', [a.x, a.y + 0.5, a.z], [0.045, 1.0, 0.045]))
  }
  return parts
}
function receptionDesk(): Part[] {
  const radius = 3.2
  const half = rad(33)
  const segments = 7
  const parts: Part[] = []
  for (let i = 0; i < segments; i += 1) {
    const theta = -half + ((i + 0.5) * 2 * half) / segments
    const x = radius * Math.sin(theta)
    const z = radius * (Math.cos(theta) - 1) + 0.2
    parts.push(box('marbleBlack', [x, 0.5, z], [0.58, 1.0, 0.5], [0, theta, 0]), box('marbleBlack', [x, 1.07, z], [0.62, 0.06, 0.72], [0, theta, 0]))
    // Fluted mahogany panelling on the guest-facing side of each segment.
    for (const f of [-0.2, -0.07, 0.07, 0.2]) {
      parts.push(box('mahogany', [x + Math.cos(theta) * f + Math.sin(theta) * 0.27, 0.5, z - Math.sin(theta) * f + Math.cos(theta) * 0.27], [0.06, 0.9, 0.04], [0, theta, 0]))
    }
  }
  // A brass kick rail along the base, a call bell, a lamp and the guest book on the counter.
  for (let i = 0; i < segments; i += 1) {
    const theta = -half + ((i + 0.5) * 2 * half) / segments
    parts.push(box('brass', [radius * Math.sin(theta) + Math.sin(theta) * 0.3, 0.06, radius * (Math.cos(theta) - 1) + 0.2 + Math.cos(theta) * 0.3], [0.6, 0.05, 0.03], [0, theta, 0]))
  }
  parts.push(shape('sphere', 'brass', [0.5, 1.15, 0.2], [0.16, 0.1, 0.16]), cyl('brass', [-0.9, 1.25, 0.05], [0.04, 0.3, 0.04]), cyl('lampWarm', [-0.9, 1.45, 0.05], [0.22, 0.16, 0.22]), box('mahogany', [0.1, 1.12, 0.18], [0.4, 0.04, 0.28]))
  return parts
}
function alabasterWall(item: LayoutItem): Part[] {
  const { w, d, h } = item
  const front = d / 2 + 0.01
  const parts: Part[] = [
    box('lampWarm', [0, h / 2, 0], [w, h, d], undefined, WARM_SLAB),
    // A brass frame, and a few darker veins in the stone.
    box('brass', [0, h - 0.04, 0], [w + 0.1, 0.08, d + 0.04]), box('brass', [0, 0.04, 0], [w + 0.1, 0.08, d + 0.04]),
    ...[-1, 1].map((side) => box('brass', [side * (w / 2 + 0.02), h / 2, 0], [0.08, h, d + 0.04])),
    ...[-2.2, -1.3, -0.4, 0.5, 1.5, 2.3].map((x, index) => box('lampWarm', [x, h / 2 + (index % 2) * 0.2, front], [0.03, h - 0.5 - (index % 3) * 0.4, 0.01], undefined, '#e3c493')),
  ]
  // Three brass time-zone clocks with porcelain faces and hands (no text anywhere).
  ;[-0.95, 0, 0.95].forEach((x, index) => {
    const hour = rad(40 + index * 95)
    const minute = rad(150 - index * 70)
    parts.push(cyl('brass', [x, 2.6, front + 0.02], [0.6, 0.06, 0.6], FACE_Z), cyl('porcelain', [x, 2.6, front + 0.06], [0.48, 0.04, 0.48], FACE_Z))
    parts.push(box('blackSteel', [x + (Math.sin(hour) * 0.1) / 1, 2.6 + (Math.cos(hour) * 0.1) / 1, front + 0.1], [0.025, 0.2, 0.012], [0, 0, -hour]), box('blackSteel', [x + Math.sin(minute) * 0.13, 2.6 + Math.cos(minute) * 0.13, front + 0.11], [0.018, 0.26, 0.012], [0, 0, -minute]))
  })
  // Key cubbies either side, each with a brass fob.
  for (const side of [-1, 1]) for (let row = 0; row < 3; row += 1) for (let col = 0; col < 4; col += 1) {
    const x = side * (1.55 + col * 0.3)
    const y = 1.2 + row * 0.3
    parts.push(box('darkWood', [x, y, front + 0.005], [0.24, 0.24, 0.03]), box('brass', [x, y, front + 0.03], [0.05, 0.06, 0.02]))
  }
  return parts
}
/** A flat inlay of nested Carrara and Marquina discs with a ring of diamonds, stepped 4 mm apart. */
function medallion(item: LayoutItem): Part[] {
  const r = item.w
  const parts: Part[] = [
    cyl('marbleBlack', [0, 0.01, 0], [r, 0.02, r]),
    cyl('marble', [0, 0.012, 0], [r * 0.865, 0.024, r * 0.865]),
    cyl('brass', [0, 0.014, 0], [r * 0.766, 0.028, r * 0.766]),
    cyl('marbleBlack', [0, 0.016, 0], [r * 0.75, 0.032, r * 0.75]),
    cyl('marble', [0, 0.018, 0], [r * 0.5, 0.036, r * 0.5]),
  ]
  for (let k = 0; k < 8; k += 1) {
    const a = (k * Math.PI) / 4
    parts.push(box('marbleBlack', [Math.sin(a) * r * 0.405, 0.019, Math.cos(a) * r * 0.405], [0.4, 0.038, 0.4], [0, a + Math.PI / 4, 0]))
    parts.push(box('marble', [Math.sin(a + Math.PI / 8) * r * 0.405, 0.021, Math.cos(a + Math.PI / 8) * r * 0.405], [0.26, 0.04, 0.26], [0, a + Math.PI / 8, 0]))
  }
  return parts
}
function tubChair(): Part[] {
  const parts: Part[] = [cyl('velvet', [0, 0.17, 0], [0.66, 0.34, 0.66]), cyl('velvetCream', [0, 0.4, 0], [0.56, 0.12, 0.56])]
  // The curved back: seven slats on an arc behind the seat.
  for (let k = 0; k < 7; k += 1) {
    const a = rad(-72 + (k * 144) / 6)
    parts.push(box('velvet', [Math.sin(a) * 0.3, 0.62, -Math.cos(a) * 0.3], [0.17, 0.56, 0.09], [0, -a, 0]))
  }
  parts.push(cyl('brass', [0, 0.02, 0], [0.5, 0.04, 0.5]))
  return parts
}
export function lobbyParts(item: LayoutItem): Part[] | undefined {
  const { w, d, h } = item
  switch (item.type) {
    case 'grandStair': return stair(item)
    case 'receptionDesk': return receptionDesk()
    case 'alabasterWall': return alabasterWall(item)
    case 'lobbyMedallion': return medallion(item)
    case 'tubChair': return tubChair()
    case 'roundRug': return [cyl('velvet', [0, 0.01, 0], [w, 0.02, d], undefined, PLUM), cyl('brass', [0, 0.012, 0], [w * 0.93, 0.024, d * 0.93]), cyl('velvet', [0, 0.014, 0], [w * 0.89, 0.028, d * 0.89], undefined, PLUM)]
    case 'loungeTable': return [cyl('marble', [0, h - 0.025, 0], [w, 0.05, d]), cyl('brass', [0, (h - 0.05) / 2, 0], [0.1, h - 0.05, 0.1]), cyl('brass', [0, 0.015, 0], [0.5, 0.03, 0.5])]
    case 'luggageTrolley': return [
      // A polished brass trolley: a deck on four small wheels, two uprights with a top bar, and two cases.
      box('brass', [0, 0.2, 0], [w, 0.05, d]),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => cyl('rubber', [sx * (w / 2 - 0.1), 0.09, sz * (d / 2 - 0.08)], [0.18, 0.06, 0.18], [0, 0, Math.PI / 2])),
      ...[-1, 1].map((side) => cyl('brass', [side * (w / 2 - 0.05), 0.78, -(d / 2 - 0.05)], [0.035, 1.16, 0.035])),
      box('brass', [0, 1.36, -(d / 2 - 0.05)], [w, 0.035, 0.035]),
      box('leather', [-0.18, 0.46, 0.02], [0.7, 0.42, 0.34]), box('leather', [0.12, 0.84, 0.0], [0.5, 0.32, 0.3], undefined, '#3a2418'), box('brass', [-0.18, 0.46, 0.2], [0.5, 0.03, 0.02]),
    ]
    case 'marbleUrn': return [
      // A tall fluted urn (eight flat faces read as flutes) on a round base, with architectural greenery.
      cyl('marble', [0, 0.06, 0], [0.7, 0.12, 0.7]),
      shape('oct', 'marble', [0, 0.55, 0], [0.62, 0.86, 0.62]),
      cyl('marble', [0, 1.02, 0], [0.5, 0.16, 0.5]),
      shape('ico', 'leaf', [0, 1.32, 0], [0.8, 0.6, 0.8]), shape('sphere', 'leaf', [0.1, 1.5, 0.05], [0.5, 0.4, 0.5]),
    ]
  }
  return undefined
}
