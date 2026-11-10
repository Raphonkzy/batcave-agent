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
  pinned?: boolean
  onTogglePin?: () => void
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
  pinned = true,
  onTogglePin,
}: SideNavProps) {
  const drawerRef = useRef<HTMLElement>(null)
  const isOverlay = isMobile || !pinned

  // Escape key closes overlay drawer
  useEffect(() => {
    if (!isOverlay || !drawerOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseDrawer?.()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOverlay, drawerOpen, onCloseDrawer])

  const handleClick = (page: Page) => {
    onNavigate(page)
    if (isOverlay) {
      onCloseDrawer?.()
    }
  }

  const renderGroup = (title: string, items: NavItem[]) => (
    <div className="mo-nav-group">
      {(mode === 'open' || isOverlay) && <div className="mo-nav-group-title">{title}</div>}
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
                title={mode === 'rail' && !isOverlay ? item.label : undefined}
              >
                <span className="mo-nav-icon">
                  <Icon name={item.icon} size={16} />
                </span>
                {(mode === 'open' || isOverlay) && <span className="mo-nav-label">{item.label}</span>}
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
      className={`mo-side-nav ${isOverlay ? 'mo-side-nav-drawer' : `mo-side-nav-${mode}`}`}
      aria-label="Main Navigation"
      role={isOverlay ? 'dialog' : undefined}
      aria-modal={isOverlay ? true : undefined}
    >
      <div className="mo-side-nav-header">
        <div className="mo-nav-brand">
          <span className="mo-brand-mark">◆</span>
          {(mode === 'open' || isOverlay) && <span className="mo-brand-text">batcave</span>}
        </div>
        <div className="mo-nav-header-actions">
          {onTogglePin && !isMobile && (
            <button
              type="button"
              className="mo-icon-btn mo-nav-pin-btn"
              onClick={onTogglePin}
              title={pinned ? 'Unpin menu (Full width / Float)' : 'Pin menu to side'}
              aria-label={pinned ? 'Unpin menu' : 'Pin menu to side'}
            >
              <Icon name={pinned ? 'pin' : 'pin-off'} size={16} />
            </button>
          )}
          {isOverlay && (
            <button
              type="button"
              className="mo-icon-btn mo-nav-close-btn"
              onClick={onCloseDrawer}
              aria-label="Close menu"
              title="Close menu"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="mo-side-nav-scroll">
        {renderGroup('Operations', OPERATIONS_ROUTES)}
        {renderGroup('System', SYSTEM_ROUTES)}
      </div>

      {!isOverlay ? (
        <div className="mo-side-nav-footer">
          <button
            type="button"
            className="mo-nav-collapse-btn"
            onClick={onToggleMode}
            title={mode === 'open' ? 'Collapse menu (rail mode)' : 'Expand menu'}
            aria-label={mode === 'open' ? 'Collapse menu' : 'Expand menu'}
          >
            <Icon name={mode === 'open' ? 'chevrons-left' : 'chevrons-right'} size={16} />
            {mode === 'open' && <span className="mo-collapse-label">Collapse menu</span>}
          </button>
          {onTogglePin && mode === 'open' && (
            <button
              type="button"
              className="mo-nav-unpin-btn"
              onClick={onTogglePin}
              title="Unpin menu from side (Fullscreen)"
            >
              <Icon name="pin-off" size={16} />
              <span>Unpin (Fullscreen)</span>
            </button>
          )}
        </div>
      ) : (
        !isMobile && onTogglePin && (
          <div className="mo-side-nav-footer">
            <button
              type="button"
              className="mo-nav-collapse-btn"
              onClick={onTogglePin}
              title="Pin menu to side"
            >
              <Icon name="pin" size={16} />
              <span className="mo-collapse-label">Pin menu to side</span>
            </button>
          </div>
        )
      )}
    </nav>
  )

  if (isOverlay) {
    if (!drawerOpen) return null
    return (
      <div className="mo-side-nav-backdrop" onClick={onCloseDrawer}>
        <div onClick={(e) => e.stopPropagation()}>{navContent}</div>
      </div>
    )
  }

  return navContent
}

