import { useAgentConnection, type ConnectionLink } from '../agent/connection.ts'
import { getStoreStats } from '../data-store.ts'
import { formatDateTime } from '../format.ts'
import { usePolling } from '../polling.ts'
import { Pill } from '../components/ui/Primitives.tsx'

interface ServerDiagnostics {
  uptimeSeconds: number
  memory: { rssMB: number; heapUsedMB: number }
  requests: { total: number }
  processes: { spawned: number; failed: number; active: number; queued: number }
  caches: Record<string, { hits: number; misses: number; staleServed: number; coalesced: number }>
}

const TONE: Record<ConnectionLink, 'accent' | 'muted' | 'default'> = { unknown: 'muted', connecting: 'muted', connected: 'accent', reconnecting: 'default', disconnected: 'muted', error: 'muted' }

/**
 * Shows the shared Hermes connection (the same state every page reads) and proof that navigating
 * does not restart it. The numbers come from the server's in-memory counters; reading them never
 * touches Hermes.
 */
export function AgentConnectionPanel() {
  const connection = useAgentConnection()
  const diagnostics = usePolling<ServerDiagnostics>('/api/diagnostics', 15_000)
  const status = connection.status
  const server = diagnostics.status === 'ready' ? diagnostics.data : undefined
  const cacheTotals = server ? Object.values(server.caches).reduce((sum, cache) => ({ hits: sum.hits + cache.hits, stale: sum.stale + cache.staleServed, misses: sum.misses + cache.misses }), { hits: 0, stale: 0, misses: 0 }) : undefined
  const client = getStoreStats()
  return (
    <>
      <div className="mo-section-row-head">
        <div>
          <div className="mo-section-eyebrow">HERMES</div>
          <h2 className="mo-section-heading">Agent connection</h2>
        </div>
        <Pill variant={TONE[connection.link]}>{connection.link === 'unknown' ? 'Unknown' : connection.label}</Pill>
      </div>
      <p className="mo-section-desc">
        One connection state for the whole app. The server checks Hermes once at start-up and then only re-checks it while a page is open. Moving between pages never restarts it.
      </p>
      {status ? (
        <dl className="mo-diag-grid font-mono">
          <dt>State</dt><dd>{status.state}{connection.verifying ? ' (re-checking)' : ''}</dd>
          <dt>Initializations</dt><dd>{status.counters.initializations} (repeat requests ignored: {status.counters.duplicateInitializations})</dd>
          <dt>Startup check</dt><dd>{status.timings.initializationMs !== undefined ? `${status.timings.initializationMs} ms` : 'Not finished'}</dd>
          <dt>Last verified</dt><dd>{status.lastVerifiedAt ? formatDateTime(status.lastVerifiedAt) : 'Never'}</dd>
          <dt>Connections lost / restored</dt><dd>{status.counters.connectionsLost} / {status.counters.reconnections}</dd>
          {status.lastError && <><dt>Last error</dt><dd>{status.lastError}</dd></>}
          {server && <><dt>Hermes commands run</dt><dd>{server.processes.spawned} ({server.processes.failed} failed, {server.processes.active} running, {server.processes.queued} queued)</dd></>}
          {server && <><dt>API requests served</dt><dd>{server.requests.total}</dd></>}
          {cacheTotals && <><dt>Reads from cache</dt><dd>{cacheTotals.hits} fresh, {cacheTotals.stale} refreshed in background, {cacheTotals.misses} waited for Hermes</dd></>}
          <dt>This browser</dt><dd>{client.requests} requests, {client.servedFromCache} page opens served from memory, {client.activeTimers} timers</dd>
        </dl>
      ) : (
        <p className="text-muted">{connection.detail || 'Waiting for the first status from the server…'}</p>
      )}
    </>
  )
}
