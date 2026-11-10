import { Icon, Kbd, StatusDot } from '../ui/Primitives.tsx'
import type { Page } from '../../routes.ts'

export interface AppHeaderProps {
  currentPage: Page
  activeCount: number
  totalCount: number
  onOpenPalette: () => void
  onNavigateHome: () => void
  onRefresh?: () => void
  onToggleNav?: () => void
  navOpen?: boolean
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
}

export function AppHeader({
  currentPage,
  activeCount,
  totalCount,
  onOpenPalette,
  onNavigateHome,
  onRefresh,
  onToggleNav,
  navOpen = false,
  isFullscreen = false,
  onToggleFullscreen,
}: AppHeaderProps) {
  return (
    <header className="mo-topbar" data-page={currentPage}>
      <div className="mo-topbar-left">
        {onToggleNav && (
          <button
            type="button"
            className={`mo-nav-toggle ${navOpen ? 'active' : ''}`}
            aria-expanded={navOpen}
            aria-controls="main-navigation"
            onClick={onToggleNav}
            aria-label="Toggle navigation menu"
            title="Toggle menu"
          >
            <Icon name="menu" size={20} />
          </button>
        )}
        <button type="button" className="mo-brand-btn" onClick={onNavigateHome} title="Go to 3D Home (Batcave)">
          <span className="mo-brand-mark">◆</span>
          <span className="mo-brand-text">batcave</span>
        </button>
        <span className="mo-page-crumb" aria-label="Current page">{currentPage}</span>
      </div>

      <div className="mo-topbar-center">
        <button type="button" className="mo-search-trigger" onClick={onOpenPalette} aria-label="Open Command Palette">
          <Icon name="search" size={16} />
          <span className="mo-search-placeholder">Search pages or agents…</span>
          <span className="mo-search-shortcut">
            <Kbd>⌘K</Kbd>
          </span>
        </button>
      </div>

      <div className="mo-topbar-right">
        <div className="mo-agent-counter" title={`${activeCount} active agents out of ${totalCount} total`}>
          <StatusDot status="working" size={6} />
          <span className="mo-counter-num">{activeCount}</span>
          <span className="mo-counter-label">active</span>
        </div>
        {onToggleFullscreen && (
          <button
            type="button"
            className={`mo-icon-btn ${isFullscreen ? 'active' : ''}`}
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            <Icon name={isFullscreen ? 'minimize' : 'maximize'} size={16} />
          </button>
        )}
        {onRefresh && (
          <button type="button" className="mo-icon-btn" onClick={onRefresh} title="Refresh data">
            <Icon name="rotate-right" size={16} />
          </button>
        )}
      </div>
    </header>
  )
}
