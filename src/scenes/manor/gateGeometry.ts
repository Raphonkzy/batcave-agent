import { box, shape, type Part } from './parts.ts'

// Inner faces of the 0.7 m posts centered at ±3.8 m.
export const GATE_HINGE_X = 3.4
export const GATE_LEAF_WIDTH = 3.36
export const GATE_OPEN_ANGLE = Math.PI / 2

/** A leaf in hinge-local coordinates, extending toward +X when closed. */
export function gateLeafParts(highlighted = false): Part[] {
  const parts: Part[] = []
  for (const y of [.35, 1.6]) parts.push(box('blackSteel', [GATE_LEAF_WIDTH / 2, y, 0], [GATE_LEAF_WIDTH, .075, .09]))
  for (let index = 0; index <= 15; index++) {
    const x = .08 + index * (GATE_LEAF_WIDTH - .16) / 15
    parts.push(box('blackSteel', [x, .98, 0], [.035, 1.25, .045]), shape('cone', 'brass', [x, 1.68, 0], [.09, .16, .09]))
  }
  parts.push(box('brass', [GATE_LEAF_WIDTH - .16, .9, .08], [.035, .24, .035]))
  return highlighted ? parts.map(part => ({ ...part, c: part.m === 'blackSteel' ? '#49463c' : '#d1ba82' })) : parts
}

/** Frame-rate independent, reversible opening; reduced motion resolves immediately. */
export function advanceGate(current: number, open: boolean, delta: number, reducedMotion: boolean): number {
  const target = open ? GATE_OPEN_ANGLE : 0
  if (reducedMotion) return target
  const next = current + (target - current) * (1 - Math.exp(-5 * Math.max(0, Math.min(delta, .25))))
  return Math.abs(next - target) < .001 ? target : next
}
