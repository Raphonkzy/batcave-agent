import { useState } from 'react'
import { formatCompact, formatNumber } from '../format.ts'
import { usePolling } from '../polling.ts'
import type { UsageSnapshot } from '../types.ts'
import { USAGE_PERIODS, formatCost, type Period } from '../usage.ts'
import { Stat, SegmentedControl } from '../components/ui/Primitives.tsx'

export function Usage() {
  const [days, setDays] = useState<Period>(7)
  const usage = usePolling<UsageSnapshot>(`/api/usage?days=${days}`, 60_000)
  const data = usage.status === 'ready' && Array.isArray(usage.data.agents) ? usage.data : undefined
  const totals = data?.totals

  const topModel = data?.models && data.models.length > 0 ? data.models[0].model : 'None'
  const agents = [...(data?.agents ?? [])].sort((a, b) => (b.usage?.totalTokens ?? 0) - (a.usage?.totalTokens ?? 0))
  const topAgent = agents.find((a) => (a.usage?.totalTokens ?? 0) > 0)
  const modelTotal = (data?.models ?? []).reduce((sum, m) => sum + m.tokens, 0)

  return (
    <div className="mo-page-usage">
      <header className="mo-page-header">
        <div className="mo-header-with-actions">
          <div>
            <h1 className="mo-page-title">Usage & Tokens</h1>
            <p className="mo-page-description">
              LLM token and compute consumption metrics from <code>hermes insights</code> across all agents.
            </p>
          </div>

          <div className="mo-period-selector">
            <SegmentedControl
              options={USAGE_PERIODS.map((p) => ({
                label: p === 1 ? '24 Hours' : `${p} Days`,
                value: p.toString(),
              }))}
              value={days.toString()}
              onChange={(val) => setDays(Number(val) as Period)}
            />
          </div>
        </div>
      </header>

      {/* 1. Three Big Numbers on top */}
      <div className="mo-metrics-top-row">
        <div className="mo-stat-card">
          <Stat
            label="TOTAL TOKENS"
            value={totals ? formatCompact(totals.totalTokens) : '—'}
            sub={totals ? `${formatCompact(totals.inputTokens)} in / ${formatCompact(totals.outputTokens)} out` : ''}
          />
        </div>
        <div className="mo-stat-card">
          <Stat
            label="ESTIMATED COST"
            value={totals ? formatCost(totals.costUsd) : '—'}
            sub={totals ? `${formatNumber(totals.sessions)} conversation sessions` : ''}
          />
        </div>
        <div className="mo-stat-card">
          <Stat
            label="TOP MODEL"
            value={topModel}
            sub={topAgent ? `Top consumer: ${topAgent.agent}` : ''}
          />
        </div>
      </div>

      {/* Hermes reports period aggregates, not a time series. */}
      <div className="mo-chart-container">
        <div className="mo-chart-header">
          <span className="mo-chart-title">TOKEN CONSUMPTION BY AGENT</span>
          <span className="mo-chart-badge">LAST {days === 1 ? '24 HOURS' : `${days} DAYS`}</span>
        </div>
        {usage.status === 'pending' && <p role="status">Reading hermes insights for every agent…</p>}
        {usage.status === 'failed' && <p role="alert">Not Available — {usage.message}</p>}
        {usage.status === 'ready' && usage.stale && <p role="status">Refresh failed — showing last successful snapshot.</p>}
        <div className="mo-model-table" role="list" aria-label="Tokens by agent">
          {agents.map((agent) => {
            const tokens = agent.usage?.totalTokens
            const pct = totals && totals.totalTokens > 0 && tokens !== undefined ? (tokens / totals.totalTokens) * 100 : 0
            return <div key={agent.agent} className="mo-model-row" role="listitem" title={tokens === undefined ? agent.error : `${agent.agent}: ${formatNumber(tokens)} tokens`}>
              <span className="mo-model-name font-mono">{agent.agent}</span>
              <span className="mo-model-tokens font-mono">{tokens === undefined ? 'Not Available' : formatCompact(tokens)}</span>
              <div className="mo-model-bar-track"><div className="mo-model-bar-fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}/></div>
              <span className="mo-model-pct">{tokens === undefined ? '—' : `${Math.round(pct)}%`}</span>
            </div>
          })}
        </div>
        {data && agents.length === 0 && <p className="mo-empty-state">No agent data available for this time range.</p>}
        {data && agents.length > 0 && agents.every((agent) => agent.usage?.totalTokens === 0) && <p className="mo-empty-state">No sessions in this period.</p>}
      </div>

      {/* 3. Breakdown per Model with Thin Inline Bars */}
      <div className="mo-usage-table-section">
        <h2 className="mo-section-heading">Breakdown per Model</h2>
        <div className="mo-model-table">
          {(data?.models ?? []).slice(0, 8).map((model) => {
            const pct = modelTotal > 0 ? Math.round((model.tokens / modelTotal) * 100) : 0
            return (
              <div key={model.model} className="mo-model-row">
                <span className="mo-model-name font-mono">{model.model}</span>
                <span className="mo-model-tokens font-mono">{formatCompact(model.tokens)}</span>
                <div className="mo-model-bar-track">
                  <div className="mo-model-bar-fill" style={{ width: `${Math.max(0, pct)}%` }} />
                </div>
                <span className="mo-model-pct">{pct}%</span>
              </div>
            )
          })}
          {(!data || data.models.length === 0) && (
            <div className="mo-empty-state">
              <p>No model data available for this time range.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
