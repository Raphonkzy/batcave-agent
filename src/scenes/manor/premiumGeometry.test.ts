import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { computeLayout } from '../../utils/layout/computeLayout.ts'
import { manorWallPieces, manorWindows } from './manorArchitecture.ts'
import { estateBoundary } from './estateBoundary.ts'
import { estateConfig } from './worldConfig.ts'
import { elevatorShaftParts } from './elevatorGeometry.ts'
import { buildBatches } from './batches.ts'
import { highlightColor } from './highlightColor.ts'
import { characterParts, PIVOTS } from '../../components/agent/rig.ts'
import { agentGear, VAULT_PROFILES } from '../../components/agent/agentLooks.ts'

describe('premium geometry invariants',()=>{
  it.each([1,6,12,40])('shares window apertures on both manor floors for %i crew',n=>{
    const layout=computeLayout(n)
    for(const wall of layout.walls.filter(w=>w.exterior&&w.level!=='subterranean')){
      const pieces=manorWallPieces(wall,wall.height)
      for(const center of manorWindows(wall)){
        expect(pieces.some(p=>p.from<center&&p.to>center&&p.bottom<1.4&&p.bottom+p.height>1.4)).toBe(false)
        expect(pieces.some(p=>p.from<=center&&p.to>=center&&p.bottom===0)).toBe(true)
      }
      expect(pieces.every(p=>p.height>0&&p.bottom+p.height<=wall.height+1e-6)).toBe(true)
    }
  })
  it('defines ironwork on every estate boundary and leaves the gate clear',()=>{
    const l=computeLayout(6),c=estateConfig(l),parts=estateBoundary(l)
    for(const x of [c.lot.minX,c.lot.maxX])expect(parts.some(p=>p.p[0]===x)).toBe(true)
    expect(parts.some(p=>p.p[2]===c.lot.minZ)).toBe(true)
    expect(parts.filter(p=>Math.abs(p.p[0])<3&&p.p[2]===c.gate.position[2])).toHaveLength(0)
  })
  it('builds continuous rectangular elevator rails between the existing floor endpoints',()=>{
    const l=computeLayout(6),{bottom,top}=l.elevator,parts=elevatorShaftParts(l,bottom,top+2.8)
    expect(parts.every(p=>p.g==='box')).toBe(true)
    const rails=parts.filter(p=>p.m==='blackSteel')
    expect(rails).toHaveLength(4)
    for(const p of rails){expect(p.p[1]-p.s[1]/2).toBeCloseTo(bottom);expect(p.p[1]+p.s[1]/2).toBeCloseTo(top+2.8)}
  })
  it('keeps object identities aligned to batched mesh instances',()=>{
    const batches=buildBatches(computeLayout(6).items)
    for(const b of batches)expect(b.itemIds).toHaveLength(b.matrices.length)
    const base=new THREE.Color('#374341'),original=base.clone()
    expect(highlightColor(base,true).equals(base)).toBe(false)
    expect(base.equals(original)).toBe(true)
  })
  it('preserves distinct identities with rounded layered character geometry and grounded feet',()=>{
    const signatures=new Set()
    for(const name of VAULT_PROFILES){
      const parts=characterParts(agentGear(name));signatures.add(JSON.stringify(parts))
      expect(parts.filter(p=>p.g==='roundedBox').length).toBeGreaterThan(15)
      expect(parts.every(p=>p.p.every(Number.isFinite)&&p.s.every(v=>v>0))).toBe(true)
      const feet=parts.filter(p=>p.bone==='legL'||p.bone==='legR').map(p=>p.p[1]+PIVOTS[p.bone][1]-p.s[1]/2)
      expect(Math.min(...feet)).toBeGreaterThanOrEqual(-.01)
    }
    expect(signatures.size).toBe(VAULT_PROFILES.length)
  })
})
