import { hashName } from '../../agents.ts'
// Gear for the Tactical Manor characters, by Hermes profile. Every design here is original:
// generic tactical and professional kit chosen for each role, in that role's colours. Any other
// profile (OpenCode included, and every agent from the eighth on) gets a deterministic mix of
// helmet, vest and accent derived from its name, so it looks the same on every device.
export type HeadMesh = 'command-helm' | 'aero-visor' | 'visor-band' | 'hard-helm' | 'scanner-goggles' | 'formal-earpiece' | 'automaton-optic-cluster'
export type TorsoMesh = 'heavy-plate' | 'data-harness' | 'reviewer-vest' | 'tactical-vest' | 'cross-harness' | 'kevlar-coat' | 'ballistic-chassis'
export type BackMesh = 'long-coat' | 'flight-pack' | 'antenna-mast' | 'thruster-pack'
export type LegGear = 'utility-belt' | 'tool-holsters' | 'heavy-boots' | 'articulated-limbs'
export type HandItem = 'cane' | 'field-tablet' | 'holo-checklist' | 'gauntlets' | 'data-slab'
export interface AgentGearConfig {
  profileId: string
  roleTitle: string
  palette: { baseDark: string; accentGlow: string; secondaryAccent?: string }
  headMesh: HeadMesh
  torsoMesh: TorsoMesh
  backMesh?: BackMesh
  legGear?: LegGear[]
  handItem?: HandItem
  offHandItem?: HandItem
  /** The automaton has its own chassis instead of a human body. */
  body: 'human' | 'automaton'
  /** Optional per-axis scale on the human torso and limbs, for a slighter or broader build. */
  silhouette?: [number, number, number]
  /** True when the look came from the fallback rather than the table. */
  fallback: boolean
}
type Entry = Omit<AgentGearConfig, 'profileId' | 'fallback'>
const TABLE: Record<string, Entry> = {
  bruce: { roleTitle: 'Tactical Commander', palette: { baseDark: '#23262b', accentGlow: '#ffaa00', secondaryAccent: '#d8f0ff' }, headMesh: 'command-helm', torsoMesh: 'heavy-plate', backMesh: 'long-coat', legGear: ['utility-belt'], body: 'human', silhouette: [1.12, 1, 1.08] },
  barbara: { roleTitle: 'Lead Developer', palette: { baseDark: '#1d2026', accentGlow: '#ffd000', secondaryAccent: '#4a1e12' }, headMesh: 'aero-visor', torsoMesh: 'data-harness', backMesh: 'flight-pack', handItem: 'gauntlets', body: 'human', silhouette: [0.88, 0.95, 0.85] },
  dick: { roleTitle: 'QA and Code Review', palette: { baseDark: '#14161c', accentGlow: '#00a8ff' }, headMesh: 'visor-band', torsoMesh: 'reviewer-vest', handItem: 'holo-checklist', body: 'human' },
  jason: { roleTitle: 'DevOps and Deployment', palette: { baseDark: '#2a2d30', accentGlow: '#ff1a1a', secondaryAccent: '#4a4f3a' }, headMesh: 'hard-helm', torsoMesh: 'tactical-vest', legGear: ['tool-holsters', 'heavy-boots'], body: 'human', silhouette: [1.08, 1, 1.06] },
  tim: { roleTitle: 'Research and Documentation', palette: { baseDark: '#1a1c22', accentGlow: '#00e676', secondaryAccent: '#5a1420' }, headMesh: 'scanner-goggles', torsoMesh: 'cross-harness', backMesh: 'antenna-mast', offHandItem: 'data-slab', body: 'human' },
  alfred: { roleTitle: 'Housekeeping and Scheduling', palette: { baseDark: '#2f3136', accentGlow: '#ffe0a3', secondaryAccent: '#cfd4da' }, headMesh: 'formal-earpiece', torsoMesh: 'kevlar-coat', handItem: 'cane', offHandItem: 'field-tablet', body: 'human' },
  default: { roleTitle: 'Tactical Combat Automaton', palette: { baseDark: '#141518', accentGlow: '#a855f7' }, headMesh: 'automaton-optic-cluster', torsoMesh: 'ballistic-chassis', backMesh: 'thruster-pack', legGear: ['articulated-limbs'], handItem: 'gauntlets', body: 'automaton' },
}
const FALLBACK_HEADS: HeadMesh[] = ['hard-helm', 'visor-band', 'scanner-goggles', 'aero-visor']
const FALLBACK_TORSOS: TorsoMesh[] = ['tactical-vest', 'reviewer-vest', 'cross-harness', 'data-harness']
/** Hues the named profiles already use; fallbacks keep at least 18 degrees away from them. */
const TAKEN_HUES = [40, 49, 203, 0, 147, 39, 271]
function hsl(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0')
  return `#${f(0)}${f(8)}${f(4)}`
}
export function fallbackHue(seed: number): number {
  const free = Array.from({ length: 360 }, (_, hue) => hue).filter((hue) => TAKEN_HUES.every((taken) => Math.min(Math.abs(hue - taken), 360 - Math.abs(hue - taken)) >= 18))
  return free[seed % free.length]
}
export function agentGear(profileId: string): AgentGearConfig {
  const key = profileId.trim().toLowerCase()
  const known = TABLE[key]
  if (known) return { ...known, profileId: key, fallback: false }
  const seed = hashName(key)
  return {
    profileId: key,
    roleTitle: 'Field Operative',
    palette: { baseDark: '#1e2126', accentGlow: hsl(fallbackHue(seed), 0.85, 0.55) },
    headMesh: FALLBACK_HEADS[(seed >>> 9) % FALLBACK_HEADS.length],
    torsoMesh: FALLBACK_TORSOS[(seed >>> 13) % FALLBACK_TORSOS.length],
    body: 'human',
    fallback: true,
  }
}
/** The five operatives whose suits stand in the vault (the steward has none). */
export const VAULT_PROFILES = ['bruce', 'barbara', 'dick', 'jason', 'tim'] as const
