// Lightweight in-memory counters and structured logging. Nothing here stores request bodies,
// query strings, cookies or Hermes output, so it is safe to expose through /api/diagnostics.

export interface RouteStats { count: number; errors: number; totalMs: number; maxMs: number }
export interface CacheStats {
  /** Served from a fresh entry. */
  hits: number
  /** Had to wait for a collection (no usable entry, or a manual refresh). */
  misses: number
  /** Served a stored value immediately while a refresh ran in the background. */
  staleServed: number
  /** Joined a collection that was already running instead of starting another. */
  coalesced: number
  collections: number
  collectFailures: number
  lastCollectMs: number
  totalCollectMs: number
}
export interface ProcessStats { spawned: number; failed: number; active: number; queued: number; totalMs: number }

const startedAt = Date.now()
const routes = new Map<string, RouteStats>()
const caches = new Map<string, CacheStats>()
const processes: ProcessStats = { spawned: 0, failed: 0, active: 0, queued: 0, totalMs: 0 }
const MAX_ROUTE_KEYS = 64

export function recordRequest(route: string, durationMs: number, status: number): void {
  let stats = routes.get(route)
  if (!stats) {
    // A bounded table: unknown routes share one bucket instead of growing without limit.
    if (routes.size >= MAX_ROUTE_KEYS) route = 'other'
    stats = routes.get(route) ?? { count: 0, errors: 0, totalMs: 0, maxMs: 0 }
    routes.set(route, stats)
  }
  stats.count += 1
  stats.totalMs += durationMs
  stats.maxMs = Math.max(stats.maxMs, durationMs)
  if (status >= 500) stats.errors += 1
}

export function cacheStatsFor(name: string): CacheStats {
  let stats = caches.get(name)
  if (!stats) {
    stats = { hits: 0, misses: 0, staleServed: 0, coalesced: 0, collections: 0, collectFailures: 0, lastCollectMs: 0, totalCollectMs: 0 }
    caches.set(name, stats)
  }
  return stats
}

export function processCounters(): ProcessStats { return processes }

export interface DiagnosticsSnapshot {
  uptimeSeconds: number
  memory: { rssMB: number; heapUsedMB: number }
  requests: { total: number; byRoute: Record<string, { count: number; errors: number; avgMs: number; maxMs: number }> }
  caches: Record<string, CacheStats>
  processes: ProcessStats
}

const round = (value: number) => Math.round(value * 10) / 10

export function diagnosticsSnapshot(): DiagnosticsSnapshot {
  const usage = process.memoryUsage()
  const byRoute: DiagnosticsSnapshot['requests']['byRoute'] = {}
  let total = 0
  for (const [route, stats] of routes) {
    total += stats.count
    byRoute[route] = { count: stats.count, errors: stats.errors, avgMs: round(stats.totalMs / Math.max(stats.count, 1)), maxMs: round(stats.maxMs) }
  }
  return {
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    memory: { rssMB: round(usage.rss / 1_048_576), heapUsedMB: round(usage.heapUsed / 1_048_576) },
    requests: { total, byRoute },
    caches: Object.fromEntries(caches),
    processes: { ...processes },
  }
}

type Fields = Record<string, string | number | boolean | undefined>

/** One structured line: `[Scope] Event {"key":"value"}`. Silent under the test runner. */
export function logEvent(scope: string, event: string, fields?: Fields): void {
  if (process.env.VITEST) return
  const clean = fields ? Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) : undefined
  console.log(clean && Object.keys(clean).length ? `[${scope}] ${event} ${JSON.stringify(clean)}` : `[${scope}] ${event}`)
}

/** Per-call events (cache reuse, navigation) are summarised at most once per interval. */
export function createRateLimitedLog(scope: string, event: string, intervalMs = 60_000) {
  let count = 0
  let last = 0
  return (fields?: Fields) => {
    count += 1
    const now = Date.now()
    if (process.env.BATCAVE_LOG === 'debug') { logEvent(scope, event, fields); return }
    if (now - last < intervalMs) return
    logEvent(scope, event, { ...fields, since: count })
    count = 0
    last = now
  }
}
