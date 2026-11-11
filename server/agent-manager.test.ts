import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentManager, type Verification } from './agent-manager.js'

// A verification the test controls: each call waits until the test settles it.
function controlledVerify() {
  const pending: ((value: Verification | Error) => void)[] = []
  const verify = vi.fn(() => new Promise<Verification>((resolve, reject) => {
    pending.push((value) => (value instanceof Error ? reject(value) : resolve(value)))
  }))
  return { verify, settle: (value: Verification | Error, index = pending.length - 1) => pending[index](value) }
}
const flush = async () => { await vi.advanceTimersByTimeAsync(0) }

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('AgentManager initialization', () => {
  it('shares one verification between concurrent initialize() calls', async () => {
    const { verify, settle } = controlledVerify()
    const manager = new AgentManager({ verify, random: () => 0.5 })
    expect(manager.status().state).toBe('NOT_INITIALIZED')
    const calls = [manager.initialize(), manager.initialize(), manager.initialize()]
    expect(manager.status().state).toBe('INITIALIZING')
    expect(calls[1]).toBe(calls[0])
    settle({ ok: true })
    const [status] = await Promise.all(calls)
    expect(status.state).toBe('CONNECTED')
    expect(verify).toHaveBeenCalledTimes(1)
    expect(manager.status().counters).toMatchObject({ initializations: 1, duplicateInitializations: 2, activeConnections: 1 })
    manager.stop()
  })

  it('does not verify again when initialize() is called on a connected manager', async () => {
    const { verify, settle } = controlledVerify()
    const manager = new AgentManager({ verify })
    const first = manager.initialize()
    settle({ ok: true })
    await first
    await manager.initialize()
    await manager.initialize()
    expect(verify).toHaveBeenCalledTimes(1)
    expect(manager.status().counters.initializations).toBe(1)
    manager.stop()
  })

  it('does not report CONNECTED before verification succeeds', async () => {
    const { verify, settle } = controlledVerify()
    const manager = new AgentManager({ verify })
    void manager.initialize()
    await flush()
    expect(manager.status()).toMatchObject({ state: 'INITIALIZING', healthy: false })
    settle({ ok: false, detail: 'Command not installed or not on PATH.' })
    await flush()
    expect(manager.status()).toMatchObject({ state: 'DISCONNECTED', healthy: false, lastError: 'Command not installed or not on PATH.' })
    manager.stop()
  })

  it('reports ERROR when verification itself throws', async () => {
    const { verify, settle } = controlledVerify()
    const manager = new AgentManager({ verify })
    void manager.initialize()
    settle(new Error('boom'))
    await flush()
    expect(manager.status()).toMatchObject({ state: 'ERROR', lastError: 'boom' })
    manager.stop()
  })
})

