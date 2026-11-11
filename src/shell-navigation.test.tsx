// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('./pages/Office.tsx',()=>({Office:()=> <div>Scene</div>}))
vi.mock('./polling.ts',async()=>{const r=await import('react');return {RefreshContext:r.createContext(0),usePolling:()=>({status:'pending'})}})
vi.mock('./access.ts',()=>({LOCKED_EVENT:'locked',loadAccess:async()=>({enabled:false,unlocked:true})}))
import { App } from './App.tsx'
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})

async function mount() {
  const host = document.body.appendChild(document.createElement('div'))
  const root = createRoot(host)
  await act(async () => root.render(<App/>))
  return { host, root }
}
const press = (key: string, init: KeyboardEventInit = {}) => act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })) })
const modeLink = (host: HTMLElement, label: string) => [...host.querySelectorAll<HTMLAnchorElement>('#main-navigation a')].find((link) => link.textContent === label)!

afterEach(() => { history.replaceState(null, '', '/'); document.body.replaceChildren() })

describe('lot navigation', () => {
  it('starts on the live lot with no window, and offers the three modes plus the options menu', async () => {
    const { host, root } = await mount()
    expect(host.querySelector('.lot-app')?.getAttribute('data-mode')).toBe('live')
    expect(host.querySelector('.lot-window')).toBeNull()
    expect([...host.querySelectorAll('#main-navigation a')].map((link) => link.textContent)).toEqual(['Live', 'Work', 'Crew'])
    expect(modeLink(host, 'Live').getAttribute('aria-current')).toBe('page')
    expect(host.querySelector('[aria-label="Options menu"]')).not.toBeNull()
    await act(async () => root.unmount())
  })

  it('opens a mode as a window with its pages as tabs, and remembers the last page per mode', async () => {
    const { host, root } = await mount()
    await act(async () => modeLink(host, 'Work').click())
    expect(location.hash).toBe('#/missions')
    expect(host.querySelector('.lot-app')?.getAttribute('data-mode')).toBe('work')
    const tabs = [...host.querySelectorAll<HTMLAnchorElement>('.lot-window-tab')]
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Missions', 'Task Board', 'Calendar', 'Activity'])
    await act(async () => tabs[2].click())
    expect(location.hash).toBe('#/calendar')
    expect(host.querySelector('.lot-window-tab[aria-current="page"]')?.textContent).toBe('Calendar')
    await act(async () => modeLink(host, 'Crew').click())
    expect(location.hash).toBe('#/agents')
    await act(async () => modeLink(host, 'Work').click())
    expect(location.hash).toBe('#/calendar')
    await act(async () => root.unmount())
  })

  it('closes the window with Escape or the close button, but not while typing', async () => {
    const { host, root } = await mount()
    await act(async () => modeLink(host, 'Crew').click())
    const field = document.body.appendChild(document.createElement('input'))
    field.focus()
    await act(async () => { field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })) })
    expect(host.querySelector('.lot-window')).not.toBeNull()
    field.remove()
    await press('Escape')
    expect(host.querySelector('.lot-window')).toBeNull()
    expect(location.hash).toBe('#/batcave')
    await act(async () => modeLink(host, 'Crew').click())
    await act(async () => host.querySelector<HTMLButtonElement>('.lot-window-close')!.click())
    expect(host.querySelector('.lot-window')).toBeNull()
    await act(async () => root.unmount())
  })

  it('opens Logs and Settings from the options menu, which Escape closes without leaving the page', async () => {
    const { host, root } = await mount()
    const toggle = host.querySelector<HTMLButtonElement>('[aria-label="Options menu"]')!
    for (let i = 0; i < 3; i++) {
      await act(async () => toggle.click()); expect(toggle.getAttribute('aria-expanded')).toBe('true')
      await act(async () => toggle.click()); expect(toggle.getAttribute('aria-expanded')).toBe('false')
    }
    await act(async () => toggle.click())
    const settings = [...host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((item) => item.textContent === 'Settings')!
    await act(async () => settings.click())
    expect(location.hash).toBe('#/settings')
    expect(host.querySelector('.lot-app')?.getAttribute('data-mode')).toBe('system')
    expect(host.querySelector('#lot-options-menu')).toBeNull()
    await act(async () => toggle.click())
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })) })
    expect(host.querySelector('#lot-options-menu')).toBeNull()
    expect(host.querySelector('.lot-window')).not.toBeNull()
    await act(async () => root.unmount())
  })

  it('opens search with Ctrl+K from anywhere', async () => {
    const { host, root } = await mount()
    await press('k', { ctrlKey: true })
    expect(host.querySelector('[role="dialog"][aria-label="Search"]')).not.toBeNull()
    await act(async () => root.unmount())
  })
})
