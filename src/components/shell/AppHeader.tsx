import { Icon, Kbd, StatusDot } from '../ui/Primitives.tsx'
import type { Page } from '../../routes.ts'

export interface AppHeaderProps {
  currentPage: Page
  activeCount: number
  totalCount: number
  onOpenPalette: () => void
  onNavigateHome: () => void
  onRefresh?: () => void
}

export function AppHeader({
  currentPage,
  activeCount,
  totalCount,
  onOpenPalette,
  onNavigateHome,
  onRefresh,
}: AppHeaderProps) {
  return (
    <header className="mo-topbar" data-page={currentPage}>
      <div className="mo-topbar-left">
        <button type="button" className="mo-brand-btn" onClick={onNavigateHome} title="Ke Home 3D (Batcave)">
          <span className="mo-brand-mark">◆</span>
          <span className="mo-brand-text">batcave</span>
        </button>
      </div>

      <div className="mo-topbar-center">
        <button type="button" className="mo-search-trigger" onClick={onOpenPalette} aria-label="Buka Command Palette">
          <Icon name="search" size={16} />
          <span className="mo-search-placeholder">Cari halaman atau agent…</span>
          <span className="mo-search-shortcut">
            <Kbd>⌘K</Kbd>
          </span>
        </button>
      </div>

      <div className="mo-topbar-right">
        <div className="mo-agent-counter" title={`${activeCount} agent aktif dari total ${totalCount}`}>
          <StatusDot status="working" size={6} />
          <span className="mo-counter-num">{activeCount}</span>
          <span className="mo-counter-label">aktif</span>
        </div>
        {onRefresh && (
          <button type="button" className="mo-icon-btn" onClick={onRefresh} title="Refresh data">
            <Icon name="rotate-right" size={16} />
          </button>
        )}
      </div>
    </header>
  )
}
