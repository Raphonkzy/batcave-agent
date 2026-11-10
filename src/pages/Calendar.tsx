import { useState } from 'react'
import { agentLabel, formatDateTime } from '../format.ts'
import { usePolling } from '../polling.ts'
import type { CalendarSnapshot, ScheduledJob } from '../types.ts'
import { Pill, Stat } from '../components/ui/Primitives.tsx'
import { MonthView } from './CalendarMonthView.tsx'

export { MonthView }

export function CalendarOverlayView() {
  const snapshot = usePolling<CalendarSnapshot>('/api/calendar', 30_000)
  const jobs = snapshot.status === 'ready' ? snapshot.data.jobs : undefined
  if (snapshot.status === 'pending') return <div className="text-muted">Loading cron jobs...</div>
  return jobs?.availability === 'available' ? <MonthView jobs={jobs.data} /> : null
}

function relativeNextRun(dateStr?: string): string {
  if (!dateStr) return '—'
  const target = new Date(dateStr).getTime()
  const now = Date.now()
  const diffMinutes = Math.round((target - now) / 60000)

  if (diffMinutes < 0) return `${Math.abs(diffMinutes)}m ago (overdue)`
  if (diffMinutes === 0) return 'shortly'
  if (diffMinutes < 60) return `in ${diffMinutes}m`
  const hours = Math.round(diffMinutes / 60)
  if (hours < 24) return `in ${hours}h`
  const days = Math.round(hours / 24)
  return `in ${days}d`
}

export function Calendar() {
  const snapshot = usePolling<CalendarSnapshot>('/api/calendar', 30_000)
  const [viewMode, setViewMode] = useState<'agenda' | 'month'>('agenda')
  const data = snapshot.status === 'ready' ? snapshot.data : undefined
  const jobs = data?.jobs
  const sorted = [...(jobs?.data ?? [])].sort((a, b) => (a.nextRun ?? '~').localeCompare(b.nextRun ?? '~'))

  // Group by day for agenda view
  const groups = new Map<string, ScheduledJob[]>()
  for (const job of sorted) {
    let day = 'Unscheduled'
    if (job.nextRun) {
      const d = new Date(job.nextRun)
      day = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    }
    if (!groups.has(day)) groups.set(day, [])
    groups.get(day)!.push(job)
  }

  const nextJob = sorted.find((j) => j.nextRun && new Date(j.nextRun).getTime() > Date.now())

  return (
    <div className="mo-page-calendar">
      <header className="mo-page-header">
        <div className="mo-header-with-actions">
          <div>
            <h1 className="mo-page-title">Calendar & Schedules</h1>
            <p className="mo-page-description">
              Chronological agenda and recurring schedule view of Hermes cron jobs.
            </p>
          </div>

          <div className="mo-segmented">
            <button
              type="button"
              className={`mo-segmented-item ${viewMode === 'agenda' ? 'active' : ''}`}
              onClick={() => setViewMode('agenda')}
            >
              Agenda View
            </button>
            <button
              type="button"
              className={`mo-segmented-item ${viewMode === 'month' ? 'active' : ''}`}
              onClick={() => setViewMode('month')}
            >
              Month View
            </button>
          </div>
        </div>
      </header>

      {/* Top Banner: Next Run Big Relative Stat */}
      {nextJob && (
        <div className="mo-panel mo-next-run-banner">
          <Stat
            label="NEXT EXECUTION"
            value={relativeNextRun(nextJob.nextRun)}
            sub={`${nextJob.name} (${nextJob.schedule}) · ${formatDateTime(nextJob.nextRun)}`}
          />
        </div>
      )}

      {viewMode === 'month' && jobs?.availability === 'available' && (
        <div className="mo-month-wrapper">
          <MonthView jobs={jobs.data} />
        </div>
      )}

      {viewMode === 'agenda' && (
        <div className="mo-agenda-list">
          {Array.from(groups.entries()).map(([day, dayJobs]) => (
            <div key={day} className="mo-agenda-day-group">
              <div className="mo-agenda-day-header">
                <span className="mo-agenda-day-title">{day}</span>
                <span className="mo-agenda-day-tally">{dayJobs.length} tasks</span>
              </div>

              <div className="mo-agenda-items">
                {dayJobs.map((job) => (
                  <div key={`${job.agent ?? ''}:${job.id ?? job.name}`} className="mo-agenda-row">
                    <div className="mo-agenda-time font-mono">
                      {job.nextRun ? new Date(job.nextRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>

                    <div className="mo-agenda-info">
                      <div className="mo-agenda-title-row">
                        <span className="mo-agenda-job-name">{job.name}</span>
                        {job.agent && <span className="mo-agent-tag">{agentLabel(job.agent)}</span>}
                      </div>
                      <div className="mo-agenda-cron-spec font-mono">
                        <code>{job.schedule}</code>
                        {job.repeat && <span> · repeats {job.repeat}</span>}
                      </div>
                    </div>

                    <div className="mo-agenda-relative">
                      <span className="mo-relative-badge font-mono">{relativeNextRun(job.nextRun)}</span>
                    </div>

                    <div className="mo-agenda-status">
                      <Pill variant={job.status === 'active' ? 'accent' : 'muted'}>
                        {job.status || 'Scheduled'}
                      </Pill>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {sorted.length === 0 && (
            <div className="mo-empty-state">
              <p>No scheduled cron jobs reported by Hermes.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
