import { useEffect, useState } from 'react'
import { LOCKED_EVENT } from '../access.ts'
import { formatBytes, formatDateTime } from '../format.ts'
import { usePolling } from '../polling.ts'
import type { RequestState } from '../request-state.ts'
import type { FolderAgent, FolderAgentsSnapshot, FolderFile, FolderListing } from '../types.ts'
import { EmptyState, LoadingState } from '../ui.tsx'
import { PrivateGate } from '../ProfileLock.tsx'
import { agentPrivacy, useProfileLock } from '../profile-lock.ts'
import { Icon } from '../components/ui/Primitives.tsx'

function folderUrl(agent: string, kind: 'list' | 'file', path: string): string {
  return `/api/folders/${encodeURIComponent(agent)}/${kind}?path=${encodeURIComponent(path)}`
}

type FolderRequest<T> = RequestState<T> & { error?: string; reload: () => void }

async function loadWithReason<T>(url: string): Promise<RequestState<T> & { error?: string }> {
  try {
    const response = await fetch(url)
    const body = (await response.json().catch(() => undefined)) as (T & { error?: unknown; locked?: unknown }) | undefined
    if (response.ok && body) return { status: 'ready', data: body }
    if (response.status === 401 && body?.locked === true) window.dispatchEvent(new Event(LOCKED_EVENT))
    return { status: 'failed', error: typeof body?.error === 'string' ? body.error : `Request failed (HTTP ${response.status}).` }
  } catch {
    return { status: 'failed', error: 'The Batcave API could not be reached.' }
  }
}

function useRequest<T>(url: string | undefined): FolderRequest<T> {
  const [state, setState] = useState<RequestState<T> & { error?: string }>({ status: 'pending' })
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    if (!url) return
    let active = true
    setState({ status: 'pending' })
    void loadWithReason<T>(url).then((next) => {
      if (active) setState(next)
    })
    return () => {
      active = false
    }
  }, [url, nonce])
  return { ...state, reload: () => setNonce((v) => v + 1) } as FolderRequest<T>
}

function FileViewer({ agent, path }: { agent: string; path: string }) {
  const file = useRequest<FolderFile>(folderUrl(agent, 'file', path))
  if (file.status === 'pending') return <LoadingState message={`Opening ${path}...`} />
  if (file.status === 'failed') return <EmptyState title="Unable to open file">{file.error ?? 'Failed to read file.'}</EmptyState>
  const data = file.data
  return (
    <section className="mo-file-viewer mo-panel" aria-label={`Contents of ${data.path}`}>
      <header className="mo-file-head">
        <div>
          <h2 className="mo-file-title font-mono">{data.path.split('/').pop()}</h2>
          <div className="mo-file-meta text-muted font-mono">
            {formatBytes(data.size)} · Modified {formatDateTime(data.modified)}
          </div>
        </div>
      </header>

      {data.kind === 'sensitive' ? (
        <div className="mo-notice-box warning">
          🔒 Sensitive file (credentials, API keys, or auth). Batcave only lists the file without reading its contents.
        </div>
      ) : data.kind === 'binary' ? (
        <div className="mo-notice-box">Binary file. Text preview is unavailable.</div>
      ) : (
        <>
          {data.truncated && <div className="mo-notice-box">Showing first 256 KB of this file.</div>}
          {!!data.redactions && <div className="mo-notice-box">{data.redactions} secret lines redacted as [REDACTED].</div>}
          <pre className="mo-file-content font-mono">{data.content || <span className="text-muted">(empty file)</span>}</pre>
        </>
      )}
    </section>
  )
}

