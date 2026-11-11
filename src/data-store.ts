import { loadSnapshot, mergeRefresh, type RequestState } from './request-state.ts'

// One shared copy of every polled API path, owned by the module instead of by a component.
//
// Before this store, each usePolling() call kept its own state: leaving a page threw its data away,
// returning showed "Connecting" again and fetched again, and every mounted copy ran its own timer.
// Here a path has one entry (data, in-flight request, timer) however many components read it, and
// the entry outlives them. A page that mounts shows what is already known and refreshes in the
// background only when that data is older than the page's polling interval.

export type Polled<T> = RequestState<T> & { refreshing: boolean; refresh: () => void }

/** A polled request is abandoned after this long (a cold server can need 70 s or more to read Hermes). Retries join the server's running read. */
const REQUEST_TIMEOUT_MS = 240_000
const BACKOFF_FLOOR_MS = 2_000
const BACKOFF_CAP_MS = 60_000
/** Entries nobody reads are dropped after this long, so parameterised paths cannot pile up. */
const IDLE_EVICT_MS = 30 * 60_000

interface Entry {
  path: string
  state: RequestState<unknown>
  /** A visible request is running (first load or a manual refresh). Silent background polls do not set it. */
  refreshing: boolean
  view: Polled<unknown>
  /** Serialised data, to keep the same object (and skip re-rendering) when a poll returns nothing new. */
  signature: string | undefined
  listeners: Set<() => void>
  /** One record per mounted reader: its polling interval. */
  readers: Map<symbol, number>
  generation: number
  inflight?: { generation: number; controller: AbortController; promise: Promise<void> }
  timer?: ReturnType<typeof setTimeout>
  lastSuccessAt: number
  nextRetryAt: number
  failures: number
  refreshTick: number
  lastReaderAt: number
}

const entries = new Map<string, Entry>()
const stats = { requests: 0, deduplicated: 0, servedFromCache: 0, backgroundRefreshes: 0, failures: 0 }
let visibilityBound = false

/** Seconds to wait after `failures` consecutive failures: exponential, capped, with +-20% jitter. */
export function backoffDelay(intervalMs: number, failures: number, random: () => number = Math.random): number {
  const base = Math.max(intervalMs, BACKOFF_FLOOR_MS)
  const exponential = Math.min(BACKOFF_CAP_MS, base * 2 ** Math.max(0, failures))
  return Math.round(exponential * (0.8 + random() * 0.4))
}

function makeView(entry: Entry): Polled<unknown> {
  return { ...entry.state, refreshing: entry.refreshing, refresh: () => { void load(entry, true) } } as Polled<unknown>
}

function publish(entry: Entry): void {
  entry.view = makeView(entry)
  for (const listener of [...entry.listeners]) listener()
}

function getEntry(path: string): Entry {
  let entry = entries.get(path)
  if (!entry) {
    entry = { path, state: { status: 'pending' }, refreshing: false, view: undefined as unknown as Polled<unknown>, signature: undefined, listeners: new Set(), readers: new Map(), generation: 0, lastSuccessAt: 0, nextRetryAt: 0, failures: 0, refreshTick: 0, lastReaderAt: Date.now() }
    entry.view = makeView(entry)
    entries.set(path, entry)
  }
  return entry
}

const minInterval = (entry: Entry): number => {
  const positive = [...entry.readers.values()].filter((interval) => interval > 0)
  return positive.length ? Math.min(...positive) : 0
}

function load(entry: Entry, fresh = false, silent = false): Promise<void> {
  if (entry.inflight && !fresh) {
    stats.deduplicated += 1
    return entry.inflight.promise
  }
  // A manual refresh replaces whatever is running; the older answer is ignored when it arrives.
  entry.inflight?.controller.abort()
  const generation = ++entry.generation
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const visible = !silent || entry.state.status !== 'ready'
  if (visible && !entry.refreshing) { entry.refreshing = true; publish(entry) }
  stats.requests += 1
  if (silent) stats.backgroundRefreshes += 1
  const url = fresh ? `${entry.path}${entry.path.includes('?') ? '&' : '?'}fresh=1` : entry.path
  const promise = loadSnapshot<unknown>(url, fetch, controller.signal).then((next) => {
    clearTimeout(timeout)
    if (generation !== entry.generation) return
    entry.inflight = undefined
    const previous = entry.state
    const wasRefreshing = entry.refreshing
    if (next.status === 'ready') {
      entry.failures = 0
      entry.lastSuccessAt = Date.now()
      const signature = JSON.stringify(next.data)
      // Same payload as before: keep the existing state object so readers do not re-render.
      const same = previous.status === 'ready' && !previous.stale && signature === entry.signature
      entry.state = same ? previous : next
      entry.signature = signature
    } else {
      entry.failures += 1
      stats.failures += 1
      entry.nextRetryAt = Date.now() + backoffDelay(minInterval(entry) || BACKOFF_FLOOR_MS, entry.failures - 1)
      const merged = mergeRefresh(previous, next)
      // A repeat of the same failure (or the same stale marker) is not news either.
      entry.state = previous.status === 'ready' && previous.stale && merged.status === 'ready' ? previous : previous.status === 'failed' && next.status === 'failed' && previous.message === next.message && previous.httpStatus === next.httpStatus ? previous : merged
    }
    entry.refreshing = false
    if (entry.state !== previous || wasRefreshing) publish(entry)
    schedule(entry)
  })
  entry.inflight = { generation, controller, promise }
  return promise
}

