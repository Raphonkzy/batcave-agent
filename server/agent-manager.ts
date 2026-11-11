import { createRateLimitedLog, logEvent } from './diagnostics.js'

// The single owner of the Hermes connection state for this backend process.
//
// Hermes is not a daemon Batcave talks to over a socket: it is the `hermes` CLI plus its home
// folder. "Connected" therefore means "a verification of Hermes just succeeded". The manager
// verifies once at start-up (one shared promise, however many callers), re-verifies on a slow
// timer while a browser is actually using the API, and retries with exponential backoff and
// jitter when verification fails. It never spawns anything itself; `verify` is injected.

export type AgentConnectionState = 'NOT_INITIALIZED' | 'INITIALIZING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED' | 'ERROR'

export interface Verification { ok: boolean; detail?: string }

export interface AgentManagerOptions {
  /** Proves Hermes is reachable right now. A rejection is reported as ERROR. */
  verify: () => Promise<Verification>
  now?: () => number
  random?: () => number
  /** How often a healthy connection is re-verified while a client is active. */
  healthIntervalMs?: number
  /** A client counts as active for this long after its last API request. */
  activeWindowMs?: number
  backoffBaseMs?: number
  backoffMaxMs?: number
  /** Consecutive failed attempts before RECONNECTING becomes DISCONNECTED (retries continue). */
  disconnectedAfter?: number
}

export interface AgentStatus {
  state: AgentConnectionState
  /** True only for a CONNECTED state whose last verification is recent. Never true from a cache alone. */
  healthy: boolean
  /** True while a verification is running or about to run because the last one is old. */
  verifying: boolean
  since: string
  initializedAt?: string
  lastVerifiedAt?: string
  verifiedAgeMs?: number
  lastError?: string
  consecutiveFailures: number
  nextAttemptInMs?: number
  counters: {
    initializations: number
    duplicateInitializations: number
    verifications: number
    connectionsLost: number
    reconnections: number
    activeConnections: number
  }
  timings: { initializationMs?: number; lastVerificationMs?: number }
}

export class AgentManager {
  private readonly verify: () => Promise<Verification>
  private readonly now: () => number
  private readonly random: () => number
  private readonly healthIntervalMs: number
  private readonly activeWindowMs: number
  private readonly backoffBaseMs: number
  private readonly backoffMaxMs: number
  private readonly disconnectedAfter: number

  private state: AgentConnectionState = 'NOT_INITIALIZED'
  private since: number
  private initializedAt?: number
  private initStartedAt?: number
  private lastVerifiedAt?: number
  private lastError?: string
  private lastActivity = 0
  private failures = 0
  private everConnected = false
  private stopped = false
  private timer?: NodeJS.Timeout
  private nextAttemptAt?: number
  private initialization?: Promise<AgentStatus>
  private running?: Promise<void>
  private readonly counters = { initializations: 0, duplicateInitializations: 0, verifications: 0, connectionsLost: 0, reconnections: 0 }
  private readonly timings: { initializationMs?: number; lastVerificationMs?: number } = {}
  private readonly logReuse = createRateLimitedLog('AgentManager', 'Reusing existing connection')

  constructor(options: AgentManagerOptions) {
    this.verify = options.verify
    this.now = options.now ?? Date.now
    this.random = options.random ?? Math.random
    this.healthIntervalMs = options.healthIntervalMs ?? 30_000
    this.activeWindowMs = options.activeWindowMs ?? 120_000
    this.backoffBaseMs = options.backoffBaseMs ?? 2_000
    this.backoffMaxMs = options.backoffMaxMs ?? 60_000
    this.disconnectedAfter = options.disconnectedAfter ?? 3
    this.since = this.now()
  }

  /**
   * Verifies Hermes for the first time. Idempotent: callers that arrive while it runs share the
   * same promise, and calls after it finished return the current status without verifying again.
   */
  initialize(): Promise<AgentStatus> {
    if (this.initialization) {
      this.counters.duplicateInitializations += 1
      return this.initialization
    }
    if (this.state !== 'NOT_INITIALIZED') {
      this.counters.duplicateInitializations += 1
      this.logReuse({ state: this.state })
      return Promise.resolve(this.status())
    }
    this.initialization = this.runInitialization().finally(() => { this.initialization = undefined })
    return this.initialization
  }

  /**
   * Records that a browser is using the API. Never re-initializes. If the connection has not been
   * verified for a while (the monitor sleeps when nobody is looking), it verifies once, now.
   */
  touch(): void {
    this.lastActivity = this.now()
    if (this.stopped) return
    if (this.state === 'NOT_INITIALIZED') { void this.initialize(); return }
    if (this.running || this.timer) return
    const age = this.lastVerifiedAt === undefined ? Infinity : this.now() - this.lastVerifiedAt
    // A client came back after the monitor slept: verify soon, then resume the normal cadence.
    if (this.failures === 0 && age >= this.healthIntervalMs) this.schedule(0)
    else if (this.failures > 0) this.schedule(this.backoffBaseMs)
  }

  /** Stops the monitor. In-flight verification results are ignored. */
  stop(): void {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    this.nextAttemptAt = undefined
    logEvent('AgentManager', 'Stopped')
  }

