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
 it('keeps the camera out of walls, retargets floors without rotating, and restores saved views',async()=>{
  const camera=new THREE.PerspectiveCamera()
  mock.state={camera,gl:{domElement:document.createElement('canvas')},size:{width:1920,height:1080}}
  const host=document.createElement('div'),root=createRoot(host),ref=createRef<ManorCameraHandle>()
  const l=computeLayout(6),wall={minX:-50,maxX:50,minY:0,maxY:30,minZ:-0.15,maxZ:0.15}
  await act(async()=>{root.render(<ManorCamera ref={ref} preset={l.camera.grandManor} panMode={false} keyTarget={null} smooth={false} obstacles={[wall]}/>)})
  const tick=(n=5)=>{for(let i=0;i<n;i++)mock.frame?.({},1/60)}
  const orbit=mock.orbit as {target:THREE.Vector3;listeners:Map<string,()=>void>}
  tick()
  // Camera arrives from the south side and drives into the wall: it is held outside, not teleported across.
  camera.position.set(0,5,4);orbit.target.set(0,5,10);tick()
  camera.position.set(0,5,0.05);tick()
  expect(camera.position.z).toBeGreaterThan(0.15+0.4)
  expect(camera.position.x).toBe(0);expect(camera.position.y).toBe(5)
  // Floor switch keeps direction and distance; flight finishes and does not restart.
  camera.position.set(10,25,30);orbit.target.set(0,10,0)
  const before=camera.position.clone().sub(orbit.target)
  ref.current!.retarget(l.camera.commandDeck);tick(400)
  const after=camera.position.clone().sub(orbit.target)
  expect(after.distanceTo(before)).toBeLessThan(0.05)
  const settled=camera.position.clone();tick(30)
  expect(camera.position.distanceTo(settled)).toBeLessThan(1e-6)
  // Saved view round trip; user input cancels the flight.
  expect(ref.current!.restoreView()).toBe(false)
  ref.current!.saveView();const saved=camera.position.clone()
  camera.position.add(new THREE.Vector3(5,0,0));ref.current!.restoreView();tick(400)
  expect(camera.position.distanceTo(saved)).toBeLessThan(0.05)
  ref.current!.reset();orbit.listeners.get('start')!();const held=camera.position.clone();tick(30)
  expect(camera.position.distanceTo(held)).toBeLessThan(1e-6)
  await act(async()=>root.unmount())
 })
})
