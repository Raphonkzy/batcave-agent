import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { advanceGate, gateLeafParts, GATE_HINGE_X, GATE_LEAF_WIDTH, GATE_OPEN_ANGLE } from './gateGeometry.ts'

describe('estate gate', () => {
  it('closes symmetrically within the posts without intersecting the opposite leaf', () => {
    const leftTip = -GATE_HINGE_X + GATE_LEAF_WIDTH
    const rightTip = GATE_HINGE_X - GATE_LEAF_WIDTH
    expect(leftTip).toBeLessThan(rightTip)
    expect(rightTip - leftTip).toBeCloseTo(.08)
    const left = new THREE.Vector3(GATE_LEAF_WIDTH, 0, 0).applyAxisAngle(new THREE.Vector3(0,1,0), GATE_OPEN_ANGLE)
    expect(left.x).toBeCloseTo(0)
    expect(left.z).toBeCloseTo(-GATE_LEAF_WIDTH)
  })
  it('opens and closes smoothly, is time-based, and supports reversal', () => {
    const run = (hz: number) => { let a = 0; for(let i=0;i<hz;i++) a=advanceGate(a,true,1/hz,false); return a }
    expect(run(30)).toBeCloseTo(run(120), 6)
    const first=advanceGate(0,true,1/60,false)
    expect(first).toBeGreaterThan(0); expect(first).toBeLessThan(GATE_OPEN_ANGLE)
    expect(advanceGate(first,false,1/60,false)).toBeLessThan(first)
    let angle=0;for(let i=0;i<180;i++)angle=advanceGate(angle,true,1/60,false)
    expect(angle).toBe(GATE_OPEN_ANGLE)
    for(let i=0;i<180;i++)angle=advanceGate(angle,false,1/60,false)
    expect(angle).toBe(0)
  })
  it('resolves reduced motion and never overshoots on stalled or negative frames', () => {
    expect(advanceGate(0,true,.01,true)).toBe(GATE_OPEN_ANGLE)
    expect(advanceGate(1,false,.01,true)).toBe(0)
    expect(advanceGate(0,true,-1,false)).toBe(0)
    expect(advanceGate(0,true,100,false)).toBeLessThan(GATE_OPEN_ANGLE)
  })
  it('keeps hover tint local and retains identical physical geometry', () => {
    const original=gateLeafParts(), highlighted=gateLeafParts(true)
    expect(original.every(p=>p.c===undefined)).toBe(true)
    expect(highlighted.every(p=>p.c!==undefined)).toBe(true)
    expect(highlighted.map(({c,...part})=>{void c;return part})).toEqual(original)
    expect(original.every(p=>p.s.every(v=>v>0))).toBe(true)
  })
})
