import { expect, it } from 'vitest'
import { jetGeometries } from './jetGeometry.ts'
it('rests the rendered parked jet on its turntable without floating or sinking',()=>{
 const parts=jetGeometries()
 try {
  let bottom=Infinity
  for(const geometry of Object.values(parts)) {
   geometry.computeBoundingBox()
   bottom=Math.min(bottom,geometry.boundingBox!.min.y)
   expect([...geometry.attributes.position.array].every(Number.isFinite)).toBe(true)
  }
  expect(bottom+0.95).toBeCloseTo(0,6)
  // Contact comes from the actual struts/feet, not a collision proxy.
  expect(parts.gunmetal.boundingBox!.min.y).toBeCloseTo(-0.95,6)
 }finally{Object.values(parts).forEach(g=>g.dispose())}
})
