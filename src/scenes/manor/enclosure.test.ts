import {describe,expect,it} from 'vitest'
import {computeLayout} from '../../utils/layout/computeLayout.ts'
import {enclosureBands,validateEnclosure,fullManorShell} from './enclosure.ts'
describe('room-volume enclosure',()=>{
 it.each([1,6,12,24,40,48])('closes exposed high room boundaries without replacing atrium floors N=%i',n=>{
  const l=computeLayout(n),bands=enclosureBands(l),f=l.zones.grandFoyer
  expect(validateEnclosure(l)).toEqual([])
  expect(bands.some(b=>b.axis==='x'&&b.at===f.maxZ&&b.from<=0&&b.to>=0&&b.bottom<=17&&b.top>=18.5)).toBe(true)
  expect(bands.some(b=>b.axis==='z'&&b.at===f.maxX&&b.from<=0&&b.to>=0&&b.bottom<=18&&b.top>=18.5)).toBe(true)
  expect(bands.every(b=>b.axis==='x'?b.d===.3:b.w===.3)).toBe(true)
  // The repair is vertical masonry only, not a slab closing the double-height foyer.
  expect(l.zoneList.find(z=>z.id==='grandFoyer')?.height).toBe(7.5)
 })
 it('uses the complete envelope in Full Walls on either surface floor only',()=>{
  expect(fullManorShell('ground','wallsUp')).toBe(true);expect(fullManorShell('upper','wallsUp')).toBe(true)
  expect(fullManorShell('deck','wallsUp')).toBe(false);expect(fullManorShell('upper','cutaway')).toBe(false)
 })
})
