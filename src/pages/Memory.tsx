import { useState } from 'react'
import { formatDateTime, formatNumber } from '../format.ts'
import { usePolling } from '../polling.ts'
import type { AgentMemory, MemoryDocument, MemorySnapshot, MemoryStore } from '../types.ts'

export function AgentMemoryView({ profile }: { profile: string; onOpenFolders?: () => void }) {
  const snapshot = usePolling<MemorySnapshot>('/api/memory', 30_000)
  const agent = snapshot.status === 'ready' ? snapshot.data.agents.find((item) => item.profile === profile) : undefined
  if (snapshot.status === 'pending') return <div className="mo-panel text-muted">Memuat memory agent...</div>
  if (!agent) return <div className="mo-panel text-muted">Agent memory tidak tersedia.</div>
  return (
    <div className="mo-panel">
      <h3 className="mo-section-heading">{agent.label} ({agent.profile})</h3>
      <div className="text-muted font-mono" style={{ marginBottom: 12 }}>{agent.path}</div>
      <div className="mo-preview-body">
        <pre className="mo-preview-content font-mono">
          {agent.soul?.content || agent.memory?.path || '(Tidak ada memory yang tercatat)'}
        </pre>
      </div>
    </div>
  )
}

export function Memory({ onOpenFolders }: { onOpenFolders?: () => void }) {
  const snapshot = usePolling<MemorySnapshot>('/api/memory', 30_000)
  const data = snapshot.status === 'ready' ? snapshot.data : undefined
  const agents = data?.agents ?? []
  const [selectedAgentIndex, setSelectedAgentIndex] = useState(0)
  const [selectedDoc, setSelectedDoc] = useState<'soul' | 'memory' | 'user'>('soul')

  const currentAgent: AgentMemory | undefined = agents[selectedAgentIndex]

  const docs: { id: 'soul' | 'memory' | 'user'; name: string; desc: string; doc: MemoryDocument | MemoryStore | undefined }[] = [
    { id: 'soul', name: 'SOUL.md', desc: 'Identitas & System Prompt', doc: currentAgent?.soul },
    { id: 'memory', name: 'MEMORY.md', desc: 'Catatan Persisten Agent', doc: currentAgent?.memory },
    { id: 'user', name: 'USER.md', desc: 'Profil Pengguna', doc: currentAgent?.user },
  ]

  const activeDocObj = docs.find((d) => d.id === selectedDoc)
  const activeDoc = activeDocObj?.doc
  const storeDoc = activeDoc && 'limit' in activeDoc ? (activeDoc as MemoryStore) : undefined

  // Gauge calculation (thin 4px bar)
  const charLimit = storeDoc?.limit || 12000
  const charUsed = storeDoc?.used || activeDoc?.chars || 0
  const pct = Math.min(100, Math.round((charUsed / charLimit) * 100))

  return (
    <div className="mo-page-memory">
      <header className="mo-page-header">
        <div className="mo-header-with-actions">
          <div>
            <h1 className="mo-page-title">Memory & Persona</h1>
            <p className="mo-page-description">
              Inspeksi berkas identitas <code>SOUL.md</code> dan memori jangka panjang per agent.
            </p>
          </div>

          {onOpenFolders && (
            <button type="button" className="mo-btn mo-btn-ghost mo-btn-sm" onClick={onOpenFolders}>
              Buka di Folders ›
            </button>
          )}
        </div>
      </header>

      {/* Agent Selector Bar */}
      {agents.length > 1 && (
        <div className="mo-filter-bar">
          <div className="mo-agent-pills">
            {agents.map((agent, idx) => (
              <button
                key={agent.profile}
                type="button"
                className={`mo-agent-pill-btn ${idx === selectedAgentIndex ? 'active' : ''}`}
                onClick={() => setSelectedAgentIndex(idx)}
              >
                {agent.label || agent.profile}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2-Column Layout: Left = Files, Right = Preview */}
      <div className="mo-memory-two-col">
        {/* Left Column: Files */}
        <div className="mo-memory-sidebar">
          <div className="mo-memory-col-title">BERKAS MEMORI ({docs.length})</div>
          <div className="mo-doc-list">
            {docs.map((item) => {
              const isSelected = selectedDoc === item.id
              const chars = item.doc && 'used' in item.doc ? item.doc.used : item.doc?.chars ?? 0

              return (
                <div
                  key={item.id}
                  className={`mo-doc-item ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedDoc(item.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="mo-doc-head">
                    <span className="mo-doc-name font-mono">{item.name}</span>
                    <span className="mo-doc-size font-mono">{formatNumber(chars)} chars</span>
                  </div>
                  <div className="mo-doc-desc">{item.desc}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Preview & 4px Gauge */}
        <div className="mo-memory-preview-panel mo-panel">
          <div className="mo-preview-header">
            <div>
              <h2 className="mo-preview-filename font-mono">{activeDocObj?.name}</h2>
              <div className="mo-preview-meta text-muted">
                {activeDoc?.modified ? `Diperbarui: ${formatDateTime(activeDoc.modified)}` : 'Berkas aktif'}
              </div>
            </div>

            <div className="mo-gauge-container">
              <div className="mo-gauge-label">
                <span>KAPASITAS KARAKTER</span>
                <span className="font-mono">{formatNumber(charUsed)} / {formatNumber(charLimit)} ({pct}%)</span>
              </div>
              <div className="mo-gauge-track">
                <div
                  className={`mo-gauge-bar ${pct > 80 ? 'warning' : ''}`}
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mo-preview-body">
            <pre className="mo-preview-content font-mono">
              {activeDoc?.content || (
                <span className="text-muted">(Tidak ada konten teks atau berkas belum diisi)</span>
              )}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