  status(): AgentStatus {
    const now = this.now()
    const verifiedAgeMs = this.lastVerifiedAt === undefined ? undefined : now - this.lastVerifiedAt
    const fresh = verifiedAgeMs !== undefined && verifiedAgeMs <= this.healthIntervalMs * 3
    return {
      state: this.state,
      healthy: this.state === 'CONNECTED' && fresh,
      verifying: this.running !== undefined || (this.state === 'CONNECTED' && !fresh),
      since: new Date(this.since).toISOString(),
      ...(this.initializedAt !== undefined ? { initializedAt: new Date(this.initializedAt).toISOString() } : {}),
      ...(this.lastVerifiedAt !== undefined ? { lastVerifiedAt: new Date(this.lastVerifiedAt).toISOString(), verifiedAgeMs } : {}),
      ...(this.lastError ? { lastError: this.lastError } : {}),
      consecutiveFailures: this.failures,
      ...(this.nextAttemptAt !== undefined ? { nextAttemptInMs: Math.max(0, this.nextAttemptAt - now) } : {}),
      counters: { ...this.counters, activeConnections: this.state === 'CONNECTED' ? 1 : 0 },
      timings: { ...this.timings },
    }
  }

  private transition(next: AgentConnectionState, fields?: Record<string, string | number | undefined>): void {
    if (next === this.state) return
    const previous = this.state
    this.state = next
    this.since = this.now()
    logEvent('AgentManager', `State ${previous} -> ${next}`, fields)
  }

  private async runInitialization(): Promise<AgentStatus> {
    this.counters.initializations += 1
    this.initStartedAt = this.now()
    this.transition('INITIALIZING')
    logEvent('AgentManager', 'Initializing Hermes connection')
    await this.attempt()
    return this.status()
  }

  /** One verification, shared by every caller that arrives while it runs. */
  private attempt(): Promise<void> {
    if (this.running) return this.running
    this.running = this.runAttempt().finally(() => { this.running = undefined })
    return this.running
  }

  private async runAttempt(): Promise<void> {
    const started = this.now()
    this.counters.verifications += 1
    this.nextAttemptAt = undefined
    let outcome: Verification | undefined
    let crashed: string | undefined
    try { outcome = await this.verify() } catch (error) { crashed = error instanceof Error ? error.message : 'Verification failed.' }
    if (this.stopped) return
    this.timings.lastVerificationMs = this.now() - started
    if (outcome?.ok) { this.onVerified(); return }
    this.onFailed(crashed !== undefined ? 'ERROR' : 'FAILED', crashed ?? outcome?.detail ?? 'Hermes could not be reached.')
  }

  private onVerified(): void {
    const recovered = this.everConnected && this.state !== 'CONNECTED'
    this.failures = 0
    this.lastError = undefined
    this.lastVerifiedAt = this.now()
    if (this.initializedAt === undefined) {
      this.initializedAt = this.lastVerifiedAt
      this.timings.initializationMs = this.lastVerifiedAt - (this.initStartedAt ?? this.lastVerifiedAt)
      logEvent('AgentManager', 'Hermes connection established', { durationMs: this.timings.initializationMs })
    }
    this.everConnected = true
    if (recovered) {
      this.counters.reconnections += 1
      logEvent('AgentManager', 'Connection restored')
    }
    this.transition('CONNECTED')
    this.scheduleNextHealthCheck()
  }

  private onFailed(kind: 'ERROR' | 'FAILED', detail: string): void {
    this.failures += 1
    this.lastError = detail
    if (this.state === 'CONNECTED') {
      this.counters.connectionsLost += 1
      logEvent('AgentManager', 'Connection lost', { reason: detail })
    }
    // A failed first verification means Hermes is simply not there. After a working connection,
    // the first misses read as a reconnection in progress; persistent ones as disconnected.
    const neverConnected = !this.everConnected
    const next: AgentConnectionState = kind === 'ERROR' ? 'ERROR' : neverConnected || this.failures >= this.disconnectedAfter ? 'DISCONNECTED' : 'RECONNECTING'
    this.transition(next, { failures: this.failures })
    this.scheduleAfterFailure()
  }

  /** Exponential backoff with +-25% jitter, capped. Only while a client is looking. */
  private scheduleAfterFailure(): void {
    if (this.stopped || !this.isActive()) return
    const exponential = Math.min(this.backoffMaxMs, this.backoffBaseMs * 2 ** Math.max(0, this.failures - 1))
    const delay = Math.round(exponential * (0.75 + this.random() * 0.5))
    logEvent('AgentManager', 'Reconnection attempt scheduled', { attempt: this.failures, inMs: delay })
    this.schedule(delay)
  }

  private scheduleNextHealthCheck(): void {
    if (this.stopped || !this.isActive()) return
    this.schedule(this.healthIntervalMs)
  }

  private isActive(): boolean { return this.now() - this.lastActivity <= this.activeWindowMs }

  private schedule(delayMs: number): void {
    if (this.timer) clearTimeout(this.timer)
    this.nextAttemptAt = this.now() + delayMs
    this.timer = setTimeout(() => {
      this.timer = undefined
      this.nextAttemptAt = undefined
      if (this.stopped) return
      void this.attempt()
    }, delayMs)
    this.timer.unref?.()
  }
}
