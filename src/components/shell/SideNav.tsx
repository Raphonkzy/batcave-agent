import { useEffect, useRef } from 'react'
import { Icon } from '../ui/Primitives.tsx'
import { type Page } from '../../routes.ts'

export interface SideNavProps {
  currentPage: Page
  onNavigate: (page: Page) => void
  mode: 'open' | 'rail'
  onToggleMode: () => void
  drawerOpen?: boolean
  onCloseDrawer?: () => void
  isMobile?: boolean
}

interface NavItem {
  page: Page
  label: string
  icon: string
  path: string
}

const OPERATIONS_ROUTES: NavItem[] = [
  { page: 'Batcave', label: 'Batcave', icon: 'home', path: '#/batcave' },
  { page: 'Agents', label: 'Agents', icon: 'users', path: '#/agents' },
  { page: 'Missions', label: 'Missions', icon: 'target', path: '#/missions' },
  { page: 'Task Board', label: 'Task Board', icon: 'layout', path: '#/task-board' },
  { page: 'Calendar', label: 'Calendar', icon: 'calendar', path: '#/calendar' },
]

const SYSTEM_ROUTES: NavItem[] = [
  { page: 'Usage', label: 'Usage', icon: 'bar-chart', path: '#/usage' },
  { page: 'Activity', label: 'Activity', icon: 'activity', path: '#/activity' },
  { page: 'Memory', label: 'Memory', icon: 'database', path: '#/memory' },
  { page: 'Folders', label: 'Folders', icon: 'folder', path: '#/folders' },
  { page: 'Logs', label: 'Logs', icon: 'terminal', path: '#/logs' },
  { page: 'Settings', label: 'Settings', icon: 'settings', path: '#/settings' },
]

export function SideNav({
  currentPage,
  onNavigate,
  mode,
  onToggleMode,
  drawerOpen = false,
  onCloseDrawer,
  isMobile = false,
}: SideNavProps) {
  const drawerRef = useRef<HTMLElement>(null)

  // Escape key closes mobile drawer
  useEffect(() => {
    if (!isMobile || !drawerOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseDrawer?.()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMobile, drawerOpen, onCloseDrawer])

  const handleClick = (page: Page) => {
    onNavigate(page)
    if (isMobile) {
      onCloseDrawer?.()
    }
  }

  const renderGroup = (title: string, items: NavItem[]) => (
    <div className="mo-nav-group">
      {mode === 'open' && <div className="mo-nav-group-title">{title}</div>}
      <ul className="mo-nav-list" role="list">
        {items.map((item) => {
          const isActive = currentPage === item.page
          return (
            <li key={item.page} className="mo-nav-item">
              <a
                href={item.path}
                className={`mo-nav-link ${isActive ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  handleClick(item.page)
                }}
                aria-current={isActive ? 'page' : undefined}
                title={mode === 'rail' ? item.label : undefined}
              >
                <span className="mo-nav-icon">
                  <Icon name={item.icon} size={16} />
                </span>
                {mode === 'open' && <span className="mo-nav-label">{item.label}</span>}
                {isActive && <span className="mo-nav-active-bar" />}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )

  const navContent = (
    <nav
      ref={drawerRef}
      className={`mo-side-nav mo-side-nav-${mode} ${isMobile ? 'mo-side-nav-drawer' : ''}`}
      aria-label="Navigasi Utama"
      role={isMobile ? 'dialog' : undefined}
      aria-modal={isMobile ? true : undefined}
    >
      <div className="mo-side-nav-header">
        <div className="mo-nav-brand">
          <span className="mo-brand-mark">◆</span>
          {mode === 'open' && <span className="mo-brand-text">batcave</span>}
        </div>
        {isMobile && (
          <button
            type="button"
            className="mo-icon-btn mo-nav-close-btn"
            onClick={onCloseDrawer}
            aria-label="Tutup menu"
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      <div className="mo-side-nav-scroll">
        {renderGroup('Operasi', OPERATIONS_ROUTES)}
        {renderGroup('Sistem', SYSTEM_ROUTES)}
      </div>

      {!isMobile && (
        <div className="mo-side-nav-footer">
          <button
            type="button"
            className="mo-nav-collapse-btn"
            onClick={onToggleMode}
            title={mode === 'open' ? 'Ciutkan menu (mode rail)' : 'Perluas menu'}
            aria-label={mode === 'open' ? 'Ciutkan menu' : 'Perluas menu'}
          >
            <Icon name={mode === 'open' ? 'chevrons-left' : 'chevrons-right'} size={16} />
            {mode === 'open' && <span className="mo-collapse-label">Ciutkan menu</span>}
          </button>
        </div>
      )}
    </nav>
  )

  if (isMobile) {
    if (!drawerOpen) return null
    return (
      <div className="mo-side-nav-backdrop" onClick={onCloseDrawer}>
        <div onClick={(e) => e.stopPropagation()}>{navContent}</div>
      </div>
    )
  }

  return navContent
}