function Browser({ agent, onBack }: { agent: FolderAgent; onBack?: () => void }) {
  const [directory, setDirectory] = useState('')
  const [selected, setSelected] = useState<string | undefined>()
  const [query, setQuery] = useState('')
  const listing = useRequest<FolderListing>(folderUrl(agent.profile, 'list', directory))
  const parts = directory ? directory.split('/') : []
  const open = (next: string) => {
    setDirectory(next)
    setSelected(undefined)
    setQuery('')
  }
  const needle = query.trim().toLowerCase()
  const entries =
    listing.status === 'ready'
      ? listing.data.entries.filter((entry) => !needle || entry.name.toLowerCase().includes(needle))
      : []

  return (
    <div className="mo-folder-browser-wrapper">
      {/* Prominent Large Breadcrumb */}
      <nav className="mo-large-breadcrumb" aria-label="Folder path">
        {onBack && (
          <>
            <button type="button" className="mo-crumb-btn" onClick={onBack}>
              All Agents
            </button>
            <span className="mo-crumb-separator">/</span>
          </>
        )}
        <button
          type="button"
          className="mo-crumb-btn mo-crumb-root font-mono"
          onClick={() => open('')}
          title={agent.path}
        >
          {agent.label}
        </button>
        {parts.map((part, index) => (
          <span key={index} className="mo-crumb-segment font-mono">
            <span className="mo-crumb-separator">/</span>
            <button
              type="button"
              className={`mo-crumb-btn ${index === parts.length - 1 ? 'current' : ''}`}
              onClick={() => open(parts.slice(0, index + 1).join('/'))}
            >
              {part}
            </button>
          </span>
        ))}
      </nav>

      {/* 2-Pane: Hairline Rows on Left, Viewer on Right */}
      <div className="mo-browser-panes">
        <div className="mo-file-list-pane">
          <div className="mo-search-box" style={{ marginBottom: 12 }}>
            <Icon name="search" size={16} />
            <input
              type="text"
              placeholder="Filter this folder…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mo-search-input"
            />
          </div>

          <div className="mo-file-rows" role="list">
            {directory && (
              <div
                className="mo-file-row-item parent-dir"
                onClick={() => open(parts.slice(0, -1).join('/'))}
                role="listitem"
                tabIndex={0}
                onKeyDown={event => { if (event.key === 'Enter') open(parts.slice(0, -1).join('/')) }}
              >
                <span className="mo-file-icon">↰</span>
                <span className="mo-file-name font-mono">..</span>
              </div>
            )}

            {entries.map((entry) => {
              const isSelected = selected === entry.path
              return (
                <div
                  key={entry.path}
                  className={`mo-file-row-item ${isSelected ? 'active' : ''}`}
                  onClick={() => (entry.type === 'dir' ? open(entry.path) : setSelected(entry.path))}
                  role="listitem"
                  tabIndex={0}
                  onKeyDown={event => { if (event.key === 'Enter') { if (entry.type === 'dir') open(entry.path); else setSelected(entry.path) } }}
                >
                  <span className="mo-file-icon font-mono">
                    {entry.unreadable ? '⛔' : entry.type === 'dir' ? '📁' : entry.sensitive ? '🔒' : '📄'}
                  </span>
                  <span className="mo-file-name font-mono">{entry.name}</span>
                  <span className="mo-file-size font-mono text-muted">
                    {entry.unreadable ? 'no access' : entry.type === 'dir' ? '' : formatBytes(entry.size)}
                  </span>
                </div>
              )
            })}
          </div>

          {entries.length === 0 && (
            <div className="mo-empty-state">
              <p>{needle ? 'No matching files.' : 'This folder is empty.'}</p>
            </div>
          )}
        </div>

        <div className="mo-file-view-pane">
          {selected ? (
            <FileViewer agent={agent.profile} path={selected} />
          ) : (
            <div className="mo-empty-state mo-panel">
              <p>Select a file on the left to view its contents.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function AgentFolder({ profile }: { profile: string }) {
  const snapshot = usePolling<FolderAgentsSnapshot>('/api/folders', 60_000)
  const agent = snapshot.status === 'ready' ? snapshot.data.agents.find((item) => item.profile === profile) : undefined
  if (snapshot.status === 'pending') return <LoadingState message="Looking for agent folders..." />
  if (snapshot.status === 'failed') return <EmptyState title="Unavailable">{snapshot.message ?? 'Failed to load folder list.'}</EmptyState>
  if (!agent || !agent.available) return <EmptyState title="Folder unavailable">{agent?.reason ?? 'This agent does not have a readable folder.'}</EmptyState>
  return (
    <div className="embedded-folder">
      <PrivateGate agent={agent.profile} compact>
        {agent.warning && <p className="file-notice">⚠ {agent.warning}</p>}
        <Browser key={agent.profile} agent={agent} />
      </PrivateGate>
    </div>
  )
}

export function Folders() {
  const snapshot = usePolling<FolderAgentsSnapshot>('/api/folders', 60_000)
  const [openAgent, setOpenAgent] = useState<string | undefined>()
  const lock = useProfileLock()
  const data = snapshot.status === 'ready' ? snapshot.data : undefined
  const agent = data?.agents.find((item) => item.profile === openAgent)

  return (
    <div className="mo-page-folders">
      <header className="mo-page-header">
        <h1 className="mo-page-title">Folders Sandbox</h1>
        <p className="mo-page-description">
          Read-only directory explorer with path-traversal protection for each agent profile. File editing and saving are not supported by this server.
        </p>
      </header>

      {agent ? (
        <PrivateGate agent={agent.profile}>
          <Browser key={agent.profile} agent={agent} onBack={() => setOpenAgent(undefined)} />
        </PrivateGate>
      ) : (
        <div className="mo-agent-folders-grid">
          {data?.agents.map((item) => {
            const isLocked = agentPrivacy(lock, item.profile) === 'locked'
            return (
              <div
                key={item.profile}
                className="mo-folder-card mo-panel"
                onClick={() => setOpenAgent(item.profile)}
                role="button"
                tabIndex={0}
              >
                <div className="mo-folder-card-head">
                  <span className="mo-folder-agent-name">
                    {isLocked && '🔒 '}
                    {item.label}
                  </span>
                  <span className="mo-crumb-arrow">›</span>
                </div>
                <div className="mo-folder-path font-mono text-muted">{item.path}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
