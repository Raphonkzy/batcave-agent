// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { ThreeEvent } from '@react-three/fiber'
const mock=vi.hoisted(()=>({frame:null as null|((s:unknown,d:number)=>void)}))
vi.mock('@react-three/fiber',()=>({useFrame:(cb:typeof mock.frame)=>{mock.frame=cb}}))
vi.mock('./Instanced.tsx',()=>({Batches:()=>null}))
import { EstateGate } from './EstateGate.tsx'
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})

describe('gate scene controller',()=>{
  it('settles once per transition including reduced-motion reversals',async()=>{
    const host=document.createElement('div'),root=createRoot(host),settled=vi.fn(),select=vi.fn()
    const render=async(open:boolean,reducedMotion:boolean)=>act(async()=>root.render(<EstateGate position={[0,11,30]} open={open} selected={false} interactive reducedMotion={reducedMotion} shadows={false} onSelect={select} onSettled={settled}/>))
    // DOM hosting is used only to exercise hooks; no WebGL renderer is needed.
    const warn=vi.spyOn(console,'error').mockImplementation(()=>{})
    try {
      await render(true,false)
      for (const node of host.querySelectorAll('group')) Object.assign(node, {rotation:{y:0}})
      await act(async()=>{mock.frame?.({},1/60);mock.frame?.({},1/60)})
      expect(settled.mock.calls).toEqual([[true]])
      await render(false,true)
      await act(async()=>{mock.frame?.({},1/60);mock.frame?.({},1/60)})
      expect(settled.mock.calls).toEqual([[true],[false]])
      await render(true,true)
      await act(async()=>{mock.frame?.({},1/60)})
      expect(settled.mock.calls).toEqual([[true],[false],[true]])
      const propsKey=Object.keys(host.firstChild!).find(k=>k.startsWith('__reactProps$'))!
      const props=(host.firstChild as unknown as Record<string,{onClick:(e:ThreeEvent<MouseEvent>)=>void}>)[propsKey]
      const stopPropagation=vi.fn()
      props.onClick({button:2,delta:0,stopPropagation} as unknown as ThreeEvent<MouseEvent>)
      props.onClick({button:0,delta:8,stopPropagation} as unknown as ThreeEvent<MouseEvent>)
      expect(select).not.toHaveBeenCalled()
      props.onClick({button:0,delta:0,stopPropagation} as unknown as ThreeEvent<MouseEvent>)
      expect(select).toHaveBeenCalledOnce();expect(stopPropagation).toHaveBeenCalledOnce()
    } finally {await act(async()=>root.unmount());warn.mockRestore()}
  })
})
