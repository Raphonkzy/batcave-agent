import { useState } from 'react'
import { usePolling } from '../polling.ts'
import type { ActivitySnapshot } from '../types.ts'
import { Icon, Pill } from '../components/ui/Primitives.tsx'

export function Activity() {
  const snapshot = usePolling<ActivitySnapshot>('/api/activity', 15_000)
  const [query, setQuery] = useState('')
  const data = snapshot.status === 'ready' ? snapshot.data : undefined
  const sessions = data?.sessions
  const needle = query.trim().toLowerCase()
  const visible = (sessions?.data ?? []).filter(
    (s) =>
      !needle ||
      `${s.title} ${s.preview} ${s.workspace ?? ''} ${s.source ?? ''}`.toLowerCase().includes(needle)
  )

  return (
    <div className="mo-page-activity">
      <header className="mo-page-header">
        <h1 className="mo-page-title">Activity</h1>
        <p className="mo-page-description">
          Stream aktivitas sesi interaksi langsung dari engine Hermes dan session feed.
        </p>
      </header>

      {/* Hairline Toolbar */}
      <div className="mo-filter-bar">
        <div className="mo-filter-tally">
          <strong>{visible.length}</strong> sesi interaksi
        </div>

        <div className="mo-search-box">
          <Icon name="search" size={16} />
          <input
            type="text"
            placeholder="Cari aktivitas atau workspace…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mo-search-input"
          />
        </div>
      </div>

      {/* Vertical Timeline Stream */}
      <div className="mo-timeline-stream">
        {visible.map((session) => (
          <div key={session.id ?? `${session.title}-${session.lastActive}`} className="mo-timeline-node">
            <div className="mo-timeline-bullet" />
            <div className="mo-timeline-content">
              <div className="mo-timeline-head">
                <span className="mo-timeline-time font-mono">{session.lastActive}</span>
                {session.source && <Pill variant="accent">{session.source}</Pill>}
                {session.workspace && (
                  <span className="mo-timeline-workspace font-mono text-muted">{session.workspace}</span>
                )}
              </div>

              <div className="mo-timeline-title">{session.title}</div>
              {session.preview && session.preview !== session.title && (
                <div className="mo-timeline-preview">{session.preview}</div>
              )}

              {session.id && (
                <div className="mo-timeline-id font-mono text-muted">ID: {session.id}</div>
              )}
            </div>
          </div>
        ))}

        {visible.length === 0 && (
          <div className="mo-empty-state">
            <p>Tidak ada sesi aktivitas yang tercatat saat ini.</p>
          </div>
        )}
      </div>
    </div>
  )
}
