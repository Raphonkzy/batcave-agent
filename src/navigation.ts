import { navigation, type Page } from './routes.ts'

// The interface works like a house-simulation game: one live view of the lot, and a few modes
// whose pages open as windows over the paused world. Routes and their hashes are unchanged
// (see routes.ts); this only groups them.

export type ModeId = 'live' | 'work' | 'crew' | 'system'

export interface Mode {
  id: ModeId
  label: string
  icon: string
  /** Shown as the tooltip of the mode button. */
  hint: string
  pages: Page[]
}

export const MODES: Mode[] = [
  { id: 'live', label: 'Live', icon: 'home', hint: 'The 3D Batcave', pages: ['Batcave'] },
  { id: 'work', label: 'Work', icon: 'clipboard', hint: 'Missions, tasks, schedules and activity', pages: ['Missions', 'Task Board', 'Calendar', 'Activity'] },
  { id: 'crew', label: 'Crew', icon: 'users', hint: 'Agents, token usage, memory and folders', pages: ['Agents', 'Usage', 'Memory', 'Folders'] },
  { id: 'system', label: 'Options', icon: 'more', hint: 'Logs and settings', pages: ['Logs', 'Settings'] },
]

/** Every route belongs to exactly one mode; an unknown page falls back to Live. */
export function modeOf(page: Page): Mode {
  return MODES.find((mode) => mode.pages.includes(page)) ?? MODES[0]
}

// Fail at load time, not silently, if a route is added without a mode.
const unplaced = navigation.filter((page) => !MODES.some((mode) => mode.pages.includes(page)))
if (unplaced.length > 0) throw new Error(`Pages without a mode: ${unplaced.join(', ')}`)
