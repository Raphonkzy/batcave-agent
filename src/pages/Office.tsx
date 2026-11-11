import { Component, lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { agentLook } from '../agents.ts'
import { officeStateBadge } from '../office-state.ts'
import { usePolling } from '../polling.ts'
import { useAgents } from '../hooks/useAgents.ts'
import { formatCompact, formatNumber } from '../format.ts'
import type { Page } from '../routes.ts'
import type { DashboardSnapshot, OfficeRoom, OfficeSnapshot, OfficeStation, UsageSnapshot } from '../types.ts'
import { LoadingState } from '../ui.tsx'
import { SceneResourceStatus } from '../components/shell/SceneResourceStatus.tsx'
import { AgentFolder } from './Folders.tsx'
import { AgentMemoryView } from './Memory.tsx'
import { Stats } from './Stats.tsx'
import { formatCost } from '../usage.ts'
import { RelockBar } from '../ProfileLock.tsx'
import { Icon } from '../components/ui/Primitives.tsx'
import { BatMark } from '../components/ui/BatMark.tsx'

// The 3D Tactical Manor (three.js) is its own chunk. The 2D rooms are only the fallback for
// browsers without WebGL.
const ManorOffice3D = lazy(() => import('./ManorOffice3D.tsx'))

let webglProbe: boolean | undefined
/** Whether WebGL works here. Probed once per page load: each probe creates a real GPU context. */
function webglAvailable(): boolean {
  if (webglProbe !== undefined) return webglProbe
  try {
    const canvas = document.createElement('canvas')
    webglProbe = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    webglProbe = false
  }
  return webglProbe
}


/** Whether the briefing panel was left open (older builds stored a tab name; any of those counts). */
function storedBriefing(): boolean {
  try {
    const value = window.localStorage.getItem('mc.officePanel')
    return value === 'open' || value === 'Crew' || value === 'Stats' || value === 'Activity'
  } catch { return false }
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

const ROOMS: OfficeRoom[] = ['Workspace', 'Lounge']

/** A pixel character dressed in the colours derived from the agent id. */
export function PixelCharacter({ agent }: { agent: string }) {
  const look = agentLook(agent)
  const style = { '--hair': look.hair, '--skin': look.skin, '--shirt': look.shirt, '--pants': look.pants } as CSSProperties
  return <span className="pixel-character" style={style} aria-hidden="true"><span className="character-hair"/><span className="character-head"><i/><b/></span><span className="character-torso"/><span className="character-arm left"/><span className="character-arm right"/><span className="character-leg left"/><span className="character-leg right"/></span>
}

function officeStateLabel(station: OfficeStation): string {
  return station.state === 'Idle' ? 'Idle · managed placement' : station.state
}

/** This agent's tokens over the last 7 days and its rank in the crew (Hermes profiles only). */
function AgentTokens({ agent }: { agent: string }) {
  const usage = usePolling<UsageSnapshot>('/api/usage?days=7', 0)
  if (usage.status !== 'ready' || !Array.isArray(usage.data.agents)) return <div><dt>Tokens (7 days)</dt><dd>{usage.status === 'pending' ? 'Loading…' : 'Not Available'}</dd></div>
  const ranked = usage.data.agents.filter((item) => item.usage)
  const index = ranked.findIndex((item) => item.agent === agent)
  const mine = ranked[index]?.usage
  return <div><dt>Tokens (7 days)</dt><dd>{mine ? `${formatNumber(mine.totalTokens)} · #${index + 1} of ${ranked.length}${mine.costUsd !== undefined ? ` · est. ${formatCost(mine.costUsd)}` : ''}${mine.topSession ? ` · biggest session ${formatCompact(mine.topSession.tokens)}` : ''}` : 'Not Available'}</dd></div>
}

type DetailTab = 'Overview' | 'Folder' | 'Memory'
const DETAIL_TABS: DetailTab[] = ['Overview', 'Folder', 'Memory']

export function OfficeDetail({ station, onClose }: { station: OfficeStation; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const [tab, setTab] = useState<DetailTab>('Overview')
  useEffect(() => { closeRef.current?.focus() }, [])
  const badge = officeStateBadge(station.state)
  const profile = station.id
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); return }
    if (event.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
    if (!focusable?.length) { event.preventDefault(); return }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
      event.preventDefault()
      const target = event.shiftKey ? last : first
      target.focus()
    }
  }
  return <div className="office-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className={`office-detail${tab === 'Overview' ? '' : ' wide'}`} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="office-detail-title" onKeyDown={onKeyDown}>
      <button className="office-close" ref={closeRef} onClick={onClose} aria-label={`Close ${station.name} details`}>Close</button>
      <div className="detail-head"><div className="detail-avatar"><PixelCharacter agent={station.id}/></div><div><p className="eyebrow">STATION DETAIL</p><h2 id="office-detail-title">{station.name}</h2><span className={`badge ${badge.tone}`}>{officeStateLabel(station)}</span>{station.privacy === 'locked' && <span className="badge muted">🔒 Locked</span>}</div></div>
      {profile && <div className="detail-tabs" role="tablist" aria-label={`${station.name} details`}>{DETAIL_TABS.map((item) => <button type="button" role="tab" key={item} aria-selected={tab === item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</div>}
      <div role="tabpanel" aria-label={tab} className="detail-body">
        {tab === 'Overview' && <>{station.privacy === 'locked' && <p className="file-notice">🔒 {station.name} is locked: its task, activity, memory and files are private. Open the Folder or Memory tab to enter the PIN.</p>}
          {station.privacy === 'unlocked' && <RelockBar agent={station.id} minutes={15}/>}
          {station.activity && <p className="detail-activity">{station.activity}</p>}
          <dl className="office-detail-grid"><div><dt>Agent type</dt><dd>{station.role}</dd></div>{station.role !== 'OpenCode' && <AgentTokens agent={station.id}/>}<div><dt>Current room</dt><dd>{station.room} / {station.roomPosition}</dd></div><div><dt>Current task</dt><dd>{station.currentTask}</dd></div><div><dt>Recent activity</dt><dd>{station.recentActivity}</dd></div><div><dt>Source / provenance</dt><dd>{station.provenance}</dd></div><div><dt>Freshness</dt><dd>{station.freshness}</dd></div></dl></>}
        {tab === 'Folder' && profile && <AgentFolder profile={profile}/>}
        {tab === 'Memory' && profile && <AgentMemoryView profile={profile}/>}
      </div>
    </section>
  </div>
}

/** The lot name and the local clock, like the time display of a house-simulation game. */
function LotPlate({ active }: { active: boolean }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!active) return
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [active])
  return <div className="mo-lot-plate">
    <BatMark size={30} className="mo-lot-mark"/>
    <span className="mo-lot-name">Batcave</span>
    <time className="mo-lot-clock" dateTime={now.toISOString()}>
      <b>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b>
      <span>{now.toLocaleDateString([], { weekday: 'short' })}</span>
    </time>
  </div>
}

interface HudItem { label: string; value: string; tone?: 'warn' | 'bad'; page?: Page; title?: string }

/** The few numbers worth seeing at a glance: crew, tasks, and errors only when there are some. */
function hudItems(office: OfficeSnapshot | undefined, dashboard: DashboardSnapshot | null | undefined): HudItem[] {
  const summary = office?.summary ?? dashboard?.office
  const items: HudItem[] = []
  if (summary) items.push({ label: 'Crew', value: `${summary.active}/${summary.declared}`, title: `${summary.active} active · ${summary.idle} idle · ${summary.offline} offline · ${summary.unknown} unknown · gateways ${summary.gatewaysReachable}/${summary.gatewaysDeclared}`, page: 'Agents' })
  if (!dashboard) return items
  const { tasks, commands } = dashboard
  if (tasks.availability === 'available') {
    const open = Object.entries(tasks.byStatus).filter(([status]) => !['done', 'archived'].includes(status)).reduce((sum, [, count]) => sum + count, 0)
    items.push({ label: 'Tasks', value: `${tasks.byStatus.running ?? 0}/${open}`, title: `${tasks.byStatus.running ?? 0} running · ${open} open`, page: 'Task Board' })
  } else items.push({ label: 'Tasks', value: 'n/a', tone: 'warn', title: 'Task board not available', page: 'Task Board' })
  const recent = commands.recentFailed ?? commands.failed
  if (recent > 0) items.push({ label: 'Errors', value: String(recent), tone: 'bad', title: `${recent} Hermes reads failed in the last 5 minutes`, page: 'Logs' })
  return items
}

export function Office({
  dashboard,
  dashboardPending = false,
  onNavigate,
  isFullscreen = false,
  onToggleFullscreen,
  active = true,
}: {
  dashboard?: DashboardSnapshot | null
  dashboardPending?: boolean
  onNavigate?: (page: Page) => void
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  /**
   * False while another page is shown. The shell keeps this page mounted so the 3D scene (its
   * WebGL context, geometry and textures) survives navigation; while inactive it renders no
   * frames, takes no shortcuts, and neither fetches nor polls.
   */
  active?: boolean
} = {}) {
  // The crew comes through the data layer (live, or a dev-only mock crew with ?mockAgents=N).
  const snapshot = useAgents({ paused: !active })
  const office = snapshot.status === 'ready' ? snapshot.data : undefined
  const [selectedName, setSelectedName] = useState<OfficeStation['name'] | undefined>()
  const selectedTrigger = useRef<HTMLElement | null>(null)
  const [chosenRoom, setChosenRoom] = useState<OfficeRoom | undefined>()
  const [webgl] = useState(() => typeof document === 'undefined' || webglAvailable())
  // One side panel only: the briefing (the operations overview). Every other detail is a full page.
  const [briefing, setBriefing] = useState(() => typeof window !== 'undefined' && storedBriefing())
  // Leaving the page closes its dialogs; the scene itself (camera, floor, selection) stays as it was.
  useEffect(() => {
    if (active) return
    setSelectedName(undefined)
  }, [active])
  const toggleBriefing = (open = !briefing) => {
    setBriefing(open)
    try { window.localStorage.setItem('mc.officePanel', open ? 'open' : 'closed') } catch { /* storage may be blocked */ }
  }
  const show3d = webgl
  const showcase = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('characterShowcase')
  const select3d = (station: OfficeStation, trigger: HTMLElement | null) => { selectedTrigger.current = trigger; setSelectedName(station.name) }
  const counts = Object.fromEntries(ROOMS.map((item) => [item, office?.stations.filter((station) => station.room === item).length ?? 0])) as Record<OfficeRoom, number>
  // Until the viewer picks a room, open wherever the crew currently is.
  const room: OfficeRoom = chosenRoom ?? (counts.Workspace === 0 && counts.Lounge > 0 ? 'Lounge' : 'Workspace')
  const stations = office?.stations.filter((station) => station.room === room) ?? []
  const selected = office?.stations.find((station) => station.name === selectedName)
  const closeDetail = () => {
    setSelectedName(undefined)
    selectedTrigger.current?.focus()
  }
  const hud = hudItems(office, dashboard)
  // Hot desking: one unlabeled desk per agent.
  const deskCount = office?.stations.length ?? 0
  const stationButton2d = (station: OfficeStation) => { const badge = officeStateBadge(station.state); const busy = ['Working', 'Reviewing', 'Collaborating'].includes(station.state); return <button className={`pixel-station ${station.roomPosition} state-${station.state.toLowerCase()}`} key={station.id} onClick={(event) => { selectedTrigger.current = event.currentTarget; setSelectedName(station.name) }} aria-label={`${station.name}. ${officeStateLabel(station)}${station.activity ? `: ${station.activity}` : ''}. Open station details.`} title={station.activity || officeStateLabel(station)}>{busy && station.activity && <span className="speech" aria-hidden="true">{station.activity}</span>}<span className="pixel-station-name">{station.privacy === 'locked' ? '🔒 ' : ''}{station.name}</span><span className={`badge ${badge.tone}`}>{officeStateLabel(station)}</span>{station.state === 'Unknown' && <span className="neutral-label">NEUTRAL PRESENCE</span>}<PixelCharacter agent={station.id}/></button> }
  return <section className={`office-stage view-${show3d ? '3d' : '2d'}`} aria-label="Visual Batcave">
    {/* Single layer stage overlay for top controls */}
    {!showcase && <div className="mo-stage-overlay">
      <div className="mo-stage-top-left">
        <div className="mo-lot-bar">
          <LotPlate active={active}/>
          <span className="mo-bar-rule" aria-hidden="true"/>
          <SceneResourceStatus request={snapshot}/>
          {hud.length > 0 && <>
            <span className="mo-bar-rule mo-bar-rule-stats" aria-hidden="true"/>
            <div className="office-hud" role="list" aria-label="Key statistics">
              {hud.map((item) => {
                const body = <><span>{item.label}</span><b>{item.value}</b></>
                return (
                  <div role="listitem" key={item.label}>
                    {item.page && onNavigate ? (
                      <button type="button" className={`hud-chip${item.tone ? ` ${item.tone}` : ''}`} title={item.title ?? `Open ${item.page}`} onClick={() => onNavigate(item.page!)}>{body}</button>
                    ) : (
                      <span className={`hud-chip${item.tone ? ` ${item.tone}` : ''}`} title={item.title}>{body}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </>}
          <span className="mo-bar-rule" aria-hidden="true"/>
          <button type="button" className={`mo-bar-btn${briefing ? ' active' : ''}`} aria-expanded={briefing} aria-controls="office-panel" onClick={() => toggleBriefing()}>
            <Icon name="sidebar" size={16}/>
            <span>Briefing</span>
          </button>
        </div>
      </div>
    </div>}

    <div className="office-canvas">
      {show3d ? (
        <SceneBoundary fallback={<section className="empty-state"><h2>3D view unavailable</h2><p>The 3D Batcave could not start on this device.</p></section>}>
          <Suspense fallback={<LoadingState message="Loading the 3D Batcave..."/>}>
            <ManorOffice3D
              stations={office?.stations ?? []}
              onSelect={select3d}
              isFullscreen={isFullscreen}
              onToggleFullscreen={onToggleFullscreen}
              active={active}
            />
          </Suspense>
        </SceneBoundary>
      ) : <><p className="muted office-note">The 3D Batcave needs WebGL, which this browser does not provide. Showing a simple 2D view.</p><div className="room-tabs" role="tablist" aria-label="Batcave zones">{ROOMS.map((item) => <button role="tab" aria-selected={room === item} className={room === item ? 'active' : ''} onClick={() => setChosenRoom(item)} key={item}>{item} <span className="room-count">{counts[item]}</span></button>)}</div>
        <div className="room-scroll"><section className={`pixel-room flow ${room.toLowerCase()}`} aria-label={`${room} room`}><div className="room-label"><span>{room}</span><small>{room === 'Workspace' ? `${deskCount} HOT DESK${deskCount === 1 ? '' : 'S'} + MEETING ROOM` : 'QUIET BREAK AREA'}</small></div>
          {room === 'Workspace' ? <>
            <div className="flow-desks">{Array.from({ length: deskCount }, (_, index) => {
              const atDesk = stations.find((station) => station.seat === index + 1 && station.roomPosition !== 'meeting-area')
              return <div className="flow-desk-cell" key={index}>{atDesk && stationButton2d(atDesk)}<div className={`ws-desk${atDesk && atDesk.state !== 'Offline' ? ' occupied' : ''}`} aria-hidden="true"><i/></div></div>
            })}</div>
            <div className="flow-meeting"><div className="meeting-table" aria-hidden="true"><span>MEETING</span></div><div className="flow-crew">{stations.filter((station) => station.roomPosition === 'meeting-area').map(stationButton2d)}</div></div>
          </> : <>
            <div className="flow-lounge-props" aria-hidden="true"><div className="pixel-tv"/><div className="lounge-chair"/><div className="lounge-sofa"/><div className="coffee-table"/><div className="lounge-chair"/><div className="pixel-plant"/></div>
            <div className="flow-crew">{stations.map(stationButton2d)}</div>
          </>}
          {room === 'Lounge' && stations.length === 0 && <p className="room-empty">No declared idle presence</p>}
          {room === 'Workspace' && stations.length === 0 && office && <p className="room-empty">Desks are empty · crew is resting</p>}
        </section></div></>}
    </div>
    {show3d && !showcase && <small className="office-3d-hint">Click to select · left-drag to rotate · right-drag to pan · wheel to zoom · R to reset</small>}
    {!showcase && briefing && <aside id="office-panel" className="office-panel" aria-labelledby="office-panel-title" onKeyDown={(event) => { if (event.key === 'Escape' && !selected) { event.stopPropagation(); toggleBriefing(false) } }}>
      <div className="office-panel-head">
        <h2 id="office-panel-title" className="office-panel-title">Briefing</h2>
        <button type="button" className="icon-button" onClick={() => toggleBriefing(false)} aria-label="Close briefing"><Icon name="close" size={16}/></button>
      </div>
      <div className="office-panel-body">
        <Stats dashboard={dashboard ?? null} pending={dashboardPending} onNavigate={onNavigate}/>
      </div>
    </aside>}
    {selected && <OfficeDetail station={selected} onClose={closeDetail}/>}
  </section>
}
