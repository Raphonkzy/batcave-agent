import { useEffect, useRef, type MutableRefObject } from 'react'
import { StatusDot } from '../ui/Primitives.tsx'

export interface AgentRadialMenuProps {
  agent: {
    id: string
    name: string
    state: string
    task?: string
    model?: string
  }
  x: number
  y: number
  onClose: () => void
  onInspect: () => void
  onFollow: () => void
  onLocate: () => void
  onMissions: () => void
  onLogs: () => void
  /** Receives the root element, so the scene can keep it pinned to the walking agent. */
  rootRef?: MutableRefObject<HTMLDivElement | null>
}

export function AgentRadialMenu({
  agent,
  x,
  y,
  onClose,
  onInspect,
  onFollow,
  onLocate,
  onMissions,
  onLogs,
  rootRef,
}: AgentRadialMenuProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleClickOutside)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  // 5 slots arranged radially around cursor (radius: 76px)
  // 1: Top (Inspect) -> angle -90 deg
  // 2: Top-Right (Follow) -> angle -18 deg
  // 3: Bottom-Right (Locate) -> angle 54 deg
  // 4: Bottom-Left (Missions) -> angle 126 deg
  // 5: Top-Left (Logs) -> angle 198 deg
  const R = 76
  const slots = [
    { label: 'Inspect', angle: -90, action: onInspect },
    { label: 'Follow', angle: -18, action: onFollow },
    { label: 'Locate', angle: 54, action: onLocate },
    { label: 'Missions', angle: 126, action: onMissions },
    { label: 'Logs', angle: 198, action: onLogs },
  ]

  return (
    <div
      ref={(element) => { containerRef.current = element; if (rootRef) rootRef.current = element }}
      className="mo-radial-menu-root"
      style={{ left: x, top: y }}
      role="menu"
      aria-label={`Interaction menu for ${agent.name}`}
    >
      {/* Center status marker badge */}
      <div className="mo-radial-center">
        <StatusDot status={agent.state} size={10} />
        <span className="mo-radial-agent-name">{agent.name}</span>
      </div>

      {slots.map((slot) => {
        const rad = (slot.angle * Math.PI) / 180
        const posX = Math.round(Math.cos(rad) * R)
        const posY = Math.round(Math.sin(rad) * R)
        return (
          <button
            key={slot.label}
            type="button"
            className="mo-radial-slot"
            style={{
              transform: `translate(calc(-50% + ${posX}px), calc(-50% + ${posY}px))`,
            }}
            onClick={() => {
              slot.action()
              onClose()
            }}
          >
            {slot.label}
          </button>
        )
      })}
    </div>
  )
}

