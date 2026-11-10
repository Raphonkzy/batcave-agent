// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { GateActions } from './GateActions.tsx'
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})

describe('estate gate actions',()=>{
  it('exposes real reversible actions and reports motion without trapping the camera',async()=>{
    const host=document.createElement('div'),root=createRoot(host),toggle=vi.fn(),close=vi.fn(),focus=vi.fn()
    const render=async(open:boolean,moving:boolean)=>act(async()=>root.render(<GateActions open={open} moving={moving} onToggle={toggle} onClose={close} onFocus={focus}/>))
    await render(true,false)
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Gate · Open')
    const button=host.querySelector('[aria-pressed]') as HTMLButtonElement
    expect(button.textContent).toBe('Close estate gate')
    await act(async()=>button.click());expect(toggle).toHaveBeenCalledOnce()
    await render(false,true)
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Gate · Closing')
    expect(host.querySelector('[aria-pressed]')?.getAttribute('aria-pressed')).toBe('false')
    expect(host.querySelector('[aria-pressed]')?.textContent).toBe('Open estate gate')
    await act(async()=>host.querySelector('section')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})))
    expect(close).toHaveBeenCalledOnce()
    await act(async()=>root.unmount())
  })
})
