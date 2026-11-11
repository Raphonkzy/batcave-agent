import { describe, expect, it, vi } from 'vitest'
import type { Polled } from '../polling.ts'
import { deriveConnection, type ServerAgentStatus } from './connection.ts'

const status = (patch: Partial<ServerAgentStatus> = {}): ServerAgentStatus => ({
  state: 'CONNECTED', healthy: true, verifying: false, since: '2026-01-01T00:00:00.000Z', consecutiveFailures: 0,
  counters: { initializations: 1, duplicateInitializations: 0, verifications: 1, connectionsLost: 0, reconnections: 0, activeConnections: 1 },
  timings: {}, ...patch,
})
const ready = (data: ServerAgentStatus, stale = false): Polled<ServerAgentStatus> => ({ status: 'ready', data, ...(stale ? { stale } : {}), refreshing: false, refresh: vi.fn() })

describe('connection state shown to every page', () => {
  it('is "connecting" only before the first answer, and never claims a connection it has not seen', () => {
    expect(deriveConnection({ status: 'pending', refreshing: true, refresh: vi.fn() }).link).toBe('connecting')
    expect(deriveConnection(ready(status({ state: 'INITIALIZING', healthy: false }))).link).toBe('connecting')
    expect(deriveConnection(ready(status({ state: 'NOT_INITIALIZED', healthy: false }))).link).toBe('connecting')
  })

  it('treats a routine re-check as connected, not as a loading state', () => {
    const connection = deriveConnection(ready(status({ healthy: false, verifying: true })))
    expect(connection).toMatchObject({ link: 'connected', verifying: true })
  })

  it('distinguishes Hermes reconnecting, disconnected and failing', () => {
    expect(deriveConnection(ready(status({ state: 'RECONNECTING', healthy: false }))).link).toBe('reconnecting')
    expect(deriveConnection(ready(status({ state: 'DISCONNECTED', healthy: false, lastError: 'offline' })))).toMatchObject({ link: 'disconnected', detail: 'offline' })
    expect(deriveConnection(ready(status({ state: 'ERROR', healthy: false }))).link).toBe('error')
  })

  it('reports a lost server link as reconnecting while keeping the last known status, never as live', () => {
    const connection = deriveConnection(ready(status(), true))
    expect(connection).toMatchObject({ link: 'reconnecting', serverUnreachable: true })
    expect(connection.status?.state).toBe('CONNECTED')
  })

  it('reports an unreachable server on first load as disconnected', () => {
    expect(deriveConnection({ status: 'failed', message: 'down', refreshing: false, refresh: vi.fn() })).toMatchObject({ link: 'disconnected', serverUnreachable: true })
  })
})