function schedule(entry: Entry): void {
  if (entry.timer) clearTimeout(entry.timer)
  entry.timer = undefined
  const interval = minInterval(entry)
  if (interval <= 0 || entry.readers.size === 0) return
  // One timer per path, restarted after each answer, so polls can never overlap. Failures back off.
  const delay = entry.failures > 0 ? Math.max(0, entry.nextRetryAt - Date.now()) : Math.round(interval * (1 + Math.random() * 0.1))
  entry.timer = setTimeout(() => {
    entry.timer = undefined
    if (typeof document !== 'undefined' && document.hidden) return // resumed by the visibility handler
    void load(entry, false, true)
  }, delay)
}

/** How old cached data may be, for a path that does not poll, before a page mount refreshes it. */
const MOUNT_MAX_AGE_MS = 60_000

function needsRefresh(entry: Entry, interval: number): boolean {
  if (entry.inflight) return false
  if (entry.state.status === 'pending') return true
  if (entry.state.status === 'failed') return Date.now() >= entry.nextRetryAt
  if (entry.state.status === 'ready' && entry.state.stale) return Date.now() >= entry.nextRetryAt
  return Date.now() - entry.lastSuccessAt >= (interval > 0 ? interval : MOUNT_MAX_AGE_MS)
}

function bindVisibility(): void {
  if (visibilityBound || typeof document === 'undefined') return
  visibilityBound = true
  const resume = () => {
    if (document.hidden) return
    for (const entry of entries.values()) {
      if (entry.readers.size === 0 || entry.inflight) continue
      // Back in view: refresh what went stale while hidden (once), and restart the timers.
      if (needsRefresh(entry, minInterval(entry))) void load(entry, false, true)
      else schedule(entry)
    }
  }
  document.addEventListener('visibilitychange', resume)
  window.addEventListener('online', () => { for (const entry of entries.values()) { if (entry.readers.size && entry.state.status !== 'ready') { entry.nextRetryAt = 0; void load(entry, false, true) } } })
}

function evictIdle(): void {
  const now = Date.now()
  for (const [path, entry] of entries) {
    if (entry.readers.size === 0 && entry.listeners.size === 0 && !entry.inflight && now - entry.lastReaderAt > IDLE_EVICT_MS) entries.delete(path)
  }
}

/**
 * A component starts reading a path. Returns the function that stops. Fetches only if there is
 * nothing usable (first read, a failure, or data older than `intervalMs`), then keeps one timer.
 */
export function retain(path: string, intervalMs: number, tick: number): () => void {
  evictIdle()
  const entry = getEntry(path)
  const id = Symbol(path)
  entry.readers.set(id, intervalMs)
  bindVisibility()
  const forced = tick > entry.refreshTick
  if (forced) entry.refreshTick = tick
  if (forced && !entry.inflight) void load(entry, true)
  else if (needsRefresh(entry, intervalMs)) void load(entry, false, entry.state.status === 'ready')
  else {
    if (entry.state.status === 'ready') stats.servedFromCache += 1
    schedule(entry)
  }
  return () => {
    entry.readers.delete(id)
    entry.lastReaderAt = Date.now()
    // The last reader leaving stops the timer; a request already running finishes and is kept.
    schedule(entry)
  }
}

/** The global refresh control was pressed after this path was retained. */
export function refreshOnTick(path: string, tick: number): void {
  const entry = getEntry(path)
  if (tick > entry.refreshTick) {
    entry.refreshTick = tick
    void load(entry, true)
  }
}

export function subscribeToPath(path: string, listener: () => void): () => void {
  const entry = getEntry(path)
  entry.listeners.add(listener)
  return () => { entry.listeners.delete(listener) }
}

export function readPath<T>(path: string): Polled<T> {
  return getEntry(path).view as Polled<T>
}

/** Counters for the diagnostics panel and tests. Contains no response data. */
export function getStoreStats() {
  let timers = 0
  let readers = 0
  let inflight = 0
  for (const entry of entries.values()) {
    if (entry.timer) timers += 1
    readers += entry.readers.size
    if (entry.inflight) inflight += 1
  }
  return { ...stats, entries: entries.size, readers, activeTimers: timers, inflight, paths: [...entries.keys()] }
}

/** Test helper: forget everything and cancel all timers and requests. */
export function resetDataStore(): void {
  for (const entry of entries.values()) {
    if (entry.timer) clearTimeout(entry.timer)
    entry.inflight?.controller.abort()
  }
  entries.clear()
  for (const key of Object.keys(stats) as (keyof typeof stats)[]) stats[key] = 0
}

if (typeof window !== 'undefined') (window as unknown as { __batcaveStore?: typeof getStoreStats }).__batcaveStore = getStoreStats
