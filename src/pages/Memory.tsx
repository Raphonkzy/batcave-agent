import { useState } from 'react'
import { formatDateTime, formatNumber } from '../format.ts'
import { usePolling } from '../polling.ts'
import { PrivateGate, ProfileUnlock } from '../ProfileLock.tsx'
import type { AgentMemory, MemoryDocument, MemorySnapshot, MemoryStore } from '../types.ts'

function documentText(doc: MemoryDocument | undefined): string {
  if (!doc) return 'This document is not exposed by this profile.'
  if (doc.error) return doc.error
  if (!doc.exists) return 'File not found in this profile.'
  return doc.content ?? '(No text content available)'
}
function Documents({ agent }: { agent: AgentMemory }) {
  const [selection, setSelection] = useState('soul')
  const docs: { id: string; name: string; doc?: MemoryDocument | MemoryStore }[] = agent.kind === 'opencode' ? [] : [
    { id: 'soul', name: 'SOUL.md', doc: agent.soul },
    { id: 'memory', name: 'MEMORY.md', doc: agent.memory },
    { id: 'user', name: 'USER.md', doc: agent.user },
  ]
  docs.push(...agent.contextFiles.map(doc => ({ id: doc.path, name: doc.name, doc })))
  const active = docs.find(doc => doc.id === selection) ?? docs[0]
  const doc = active?.doc
  const store = doc && 'limit' in doc ? doc as MemoryStore : undefined
  if (agent.locked) return <ProfileUnlock agent={agent.profile}/>
  if (!agent.available) return <p role="alert">{agent.reason ?? 'Memory folder unavailable.'}</p>
  return <PrivateGate agent={agent.profile}><div className="mo-memory-two-col">
    <div className="mo-memory-sidebar"><div className="mo-memory-col-title">MEMORY FILES ({docs.length})</div>
      <div className="mo-doc-list">{docs.map(item => <button type="button" key={item.id} className={'mo-doc-item' + (active?.id === item.id ? ' active' : '')} aria-pressed={active?.id === item.id} onClick={() => setSelection(item.id)}>
        <span className="mo-doc-head"><span className="mo-doc-name font-mono">{item.name}</span><span className="mo-doc-size">{formatNumber(item.doc?.chars ?? 0)} chars</span></span>
        <span className="mo-doc-desc">{item.doc?.path ?? 'Not exposed'}</span>
      </button>)}</div>
    </div>
    <section className="mo-memory-preview-panel mo-panel" aria-label="Memory document contents">
      <header className="mo-preview-header"><div><h2 className="mo-preview-filename font-mono">{active?.name ?? 'No supported context files'}</h2><p className="mo-preview-meta text-muted">{doc?.path} {doc?.modified && ' · Updated ' + formatDateTime(doc.modified)}</p></div>
        {store && <div className="mo-gauge-container"><span>{formatNumber(store.used)} / {formatNumber(store.limit)} characters</span><progress max={store.limit} value={Math.min(store.used, store.limit)} aria-label="Memory character capacity"/></div>}
      </header>
      {doc?.truncated && <p role="status">Preview truncated; open the original file locally to see the full document.</p>}
      {!!doc?.redactions && <p role="status">Sensitive values have been redacted.</p>}
      <div className="mo-preview-body"><pre className="mo-preview-content font-mono" role={doc?.error ? 'alert' : undefined}>{documentText(doc)}</pre></div>
    </section>
  </div></PrivateGate>
}
export function AgentMemoryView({ profile }: { profile: string; onOpenFolders?: () => void }) {
  const snapshot = usePolling<MemorySnapshot>('/api/memory', 30_000)
  if (snapshot.status === 'pending') return <p role="status">Loading agent memory…</p>
  if (snapshot.status === 'failed') return <p role="alert">{snapshot.message ?? 'Agent memory unavailable.'}</p>
  const agent = snapshot.data.agents.find(item => item.profile === profile)
  return agent ? <Documents key={agent.profile} agent={agent}/> : <p>Agent memory unavailable.</p>
}
export function Memory({ onOpenFolders }: { onOpenFolders?: () => void }) {
  const snapshot = usePolling<MemorySnapshot>('/api/memory', 30_000)
  const [selected, setSelected] = useState<string>()
  if (snapshot.status === 'pending') return <p role="status">Loading agent memory…</p>
  if (snapshot.status === 'failed') return <p role="alert">{snapshot.message ?? 'Unable to read memory from the Batcave API.'}</p>
  const agents = snapshot.data.agents
  const current = agents.find(agent => agent.profile === selected) ?? agents[0]
  return <div className="mo-page-memory">
    <header className="mo-page-header"><h1 className="mo-page-title">Memory & Persona</h1>
      <p className="mo-page-description">Read actual profile identity, memory, and supported context files. Read-only: this server does not support editing or saving; use Hermes or your local editor.</p>
      {onOpenFolders && <button type="button" className="mo-btn mo-btn-ghost" onClick={onOpenFolders}>Open in Folders ›</button>}
    </header>
    {snapshot.stale && <p role="status">Showing the last successful snapshot; background refresh failed.</p>}
    <div className="mo-agent-pills">{agents.map(agent => <button type="button" key={agent.profile} className={'mo-agent-pill-btn' + (current?.profile === agent.profile ? ' active' : '')} onClick={() => setSelected(agent.profile)}>{agent.label || agent.profile}</button>)}</div>
    {current ? <Documents key={current.profile} agent={current}/> : <p>No agent memory folders are available.</p>}
  </div>
}
