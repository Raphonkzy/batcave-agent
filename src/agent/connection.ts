import { createContext, useContext } from 'react'
import type { Polled } from '../polling.ts'

// The one place the browser learns whether Hermes is connected. The backend's AgentManager owns
// the real connection; AgentProvider (mounted once above every page) reads its state through the
// shared data store and hands the same answer to all pages. Pages never start, restart or probe
// the connection themselves.

export type ServerConnectionState = 'NOT_INITIALIZED' | 'INITIALIZING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED' | 'ERROR'

/** Mirrors the backend's /api/agent/status. */
export interface ServerAgentStatus {
  state: ServerConnectionState
  healthy: boolean
  verifying: boolean
  since: string
  initializedAt?: string
  lastVerifiedAt?: string
  verifiedAgeMs?: number
  lastError?: string
  consecutiveFailures: number
  nextAttemptInMs?: number
  counters: { initializations: number; duplicateInitializations: number; verifications: number; connectionsLost: number; reconnections: number; activeConnections: number }
  timings: { initializationMs?: number; lastVerificationMs?: number }
}

/**
 * What the interface shows, in the four situations it must tell apart:
 * - `connecting`: the first answer has not arrived, or the server is verifying Hermes for the first time.
 * - `connected`: verified. A routine re-check in progress (`verifying`) is not a state change.
 * - `reconnecting`: a working connection was lost (Hermes, or this browser's link to the server) and is being re-established.
 * - `disconnected` / `error`: Hermes is not reachable; retries continue with backoff.
 * - `unknown`: no provider above (tests, isolated components).
 */
export type ConnectionLink = 'unknown' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'

export interface AgentConnection {
  link: ConnectionLink
  /** True when the browser cannot reach the Batcave server at all (as opposed to Hermes being down). */
  serverUnreachable: boolean
  /** A re-check is running while the last verified state is still shown. Never a reason for a loading screen. */
  verifying: boolean
  /** The latest status from the server, kept while the server is briefly unreachable. */
  status?: ServerAgentStatus
  /** Short, user-facing line. */
  label: string
  detail: string
}

const UNKNOWN: AgentConnection = { link: 'unknown', serverUnreachable: false, verifying: false, label: '', detail: '' }

export function deriveConnection(poll: Polled<ServerAgentStatus>): AgentConnection {
  const status = poll.status === 'ready' ? poll.data : undefined
  if (poll.status === 'pending') return { link: 'connecting', serverUnreachable: false, verifying: false, label: 'Connecting to Hermes', detail: 'Waiting for the first answer from the Batcave server.' }
  if (poll.status === 'failed') {
    // Never connected in this session: the server is not answering at all.
    return { link: 'disconnected', serverUnreachable: true, verifying: false, label: 'Batcave server unreachable', detail: poll.message ?? 'The Batcave API could not be reached.' }
  }
  const serverUnreachable = poll.stale === true
  if (serverUnreachable) {
    // The last answer is kept, but it is old and the server stopped answering: say so, do not claim a live connection.
    return { link: 'reconnecting', serverUnreachable: true, verifying: false, ...(status ? { status } : {}), label: 'Reconnecting to the Batcave server', detail: 'The last known state is shown while the connection is re-established.' }
  }
  const base = { serverUnreachable: false, status }
  switch (status?.state) {
    case 'CONNECTED':
      return { ...base, link: 'connected', verifying: status.verifying, label: 'Hermes connected', detail: status.lastVerifiedAt ? `Verified ${status.lastVerifiedAt}.` : 'Verified.' }
    case 'RECONNECTING':
      return { ...base, link: 'reconnecting', verifying: true, label: 'Reconnecting to Hermes', detail: status.lastError ?? 'Hermes did not answer; trying again.' }
    case 'DISCONNECTED':
      return { ...base, link: 'disconnected', verifying: status.verifying, label: 'Hermes disconnected', detail: status.lastError ?? 'Hermes could not be reached. Retrying with increasing delays.' }
    case 'ERROR':
      return { ...base, link: 'error', verifying: status.verifying, label: 'Hermes connection error', detail: status.lastError ?? 'The connection check failed unexpectedly.' }
    default:
      return { ...base, link: 'connecting', verifying: true, label: 'Initializing Hermes', detail: 'The server is verifying Hermes for the first time.' }
  }
}

export const AgentConnectionContext = createContext<AgentConnection>(UNKNOWN)

export function useAgentConnection(): AgentConnection {
  return useContext(AgentConnectionContext)
}
