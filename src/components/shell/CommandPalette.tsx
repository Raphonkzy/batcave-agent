import { useEffect, useRef, useState } from 'react'
import { modeOf } from '../../navigation.ts'
import { navigation, pageSlug, type Page } from '../../routes.ts'
import { Icon, Kbd } from '../ui/Primitives.tsx'

export interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onNavigate: (page: Page) => void
  agents?: { id: string; name: string; state: string }[]
}

/** Search for a page or an agent (Ctrl/Cmd+K). */
export function CommandPalette({ open, onClose, onNavigate, agents = [] }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    const timer = setTimeout(() => inputRef.current?.focus(), 30)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { clearTimeout(timer); window.removeEventListener('keydown', onKeyDown) }
  }, [open, onClose])

  if (!open) return null

  const q = query.toLowerCase().trim()
  const matchedPages = navigation.filter((p) => p.toLowerCase().includes(q) || pageSlug(p).includes(q))
  const matchedAgents = agents.filter((a) => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q))
  const go = (page: Page) => { onNavigate(page); onClose() }

  return (
    <div className="mo-palette-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Search">
      <div className="mo-palette" onClick={(e) => e.stopPropagation()}>
        <div className="mo-palette-header">
          <Icon name="search" size={20} className="mo-palette-icon" />
          <input
            ref={inputRef}
            type="text"
            className="mo-palette-input"
            placeholder="Search pages or agents"
            aria-label="Search pages or agents"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && matchedPages[0]) go(matchedPages[0]) }}
          />
          <Kbd>Esc</Kbd>
        </div>

        <div className="mo-palette-body">
          <div className="mo-palette-group">
            <div className="mo-palette-label">Pages</div>
            {matchedPages.map((page) => (
              <button key={page} type="button" className="mo-palette-item" onClick={() => go(page)}>
                <span>{page}</span>
                <span className="mo-palette-slug">{modeOf(page).label}</span>
              </button>
            ))}
            {matchedPages.length === 0 && <div className="mo-palette-empty">No matching pages</div>}
          </div>

          {matchedAgents.length > 0 && (
            <div className="mo-palette-group">
              <div className="mo-palette-label">Agents</div>
              {matchedAgents.map((agent) => (
                <button key={agent.id} type="button" className="mo-palette-item" onClick={() => go('Agents')}>
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
