import { useEffect, useState, useRef } from 'react'
import { navigation, pageSlug, type Page } from '../../routes.ts'
import { Icon, Kbd } from '../ui/Primitives.tsx'

export interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onNavigate: (page: Page) => void
  agents?: { id: string; name: string; state: string }[]
}

export function CommandPalette({ open, onClose, onNavigate, agents = [] }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const q = query.toLowerCase().trim()
  const matchedPages = navigation.filter((p) => p.toLowerCase().includes(q) || pageSlug(p).includes(q))
  const matchedAgents = agents.filter((a) => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q))

  return (
    <div className="mo-palette-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Command Palette">
      <div className="mo-palette" onClick={(e) => e.stopPropagation()}>
        <div className="mo-palette-header">
          <Icon name="search" size={16} className="mo-palette-icon" />
          <input
            ref={inputRef}
            type="text"
            className="mo-palette-input"
            placeholder="Cari halaman, rute, atau agent…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Kbd>ESC</Kbd>
        </div>

        <div className="mo-palette-body">
          <div className="mo-palette-group">
            <div className="mo-palette-label">HALAMAN & RUTE</div>
            {matchedPages.map((page) => (
              <button
                key={page}
                type="button"
                className="mo-palette-item"
                onClick={() => {
                  onNavigate(page)
                  onClose()
                }}
              >
                <span>{page}</span>
                <span className="mo-palette-slug">#/{pageSlug(page)}</span>
              </button>
            ))}
            {matchedPages.length === 0 && <div className="mo-palette-empty">Tidak ada halaman yang cocok</div>}
          </div>

          {matchedAgents.length > 0 && (
            <div className="mo-palette-group">
              <div className="mo-palette-label">AGENTS</div>
              {matchedAgents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  className="mo-palette-item"
                  onClick={() => {
                    onNavigate('Agents')
                    onClose()
                  }}
                >
                  <span>{agent.name}</span>
                  <span className="mo-palette-slug">{agent.state}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

