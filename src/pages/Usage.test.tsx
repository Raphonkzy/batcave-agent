import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Usage } from './Usage.tsx'
import { usePolling } from '../polling.ts'
import type { UsageSnapshot } from '../types.ts'

vi.mock('../polling.ts', () => ({ usePolling: vi.fn() }))
const snapshot: UsageSnapshot = {
  days: 7, fetchedAt: '2026-11-10',
  agents: [
    { agent: 'small', availability: 'available', usage: { days: 7, sessions: 1, messages: 1, toolCalls: 0, inputTokens: 10, outputTokens: 15, totalTokens: 25, models: [], sources: [], tools: [] } },
    { agent: 'large', availability: 'available', usage: { days: 7, sessions: 1, messages: 1, toolCalls: 0, inputTokens: 30, outputTokens: 45, totalTokens: 75, models: [], sources: [], tools: [] } },
    { agent: 'offline', availability: 'unavailable', error: 'CLI offline' },
  ],
  totals: { sessions: 2, messages: 2, toolCalls: 0, inputTokens: 40, outputTokens: 60, totalTokens: 100 },
  models: [], sources: [], tools: [],
}
beforeEach(() => vi.mocked(usePolling).mockReturnValue({ status: 'ready', data: snapshot, refreshing: false, refresh: vi.fn() }))

describe('active Usage page', () => {
  it('renders real per-agent shares instead of an invented trend and finds the largest consumer', () => {
    const html = renderToStaticMarkup(<Usage/>)
    expect(usePolling).toHaveBeenCalledWith('/api/usage?days=7', 60_000)
    expect(html).toContain('TOKEN CONSUMPTION BY AGENT')
    expect(html).toContain('width:75%')
    expect(html).toContain('width:25%')
    expect(html).toContain('Top consumer: large')
    expect(html).toContain('Not Available')
    expect(html).not.toContain('<svg')
    expect(html).not.toContain('ACTIVE')
  })

  it('does not invent zero cost or chart data while loading or failing', () => {
    vi.mocked(usePolling).mockReturnValue({ status: 'pending', refreshing: true, refresh: vi.fn() })
    expect(renderToStaticMarkup(<Usage/>)).toContain('Reading hermes insights')
    expect(renderToStaticMarkup(<Usage/>)).not.toContain('$0.00')
    vi.mocked(usePolling).mockReturnValue({ status: 'failed', message: 'offline', refreshing: false, refresh: vi.fn() })
    expect(renderToStaticMarkup(<Usage/>)).toContain('Not Available — offline')
  })

  it('labels stale data and empty results explicitly', () => {
    vi.mocked(usePolling).mockReturnValue({ status: 'ready', data: { ...snapshot, agents: [] }, stale: true, refreshing: false, refresh: vi.fn() })
    const html = renderToStaticMarkup(<Usage/>)
    expect(html).toContain('showing last successful snapshot')
    expect(html).toContain('No agent data available')
  })
})
