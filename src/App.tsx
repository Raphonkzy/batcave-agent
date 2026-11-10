import { useCallback, useEffect, useState } from 'react'
import { Activity } from './pages/Activity.tsx'
import { Agents } from './pages/Agents.tsx'
import { Calendar } from './pages/Calendar.tsx'
import { Folders } from './pages/Folders.tsx'
import { Logs } from './pages/Logs.tsx'
import { Memory } from './pages/Memory.tsx'
import { Office } from './pages/Office.tsx'
import { Settings } from './pages/Settings.tsx'
import { Usage } from './pages/Usage.tsx'
import { TaskBoard } from './pages/TaskBoard.tsx'
import { Missions } from './pages/Missions.tsx'
import { LOCKED_EVENT, loadAccess, type AccessStatus } from './access.ts'
import { PROFILES_CHANGED } from './profile-lock.ts'
import { LockScreen } from './LockScreen.tsx'
import { API_VERSION } from './api-version.ts'
import { APP_NAME, APP_TITLE } from './brand.ts'
import { RefreshContext, usePolling } from './polling.ts'
import { HOME, pageFromHash, pageSlug, type Page } from './routes.ts'
import type { DashboardSnapshot } from './types.ts'
import { AppHeader } from './components/shell/AppHeader.tsx'
import { SideNav } from './components/shell/SideNav.tsx'
import { CommandPalette } from './components/shell/CommandPalette.tsx'

function currentPage(): Page {
  return typeof window === 'undefined' ? HOME : pageFromHash(window.location.hash)
}

function getInitialSideNavMode(): 'open' | 'rail' {
  return 'open'
}

function getInitialPinned(): boolean {
  return false
}

