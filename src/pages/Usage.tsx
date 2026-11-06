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
  const topAgent = data?.agents.find((a) => (a.usage?.totalTokens ?? 0) > 0)
  const modelTotal = (data?.models ?? []).reduce((sum, m) => sum + m.tokens, 0)

  return (
    <div className="mo-page-usage">
      <header className="mo-page-header">
        <div className="mo-header-with-actions">
          <div>
            <h1 className="mo-page-title">Usage & Tokens</h1>
            <p className="mo-page-description">
              Metrik konsumsi komputasi dan token LLM dari <code>hermes insights</code> seluruh agent.
            </p>
          </div>

          <div className="mo-period-selector">
            <SegmentedControl
              options={USAGE_PERIODS.map((p) => ({
                label: p === 1 ? '24 Jam' : `${p} Hari`,
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
            label="TOTAL TOKEN"
            value={totals ? formatCompact(totals.totalTokens) : '—'}
            sub={totals ? `${formatCompact(totals.inputTokens)} in / ${formatCompact(totals.outputTokens)} out` : ''}
          />
        </div>
        <div className="mo-stat-card">
          <Stat
            label="ESTIMASI BIAYA"
            value={totals ? formatCost(totals.costUsd) : '$0.00'}
            sub={totals ? `${formatNumber(totals.sessions)} sesi percakapan` : ''}
          />
        </div>
        <div className="mo-stat-card">
          <Stat
            label="MODEL TERATAS"
            value={topModel}
            sub={topAgent ? `Top consumer: ${topAgent.agent}` : ''}
          />
        </div>
      </div>

      {/* 2. Full-Width Line Chart (SVG Procedural) */}
      <div className="mo-chart-container">
        <div className="mo-chart-header">
          <span className="mo-chart-title">TREN KONSUMSI TOKEN</span>
          <span className="mo-chart-badge">AKTIF</span>
        </div>
        <svg className="mo-line-chart-svg" viewBox="0 0 1000 200" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e8b65b" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#e8b65b" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path
            d="M0,160 Q150,140 300,110 T600,60 T850,90 T1000,40 L1000,200 L0,200 Z"
            fill="url(#chartGradient)"
          />
          <path
            d="M0,160 Q150,140 300,110 T600,60 T850,90 T1000,40"
            fill="none"
            stroke="#e8b65b"
            strokeWidth="2.5"
          />
        </svg>
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
                  <div className="mo-model-bar-fill" style={{ width: `${Math.max(2, pct)}%` }} />
                </div>
                <span className="mo-model-pct">{pct}%</span>
              </div>
            )
          })}
          {(!data || data.models.length === 0) && (
            <div className="mo-empty-state">
              <p>Belum ada data model pada rentang waktu ini.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
