import { useEffect, useState } from 'react'
import { usePolling, type Polled, type PollingOptions } from '../polling.ts'
import type { OfficeSnapshot } from '../types.ts'
import { CYCLE_STEP_MS, cycleCount, mockOffice, parseMockRequest } from './mockAgents.ts'
// The front-end data layer for the crew: the live `/api/office` snapshot, or, in development
// builds only, a mock crew when the URL says `?mockAgents=N` (or `?mockAgents=cycle` to grow from
// 1 to 40 agents and shrink back, for stress tests). In production `import.meta.env.DEV` is false,
// so the mock branch and the mock module are dropped from the bundle.
function useMockCount(): number | null {
  const request = import.meta.env.DEV && typeof window !== 'undefined' ? parseMockRequest(window.location.search) : null
  const cycling = request?.kind === 'cycle'
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (!cycling) return
    const timer = window.setInterval(() => setStep((value) => value + 1), CYCLE_STEP_MS)
    return () => window.clearInterval(timer)
  }, [cycling])
  if (!request) return null
  return request.kind === 'cycle' ? cycleCount(step) : request.count
}
export function useAgents(options?: PollingOptions): Polled<OfficeSnapshot> {
  const live = usePolling<OfficeSnapshot>('/api/office', 10_000, options)
  const mock = useMockCount()
  if (import.meta.env.DEV && mock !== null) return { status: 'ready', data: mockOffice(mock), refreshing: false, refresh: live.refresh }
  return live
}
