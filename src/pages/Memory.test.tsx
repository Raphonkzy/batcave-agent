// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Memory } from './Memory.tsx'
const mock = vi.hoisted(() => ({ state: {} as unknown }))
vi.mock('../polling.ts', () => ({usePolling: () => mock.state}))
vi.mock('../ProfileLock.tsx', () => ({PrivateGate: ({children}: {children: import('react').ReactNode}) => children, ProfileUnlock: () => <p>PIN required</p>}))
Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true})
afterEach(() => document.body.replaceChildren())
describe('actual memory documents', () => {
  it('renders real contents, supports document selection, and reports read-only behavior', async () => {
    mock.state = {status:'ready',data:{agents:[{profile:'default',label:'Default',kind:'hermes',available:true,contextFiles:[{name:'AGENTS.md',path:'AGENTS.md',exists:true,content:'actual context'}],soul:{name:'SOUL.md',path:'SOUL.md',exists:true,content:'actual soul'},memory:{name:'MEMORY.md',path:'memories/MEMORY.md',exists:true,content:'actual memory'}}]}}
    const host = document.body.appendChild(document.createElement('div')), root = createRoot(host)
    await act(async () => root.render(<Memory/>))
    expect(host.querySelector('pre')?.textContent).toBe('actual soul')
    const memory = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('MEMORY.md'))!
    await act(async () => memory.click())
    expect(host.querySelector('pre')?.textContent).toBe('actual memory')
    const context = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('AGENTS.md'))!
    await act(async () => context.click())
    expect(host.querySelector('pre')?.textContent).toBe('actual context')
    expect(host.textContent).toContain('does not support editing or saving')
    expect(host.querySelector('textarea')).toBeNull()
    await act(async () => root.unmount())
  })
  it('does not disguise request failures as empty files', async () => {
    mock.state = {status:'failed',message:'Permission denied'}
    const root = createRoot(document.body.appendChild(document.createElement('div')))
    await act(async () => root.render(<Memory/>))
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('Permission denied')
    await act(async () => root.unmount())
  })
})
