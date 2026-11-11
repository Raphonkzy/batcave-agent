import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react'
import { readPath, refreshOnTick, retain, subscribeToPath, type Polled } from './data-store.ts'

export type { Polled } from './data-store.ts'

/** Incremented by the header refresh control; every mounted poller refetches once when it changes. */
export const RefreshContext = createContext(0)

export interface PollingOptions {
  /** Keep showing what is known but neither fetch nor poll (a hidden, kept-alive page). */
  paused?: boolean
}

/**
 * Reads an API path through the shared data store (see data-store.ts). Components that read the
 * same path share one copy of the data, one in-flight request and one timer; the data stays
 * available after the component unmounts. `intervalMs` 0 reads once and re-reads on a manual
 * refresh or when a later mount finds the data older than a minute.
 */
export function usePolling<T>(path: string, intervalMs = 15_000, options: PollingOptions = {}): Polled<T> {
  const paused = options.paused ?? false
  const tick = useContext(RefreshContext)
  const subscribe = useCallback((listener: () => void) => subscribeToPath(path, listener), [path])
  const snapshot = useCallback(() => readPath<T>(path), [path])
  const view = useSyncExternalStore(subscribe, snapshot, snapshot)
  useEffect(() => (paused ? undefined : retain(path, intervalMs, tick)), [path, intervalMs, paused]) // eslint-disable-line react-hooks/exhaustive-deps -- `tick` is applied by the effect below, so a refresh never restarts the reader
  useEffect(() => { if (!paused) refreshOnTick(path, tick) }, [path, tick, paused])
  return view
}
