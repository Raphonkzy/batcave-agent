import { describe, expect, it } from 'vitest'
import { computeLayout } from '../../utils/layout/computeLayout.ts'
import { wallBoxes, wallHeight } from './wallGeometry.ts'
import type { WallSegment } from '../../utils/layout/types.ts'
const wall: WallSegment = {level:'surface',axis:'x',at:0,from:0,to:8,exterior:true,side:'south',height:3.5}
describe('intentional shell geometry', () => {
 it('joins offset exterior corners without extending into window apertures', () => {
   const boxes = wallBoxes([wall],'wallsUp').stone
   expect(boxes[0].x-boxes[0].w/2).toBeCloseTo(-0.15)
   expect(Math.max(...boxes.map(b=>b.x+b.w/2))).toBeCloseTo(8.15)
   expect(boxes.every(b=>b.h>0 && b.w>0 && b.d===0.3)).toBe(true)
 })
 it('lowers only camera-facing exterior sides, keeping rear walls full', () => {
   expect(wallHeight(wall,'cutaway',{x:'east',z:'south'})).toBe(1)
   expect(wallHeight(wall,'cutaway',{x:'west',z:'north'})).toBe(3.5)
   expect(wallHeight({...wall,exterior:false},'wallsUp',{x:'west',z:'north'})).toBe(3.5)
   expect(wallBoxes([wall],'wallsDown').stone.every(b=>b.h<=0.3)).toBe(true)
 })
 it.each([1,2,6,12,24,40,48])('N=%i: outdoor-facing room boundaries are full exterior shell', count => {
   const l=computeLayout(count)
   const z=l.zones.entranceHall.maxZ
   const front=l.walls.filter(w=>w.level==='surface'&&w.axis==='x'&&Math.abs(w.at-z)<1e-6)
   expect(front.length).toBeGreaterThan(0)
   expect(front.every(w=>w.exterior&&w.side==='south')).toBe(true)
   expect(wallBoxes(front,'wallsUp').stone.every(b=>b.y-b.h/2>=11-1e-6)).toBe(true)
 })
})
