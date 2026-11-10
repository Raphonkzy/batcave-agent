// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RefreshContext, usePolling } from './polling.ts'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | undefined
let host: HTMLDivElement
const requests: { resolve: (value: Response) => void; signal?: AbortSignal | null; path: string }[] = []
function View({ path }: { path: string }) {
  const value = usePolling<string>(path, 0)
  return <button onClick={value.refresh}>{value.status === 'ready' ? value.data : value.status}:{String(value.refreshing)}</button>
}
async function render(path: string, tick = 0) {
  if (!root) {
    host = document.body.appendChild(document.createElement('div'))
    root = createRoot(host)
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => new Promise<Response>((resolve) => requests.push({ resolve, signal: init?.signal, path: url }))))
  }
  await act(async () => { root!.render(<StrictMode><RefreshContext.Provider value={tick}><View path={path}/></RefreshContext.Provider></StrictMode>) })
}
async function respond(index: number, data: string) {
  await act(async () => { requests[index].resolve(new Response(JSON.stringify(data))); await Promise.resolve() })
}
afterEach(async () => {
  await act(async () => { root?.unmount() })
  root = undefined
  requests.length = 0
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('polling request identity', () => {
  it('ignores old paths even when fetch ignores abort, including StrictMode replay', async () => {
    await render('/api/usage?days=7')
    await respond(requests.length - 1, 'seven')
    await render('/api/usage?days=30')
    expect(host.textContent).toBe('pending:true')
    const latest = requests.length - 1
    expect(requests[0].signal?.aborted).toBe(true)
    await respond(latest, 'thirty')
    await respond(0, 'old-seven')
    expect(host.textContent).toBe('thirty:false')
  })

  it('ignores overlapping refresh responses without clearing the newest loading state', async () => {
    await render('/api/usage?days=7')
    const older = requests.length - 1
    await act(async () => { host.querySelector('button')!.click() })
    const latest = requests.length - 1
    expect(requests[latest].path).toBe('/api/usage?days=7&fresh=1')
    expect(requests[older].signal?.aborted).toBe(true)
    await respond(older, 'older')
    expect(host.textContent).toBe('pending:true')
    await respond(latest, 'latest')
    expect(host.textContent).toBe('latest:false')
  })

  it('aborts on global refresh and unmount', async () => {
    await render('/api/tasks')
    const older = requests.length - 1
    await render('/api/tasks', 1)
    expect(requests[older].signal?.aborted).toBe(true)
    expect(requests.at(-1)?.path).toBe('/api/tasks?fresh=1')
    await act(async () => { root!.unmount() })
    root = undefined
    expect(requests.at(-1)?.signal?.aborted).toBe(true)
    await respond(older, 'late')
  })
})
