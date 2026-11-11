import { useAgentConnection } from '../../agent/connection.ts'
import type { Polled } from '../../polling.ts'

/**
 * A failed data source never replaces a scene that can still render. The line combines two facts:
 * the shared Hermes connection (one answer for every page) and this page's crew data.
 * A background re-check or a quiet reconnection is shown here, never as a loading screen.
 */
export function SceneResourceStatus({ request }: { request: Polled<unknown> }) {
  const connection = useAgentConnection()
  const down = connection.link === 'disconnected' || connection.link === 'error'
  const reconnecting = connection.link === 'reconnecting'
  const unavailable = request.status === 'failed'
  const stale = request.status === 'ready' && request.stale
  const loading = request.status === 'pending'
  const label = down ? connection.label
    : reconnecting ? connection.label
      : unavailable ? 'Crew data unavailable'
        : stale ? 'Crew data delayed'
          : loading ? 'Connecting to crew'
            : 'Crew connected'
  const tone = down || unavailable ? 'error' : reconnecting || stale || loading ? 'warning' : 'success'
  const detail = down || reconnecting ? connection.detail
    : unavailable ? request.message ?? 'The crew source could not be reached.'
      : stale ? 'Showing the last successful crew snapshot. The next refresh will retry.'
        : loading ? 'The environment remains available while crew data loads.'
          : 'Live crew data is available. Environment controls are independent of this connection.'
  return <details className="scene-resource-status" data-tone={tone}>
    <summary><span className="scene-resource-dot" aria-hidden="true"/><span role="status">{label}</span><span aria-hidden="true">⌄</span></summary>
    <div className="scene-resource-details">
      <p>{detail}</p>
      <button type="button" className="panel-toggle" disabled={request.refreshing} onClick={request.refresh}>{request.refreshing ? 'Refreshing…' : 'Retry crew data'}</button>
    </div>
  </details>
}
