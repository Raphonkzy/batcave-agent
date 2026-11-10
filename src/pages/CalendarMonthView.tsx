import { useState } from 'react'
import { dayKey, monthEntries, type CalendarEntry } from '../cron-calendar.ts'
import { agentLabel } from '../format.ts'
import type { ScheduledJob } from '../types.ts'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const KIND_LABEL: Record<CalendarEntry['kind'], string> = {
  run: 'Scheduled run',
  interval: 'Repeats through the day',
  overdue: 'Overdue',
  'last-ok': 'Last run · ok',
  'last-failed': 'Last run · failed',
}

function todayKey(): string {
  const now = new Date()
  return dayKey(now.getFullYear(), now.getMonth(), now.getDate())
}

export function MonthView({ jobs: allJobs }: { jobs: ScheduledJob[] }) {
  const today = todayKey()
  const agents = [...new Set(allJobs.map((job) => job.agent).filter((agent): agent is string => Boolean(agent)))]
  const [agent, setAgent] = useState('')
  const jobs = agent ? allJobs.filter((job) => job.agent === agent) : allJobs
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selected, setSelected] = useState(today)
  const entries = monthEntries(jobs, cursor.year, cursor.month, today)
  const first = new Date(cursor.year, cursor.month, 1)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(cursor.year, cursor.month + 1, 0).getDate()
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)]
  const move = (delta: number) =>
    setCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  const selectedEntries = entries.get(selected) ?? []

  return (
    <section className="month-view mo-panel" aria-label="Cron calendar">
      <header className="month-head">
        <button type="button" className="icon-button" onClick={() => move(-1)} aria-label="Previous month">
          ‹
        </button>
        <h2>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <button type="button" className="icon-button" onClick={() => move(1)} aria-label="Next month">
          ›
        </button>
        <button
          type="button"
          className="refresh-button"
          onClick={() => {
            const now = new Date()
            setCursor({ year: now.getFullYear(), month: now.getMonth() })
            setSelected(today)
          }}
        >
          Today
        </button>
        {agents.length > 1 && (
          <label className="month-filter">
            <span>Agent</span>
            <select value={agent} onChange={(event) => setAgent(event.target.value)}>
              <option value="">All agents ({allJobs.length})</option>
              {agents.map((item) => (
                <option key={item} value={item}>
                  {agentLabel(item)} ({allJobs.filter((job) => job.agent === item).length})
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      <div className="month-grid" role="grid">
        {WEEKDAYS.map((day) => (
          <div key={day} className="month-weekday" role="columnheader">
            {day}
          </div>
        ))}
        {cells.map((day, index) => {
          if (day === null) return <div key={`lead-${index}`} className="month-cell empty" aria-hidden="true" />
          const key = dayKey(cursor.year, cursor.month, day)
          const list = entries.get(key) ?? []
          return (
            <button
              type="button"
              role="gridcell"
              key={key}
              className={`month-cell${key === today ? ' today' : ''}${key === selected ? ' selected' : ''}${key < today ? ' past' : ''}`}
              onClick={() => setSelected(key)}
              aria-label={`${key}: ${list.length} item${list.length === 1 ? '' : 's'}`}
              aria-selected={key === selected}
            >
              <span className="month-day">{day}</span>
              {list.slice(0, 3).map((entry, entryIndex) => (
                <span key={entryIndex} className={`month-entry kind-${entry.kind}`} title={`${entry.job} · ${KIND_LABEL[entry.kind]}`}>
                  <b>{entry.label}</b> {entry.job}
                </span>
              ))}
            </button>
          )
        })}
      </div>
      <div className="month-day-detail">
        <p className="eyebrow">
          {new Date(`${selected}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        {selectedEntries.length === 0 ? (
          <p className="muted">Nothing scheduled on this day.</p>
        ) : (
          <ul>
            {selectedEntries.map((entry, index) => (
              <li key={index}>
                <span className={`badge kind-${entry.kind}`}>{KIND_LABEL[entry.kind]}</span>
                <strong>{entry.job}</strong>
                <span className="muted">{entry.label}</span>
                {entry.agent && <span className="chip">{agentLabel(entry.agent)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