describe('AgentManager health and recovery', () => {
  it('does not restart a healthy connection when clients touch it', async () => {
    const { verify, settle } = controlledVerify()
    const manager = new AgentManager({ verify, healthIntervalMs: 30_000 })
    void manager.initialize()
    settle({ ok: true })
    await flush()
    for (let i = 0; i < 50; i += 1) manager.touch()
    await vi.advanceTimersByTimeAsync(10_000)
    for (let i = 0; i < 50; i += 1) manager.touch()
    expect(verify).toHaveBeenCalledTimes(1)
    expect(manager.status().counters).toMatchObject({ initializations: 1, reconnections: 0, connectionsLost: 0 })
    manager.stop()
  })

  it('re-verifies on the health interval while a client is active, and sleeps when none is', async () => {
    const { verify, settle } = controlledVerify()
    const manager = new AgentManager({ verify, healthIntervalMs: 30_000, activeWindowMs: 45_000 })
    manager.touch()
    settle({ ok: true })
    await flush()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(verify).toHaveBeenCalledTimes(2)
    settle({ ok: true })
    await flush()
    // The check at 30 s was inside the 45 s window, so one more is scheduled for 60 s.
    await vi.advanceTimersByTimeAsync(30_000)
    expect(verify).toHaveBeenCalledTimes(3)
    settle({ ok: true })
    await flush()
    // After it the window has passed: no further check is scheduled, however long nobody looks.
    await vi.advanceTimersByTimeAsync(300_000)
    expect(verify).toHaveBeenCalledTimes(3)
    // A client returning wakes the monitor with one verification, not a re-initialization.
    manager.touch()
    await vi.advanceTimersByTimeAsync(0)
    expect(verify).toHaveBeenCalledTimes(4)
    expect(manager.status().counters.initializations).toBe(1)
    manager.stop()
  })

  it('goes RECONNECTING then DISCONNECTED on failures and backs off exponentially with jitter', async () => {
    const { verify, settle } = controlledVerify()
    const manager = new AgentManager({ verify, healthIntervalMs: 30_000, backoffBaseMs: 1_000, backoffMaxMs: 8_000, disconnectedAfter: 3, random: () => 0.5 })
    manager.touch()
    settle({ ok: true })
    await flush()
    expect(manager.status().state).toBe('CONNECTED')

    // Health check fails: connection lost, reconnecting, retry after the 1 s base (jitter 0.5 => x1).
    await vi.advanceTimersByTimeAsync(30_000)
    settle({ ok: false, detail: 'offline' })
    await flush()
    manager.touch()
    expect(manager.status()).toMatchObject({ state: 'RECONNECTING', consecutiveFailures: 1, healthy: false })
    expect(manager.status().counters.connectionsLost).toBe(1)
    expect(manager.status().nextAttemptInMs).toBe(1_000)

    const calls = () => verify.mock.calls.length
    const before = calls()
    await vi.advanceTimersByTimeAsync(999)
    expect(calls()).toBe(before)
    await vi.advanceTimersByTimeAsync(1)
    expect(calls()).toBe(before + 1)
    settle({ ok: false, detail: 'offline' })
    await flush()
    expect(manager.status()).toMatchObject({ state: 'RECONNECTING', consecutiveFailures: 2 })
    expect(manager.status().nextAttemptInMs).toBe(2_000)

    await vi.advanceTimersByTimeAsync(2_000)
    settle({ ok: false, detail: 'offline' })
    await flush()
    expect(manager.status()).toMatchObject({ state: 'DISCONNECTED', consecutiveFailures: 3 })
    expect(manager.status().nextAttemptInMs).toBe(4_000)

    // The delay stops growing at the cap.
    await vi.advanceTimersByTimeAsync(4_000)
    settle({ ok: false })
    await flush()
    await vi.advanceTimersByTimeAsync(8_000)
    settle({ ok: false })
    await flush()
    expect(manager.status().nextAttemptInMs).toBe(8_000)

    // Recovery: one reconnection, still a single initialization.
    await vi.advanceTimersByTimeAsync(8_000)
    settle({ ok: true })
    await flush()
    expect(manager.status()).toMatchObject({ state: 'CONNECTED', healthy: true, consecutiveFailures: 0 })
    expect(manager.status().counters).toMatchObject({ initializations: 1, reconnections: 1, connectionsLost: 1 })
    manager.stop()
  })

  it('never runs two verifications at once', async () => {
    const { verify, settle } = controlledVerify()
    const manager = new AgentManager({ verify, healthIntervalMs: 1_000, activeWindowMs: 1_000_000 })
    manager.touch()
    // The first verification is still pending while time and touches pile up.
    await vi.advanceTimersByTimeAsync(5_000)
    for (let i = 0; i < 20; i += 1) manager.touch()
    expect(verify).toHaveBeenCalledTimes(1)
    settle({ ok: true })
    await flush()
    manager.stop()
  })

  it('stops cleanly: no timers fire and late results are ignored', async () => {
    const { verify, settle } = controlledVerify()
    const manager = new AgentManager({ verify, healthIntervalMs: 1_000 })
    manager.touch()
    manager.stop()
    settle({ ok: true })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(verify).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    expect(manager.status().state).not.toBe('CONNECTED')
  })
})
