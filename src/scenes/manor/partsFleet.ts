import type { LayoutItem } from '../../utils/layout/types.ts'
import { box, cyl, shape, type Part } from './parts.ts'
// Procedural models for the hangar's fleet and workshop. Every vehicle is built from the same few
// shared shapes (boxes, cylinders, hexagonal prisms, spheres), so the whole fleet adds instances to
// existing batches rather than new draw calls. Vehicles face local +z; their feet are at y 0.
const SIDEWAYS: Part['r'] = [0, 0, Math.PI / 2]
const ALONG_Z: Part['r'] = [Math.PI / 2, 0, 0]
const HULL = '#1a1c1e' // matte graphite
/** Hazard-striped border round a pad (only ever drawn under a vehicle or a lift). */
const border = (w: number, d: number, y: number, thick = 0.2): Part[] => [
  box('hazard', [0, y, d / 2 - thick / 2], [w, 0.03, thick]), box('hazard', [0, y, -(d / 2 - thick / 2)], [w, 0.03, thick]),
  box('hazard', [w / 2 - thick / 2, y, 0], [thick, 0.03, d - 2 * thick]), box('hazard', [-(w / 2 - thick / 2), y, 0], [thick, 0.03, d - 2 * thick]),
]
/** A steel pad with a hazard border: the platform a vehicle is parked on. */
const pad = (w: number, d: number): Part[] => [box('grating', [0, 0.02, 0], [w - 0.5, 0.04, d - 0.5]), ...border(w, d, 0.03)]
/** A ducted fan: a shrouded ring with a dark well, cross blades and a hub. */
function fan(x: number, y: number, z: number, diameter: number): Part[] {
  return [
    cyl('blackSteel', [x, y, z], [diameter, 0.7, diameter]),
    cyl('rubber', [x, y, z], [diameter * 0.82, 0.74, diameter * 0.82]),
    ...[0, 1, 2, 3].map((k) => box('gunmetal', [x, y + 0.02, z], [diameter * 0.76, 0.03, 0.12], [0, (k * Math.PI) / 4, 0])),
    cyl('chrome', [x, y + 0.04, z], [0.3, 0.1, 0.3]),
    shape('torus', 'ledCyan', [x, y + 0.35, z], [diameter * 0.98, 1, diameter * 0.98]),
  ]
}
function apc(): Part[] {
  const wheelZ = [-2.6, 0, 2.6]
  return [
    // Three armoured layers: hull, deck, upper cabin, with a sloped glacis plate at the nose.
    box('blackSteel', [0, 0.95, 0], [2.7, 0.7, 6.9], undefined, HULL),
    box('blackSteel', [0, 1.62, -0.3], [2.3, 0.65, 5.6], undefined, HULL),
    box('blackSteel', [0, 2.2, -0.7], [1.8, 0.5, 3.4], undefined, HULL),
    box('carbon', [0, 1.4, 3.15], [2.3, 0.16, 1.5], [0.55, 0, 0]),
    box('gunmetal', [0, 0.62, 0], [2.9, 0.34, 6.2], undefined, '#23262a'),
    // Narrow ballistic vision slits on the nose and along the cabin sides.
    ...[-0.6, 0, 0.6].map((x) => box('darkGlass', [x, 1.8, 2.5], [0.46, 0.07, 0.03])),
    ...[-1, 1].flatMap((side) => [-1.4, 0, 1.4].map((z) => box('darkGlass', [side * 0.91, 2.25, z - 0.7], [0.03, 0.07, 0.6]))),
    // Six deep-tread wheels, with hubs and hydraulic struts down to the axles.
    ...[-1, 1].flatMap((side) => wheelZ.flatMap((z) => [
      cyl('rubber', [side * 1.57, 0.6, z], [1.2, 0.55, 1.2], SIDEWAYS),
      cyl('chrome', [side * 1.57, 0.6, z], [0.5, 0.6, 0.5], SIDEWAYS),
      cyl('chrome', [side * 1.95, 0.95, z], [0.09, 0.7, 0.09]),
      box('gunmetal', [side * 1.5, 1.2, z], [0.6, 0.1, 0.16], [0, 0, side * 0.5]),
    ])),
    // Canted side armor with inset service seams; no additional garage footprint.
    ...[-1,1].flatMap(side=>[-1.7,0,1.7].map(z=>box('carbon',[side*1.28,1.55,z],[0.12,0.7,1.35],[0,0,side*0.18]))),
    box('blackSteel',[0,2.58,0.7],[1.2,0.14,1.3]),
    // Communications dome on a hexagonal base, and an antenna.
    shape('hex', 'gunmetal', [0, 2.58, -0.9], [1.1, 0.3, 1.1]),
    shape('hex', 'gunmetal', [0, 2.8, -0.9], [0.6, 0.2, 0.6], undefined, '#15171a'),
    cyl('chrome', [0.5, 2.9, -1.6], [0.04, 0.7, 0.04]),
    ...[-1, 1].map((side) => box('ledRed', [side * 0.95, 1.1, -3.47], [0.3, 0.1, 0.04])),
    ...[-1, 1].map((side) => box('ledWhite', [side * 0.95, 1.1, 3.47], [0.4, 0.08, 0.04])),
  ]
}
function vtol(): Part[] {
  return [
    // Hexagonal-prism fuselage with a nose cone, canted cockpit glass, belly sponson and tail boom.
    shape('hex', 'blackSteel', [0, 1.55, 0], [1.9, 5.4, 1.5], ALONG_Z, HULL),
    shape('sphere', 'blackSteel', [0, 1.55, 3.0], [1.5, 1.25, 1.3], undefined, HULL),
    box('darkGlass', [0, 2.05, 2.2], [1.3, 0.5, 1.5], [-0.5, 0, 0]),
    box('gunmetal', [0, 0.78, 0], [2.0, 0.2, 3.2]),
    box('blackSteel', [0, 1.55, -3.0], [1.3, 0.55, 1.2], [0.2, 0, 0], HULL),
    ...[-1, 1].map((side) => box('blackSteel', [side * 0.6, 2.35, -2.9], [0.08, 1.1, 0.9], undefined, HULL)),
    box('carbon', [0, 2.0, -3.0], [2.6, 0.07, 0.7]),
    ...[-1,1].map(side=>box('blackSteel',[side*0.64,2.3,-2.6],[0.08,0.8,1.1],[0,side*0.25,side*-0.3])),
    box('ledCyan', [0, 1.55, 0], [1.96, 0.04, 4.4]),
    // Stubby high-mount wings carrying two ducted fan nacelles.
    box('carbon', [0, 2.15, 0.2], [6.0, 0.16, 1.7]),
    ...[-1, 1].flatMap((side) => fan(side * 2.75, 2.15, 0.2, 1.9)),
    // Four hydraulic landing struts with foot pads.
    ...[-1, 1].flatMap((side) => [-1.4, 1.4].flatMap((z) => [
      cyl('chrome', [side * 0.75, 0.42, z], [0.12, 0.72, 0.12]),
      box('blackSteel', [side * 0.75, 0.04, z], [0.4, 0.08, 0.5]),
    ])),
  ]
}
function submersible(): Part[] {
  return [
    // Torpedo hull, obsidian dome canopy, twin dive planes, tail fins and a shrouded propulsion screw.
    shape('sphere', 'blackSteel', [0, 1.0, 0], [1.15, 1.15, 4.0], undefined, HULL),
    shape('sphere', 'darkGlass', [0, 1.45, 0.9], [0.8, 0.5, 1.2]),
    box('gunmetal', [0, 1.0, 0.55], [2.3, 0.05, 0.55]),
    box('gunmetal', [0, 1.0, -1.45], [1.5, 0.05, 0.5]),
    box('blackSteel', [0, 1.4, -1.5], [0.05, 0.9, 0.55], undefined, HULL),
    shape('torus', 'ledCyan', [0, 1.0, -2.12], [1.1, 1, 1.1], ALONG_Z, '#4a5058'),
    cyl('chrome', [0, 1.0, -2.1], [0.26, 0.3, 0.26], ALONG_Z),
    ...[0, 1, 2, 3].map((k) => box('chrome', [0, 1.0, -2.14], [0.9, 0.08, 0.03], [0, 0, (k * Math.PI) / 4])),
    box('ledCyan', [0, 1.0, 1.5], [0.04, 0.04, 0.6]),
    // The cradle it rests in.
    ...[-1.0, 1.0].map((z) => box('blackSteel', [0, 0.2, z], [1.3, 0.36, 0.3])),
  ]
}
export function fleetParts(item: LayoutItem): Part[] | undefined {
  const { w, d, h } = item
  switch (item.type) {
    case 'vtolPad': case 'apcBay': case 'subDock': return pad(w, d)
    case 'serviceLane': return [
      // A darker steel strip with a dashed white guide light down each edge: a lane, not a parking bay.
      box('blackSteel', [0, 0.008, 0], [w, 0.012, d]),
      ...[-1, 1].flatMap((side) => Array.from({ length: Math.floor(w / 1.2) }, (_, index) => box('ledWhite', [-w / 2 + 0.6 + index * 1.2, 0.016, side * (d / 2 - 0.1)], [0.5, 0.008, 0.04]))),
    ]
    case 'combatApc': return apc()
    case 'assaultVtol': return vtol()
    case 'submersiblePod': return submersible()
    case 'bikeDock': return [
      box('gunmetal', [0, h / 2, 0], [w, h, d]),
      ...border(w, d, h + 0.005, 0.16),
      // A cradle and a charge strip under each bike, alternating amber and cyan.
      ...[-1.65, -0.55, 0.55, 1.65].flatMap((x, index) => [box('blackSteel', [x, h + 0.05, -0.1], [0.36, 0.1, 1.7]), box(index % 2 === 0 ? 'ledAmber' : 'ledCyan', [x, h + 0.11, -0.1], [0.1, 0.02, 1.3])]),
      // Charging posts between the bikes, at their tails.
      ...[-1.1, 0, 1.1].flatMap((x) => [cyl('gunmetal', [x, h + 0.45, 1.0], [0.14, 0.9, 0.14]), box('ledCyan', [x, h + 0.9, 0.94], [0.1, 0.06, 0.06])]),
    ]
    case 'hydraulicLift': return [
      box('grating', [0, 0.03, 0], [w, 0.06, d]), ...border(w, d, 0.07, 0.16),
      // Two posts, a raised pair of rails on carriages, and a hydraulic ram under each.
      ...[-1, 1].flatMap((side) => [
        box('blackSteel', [side * (w / 2 - 0.3), h / 2, -(d / 2 - 0.35)], [0.3, h, 0.3]),
        box('gunmetal', [side * (w / 2 - 0.3), 0.6, -(d / 2 - 0.35)], [0.4, 0.3, 0.5]),
        box('gunmetal', [side * 0.95, 0.6, 0.1], [0.4, 0.14, d - 0.8]),
        cyl('chrome', [side * 0.95, 0.3, 0.1], [0.1, 0.55, 0.1]),
        shape('sphere', 'ledAmber', [side * (w / 2 - 0.3), h + 0.1, -(d / 2 - 0.35)], [0.18, 0.12, 0.18]),
      ]),
    ]
    case 'toolChest': return [
      box('gunmetal', [0, (h - 0.15) / 2 + 0.12, 0], [w, h - 0.15, d], undefined, '#8b2b2b'),
      box('blackSteel', [0, h - 0.02, 0], [w + 0.04, 0.05, d + 0.04]),
      ...[0.3, 0.55, 0.8].map((y) => box('blackSteel', [0, y, d / 2 + 0.005], [w - 0.1, 0.012, 0.01])),
      box('chrome', [0, h - 0.18, d / 2 + 0.03], [w - 0.4, 0.03, 0.04]),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => cyl('rubber', [sx * (w / 2 - 0.1), 0.06, sz * (d / 2 - 0.1)], [0.12, 0.06, 0.12], SIDEWAYS)),
    ]
    case 'diagBench': return [
      box('gunmetal', [0, 0.88, 0], [w, 0.06, d]),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => box('blackSteel', [sx * (w / 2 - 0.05), 0.44, sz * (d / 2 - 0.05)], [0.06, 0.88, 0.06])),
      box('blackSteel', [0, 0.25, 0], [w - 0.1, 0.04, d - 0.1]),
      // Two tilted monitors on arms at the back, and a keyboard.
      ...[-0.5, 0.5].flatMap((x) => [cyl('chrome', [x, 1.12, -(d / 2 - 0.1)], [0.05, 0.4, 0.05]), box('darkGlass', [x, 1.45, -(d / 2 - 0.12)], [0.72, 0.42, 0.03], [-0.15, 0, 0]), box('ledCyan', [x, 1.45, -(d / 2 - 0.09)], [0.6, 0.3, 0.005], [-0.15, 0, 0])]),
      box('rubber', [0, 0.93, 0.1], [0.6, 0.02, 0.2]),
    ]
  }
  return undefined
}
