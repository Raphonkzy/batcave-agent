import type { ReactNode } from 'react'
import type { Mode } from '../../navigation.ts'
import { pageSlug, type Page } from '../../routes.ts'
import { Icon } from '../ui/Primitives.tsx'

/**
 * A page opens as a window over the paused lot, like a game menu: the mode's name, one tab per
 * page in the mode, and a close button (or Escape) that returns to the live view.
 */
export function GameWindow({ mode, page, onNavigate, onClose, children }: {
  mode: Mode
  page: Page
  onNavigate: (page: Page) => void
  onClose: () => void
  children: ReactNode
}) {
  return (
    <section className={`lot-window lot-window-${mode.id}`} aria-labelledby="lot-window-title">
      <header className="lot-window-head">
        <span className="lot-window-icon" aria-hidden="true"><Icon name={mode.icon} size={20} /></span>
        <h2 id="lot-window-title" className="lot-window-title">{mode.label}</h2>
        {mode.pages.length > 1 && (
          <nav className="lot-window-tabs" aria-label={`${mode.label} pages`}>
            {mode.pages.map((item) => (
              <a
                key={item}
                href={`#/${pageSlug(item)}`}
                className={`lot-window-tab${item === page ? ' active' : ''}`}
                aria-current={item === page ? 'page' : undefined}
                onClick={(event) => { event.preventDefault(); onNavigate(item) }}
              >
                {item}
              </a>
            ))}
          </nav>
        )}
        <button type="button" className="lot-window-close" onClick={onClose} aria-label="Close and return to the Batcave" title="Back to the Batcave (Esc)">
          <Icon name="close" size={20} />
        </button>
      </header>
      {/* Keyed by page so each page opens scrolled to the top. */}
      <div className="lot-window-body" key={page}>{children}</div>
    </section>
  )
}
