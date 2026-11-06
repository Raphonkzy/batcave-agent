import { useState, useRef, useEffect } from 'react'
import type { Page } from '../../routes.ts'
import { Icon } from '../ui/Primitives.tsx'

export interface BottomDockProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

const PRIMARY_ROUTES: { label: string; page: Page }[] = [
  { label: 'Batcave', page: 'Batcave' },
  { label: 'Agents', page: 'Agents' },
  { label: 'Missions', page: 'Missions' },
  { label: 'Tugas', page: 'Task Board' },
  { label: 'Jadwal', page: 'Calendar' },
]

const SECONDARY_ROUTES: { label: string; page: Page }[] = [
  { label: 'Usage & Token', page: 'Usage' },
  { label: 'Activity Feed', page: 'Activity' },
  { label: 'Memory & Soul', page: 'Memory' },
  { label: 'Folders Sandbox', page: 'Folders' },
  { label: 'Logs Stream', page: 'Logs' },
  { label: 'Settings', page: 'Settings' },
]

export function BottomDock({ currentPage, onNavigate }: BottomDockProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menuOpen])

  return (
    <nav className="mo-bottom-dock" aria-label="Navigasi Utama">
      <div className="mo-dock-container">
        {PRIMARY_ROUTES.map((route) => {
          const isActive = currentPage === route.page
          return (
            <button
              key={route.page}
              type="button"
              className={`mo-dock-item ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onNavigate(route.page)}
            >
              <span>{route.label}</span>
              {isActive && <span className="mo-dock-indicator" />}
            </button>
          )
        })}

        <div className="mo-dock-more-wrapper" ref={menuRef}>
          <button
            type="button"
            className={`mo-dock-item mo-dock-more ${menuOpen ? 'active' : ''}`}
            aria-expanded={menuOpen}
            aria-label="Menu Rute Tambahan"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name="more" size={16} />
          </button>

          {menuOpen && (
            <div className="mo-dock-popover">
              {SECONDARY_ROUTES.map((route) => (
                <button
                  key={route.page}
                  type="button"
                  className={`mo-popover-item ${currentPage === route.page ? 'active' : ''}`}
                  onClick={() => {
                    onNavigate(route.page)
                    setMenuOpen(false)
                  }}
                >
                  {route.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

