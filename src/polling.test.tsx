// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { backoffDelay, getStoreStats } from './data-store.ts'
import { RefreshContext, usePolling } from './polling.ts'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | undefined
let host: HTMLDivElement
const requests: { resolve: (value: Response) => void; signal?: AbortSignal | null; path: string }[] = []
function View({ path, interval = 0, paused = false }: { path: string; interval?: number; paused?: boolean }) {
  const value = usePolling<string>(path, interval, { paused })
  return <button onClick={value.refresh}>{value.status === 'ready' ? `${value.data}${value.stale ? '(stale)' : ''}` : value.status}:{String(value.refreshing)}</button>
}
async function render(path: string, tick = 0, props: { interval?: number; paused?: boolean; strict?: boolean } = {}) {
  if (!root) {
    host = document.body.appendChild(document.createElement('div'))
    root = createRoot(host)
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => new Promise<Response>((resolve) => requests.push({ resolve, signal: init?.signal, path: url }))))
  }
  const tree = <RefreshContext.Provider value={tick}><View path={path} interval={props.interval} paused={props.paused}/></RefreshContext.Provider>
  await act(async () => { root!.render(props.strict === false ? tree : <StrictMode>{tree}</StrictMode>) })
}
async function respond(index: number, data: string, status = 200) {
  await act(async () => { requests[index].resolve(new Response(JSON.stringify(status === 200 ? data : { error: 'nope' }), { status })); await Promise.resolve() })
}
afterEach(async () => {
  await act(async () => { root?.unmount() })
  root = undefined
  requests.length = 0
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('polling request identity', () => {
  it('keeps each path\'s data separate and shows a path\'s cached data again without a request', async () => {
    await render('/api/usage?days=7')
    expect(requests).toHaveLength(1) // StrictMode replays the effect; the second start joins the first request
    await respond(0, 'seven')
    await render('/api/usage?days=30')
    expect(host.textContent).toBe('pending:true')
    await respond(1, 'thirty')
    expect(host.textContent).toBe('thirty:false')
    await render('/api/usage?days=7')
    expect(host.textContent).toBe('seven:false')
    expect(requests).toHaveLength(2)
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

  it('aborts the older request on a global refresh, and keeps a running request alive across unmount', async () => {
    await render('/api/tasks')
    const older = requests.length - 1
    await render('/api/tasks', 1)
    expect(requests[older].signal?.aborted).toBe(true)
    expect(requests.at(-1)?.path).toBe('/api/tasks?fresh=1')
    const running = requests.length - 1
    await act(async () => { root!.unmount() })
    root = undefined
    // Leaving the page must not cancel the read: its answer is kept for the next visit.
    expect(requests[running].signal?.aborted).toBe(false)
    await respond(running, 'kept')
    await render('/api/tasks', 1, { strict: false })
    expect(host.textContent).toBe('kept:false')
    expect(requests).toHaveLength(running + 1)
  })
})

describe('shared data across components and navigation', () => {
  it('serves two readers of one path from one request', async () => {
    host = document.body.appendChild(document.createElement('div'))
    root = createRoot(host)
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => new Promise<Response>((resolve) => requests.push({ resolve, signal: init?.signal, path: url }))))
    await act(async () => { root!.render(<><View path="/api/office" interval={10_000}/><View path="/api/office" interval={10_000}/></>) })
    expect(requests).toHaveLength(1)
    await respond(0, 'crew')
    expect(host.textContent).toBe('crew:falsecrew:false')
    expect(getStoreStats()).toMatchObject({ requests: 1, readers: 2, activeTimers: 1 })
  })

  it('does not fetch again, or show a loading state, when a page returns within its polling interval', async () => {
    await render('/api/calendar', 0, { interval: 30_000, strict: false })
    await respond(0, 'jobs')
    await act(async () => { root!.unmount() })
    root = undefined
    await render('/api/calendar', 0, { interval: 30_000, strict: false })
    expect(host.textContent).toBe('jobs:false')
    expect(requests).toHaveLength(1)
    expect(getStoreStats().servedFromCache).toBeGreaterThan(0)
  })

  it('shows cached data at once and refreshes silently when it is older than the interval', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    await render('/api/activity', 0, { interval: 15_000, strict: false })
    await respond(0, 'old')
    await act(async () => { root!.unmount() })
    root = undefined
    vi.setSystemTime(Date.now() + 20_000)
    await render('/api/activity', 0, { interval: 15_000, strict: false })
    expect(host.textContent).toBe('old:false') // not "pending", and no refreshing flag: a silent update
    expect(requests).toHaveLength(2)
    await respond(1, 'new')
    expect(host.textContent).toBe('new:false')
  })

  it('never aborts a slow request because the next poll came due, and never overlaps polls', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    await render('/api/office', 0, { interval: 10_000, strict: false })
    await act(async () => { await vi.advanceTimersByTimeAsync(45_000) })
    expect(requests).toHaveLength(1)
    expect(requests[0].signal?.aborted).toBe(false)
    await respond(0, 'finally')
    expect(host.textContent).toBe('finally:false')
    await act(async () => { await vi.advanceTimersByTimeAsync(11_500) })
    expect(requests).toHaveLength(2)
  })

  it('keeps the last good data (marked stale) when a poll fails, and backs off before retrying', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    await render('/api/tasks', 0, { interval: 10_000, strict: false })
    await respond(0, 'tasks')
    await act(async () => { await vi.advanceTimersByTimeAsync(11_500) })
    await respond(1, '', 503)
    expect(host.textContent).toBe('tasks(stale):false')
    // First retry after about one interval; each further failure doubles the wait.
    await act(async () => { await vi.advanceTimersByTimeAsync(12_500) })
    expect(requests).toHaveLength(3)
    await respond(2, '', 503)
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(requests).toHaveLength(3)
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(requests).toHaveLength(4)
  })

  it('does not fetch or poll while paused, and resumes on unpause', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    await render('/api/logs', 0, { interval: 5_000, paused: true, strict: false })
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(requests).toHaveLength(0)
    await render('/api/logs', 0, { interval: 5_000, paused: false, strict: false })
    expect(requests).toHaveLength(1)
  })

  it('stops its timer when the last reader leaves', async () => {
    await render('/api/folders', 0, { interval: 60_000, strict: false })
    await respond(0, 'folders')
    expect(getStoreStats().activeTimers).toBe(1)
    await act(async () => { root!.unmount() })
    root = undefined
    expect(getStoreStats()).toMatchObject({ readers: 0, activeTimers: 0 })
  })
})

describe('backoff', () => {
  it('grows exponentially from the interval, is capped, and is jittered by +-20%', () => {
    expect(backoffDelay(10_000, 0, () => 0.5)).toBe(10_000)
    expect(backoffDelay(10_000, 1, () => 0.5)).toBe(20_000)
    expect(backoffDelay(10_000, 2, () => 0.5)).toBe(40_000)
    expect(backoffDelay(10_000, 9, () => 0.5)).toBe(60_000)
    expect(backoffDelay(10_000, 1, () => 0)).toBe(16_000)
    expect(backoffDelay(10_000, 1, () => 1)).toBe(24_000)
    expect(backoffDelay(0, 0, () => 0.5)).toBe(2_000)
  })
})
