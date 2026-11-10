import { useEffect, useRef, useState } from 'react'
import { formatDateTime, orderedStatuses } from '../format.ts'
import { usePolling } from '../polling.ts'
import { loadSnapshot, type RequestState } from '../request-state.ts'
import type { Task, TaskBoardSnapshot, TaskDetailSnapshot } from '../types.ts'
import { Dialog } from '../ui.tsx'
import { ProfileUnlock, RelockBar } from '../ProfileLock.tsx'
import { agentPrivacy, useProfileLock } from '../profile-lock.ts'
import { Icon, Pill } from '../components/ui/Primitives.tsx'

const UNASSIGNED = '(unassigned)'

function Field({ label, value }: { label: string; value?: string | number }) {
  return value === undefined || value === '' ? null : (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export function TaskDetailDialog({
  task,
  onClose,
  onOpenTask,
}: {
  task: Task
  onClose: () => void
  onOpenTask?: (id: string) => void
}) {
  const [state, setState] = useState<RequestState<TaskDetailSnapshot>>({ status: 'pending' })
  const lock = useProfileLock()
  const privacy = agentPrivacy(lock, task.assignee)
  const locked = privacy === 'locked' || (task.private === true && !lock)

  useEffect(() => {
    if (!task.id || locked) return
    let active = true
    setState({ status: 'pending' })
    void loadSnapshot<TaskDetailSnapshot>(
      `/api/tasks/${encodeURIComponent(task.id)}${task.board ? `?board=${encodeURIComponent(task.board)}` : ''}`
    ).then((next) => {
      if (active) setState(next)
    })
    return () => {
      active = false
    }
  }, [task.id, task.board, locked])

  const detail = state.status === 'ready' && state.data.task.availability === 'available' ? state.data.task.data : null
  const failed = !task.id || state.status === 'failed' || (state.status === 'ready' && !detail)
  const status = detail?.status ?? task.status
  const links = (label: string, ids: string[]) =>
    ids.length > 0 && (
      <div>
        <dt>{label}</dt>
        <dd className="task-links">
          {ids.map((id) => (
            <button type="button" key={id} className="chip chip-button" onClick={() => onOpenTask?.(id)}>
              {id}
            </button>
          ))}
        </dd>
      </div>
    )

  return (
    <Dialog labelledBy="task-detail-title" onClose={onClose} closeLabel={`Close details for ${task.title}`} className="task-detail mo-panel">
      <p className="eyebrow">
        KANBAN TASK{task.board ? ` · ${task.board.toUpperCase()} BOARD` : ''}{task.id ? ` · ${task.id}` : ''}
      </p>
      <h2 id="task-detail-title" className="mo-section-heading">{detail?.title ?? task.title}</h2>
      <div className="task-meta">
        <Pill variant="accent">{status}</Pill>
        <span className="text-muted">{detail?.assignee ?? task.assignee ?? 'unassigned'}</span>
        {(detail?.priority ?? task.priority) ? (
          <span className="mo-pill mo-pill-default">P{detail?.priority ?? task.priority}</span>
        ) : null}
      </div>

      {locked && task.assignee ? (
        <ProfileUnlock agent={task.assignee} minutes={lock?.unlockMinutes} compact />
      ) : (
        <>
          {privacy === 'unlocked' && task.assignee && (
            <RelockBar agent={task.assignee} minutes={lock?.unlockMinutes ?? 15} />
          )}
          {state.status === 'pending' && task.id && <p className="muted">Memuat rincian task…</p>}
          {failed && (
            <p className="file-notice">
              {task.id
                ? 'Detail lengkap tidak tersedia saat ini (hermes kanban show gagal dibaca). Menampilkan ringkasan.'
                : 'Task ini tidak memiliki ID.'}
            </p>
          )}
          {detail && (
            <>
              <dl className="office-detail-grid task-grid">
                <Field
                  label="Dibuat"
                  value={detail.createdAt ? `${formatDateTime(detail.createdAt)}${detail.createdBy ? ` oleh ${detail.createdBy}` : ''}` : undefined}
                />
                <Field label="Mulai" value={detail.startedAt && formatDateTime(detail.startedAt)} />
                <Field label="Selesai" value={detail.completedAt && formatDateTime(detail.completedAt)} />
                <Field label="Workspace" value={detail.workspace} />
                <Field label="Branch" value={detail.branch} />
                <Field label="Model" value={detail.model} />
                {links('Tergantung pada', detail.parents)}
                {links('Memblokir', detail.children)}
              </dl>
              {detail.body && (
                <section className="task-section">
                  <p className="eyebrow">DESKRIPSI</p>
                  <pre className="task-text">{detail.body}</pre>
                </section>
              )}
            </>
          )}
        </>
      )}
    </Dialog>
  )
}

export function TaskBoard() {
  const snapshot = usePolling<TaskBoardSnapshot>('/api/tasks', 10_000)
  const [query, setQuery] = useState('')
  const [assignee, setAssignee] = useState('all')
  const [board, setBoard] = useState('all')
  const [openTask, setOpenTask] = useState<Task | undefined>()
  const trigger = useRef<HTMLButtonElement | null>(null)

  const closeTask = () => {
    setOpenTask(undefined)
    trigger.current?.focus()
  }

  const data = snapshot.status === 'ready' ? snapshot.data : undefined
  const tasks = data?.tasks
  const all = tasks?.data ?? []
  const assignees = [...new Set(all.map((t) => t.assignee ?? UNASSIGNED))].sort()
  const boards = data?.boards ?? []
  const multiBoard = boards.length > 1
  const needle = query.trim().toLowerCase()
  const visible = all.filter(
    (t) =>
      (assignee === 'all' || (t.assignee ?? UNASSIGNED) === assignee) &&
      (board === 'all' || t.board === board) &&
      (!needle || `${t.title} ${t.id ?? ''} ${t.assignee ?? ''}`.toLowerCase().includes(needle))
  )
  const columns = orderedStatuses(all.map((t) => t.status), true)

  return (
    <div className="mo-page-taskboard">
      <header className="mo-page-header">
        <h1 className="mo-page-title">Task Board</h1>
        <p className="mo-page-description">
          Kanban board real-time dari <code>hermes kanban list</code>. Tampilan tugas terorganisir per tahapan proses.
        </p>
      </header>

      {/* Toolbar Hairline */}
      <div className="mo-filter-bar">
        <div className="mo-filter-tally">
          <strong>{visible.length}</strong> tugas ditampilkan
        </div>

        <div className="mo-filter-controls">
          <div className="mo-search-box">
            <Icon name="search" size={16} />
            <input
              type="text"
              placeholder="Cari tugas…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mo-search-input"
            />
          </div>

          <label className="mo-select-wrapper">
            <span className="mo-select-label">Assignee:</span>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="mo-select-input"
            >
              <option value="all">Semua ({all.length})</option>
              {assignees.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          {multiBoard && (
            <label className="mo-select-wrapper">
              <span className="mo-select-label">Board:</span>
              <select
                value={board}
                onChange={(e) => setBoard(e.target.value)}
                className="mo-select-input"
              >
                <option value="all">Semua board</option>
                {boards.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {/* Full-Width Kanban Columns separated by Hairline */}
      <div className="mo-kanban-board" role="region" aria-label="Kanban board">
        {columns.map((colStatus) => {
          const colTasks = visible
            .filter((t) => t.status === colStatus)
            .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

          return (
            <div key={colStatus} className="mo-kanban-col">
              <div className="mo-kanban-col-head">
                <span className="mo-col-title">{colStatus}</span>
                <span className="mo-col-count">{colTasks.length}</span>
              </div>

              <div className="mo-kanban-col-body">
                {colTasks.map((task) => {
                  const priorityColor =
                    task.priority === 1
                      ? 'var(--st-triage)'
                      : task.priority === 2
                      ? 'var(--st-deploying)'
                      : 'var(--st-working)'

                  return (
                    <div
                      key={`${task.board ?? ''}-${task.status}-${task.id ?? task.title}`}
                      className="mo-kanban-card"
                      onClick={() => setOpenTask(task)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="mo-card-title">{task.title}</div>
                      <div className="mo-card-footer">
                        <div className="mo-card-meta">
                          {task.priority ? (
                            <span className="mo-priority-badge" style={{ color: priorityColor }}>
                              ● P{task.priority}
                            </span>
                          ) : null}
                          <span className="mo-card-assignee">{task.assignee || 'unassigned'}</span>
                        </div>
                        {task.id && <span className="mo-card-id font-mono">{task.id}</span>}
                      </div>
                    </div>
                  )
                })}

                {colTasks.length === 0 && (
                  <div className="mo-col-empty">Tidak ada tugas</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {openTask && (
        <TaskDetailDialog
          task={openTask}
          onClose={closeTask}
          onOpenTask={(id) =>
            setOpenTask(all.find((t) => t.id === id && t.board === openTask.board) ?? { id, title: id, status: 'unknown' })
          }
        />
      )}
    </div>
  )
}
