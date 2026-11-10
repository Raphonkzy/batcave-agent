import type { Polled } from '../../polling.ts'

/** A failed data source never replaces a scene that can still render. */
export function SceneResourceStatus({ request }: { request: Polled<unknown> }) {
  const unavailable = request.status === 'failed'
  const stale = request.status === 'ready' && request.stale
  const label = unavailable ? 'Crew data unavailable' : stale ? 'Crew data delayed' : request.status === 'pending' ? 'Connecting to crew' : 'Crew connected'
  return <details className="scene-resource-status" data-tone={unavailable ? 'error' : stale || request.status === 'pending' ? 'warning' : 'success'}>
    <summary><span className="scene-resource-dot" aria-hidden="true"/><span role="status">{label}</span><span aria-hidden="true">⌄</span></summary>
    <div className="scene-resource-details">
      <p>{unavailable ? request.message ?? 'The crew source could not be reached.' : stale ? 'Showing the last successful crew snapshot. The next refresh will retry.' : request.status === 'pending' ? 'The environment remains available while crew data loads.' : 'Live crew data is available. Environment controls are independent of this connection.'}</p>
      <button type="button" className="panel-toggle" disabled={request.refreshing} onClick={request.refresh}>{request.refreshing ? 'Connecting…' : 'Retry crew data'}</button>
    </div>
  </details>
}
