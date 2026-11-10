import type { ManorView, Level, WallMode } from '../scenes/manor/ZoneLayout.ts'
export const VIEW_KEY = 'batcave.manorView'
export const UPPER_KEY = 'batcave.manorUpper'
export const LEVEL_KEY = 'batcave.level'
export const WALL_MODE_KEY = 'batcave.wallMode'

export const VIEWS: { view: ManorView; label: string; title: string }[] = [
  { view: 'exterior', label: 'Exterior Grounds', title: 'The estate grounds, gates and driveway' },
  { view: 'deck', label: 'Command Deck', title: 'The operations room, war table and command center' },
  { view: 'hangar', label: 'Hangar Bay', title: 'The fleet: jet, VTOL, interceptor, APC, bikes and the submersible' },
  { view: 'lobby', label: 'Manor Lobby', title: 'The grand hotel lobby: reception, twin staircases and seating' },
  { view: 'manor', label: 'Grand Manor', title: 'The foyer, lounge, library and suites' },
  { view: 'overview', label: 'Full Overview', title: 'Both levels, the cliff and the waterfall' },
]

export function stored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = (localStorage.getItem(key) ?? localStorage.getItem(key.replace('batcave.', 'ruang.'))) as T | null
    return value && allowed.includes(value) ? value : fallback
  } catch {
    return fallback
  }
}

export function storedLevel(): Level {
  try {
    const val = localStorage.getItem(LEVEL_KEY)
    if (val === 'deck' || val === 'ground' || val === 'upper') return val
    // Migration from old batcave.manorView
    const oldView = localStorage.getItem(VIEW_KEY)
    if (oldView === 'deck' || oldView === 'hangar') return 'deck'
    if (oldView === 'manor' || oldView === 'lobby') return 'ground'
    if (oldView === 'exterior' || oldView === 'overview') return 'upper'
    return 'ground'
  } catch {
    return 'ground'
  }
}

export function storedWallMode(): WallMode {
  try {
    const val = localStorage.getItem(WALL_MODE_KEY)
    if (val === 'wallsUp' || val === 'cutaway' || val === 'wallsDown') return val
    return 'cutaway'
  } catch {
    return 'cutaway'
  }
}

export function remember(key: string, value: string) { try { localStorage.setItem(key, value) } catch { /* per-browser convenience only */ } }
export const SLEEP_KEY = 'batcave.manorSleep'
