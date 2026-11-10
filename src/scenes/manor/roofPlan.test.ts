import { describe, expect, it } from 'vitest'
import { computeLayout } from '../../utils/layout/computeLayout.ts'
import { LEVEL_Y } from '../../utils/layout/types.ts'
import { roofPlan } from './roofPlan.ts'
describe('architectural roof coverage',()=>{
 it.each([1,6,12,24,40,48])('N=%i: covers every indoor footprint at or above its wall top',n=>{
  const l=computeLayout(n),sections=roofPlan(l)
  for(const z of l.zoneList.filter(z=>z.level!=='subterranean'&&z.kind!=='outdoor')) {
   for(const tx of [0.01,0.5,0.99])for(const tz of [0.01,0.5,0.99]){
    const x=z.rect.minX+(z.rect.maxX-z.rect.minX)*tx,zz=z.rect.minZ+(z.rect.maxZ-z.rect.minZ)*tz
    expect(sections.some(s=>x>=s.minX&&x<=s.maxX&&zz>=s.minZ&&zz<=s.maxZ&&s.y>=LEVEL_Y[z.level]+z.height-1e-6)).toBe(true)
   }
  }
  expect(sections.every(s=>s.maxX>s.minX&&s.maxZ>s.minZ)).toBe(true)
 })
})
