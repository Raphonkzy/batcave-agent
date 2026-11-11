// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../hooks/useAgents.ts', () => ({ useAgents: () => ({ status: 'pending' }) }))
vi.mock('../polling.ts', () => ({ usePolling: () => ({ status: 'pending' }) }))
import { Office } from './Office.tsx'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
afterEach(() => { history.replaceState(null, '', '/'); localStorage.clear(); document.body.replaceChildren() })
describe('developer inspection isolation', () => {
  it('hides gameplay overlays and persisted panels only in the showcase', async () => {
    history.replaceState(null, '', '/?characterShowcase')
    localStorage.setItem('mc.officePanel', 'Crew')
    const host = document.body.appendChild(document.createElement('div')), root = createRoot(host)
    await act(async () => root.render(<Office/>))
    expect(host.querySelector('.mo-stage-overlay')).toBeNull()
    expect(host.querySelector('#office-panel')).toBeNull()
    await act(async () => root.unmount())
    const normal = createRoot(host)
    history.replaceState(null, '', '/')
    await act(async () => normal.render(<Office/>))
    expect(host.querySelector('.mo-stage-overlay')).not.toBeNull()
    expect(host.querySelector('#office-panel')).not.toBeNull()
    await act(async () => normal.unmount())
  })
})
