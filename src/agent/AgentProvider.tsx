import { useMemo, type ReactNode } from 'react'
import { usePolling } from '../polling.ts'
import { AgentConnectionContext, deriveConnection, type ServerAgentStatus } from './connection.ts'

/**
 * Mount once, above the page switch: it survives every navigation. It reads the server's
 * connection state through the shared data store (one request every 10 s, however many pages
 * come and go) and gives every page the same answer.
 */
export function AgentProvider({ children }: { children: ReactNode }) {
  const poll = usePolling<ServerAgentStatus>('/api/agent/status', 10_000)
  const connection = useMemo(() => deriveConnection(poll), [poll])
  return <AgentConnectionContext.Provider value={connection}>{children}</AgentConnectionContext.Provider>
}
