// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { SideNav } from './SideNav.tsx'
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
it('keeps the focused navigation link across parent callback rerenders',async()=>{
 const host=document.body.appendChild(document.createElement('div')),root=createRoot(host)
 const render=()=>root.render(<SideNav currentPage="Batcave" mode="open" pinned={false} drawerOpen onNavigate={()=>{}} onToggleMode={()=>{}} onCloseDrawer={()=>{}}/>)
 try{
  await act(async()=>render())
  const link=host.querySelector<HTMLAnchorElement>('a[href="#/usage"]')!;link.focus()
  await act(async()=>render())
  expect(document.activeElement).toBe(link)
 }finally{await act(async()=>root.unmount());host.remove()}
})
