import { useEffect, useRef, useState } from 'react'
import { formatTime } from '../format.ts'
import { usePolling } from '../polling.ts'
import type { CommandLogSnapshot, LogLevel, LogsSnapshot } from '../types.ts'
import { Icon, SegmentedControl } from '../components/ui/Primitives.tsx'

const LEVELS: ('ALL' | LogLevel)[] = ['ALL', 'ERROR', 'WARNING', 'INFO', 'DEBUG']
const MISSION_CONTROL = 'mission-control'

function getInitialQuery(): string {
  if (typeof window === 'undefined') return ''
  const hash = window.location.hash
  const match = hash.match(/[?&]agent=([^&]+)/)
  if (match) return decodeURIComponent(match[1])
  const searchMatch = window.location.search.match(/[?&]agent=([^&]+)/)
  if (searchMatch) return decodeURIComponent(searchMatch[1])
  return ''
}

export function Logs() {
  const [follow, setFollow] = useState(true)
  const logs = usePolling<LogsSnapshot>('/api/logs', follow ? 5_000 : 0)
  const commands = usePolling<CommandLogSnapshot>('/api/command-log', follow ? 5_000 : 0)
  const [tab, setTab] = useState('agent')
  const [level, setLevel] = useState<'ALL' | LogLevel>('ALL')
  const [query, setQuery] = useState(getInitialQuery)
  const viewer = useRef<HTMLPreElement>(null)

  const data = logs.status === 'ready' ? logs.data : undefined
  const file = data?.files.find((item) => item.name === tab)
  const needle = query.trim().toLowerCase()
  const lines = (file?.source.data ?? []).filter(
    (line) => (level === 'ALL' || line.level === level) && (!needle || line.text.toLowerCase().includes(needle))
  )
  const commandData = commands.status === 'ready' ? commands.data : undefined

  useEffect(() => {
    if (follow && viewer.current) viewer.current.scrollTop = viewer.current.scrollHeight
  }, [follow, lines.length, tab])

  const tabs = [
    ...(data?.files.map((item) => ({
      name: item.name,
      label: item.label,
      count: item.source.data.filter((line) => line.level === 'ERROR').length,
    })) ?? []),
    { name: MISSION_CONTROL, label: 'Command Audit', count: commandData?.health.failed ?? 0 },
  ]

  return (
    <div className="mo-page-logs">
      <header className="mo-page-header">
        <div className="mo-header-with-actions">
          <div>
            <h1 className="mo-page-title">System Logs</h1>
            <p className="mo-page-description">
              Streaming tail from <code>hermes logs</code> (agent, gateway, error) with automatic sensitive string redaction.
            </p>
          </div>

          <div className="mo-logs-tabs-wrapper">
            <div className="mo-segmented">
              {tabs.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  className={`mo-segmented-item ${tab === t.name ? 'active' : ''}`}
                  onClick={() => setTab(t.name)}
                >
                  {t.label}
                  {t.count > 0 && <span className="mo-error-dot">●</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Toolbar: Segmented Level Filter + Follow Toggle + Search */}
      <div className="mo-filter-bar">
        <div className="mo-filter-tally">
          <SegmentedControl
            options={LEVELS.map((lvl) => ({ label: lvl, value: lvl }))}
            value={level}
            onChange={(val) => setLevel(val as 'ALL' | LogLevel)}
          />
        </div>

        <div className="mo-filter-controls">
          <div className="mo-search-box">
            <Icon name="search" size={16} />
            <input
              type="text"
              placeholder="Filter log text…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mo-search-input"
            />
          </div>

          <button
            type="button"
            className={`mo-btn mo-btn-sm ${follow ? 'mo-btn-primary' : 'mo-btn-ghost'}`}
            onClick={() => setFollow(!follow)}
            title="Auto-scroll to latest output"
          >
            {follow ? 'Following live (5 s)' : 'Follow live'}
          </button>
        </div>
      </div>

      {/* Full-Height Monospace Panel */}
      <div className="mo-logs-container mo-panel">
        {tab === MISSION_CONTROL ? (
          <div className="mo-audit-pane">
            <div className="mo-audit-stats font-mono text-muted" style={{ marginBottom: 16 }}>
              Total Reads: {commandData?.health.total ?? 0} · Failed: {commandData?.health.failed ?? 0} · Average: {commandData?.health.averageMs ?? 0} ms
            </div>
            <div className="mo-audit-table-wrapper">
              <table className="mo-table font-mono">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>CLI Command</th>
                    <th>Status</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {(commandData?.entries ?? []).map((entry, idx) => (
                    <tr key={`${entry.at}-${idx}`}>
                      <td>{formatTime(entry.at)}</td>
                      <td><code>{entry.command}</code></td>
                      <td>
                        <span className={`mo-tag ${entry.ok ? 'good' : 'bad'}`}>
                          {entry.ok ? 'OK' : 'ERROR'}
                        </span>
                      </td>
                      <td>{entry.durationMs} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <pre className="mo-log-viewer font-mono" ref={viewer} tabIndex={0}>
            {lines.map((line, idx) => {
              const lvl = line.level.toLowerCase()
              return (
                <div key={idx} className={`mo-log-line lvl-${lvl}`}>
                  <span className="mo-log-lvl-badge">[{line.level}]</span>
                  <span className="mo-log-text">{line.text}</span>
                </div>
              )
            })}
            {lines.length === 0 && (
              <div className="mo-log-empty text-muted">
                (No logs match the current filter)
              </div>
            )}
          </pre>
        )}
      </div>
    </div>
  )
}
