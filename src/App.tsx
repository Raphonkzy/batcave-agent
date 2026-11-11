import { memo, useCallback, useEffect, useRef, useState } from 'react'
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
import { modeOf, type Mode, type ModeId } from './navigation.ts'
import type { DashboardSnapshot } from './types.ts'
import { LotModes } from './components/shell/LotModes.tsx'
import { GameWindow } from './components/shell/GameWindow.tsx'
import { CommandPalette } from './components/shell/CommandPalette.tsx'
import { AgentProvider } from './agent/AgentProvider.tsx'
import { hasOpenDialog } from './open-dialog.ts'

/** How long the 3D Batcave stays alive behind other pages before its GPU memory is released. */
const OFFICE_KEEPALIVE_MS = 10 * 60_000

/**
 * The kept-alive Batcave page. While it is hidden nothing about it can change on screen, so the
 * shell re-rendering (every navigation, every data refresh) must not re-render the whole 3D page.
 */
const KeptOffice = memo(Office, (previous, next) => previous?.active === false && next?.active === false)

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function currentPage(): Page {
  return typeof window === 'undefined' ? HOME : pageFromHash(window.location.hash)
}

function Shell({ onRefresh, access, onAccessChange }: { onRefresh: () => void; access: AccessStatus | undefined; onAccessChange: (status: AccessStatus) => void }) {
  const [page, setPage] = useState<Page>(currentPage)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  // Each mode reopens on the page it was left on, as a game menu remembers its last tab.
  const lastPage = useRef<Partial<Record<ModeId, Page>>>({})
  const mode = modeOf(page)
  lastPage.current[mode.id] = page

  const toggleFullscreen = useCallback(() => {
    try {
      if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {})
      else void document.exitFullscreen?.().catch(() => {})
    } catch {
      // The browser may refuse; the button simply has no effect then.
    }
  }, [])

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

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

  const navigate = useCallback((next: Page) => {
    window.location.hash = `/${pageSlug(next)}`
    setPage(next)
  }, [])
  const openMode = useCallback((target: Mode) => navigate(lastPage.current[target.id] ?? target.pages[0]), [navigate])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Ctrl+K / Cmd+K opens search from anywhere.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
        return
      }
      // Escape closes the open window and returns to the live lot, unless something inside it
      // (a dialog, a menu, a text field) is using the key.
      if (event.key !== 'Escape' || event.defaultPrevented || page === HOME || paletteOpen) return
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || TYPING.has(target.tagName))) return
      if (hasOpenDialog()) return
      event.preventDefault()
      navigate(HOME)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [page, paletteOpen, navigate])

  const profilesList = data?.runtime?.profiles?.data ?? []

  // The Batcave page owns the 3D scene (a WebGL context plus its geometry and textures). It is
  // mounted on the first visit and then kept behind the other pages, paused, so coming back is
  // instant instead of rebuilding the scene. If nobody returns for a while, it is released.
  const [officeKept, setOfficeKept] = useState(page === 'Batcave')
  if (page === 'Batcave' && !officeKept) setOfficeKept(true)
  useEffect(() => {
    if (page === 'Batcave' || !officeKept) return
    const timer = window.setTimeout(() => setOfficeKept(false), OFFICE_KEEPALIVE_MS)
    return () => window.clearTimeout(timer)
  }, [page, officeKept])

  const content =
    page === 'Batcave' ? null : page === 'Agents' ? (
      <Agents runtime={data?.runtime ?? null} pending={dashboard.status === 'pending'} />
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

  const live = page === 'Batcave'
  return (
    <div className="lot-app" data-mode={mode.id}>
      {/* The sky shows when the 3D lot has not been opened yet (or was released). */}
      <div className="lot-sky" aria-hidden="true" />
      {officeKept && (
        <div className="lot-stage" inert={!live} aria-hidden={live ? undefined : true}>
          <KeptOffice
            dashboard={data}
            dashboardPending={dashboard.status === 'pending'}
            onNavigate={navigate}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            active={live}
          />
        </div>
      )}

      <LotModes
        currentPage={page}
        onOpenMode={openMode}
        onNavigate={navigate}
        onOpenSearch={() => setPaletteOpen(true)}
        onRefresh={onRefresh}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {versionNotice && (
        <section className="lot-toast" role="alert">
          <strong>Restart needed.</strong> {versionNotice}
        </section>
      )}

      {content && (
        <main className="lot-window-layer">
          <GameWindow mode={mode} page={page} onNavigate={navigate} onClose={() => navigate(HOME)}>
            {content}
          </GameWindow>
        </main>
      )}

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
  // The connection provider sits above the page switch: it is mounted once and survives every navigation.
  return <RefreshContext.Provider value={tick}><AgentProvider><Shell access={access} onAccessChange={setAccess} onRefresh={() => setTick((value) => value + 1)}/></AgentProvider></RefreshContext.Provider>
}
