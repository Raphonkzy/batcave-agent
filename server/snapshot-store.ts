import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { accessConfigDir } from './access.js'
import { logEvent } from './diagnostics.js'

// The last good Hermes snapshots, kept on disk so a restarted server (every save under
// `npm run dev`, or a reboot) can answer the first page at once instead of waiting 20 to 60 s for
// the CLI. A restored snapshot is only served while a fresh read runs behind it, and its own
// fetchedAt tells the page how old it is. Snapshots older than RESTORE_MAX_AGE_MS are ignored.
//
// The file lives next to the access-code file (owner-only permissions) and holds the same
// information Hermes already keeps in this user's home. BATCAVE_SNAPSHOT_CACHE=0 turns it off.

const RESTORE_MAX_AGE_MS = 15 * 60_000
const WRITE_DELAY_MS = 2_000
const FILE = 'snapshot-cache.json'

interface Stored { savedAt: number; value: unknown }

const enabled = process.env.BATCAVE_SNAPSHOT_CACHE !== '0' && !process.env.VITEST
const dir = accessConfigDir()
let store: Record<string, Stored> | undefined
let timer: NodeJS.Timeout | undefined

function load(): Record<string, Stored> {
  if (store) return store
  store = {}
  if (!enabled) return store
  try {
    const parsed = JSON.parse(readFileSync(join(dir, FILE), 'utf8')) as Record<string, Stored>
    if (parsed && typeof parsed === 'object') store = parsed
  } catch {
    // No file yet, or an unreadable one: start empty.
  }
  return store
}

/** The stored value for a source, when it is recent enough to show while a fresh read runs. */
export function restoreSnapshot<T>(name: string, now = Date.now()): { value: T; savedAt: number } | undefined {
  const entry = load()[name]
  if (!entry || typeof entry.savedAt !== 'number' || now - entry.savedAt > RESTORE_MAX_AGE_MS) return undefined
  return { value: entry.value as T, savedAt: entry.savedAt }
}

export function saveSnapshot(name: string, value: unknown): void {
  if (!enabled) return
  load()[name] = { savedAt: Date.now(), value }
  if (timer) return
  timer = setTimeout(flushSnapshots, WRITE_DELAY_MS)
  timer.unref?.()
}

/** Writes pending snapshots now (also called at shutdown). Atomic: temp file, then rename. */
export function flushSnapshots(): void {
  if (timer) clearTimeout(timer)
  timer = undefined
  if (!enabled || !store) return
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    const temporary = join(dir, `${FILE}.${process.pid}.tmp`)
    writeFileSync(temporary, JSON.stringify(store), { mode: 0o600 })
    renameSync(temporary, join(dir, FILE))
  } catch (error) {
    logEvent('SnapshotStore', 'Write failed', { reason: error instanceof Error ? error.message : 'unknown' })
  }
}
