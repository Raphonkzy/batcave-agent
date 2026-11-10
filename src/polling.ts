import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { loadSnapshot, mergeRefresh, type RequestState } from './request-state.ts'

/** Incremented by the header refresh control; every poller refetches when it changes. */
export const RefreshContext = createContext(0)

export type Polled<T> = RequestState<T> & { refreshing: boolean; refresh: () => void }

export function usePolling<T>(path: string, intervalMs = 15_000): Polled<T> {
  const [result, setResult] = useState<{ path: string; state: RequestState<T> }>({ path, state: { status: 'pending' } })
  const state: RequestState<T> = result.path === path ? result.state : { status: 'pending' }
  const [refreshing, setRefreshing] = useState(false)
  const tick = useContext(RefreshContext)
  const generation = useRef(0)
  const controller = useRef<AbortController | undefined>(undefined)

  const load = useCallback(async (fresh = false) => {
    const id = ++generation.current
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    setRefreshing(true)
    const next = await loadSnapshot<T>(fresh ? `${path}${path.includes('?') ? '&' : '?'}fresh=1` : path, fetch, request.signal)
    if (request.signal.aborted || id !== generation.current) return
    setResult((previous) => ({ path, state: mergeRefresh(previous.path === path ? previous.state : { status: 'pending' }, next) }))
    setRefreshing(false)
  }, [path])

  useEffect(() => {
    void load(tick > 0)
    return () => { controller.current?.abort() }
  }, [load, tick])

  useEffect(() => {
    if (intervalMs <= 0) return
    const timer = setInterval(() => { if (typeof document === 'undefined' || !document.hidden) void load() }, intervalMs)
    return () => clearInterval(timer)
  }, [load, intervalMs])

  return { ...state, refreshing, refresh: () => { void load(true) } } as Polled<T>
}
