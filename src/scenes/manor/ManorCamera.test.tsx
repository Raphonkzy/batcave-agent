// @vitest-environment jsdom
import { act, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
const mock=vi.hoisted(()=>({frame:null as null|((s:unknown,d:number)=>void),state:null as unknown,orbit:null as unknown}))
vi.mock('@react-three/fiber',()=>({useThree:()=>mock.state,useFrame:(cb:typeof mock.frame)=>{mock.frame=cb}}))
vi.mock('three/examples/jsm/controls/OrbitControls.js',()=>({OrbitControls:class {
 target=new THREE.Vector3();mouseButtons={};touches={};listeners=new Map<string,()=>void>();minDistance=0;maxDistance=100;enabled=true
 constructor(){mock.orbit=this}
 addEventListener(n:string,cb:()=>void){this.listeners.set(n,cb)}
 removeEventListener(n:string){this.listeners.delete(n)}
 update(){} dispose(){} listenToKeyEvents(){} stopListenToKeyEvents(){}
}}))
import { ManorCamera, type ManorCameraHandle } from './ManorCamera.tsx'
import { computeLayout } from '../../utils/layout/computeLayout.ts'
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
describe('camera ownership',()=>{
 it('releases completed flights, cancels follow on input, and does not reframe on resize',async()=>{
  const camera=new THREE.PerspectiveCamera()
  const state={camera,gl:{domElement:document.createElement('canvas')},size:{width:1200,height:900}}
  mock.state=state
  const host=document.createElement('div'),root=createRoot(host),ref=createRef<ManorCameraHandle>()
  const l=computeLayout(6)
  const render=async(preset=l.camera.grandManor)=>{await act(async()=>{root.render(<ManorCamera ref={ref} preset={preset} panMode={false} keyTarget={null} smooth/>)})}
  const tick=()=>{for(let i=0;i<300;i++)mock.frame?.({},1/60)}
  await render();tick();await render(l.camera.commandDeck);tick()
  const orbit=mock.orbit as {target:THREE.Vector3;listeners:Map<string,()=>void>;mouseButtons:{LEFT:number|null;MIDDLE:number;RIGHT:number};screenSpacePanning:boolean}
  expect(orbit.mouseButtons).toEqual({LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.PAN})
  expect(orbit.screenSpacePanning).toBe(true)
  camera.position.add(new THREE.Vector3(8,0,0));orbit.target.x+=8
  const manual=camera.position.clone(), target=orbit.target.clone(), orientation=camera.quaternion.clone(), zoom=camera.zoom
  for (const next of [l.camera.grandManor, l.camera.manorLobby, l.camera.commandDeck]) {
    await render(next);tick()
    expect(camera.position.distanceTo(manual)).toBeLessThan(.001)
    expect(orbit.target.distanceTo(target)).toBeLessThan(.001)
    expect(camera.quaternion.equals(orientation)).toBe(true)
    expect(camera.zoom).toBe(zoom)
  }
  tick();expect(camera.position.distanceTo(manual)).toBeLessThan(0.001)
  ref.current!.follow(new THREE.Vector3(0,0,0));mock.frame?.({},1/60)
  orbit.listeners.get('start')!();camera.position.copy(manual);tick()
  expect(camera.position.distanceTo(manual)).toBeLessThan(0.001)
  state.size={width:900,height:650};await render({...l.camera.commandDeck});tick()
  expect(camera.position.distanceTo(manual)).toBeLessThan(0.001)
  ref.current!.reset();mock.frame?.({},1/60);orbit.listeners.get('start')!()
  camera.position.copy(manual);tick();expect(camera.position.distanceTo(manual)).toBeLessThan(0.001)
  ref.current!.reset();tick();expect(camera.position.distanceTo(manual)).toBeGreaterThan(1)
  const reset=camera.position.clone();tick();expect(camera.position.distanceTo(reset)).toBeLessThan(.001)
  await act(async()=>root.unmount())
 })
})
