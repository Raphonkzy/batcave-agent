import { describe, expect, it } from 'vitest'
import { computeLayout } from '../../utils/layout/computeLayout.ts'
import { canCommandMove } from '../../utils/layout/navigation.ts'
import { placementError, withEdits, titleOf, VEHICLES } from './simulation.ts'
import { partsFor } from './batches.ts'
import type { LayoutItem } from '../../utils/layout/types.ts'
const layout=computeLayout(12)
const item: LayoutItem={id:'test',type:'sideTable',zone:'grandFoyer',level:'surface',x:0,y:11,z:0,w:0.5,d:0.5,h:0.6,rotY:0}
describe('simulation placement safety',()=>{
 it('rejects nonfinite, floating and out-of-room placements',()=>{
  expect(placementError(layout,{...item,x:NaN})).toBe('Invalid coordinates')
  expect(placementError(layout,{...item,y:12})).toBe('Keep objects on their floor')
  expect(placementError(layout,{...item,x:1000})).toBe('Stay inside the original room')
 })
 it('rejects overlapping equipment',()=>{
  const target=layout.items.find(i=>i.type==='banquetTable')!
  expect(placementError(layout,{...item,zone:target.zone,x:target.x,z:target.z})).toBe('Overlaps another object')
 })
 it('keeps source geometry immutable while rebuilding navigation',()=>{
  const original=layout.items.find(i=>i.type==='sideTable')!
  const next=withEdits(layout,{[original.id]:{...original,x:original.x+0.5}})
  expect(next.items.find(i=>i.id===original.id)?.x).toBe(original.x+0.5)
  expect(next.paths.grids).not.toBe(layout.paths.grids)
  expect(layout.items.find(i=>i.id===original.id)?.x).toBe(original.x)
 })
 it('rejects disconnected, blocked, and cross-floor movement commands',()=>{
  const grid={level:'surface' as const,y:11,minX:0,minZ:0,cols:3,rows:1,blocked:[false,true,false]}
  const fake={...layout,paths:{...layout.paths,resolution:1,grids:[grid]}}
  expect(canCommandMove(fake,[0.5,11,0.5],[2.5,11,0.5])).toBe(false)
  expect(canCommandMove(fake,[0.5,11,0.5],[1.5,11,0.5])).toBe(false)
  expect(canCommandMove(fake,[0.5,11,0.5],[0.5,0,0.5])).toBe(false)
  expect(canCommandMove(fake,[0.5,11,0.5],[0.5,11,0.5])).toBe(true)
 })
})
describe('original tactical fleet',()=>{
 it('has distinct names and finite positive model dimensions',()=>{
  const vehicles=layout.items.filter(i=>VEHICLES.has(i.type))
  expect(new Set(vehicles.map(titleOf)).size).toBe(6)
  for(const i of vehicles) for(const p of partsFor(i)) {
   expect([...p.p,...p.s].every(Number.isFinite)).toBe(true)
   expect(p.s.every(n=>n>0)).toBe(true)
  }
 })
 it('interceptor and cycle tires contact their parking surface',()=>{
  for(const type of ['armoredInterceptor','pursuitBike']) {
   const i=layout.items.find(i=>i.type===type)!
   const tires=partsFor(i).filter(p=>p.m==='rubber'&&p.g==='cyl')
   expect(tires.length).toBe(type==='pursuitBike'?2:4)
   for(const tire of tires) expect(tire.p[1]-tire.s[0]/2).toBeCloseTo(0)
  }
 })
})