function Shell({ onRefresh, access, onAccessChange }: { onRefresh: () => void; access: AccessStatus | undefined; onAccessChange: (status: AccessStatus) => void }) {
  const [page, setPage] = useState<Page>(currentPage)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [navMode, setNavMode] = useState<'open' | 'rail'>(getInitialSideNavMode)
  const [pinned, setPinned] = useState(getInitialPinned)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 760)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 760)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const toggleNavMode = () => {
    setNavMode((prev) => {
      const next = prev === 'open' ? 'rail' : 'open'
      localStorage.setItem('batcave.sideNav', next)
      return next
    })
  }

  const togglePin = useCallback(() => {
    setPinned((prev) => {
      const next = !prev
      localStorage.setItem('batcave.sideNavPinned', String(next))
      if (!next) setDrawerOpen(false)
      return next
    })
  }, [])

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev
      if (next) {
        try {
          if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
            void document.documentElement.requestFullscreen().catch(() => {})
          }
        } catch {
          // Ignore browser restriction errors
        }
      } else {
        try {
          if (document.fullscreenElement && document.exitFullscreen) {
            void document.exitFullscreen().catch(() => {})
          }
        } catch {
          // Ignore browser restriction errors
        }
      }
      return next
    })
  }

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const handleToggleNav = () => {
    if (!pinned || isMobile) {
      setDrawerOpen((prev) => !prev)
    } else {
      setPinned(false)
      setDrawerOpen(false)
    }
  }
  const dashboard = usePolling<DashboardSnapshot>('/api/dashboard', 15_000)
  const data = dashboard.status === 'ready' ? dashboard.data : null
  const health = usePolling<{ apiVersion?: number }>('/api/health', 60_000)
  const serverVersion = health.status === 'ready' ? health.data.apiVersion ?? 0 : health.status === 'failed' && health.httpStatus === 404 ? 0 : undefined
  const versionNotice = serverVersion === undefined || serverVersion === API_VERSION ? undefined
    : serverVersion < API_VERSION ? 'The Batcave server is running an older version than this page, so newer menus (such as Memory) cannot load. Restart the server: stop it, run npm run build, then npm start (npm run dev restarts by itself).'
      : 'This page is older than the Batcave server. Reload the page (and run npm run build if you use npm start).'

  useEffect(() => {
    const onHashChange = () => setPage(currentPage())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    document.title = page === HOME ? APP_TITLE : `${page} · ${APP_NAME}`
  }, [page])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // ⌘K / Ctrl+K opens Command Palette
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((prev) => !prev)
        return
      }
      // ⌘B / Ctrl+B toggles sidebar pin
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        togglePin()
        return
      }
      // 'M' shortcut opens Command Palette as well (clean replacement for old menu)
      if (event.key.toLowerCase() === 'm' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const target = event.target as HTMLElement | null
        if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
        if (document.querySelector('[role="dialog"]')) return
        event.preventDefault()
        setPaletteOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [togglePin])

  const navigate = (next: Page) => {
    window.location.hash = `/${pageSlug(next)}`
    setPage(next)
    setDrawerOpen(false)
    window.scrollTo?.({ top: 0 })
  }

  const profilesList = data?.runtime?.profiles?.data ?? []
  const activeAgents = data?.office ? data.office.active : 0
  const totalAgents = profilesList.length || (data?.office ? data.office.declared : 0)

  const content =
    page === 'Agents' ? (
      <Agents runtime={data?.runtime ?? null} pending={dashboard.status === 'pending'} />
    ) : page === 'Batcave' ? (
      <Office
        dashboard={data}
        dashboardPending={dashboard.status === 'pending'}
        onNavigate={navigate}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />
    ) : page === 'Missions' ? (
      <Missions onNavigate={navigate} />
    ) : page === 'Usage' ? (
      <Usage />
    ) : page === 'Task Board' ? (
      <TaskBoard />
    ) : page === 'Calendar' ? (
      <Calendar />
    ) : page === 'Activity' ? (
      <Activity />
    ) : page === 'Memory' ? (
      <Memory onOpenFolders={() => navigate('Folders')} />
    ) : page === 'Folders' ? (
      <Folders />
    ) : page === 'Settings' ? (
      <Settings access={access} onAccessChange={onAccessChange} />
    ) : (
      <Logs />
    )

  const sideWidth = isMobile || !pinned || isFullscreen ? '0px' : navMode === 'rail' ? '64px' : 'var(--nav-w)'

  return (
    <div
      className={`mo-app-container ${page === 'Batcave' ? 'mo-page-home' : 'mo-page-sub'} ${
        isFullscreen ? 'mo-fullscreen' : ''
      } ${!pinned ? 'mo-unpinned' : ''}`}
      style={{ '--side-w': sideWidth } as React.CSSProperties}
    >
      <AppHeader
        currentPage={page}
        activeCount={activeAgents}
        totalCount={totalAgents}
        onOpenPalette={() => setPaletteOpen(true)}
        onNavigateHome={() => navigate(HOME)}
        onRefresh={onRefresh}
        onToggleNav={handleToggleNav}
        navOpen={drawerOpen || (pinned && !isMobile)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      <div className="mo-app-body">
        <SideNav
          currentPage={page}
          onNavigate={navigate}
          mode={navMode}
          onToggleMode={toggleNavMode}
          drawerOpen={drawerOpen}
          onCloseDrawer={() => setDrawerOpen(false)}
          isMobile={isMobile}
          pinned={pinned}
          onTogglePin={togglePin}
        />

        <main className="mo-main-content">
          {versionNotice && (
            <section className="notice version-notice" role="alert">
              <strong>Restart needed.</strong> {versionNotice}
            </section>
          )}
          <div className="mo-page-wrapper">{content}</div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={navigate}
        agents={profilesList.map((p) => ({ id: p.name, name: p.name, state: p.gateway || 'Active' }))}
      />
    </div>
  )
}

export function App() {
  const [tick, setTick] = useState(0)
  const [access, setAccess] = useState<AccessStatus | undefined>()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let active = true
    const check = () => void loadAccess().then((status) => { if (active) { setAccess(status); setChecked(true) } })
    check()
    window.addEventListener(LOCKED_EVENT, check)
    const refresh = () => setTick((value) => value + 1)
    window.addEventListener(PROFILES_CHANGED, refresh)
    return () => { active = false; window.removeEventListener(LOCKED_EVENT, check); window.removeEventListener(PROFILES_CHANGED, refresh) }
  }, [])

  if (!checked) return <main className="lock-screen" aria-busy="true"/>
  if (access?.enabled && !access.unlocked) return <LockScreen status={access} onUnlocked={(status) => { setAccess(status); setTick((value) => value + 1) }}/>
  return <RefreshContext.Provider value={tick}><Shell access={access} onAccessChange={setAccess} onRefresh={() => setTick((value) => value + 1)}/></RefreshContext.Provider>
}
