import { usePolling } from './polling.ts'

// Client side of the profile lock (see server/profile-lock.ts). The server withholds a locked
// agent's private data; this only decides what to show and asks for the PIN.

export interface ProfileLockStatus { enabled: boolean; agents: string[]; unlocked: string[]; pinLength: number; unlockMinutes: number }

/** Fired after a PIN unlocks or locks an agent, so every view refreshes its data. */
export const PROFILES_CHANGED = 'batcave:profiles-changed'

export type ProfileLockResult = { ok: true; status: ProfileLockStatus } | { ok: false; message: string }

export async function profileLockRequest(path: 'setup' | 'update' | 'disable' | 'unlock' | 'lock', body: Record<string, unknown> = {}, request: typeof fetch = fetch): Promise<ProfileLockResult> {
  try {
    const response = await request(`/api/profile-lock/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-batcave-request': '1', 'x-ruang-request': '1' }, body: JSON.stringify(body), credentials: 'same-origin' })
    const data = await response.json().catch(() => undefined) as (ProfileLockStatus & { error?: string }) | undefined
    if (!response.ok || !data) return { ok: false, message: data?.error ?? `The Batcave server answered HTTP ${response.status}.` }
    if (path === 'unlock' || path === 'lock' || path === 'update' || path === 'disable') window.dispatchEvent(new Event(PROFILES_CHANGED))
    return { ok: true, status: data }
  } catch {
    return { ok: false, message: 'The Batcave server could not be reached.' }
  }
}

/**
 * The profile lock status, shared by every view that asks (one request and one 30 s timer, not
 * one per view). Unlocks expire, hence the poll; a PIN change refreshes it through the app-wide
 * refresh that PROFILES_CHANGED triggers. On a failed refresh the last known status stays.
 */
export function useProfileLock(): ProfileLockStatus | undefined {
  const poll = usePolling<ProfileLockStatus>('/api/profile-lock', 30_000)
  return poll.status === 'ready' && Array.isArray(poll.data.agents) ? poll.data : undefined
}

/** 'locked' (PIN needed), 'unlocked' (opened in this browser) or 'open' (not locked). */
export function agentPrivacy(status: ProfileLockStatus | undefined, agent: string | undefined): 'locked' | 'unlocked' | 'open' {
  if (!status?.enabled || !agent) return 'open'
  const match = (list: string[]) => list.some((item) => item.toLowerCase() === agent.trim().toLowerCase() || (item === 'opencode' && agent.trim().toLowerCase() === 'open-code'))
  if (!match(status.agents)) return 'open'
  return match(status.unlocked) ? 'unlocked' : 'locked'
}
