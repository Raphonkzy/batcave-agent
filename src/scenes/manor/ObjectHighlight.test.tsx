// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
const mock=vi.hoisted(()=>({scene:null as unknown}))
vi.mock('@react-three/fiber',()=>({useThree:()=>({scene:mock.scene})}))
import { ObjectHighlight } from './ObjectHighlight.tsx'
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
describe('object surface highlighting',()=>{
 it('isolates instances, preserves shared materials, and restores on deselection',async()=>{
  const scene=new THREE.Scene(),material=new THREE.MeshStandardMaterial({color:'#444444'}),geometry=new THREE.BoxGeometry()
  const mesh=new THREE.InstancedMesh(geometry,material,2),base=new THREE.Color('#263942')
  mesh.userData={itemIds:['chair-a','chair-b'],baseColors:[base.clone(),base.clone()]};mesh.setColorAt(0,base);mesh.setColorAt(1,base);scene.add(mesh);mock.scene=scene
  const root=createRoot(document.createElement('div')),color=new THREE.Color(),original=material.color.clone()
  await act(async()=>root.render(<ObjectHighlight id="chair-a" selected/>))
  mesh.getColorAt(0,color);expect(color.equals(base)).toBe(false)
  mesh.getColorAt(1,color);expect(color.r).toBeCloseTo(base.r)
  expect(material.color.equals(original)).toBe(true)
  await act(async()=>root.render(<ObjectHighlight selected={false}/>))
  mesh.getColorAt(0,color);expect(color.r).toBeCloseTo(base.r);expect(color.g).toBeCloseTo(base.g)
  await act(async()=>root.unmount());geometry.dispose();material.dispose()
 })
})
