import { agentLook } from '../../agents.ts'
import { box, cyl, shape, type Part } from '../../scenes/manor/parts.ts'
import type { AgentGearConfig } from './agentLooks.ts'
// A character is a few bones (body, head, arms, legs) with parts attached. Parts are the same
// boxes, cylinders and spheres as the furniture, so the whole crew shares a handful of instanced
// meshes. Positions are relative to the bone's pivot; the character faces +z with its feet at y 0.
export type Bone = 'body' | 'head' | 'armL' | 'armR' | 'legL' | 'legR'
export interface BonePart extends Part { bone: Bone }
export const PIVOTS: Record<Bone, [number, number, number]> = { body: [0, 0, 0], head: [0, 1.5, 0], armL: [-0.31, 1.2, 0], armR: [0.31, 1.2, 0], legL: [-0.11, 0.66, 0], legR: [0.11, 0.66, 0] }
const on = (bone: Bone, parts: Part[]): BonePart[] => parts.map((part) => ({ ...part, bone }))
const QUARTER: Part['r'] = [Math.PI / 2, 0, 0]
function humanBody(config: AgentGearConfig): BonePart[] {
  const look = agentLook(config.profileId)
  const suit = config.palette.baseDark
  // An optional build: a slighter waist and shoulders give a more feminine athletic silhouette.
  const [sx, sy, sz] = config.silhouette ?? [1, 1, 1]
  return [
    ...on('body', [box('paper', [0, 0.98, 0], [0.48 * sx, 0.58 * sy, 0.3 * sz], undefined, suit)]),
    ...on('head', [box('paper', [0, 0, 0], [0.38, 0.4, 0.36], undefined, look.skin), box('paper', [-0.08, 0.02, 0.182], [0.05, 0.06, 0.01], undefined, '#17201e'), box('paper', [0.08, 0.02, 0.182], [0.05, 0.06, 0.01], undefined, '#17201e')]),
    ...(['legL', 'legR'] as const).flatMap((leg) => on(leg, [box('paper', [0, -0.31, 0], [0.17 * sx, 0.62 * sy, 0.2 * sz], undefined, '#202328'), box('paper', [0, -0.6, 0.03], [0.19 * sx, 0.1, 0.26], undefined, '#0f1012')])),
    ...(['armL', 'armR'] as const).flatMap((arm) => on(arm, [box('paper', [0, -0.26, 0], [0.12 * sx, 0.52 * sy, 0.14 * sz], undefined, suit), box('paper', [0, -0.55, 0], [0.11 * sx, 0.1, 0.12], undefined, '#15171a')])),
  ]
}
/** The combat automaton: faceted sensor head, layered armour, pauldrons, reverse-joint legs. */
function automatonBody(config: AgentGearConfig): BonePart[] {
  const dark = config.palette.baseDark
  const glow = config.palette.accentGlow
  return [
    ...on('body', [
      box('carbon', [0, 1.0, 0], [0.56, 0.5, 0.34], undefined, dark), box('gunmetal', [0, 0.7, 0], [0.36, 0.18, 0.28], undefined, '#2a2c31'),
      ...[0, 1, 2].map((index) => box('gunmetal', [0, 0.92 + index * 0.11, 0.18], [0.5 - index * 0.06, 0.05, 0.04], undefined, '#2a2c31')),
      cyl('ledCyan', [0, 0.98, 0.2], [0.12, 0.04, 0.12], QUARTER, glow),
      ...[-1, 1].flatMap((side) => [box('carbon', [side * 0.37, 1.28, 0], [0.24, 0.16, 0.32], undefined, dark), cyl('chrome', [side * 0.36, 1.13, 0.11], [0.04, 0.22, 0.04])]),
    ]),
    ...on('head', [
      box('carbon', [0, -0.02, 0], [0.34, 0.24, 0.3], undefined, dark),
      box('gunmetal', [0, 0.1, 0], [0.24, 0.08, 0.26], [0, Math.PI / 4, 0], '#2a2c31'),
      cyl('ledCyan', [0, -0.01, 0.155], [0.13, 0.04, 0.13], QUARTER, glow),
      ...[-1, 1].map((side) => box('ledCyan', [side * 0.11, 0.05, 0.152], [0.07, 0.018, 0.01], undefined, glow)),
    ]),
    ...(['legL', 'legR'] as const).flatMap((leg) => on(leg, [
      box('carbon', [0, -0.15, -0.07], [0.15, 0.36, 0.17], [0.55, 0, 0], dark),
      shape('sphere', 'gunmetal', [0, -0.32, -0.17], [0.13, 0.13, 0.13], undefined, '#2a2c31'),
      box('carbon', [0, -0.47, -0.06], [0.12, 0.34, 0.14], [-0.6, 0, 0], dark),
      cyl('chrome', [0, -0.55, 0.03], [0.04, 0.16, 0.04]),
      box('gunmetal', [0, -0.63, 0.06], [0.24, 0.06, 0.36], undefined, '#2a2c31'),
      // Heel micro-thruster: a small nozzle at the back of the foot with a violet glow.
      cyl('gunmetal', [0, -0.6, -0.16], [0.08, 0.12, 0.08], QUARTER, '#2a2c31'),
      cyl('ledViolet', [0, -0.6, -0.22], [0.05, 0.03, 0.05], QUARTER, glow),
    ])),
    ...(['armL', 'armR'] as const).flatMap((arm) => on(arm, [
      box('carbon', [0, -0.16, 0], [0.13, 0.32, 0.15], undefined, dark),
      box('gunmetal', [0, -0.44, 0], [0.17, 0.22, 0.19], undefined, '#2a2c31'),
      box('ledCyan', [0, -0.5, 0.1], [0.12, 0.03, 0.01], undefined, glow),
    ])),
  ]
}
function headParts(config: AgentGearConfig): Part[] {
  const { baseDark: dark, accentGlow: glow, secondaryAccent: second } = config.palette
  switch (config.headMesh) {
    case 'command-helm': return [
      box('carbon', [0, 0.1, -0.01], [0.44, 0.3, 0.42], undefined, dark), box('gunmetal', [0, 0.27, -0.01], [0.46, 0.04, 0.44], undefined, '#3a3e45'),
      box('ledCyan', [0, 0.03, 0.2], [0.34, 0.045, 0.02], undefined, second ?? '#d8f0ff'),
      ...[-1, 1].map((side) => box('carbon', [side * 0.21, -0.05, 0.02], [0.06, 0.22, 0.32], undefined, dark)),
      box('carbon', [0, -0.16, 0.17], [0.3, 0.08, 0.06], undefined, dark), box('ledCyan', [0, 0.27, 0.21], [0.12, 0.02, 0.02], undefined, glow),
    ]
    case 'aero-visor': {
      const hair = second ?? '#3a2a20'
      // A streamlined cowl with a gold visor band and a comms earpiece. At the back is a round
      // rubber-rimmed socket (a mini torus) from which a high ponytail falls in tapering, curving
      // segments. Each segment sits behind the cowl (z <= -0.26) so the hair never clips the neck
      // or collar, and the radii taper 0.11 -> 0.04 towards the tip.
      const socket: Part[] = [shape('torus', 'blackSteel', [0, 0.26, -0.24], [0.2, 1, 0.2], [1.2, 0, 0])]
      const ponytail: Part[] = [
        cyl('paper', [0, 0.14, -0.3], [0.22, 0.24, 0.22], [0.55, 0, 0], hair),
        cyl('paper', [0, -0.06, -0.37], [0.18, 0.26, 0.18], [0.9, 0, 0], hair),
        cyl('paper', [0, -0.28, -0.36], [0.12, 0.24, 0.12], [1.2, 0, 0], hair),
        cyl('paper', [0, -0.46, -0.32], [0.08, 0.18, 0.08], [1.4, 0, 0], hair),
      ]
      return [
        shape('sphere', 'carbon', [0, 0.06, -0.02], [0.44, 0.42, 0.46], undefined, dark), box('ledCyan', [0, 0.02, 0.19], [0.4, 0.08, 0.04], undefined, glow),
        box('gunmetal', [0, 0.27, -0.04], [0.04, 0.06, 0.3], undefined, '#3a3e45'),
        // comms earpiece, offset clear of the cowl surface
        box('gunmetal', [0.21, 0.0, 0.05], [0.04, 0.08, 0.06], undefined, '#3a3e45'),
        ...socket, ...ponytail,
      ]
    }
    case 'visor-band': return [box('paper', [0, 0.06, 0], [0.4, 0.07, 0.39], undefined, dark), box('ledCyan', [0, 0.04, 0.19], [0.3, 0.05, 0.03], undefined, glow), box('paper', [0.2, -0.02, 0.02], [0.03, 0.08, 0.06], undefined, dark), box('paper', [0, 0.2, -0.02], [0.4, 0.1, 0.38], undefined, '#1a1a1a')]
    case 'hard-helm': return [
      shape('sphere', 'gunmetal', [0, 0.13, 0], [0.46, 0.36, 0.46], undefined, dark), box('gunmetal', [0, 0.04, 0.02], [0.48, 0.03, 0.5], undefined, dark),
      box('ledCyan', [0, 0.31, 0], [0.04, 0.02, 0.44], undefined, glow), box('darkGlass', [0, 0.25, 0.19], [0.36, 0.18, 0.02], [-1.0, 0, 0]),
    ]
    case 'scanner-goggles': return [
      shape('sphere', 'paper', [0, 0.04, -0.05], [0.46, 0.44, 0.46], undefined, second ?? dark), box('paper', [0, 0.04, 0], [0.4, 0.04, 0.38], undefined, '#111'),
      ...[-1, 1].map((side) => cyl('ledCyan', [side * 0.09, 0.03, 0.19], [0.1, 0.05, 0.1], QUARTER, glow)),
    ]
    case 'formal-earpiece': return [box('paper', [0, 0.22, -0.02], [0.4, 0.08, 0.38], undefined, '#8a8a8a'), box('ledCyan', [0.2, 0, 0.03], [0.03, 0.06, 0.04], undefined, glow)]
    case 'automaton-optic-cluster': return []
  }
}
function torsoParts(config: AgentGearConfig): Part[] {
  const { baseDark: dark, accentGlow: glow, secondaryAccent: second } = config.palette
  switch (config.torsoMesh) {
    case 'heavy-plate': return [box('carbon', [0, 1.06, 0.165], [0.52, 0.34, 0.08], undefined, dark), box('gunmetal', [0, 1.23, 0.16], [0.4, 0.06, 0.1], [-0.4, 0, 0], '#3a3e45'), ...[-1, 1].map((side) => box('carbon', [side * 0.3, 1.27, 0], [0.18, 0.08, 0.3], undefined, dark)), box('ledCyan', [0, 0.95, 0.21], [0.3, 0.02, 0.01], undefined, glow)]
    case 'data-harness': return [...[-1, 1].map((side) => box('paper', [side * 0.12, 1.0, 0.16], [0.06, 0.5, 0.02], undefined, '#3a3e45')), cyl('ledCyan', [0, 1.05, 0.17], [0.1, 0.02, 0.1], QUARTER, glow), cyl('silver', [0.2, 0.72, 0.13], [0.12, 0.03, 0.12], QUARTER)]
    case 'reviewer-vest': return [box('paper', [0, 1.0, 0], [0.5, 0.5, 0.32], undefined, dark), ...[-1, 1].map((side) => box('ledCyan', [side * 0.09, 1.0, 0.165], [0.03, 0.42, 0.01], undefined, glow)), box('paper', [0, 1.28, 0], [0.4, 0.06, 0.3], undefined, dark)]
    case 'tactical-vest': return [box('paper', [0, 1.0, 0], [0.52, 0.46, 0.34], undefined, second ?? dark), ...[-0.15, 0, 0.15].map((x) => box('paper', [x, 0.92, 0.18], [0.1, 0.12, 0.06], undefined, '#2a2e24')), box('paper', [0, 1.3, 0], [0.42, 0.1, 0.32], undefined, second ?? dark), box('ledCyan', [0.18, 1.1, 0.175], [0.04, 0.04, 0.01], undefined, glow)]
    case 'cross-harness': return [box('paper', [0, 1.05, 0.165], [0.46, 0.3, 0.06], undefined, second ?? '#5a1420'), ...[-1, 1].map((side) => box('paper', [0, 1.0, 0.2], [0.05, 0.62, 0.02], [0, 0, side * 0.6], '#111'))]
    case 'kevlar-coat': return [box('paper', [0, 0.97, 0], [0.52, 0.62, 0.34], undefined, dark), box('paper', [0, 1.32, 0], [0.44, 0.12, 0.34], undefined, dark), box('paper', [0, 0.5, -0.16], [0.52, 0.5, 0.05], undefined, dark), ...[-1, 1].map((side) => box('paper', [side * 0.13, 0.47, 0.16], [0.24, 0.45, 0.04], undefined, dark)), ...[1.1, 0.95, 0.8].map((y) => shape('sphere', 'silver', [0.05, y, 0.175], [0.03, 0.03, 0.02]))]
    case 'ballistic-chassis': return []
  }
}
function backParts(config: AgentGearConfig): Part[] {
  const { baseDark: dark, accentGlow: glow } = config.palette
  switch (config.backMesh) {
    // The cape hangs from below the pauldrons with a 0.03-unit clearance behind the back and legs,
    // so a walking animation never pushes a thigh through it.
    case 'long-coat': return [box('paper', [0, 0.72, -0.2], [0.5, 0.95, 0.04], undefined, dark), ...[-1, 1].map((side) => box('paper', [side * 0.27, 0.52, -0.03], [0.04, 0.6, 0.3], undefined, dark))]
    case 'flight-pack': return [box('carbon', [0, 1.0, -0.22], [0.34, 0.36, 0.14], undefined, dark), cyl('gunmetal', [0.12, 1.35, -0.24], [0.015, 0.4, 0.015]), box('ledCyan', [0, 1.0, -0.295], [0.24, 0.03, 0.01], undefined, glow)]
    case 'antenna-mast': return [box('paper', [0, 1.0, -0.2], [0.26, 0.3, 0.1], undefined, dark), cyl('gunmetal', [0.1, 1.35, -0.2], [0.03, 0.7, 0.03]), shape('sphere', 'ledCyan', [0.1, 1.72, -0.2], [0.06, 0.06, 0.06], undefined, glow)]
    case 'thruster-pack': return [
      box('carbon', [0, 1.02, -0.24], [0.36, 0.34, 0.16], undefined, dark),
      ...[-1, 1].flatMap((side) => [cyl('gunmetal', [side * 0.1, 0.82, -0.28], [0.1, 0.18, 0.1], undefined, '#2a2c31'), shape('torus', 'ledCyan', [side * 0.1, 0.72, -0.28], [0.1, 1, 0.1], undefined, glow), shape('tri', 'carbon', [side * 0.18, 1.18, -0.3], [0.05, 0.3, 0.18], undefined, dark), cyl('chrome', [side * 0.1, 1.38, -0.22], [0.012, 0.35, 0.012])]),
    ]
    default: return []
  }
}
function legParts(config: AgentGearConfig): BonePart[] {
  const { baseDark: dark, accentGlow: glow } = config.palette
  const parts: BonePart[] = []
  for (const gear of config.legGear ?? []) {
    if (gear === 'utility-belt') parts.push(...on('body', [box('paper', [0, 0.7, 0], [0.52, 0.07, 0.32], undefined, '#111'), ...[-0.18, -0.08, 0.08, 0.18].map((x) => box('paper', [x, 0.68, 0.17], [0.07, 0.09, 0.05], undefined, dark)), shape('oct', 'silver', [0, 0.7, 0.17], [0.08, 0.02, 0.08], QUARTER)]))
    if (gear === 'tool-holsters') parts.push(...on('legL', [box('paper', [-0.1, -0.2, 0], [0.08, 0.18, 0.1], undefined, '#111'), box('ledCyan', [-0.145, -0.17, 0], [0.01, 0.03, 0.03], undefined, glow)]), ...on('legR', [box('paper', [0.1, -0.2, 0], [0.08, 0.18, 0.1], undefined, '#111')]))
    if (gear === 'heavy-boots') parts.push(...(['legL', 'legR'] as const).flatMap((leg) => on(leg, [box('paper', [0, -0.57, 0.04], [0.22, 0.18, 0.3], undefined, '#121212')])))
  }
  return parts
}
function handParts(item: AgentGearConfig['handItem'], arm: 'armL' | 'armR', config: AgentGearConfig): BonePart[] {
  const { baseDark: dark, accentGlow: glow } = config.palette
  switch (item) {
    case 'gauntlets': return (['armL', 'armR'] as const).flatMap((side) => on(side, [box('carbon', [0, -0.4, 0], [0.15, 0.24, 0.17], undefined, dark), box('ledCyan', [0, -0.33, 0], [0.16, 0.03, 0.18], undefined, glow)]))
    case 'holo-checklist': return on(arm, [box('ledCyan', [0, -0.58, 0.2], [0.3, 0.22, 0.01], [-0.5, 0, 0], glow)])
    case 'data-slab': return on(arm, [box('paper', [0, -0.6, 0.12], [0.22, 0.3, 0.03], undefined, '#111'), box('ledCyan', [0, -0.6, 0.137], [0.18, 0.25, 0.005], undefined, glow)])
    case 'field-tablet': return on(arm, [box('paper', [0, -0.58, 0.12], [0.2, 0.28, 0.025], undefined, '#111'), box('ledCyan', [0, -0.58, 0.135], [0.16, 0.22, 0.005], undefined, glow)])
    case 'cane': return on(arm, [cyl('silver', [0, -0.98, 0.08], [0.025, 0.9, 0.025]), shape('sphere', 'silver', [0, -0.54, 0.08], [0.06, 0.06, 0.06])])
    default: return []
  }
}
/** The gear alone (helmet, armour, packs, belts, hand items), without the body under it. */
function gearParts(config: AgentGearConfig): BonePart[] {
  const human = config.body === 'human'
  return [
    ...on('head', headParts(config)),
    ...on('body', [...torsoParts(config), ...backParts(config)]),
    ...legParts(config),
    ...(human ? [...handParts(config.handItem, 'armR', config), ...handParts(config.offHandItem, 'armL', config)] : []),
  ]
}
/** Every part of a character: its body (human or automaton) and its gear. */
export function characterParts(config: AgentGearConfig): BonePart[] {
  return [...(config.body === 'automaton' ? automatonBody(config) : humanBody(config)), ...gearParts(config)]
}
/** A suit as it stands in a vault pod: the gear only, at rest, in body coordinates (feet at 0). */
export function suitParts(config: AgentGearConfig): Part[] {
  return gearParts(config).map((part) => {
    const pivot = PIVOTS[part.bone]
    const { bone, ...rest } = part
    void bone
    return { ...rest, p: [part.p[0] + pivot[0], part.p[1] + pivot[1], part.p[2] + pivot[2]] }
  })
}
