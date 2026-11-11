import { useEffect, useRef, useState } from 'react'
import { MODES, modeOf, type Mode } from '../../navigation.ts'
import { pageSlug, type Page } from '../../routes.ts'
import { Icon, Kbd } from '../ui/Primitives.tsx'

export interface LotModesProps {
  currentPage: Page
  /** Opens a mode: the page last visited in it, or its first page. */
  onOpenMode: (mode: Mode) => void
  onNavigate: (page: Page) => void
  onOpenSearch: () => void
  onRefresh: () => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
}

/**
 * The main navigation: one round button per mode in a capsule at the top right, as in a
 * house-simulation game. The last button opens the options menu (Logs, Settings, actions).
 */
export function LotModes({ currentPage, onOpenMode, onNavigate, onOpenSearch, onRefresh, isFullscreen, onToggleFullscreen }: LotModesProps) {
  const active = modeOf(currentPage)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setMenuOpen(false)
      toggleRef.current?.focus()
    }
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    // Capture phase: the menu closes before the page's own Escape handling sees the key.
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onPointer)
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('pointerdown', onPointer) }
  }, [menuOpen])

  const choose = (action: () => void) => () => { setMenuOpen(false); action() }
  const system = MODES.find((mode) => mode.id === 'system')!

  return (
    <nav className="lot-modes" id="main-navigation" aria-label="Main navigation">
      <ul className="lot-mode-list" role="list">
        {MODES.filter((mode) => mode.id !== 'system').map((mode) => {
          const current = mode.id === active.id
          return (
            <li key={mode.id}>
              <a
                href={`#/${pageSlug(mode.pages[0])}`}
                className={`lot-mode${current ? ' active' : ''}`}
                aria-current={current ? 'page' : undefined}
                title={mode.hint}
                onClick={(event) => { event.preventDefault(); onOpenMode(mode) }}
              >
                <span className="lot-mode-icon"><Icon name={mode.icon} size={20} /></span>
                <span className="lot-mode-label">{mode.label}</span>
              </a>
            </li>
          )
        })}
      </ul>
      <div className="lot-menu" ref={menuRef}>
        <button
          ref={toggleRef}
          type="button"
          className={`lot-mode lot-mode-more${active.id === 'system' || menuOpen ? ' active' : ''}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls="lot-options-menu"
          aria-label="Options menu"
          title={system.hint}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="lot-mode-icon"><Icon name="more" size={20} /></span>
        </button>
        {menuOpen && (
          <div className="lot-menu-popover" id="lot-options-menu" role="menu" aria-label="Options">
            {system.pages.map((page) => (
              <button key={page} type="button" role="menuitem" className={`lot-menu-item${currentPage === page ? ' active' : ''}`} onClick={choose(() => onNavigate(page))}>
                <Icon name={page === 'Logs' ? 'terminal' : 'settings'} size={16} />
                <span>{page}</span>
              </button>
            ))}
            <hr className="lot-menu-rule" />
            <button type="button" role="menuitem" className="lot-menu-item" onClick={choose(onOpenSearch)}>
              <Icon name="search" size={16} />
              <span>Search</span>
              <Kbd>Ctrl K</Kbd>
            </button>
            <button type="button" role="menuitem" className="lot-menu-item" onClick={choose(onRefresh)}>
              <Icon name="rotate-right" size={16} />
              <span>Refresh all data</span>
            </button>
            <button type="button" role="menuitem" className="lot-menu-item" onClick={choose(onToggleFullscreen)}>
              <Icon name={isFullscreen ? 'minimize' : 'maximize'} size={16} />
              <span>{isFullscreen ? 'Exit full screen' : 'Full screen'}</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
