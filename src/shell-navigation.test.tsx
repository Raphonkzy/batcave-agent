// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
vi.mock('./pages/Office.tsx',()=>({Office:()=> <div>Scene</div>}))
vi.mock('./polling.ts',async()=>{const r=await import('react');return {RefreshContext:r.createContext(0),usePolling:()=>({status:'pending'})}})
vi.mock('./access.ts',()=>({LOCKED_EVENT:'locked',loadAccess:async()=>({enabled:false,unlocked:true})}))
import { App } from './App.tsx'
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
describe('shell navigation',()=>{
 it('starts closed despite legacy preferences, toggles repeatedly, and closes on Escape',async()=>{
  localStorage.setItem('batcave.sideNavPinned','true');localStorage.setItem('batcave.sideNav','open')
  const host=document.body.appendChild(document.createElement('div')),root=createRoot(host)
  await act(async()=>root.render(<App/>))
  const burger=host.querySelector<HTMLButtonElement>('[aria-label="Toggle navigation menu"]')!
  expect(burger.getAttribute('aria-expanded')).toBe('false')
  expect(host.querySelector('#main-navigation')).toBeNull()
  for(let i=0;i<3;i++) {
   await act(async()=>burger.click());expect(host.querySelector('#main-navigation')).not.toBeNull()
   await act(async()=>burger.click());expect(host.querySelector('#main-navigation')).toBeNull()
  }
  await act(async()=>burger.click())
  await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})))
  expect(host.querySelector('#main-navigation')).toBeNull()
  await act(async()=>root.unmount());host.remove();localStorage.clear()
 })
})
