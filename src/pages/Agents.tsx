import { useState } from 'react'
import { agentLabel } from '../format.ts'
import type { OfficeSnapshot, RuntimeSnapshot } from '../types.ts'
import { usePolling } from '../polling.ts'
import { StatusDot, Pill, Icon } from '../components/ui/Primitives.tsx'

export function Agents({ runtime, pending = false }: { runtime: RuntimeSnapshot | null; pending?: boolean }) {
  const [filter, setFilter] = useState<'all' | 'active' | 'idle'>('all')
  const [search, setSearch] = useState('')
  const office = usePolling<OfficeSnapshot>('/api/office', 15_000)

  if (pending) {
    return (
      <div className="mo-page-loading">
        <p className="font-mono text-muted" style={{ marginBottom: 12 }}>Loading agent profiles…</p>
        <div className="mo-skeleton" style={{ height: 40, width: 200, marginBottom: 12 }} />
        <div className="mo-skeleton" style={{ height: 20, width: 340, marginBottom: 32 }} />
        <div className="mo-skeleton" style={{ height: 240 }} />
      </div>
    )
  }

  if (!runtime || runtime.profiles.availability === 'unavailable') {
    return (
      <div className="mo-empty-state">
        <h2>Agents Tidak Tersedia</h2>
        <p>Daftar profil Hermes tidak dapat dibaca dari server.</p>
      </div>
    )
  }

  const states = new Map(office.status === 'ready' ? office.data.stations.map((s) => [s.id, s]) : [])
  const openCode = runtime.openCode.availability === 'available' ? runtime.openCode.data : undefined

  const rawAgents = [
    ...runtime.profiles.data.map((profile) => ({
      id: profile.name,
      kind: 'Hermes profile',
      model: profile.model,
      gateway: profile.gateway,
    })),
    ...(openCode ? [{ id: 'opencode', kind: 'OpenCode (CLI)', model: openCode, gateway: undefined }] : []),
  ]

  const activeCount = rawAgents.filter((a) => {
    const st = states.get(a.id)
    return st && st.state !== 'Idle'
  }).length

  const filtered = rawAgents.filter((a) => {
    const st = states.get(a.id)
    const isIdle = !st || st.state === 'Idle'
    if (filter === 'active' && isIdle) return false
    if (filter === 'idle' && !isIdle) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return a.id.toLowerCase().includes(q) || a.model.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="mo-page-agents">
      <header className="mo-page-header">
        <h1 className="mo-page-title">Agents</h1>
        <p className="mo-page-description">
          Daftar seluruh profil Hermes agent yang aktif beroperasi pada workstation ini.
        </p>
      </header>

      {/* Filter and stats hairline bar */}
      <div className="mo-filter-bar">
        <div className="mo-filter-tally">
          <strong>{rawAgents.length}</strong> agent · <span className="text-accent">{activeCount} aktif</span>
        </div>

        <div className="mo-filter-controls">
          <div className="mo-segmented">
            <button
              type="button"
              className={`mo-segmented-item ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Semua
            </button>
            <button
              type="button"
              className={`mo-segmented-item ${filter === 'active' ? 'active' : ''}`}
              onClick={() => setFilter('active')}
            >
              Aktif
            </button>
            <button
              type="button"
              className={`mo-segmented-item ${filter === 'idle' ? 'active' : ''}`}
              onClick={() => setFilter('idle')}
            >
              Idle
            </button>
          </div>

          <div className="mo-search-box">
            <Icon name="search" size={16} />
            <input
              type="text"
              placeholder="Cari agent atau model…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mo-search-input"
            />
          </div>
        </div>
      </div>

      {/* Hairline rows list */}
      <div className="mo-agent-list" role="list">
        {filtered.map((agent) => {
          const station = states.get(agent.id)
          const state = station?.state || 'Idle'
          const isLocked = station?.privacy === 'locked'

          return (
            <div key={agent.id} className="mo-agent-row-item" role="listitem">
              <div className="mo-agent-col-main">
                <StatusDot status={state} size={8} />
                <div className="mo-agent-info">
                  <span className="mo-agent-name">
                    {isLocked && '🔒 '}
                    {agentLabel(agent.id)}
                  </span>
                  <span className="mo-agent-kind">{agent.kind}</span>
                </div>
              </div>

              <div className="mo-agent-col-status">
                <Pill variant={state === 'Idle' ? 'muted' : 'accent'}>{state}</Pill>
              </div>

              <div className="mo-agent-col-model font-mono">{agent.model}</div>

              <div className="mo-agent-col-gateway">
                {agent.gateway ? (
                  <span className="mo-gateway-badge">{agent.gateway}</span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </div>

              <div className="mo-agent-col-action">
                <span className="text-muted">›</span>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="mo-empty-state">
            <p>Tidak ada agent yang cocok dengan filter atau pencarian saat ini.</p>
          </div>
        )}
      </div>
    </div>
  )
}
