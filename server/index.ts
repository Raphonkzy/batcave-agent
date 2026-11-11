import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type NextFunction, type Request, type Response } from 'express'
import { alwaysHiddenFor, excludedFor, FolderError, listFolder, publicAgent, readFolderFile, resolveAgentFolders } from './folders.js'
import { installAccess } from './access.js'
import { redactActivity, redactCalendar, redactDashboard, redactLogs, redactMemory, redactOffice, redactTasks, redactUsage } from './privacy.js'
import { installProfileLock, isHidden, type Privacy } from './profile-lock.js'
import { API_VERSION } from './api-version.js'
import { collectMemory } from './memory.js'
import { getActivity, getCalendar, getChannels, getCommandLog, getDashboard, getKnowledge, getLogs, getOffice, getSnapshot, getTaskBoard, getTaskDetail, getUsage, terminateChildProcesses, verifyHermes, type CacheRead } from './mission-control.js'
import { AgentManager } from './agent-manager.js'
import { diagnosticsSnapshot, logEvent, recordRequest } from './diagnostics.js'
import { flushSnapshots } from './snapshot-store.js'

const HOST = '127.0.0.1'
// BATCAVE_PORT is the primary port, with legacy aliases RUANG_PORT / MISSION_CONTROL_PORT still honoured.
const PORT = Number(process.env.BATCAVE_PORT ?? process.env.RUANG_PORT ?? process.env.MISSION_CONTROL_PORT) || 3001
// The built UI sits next to the server: ../dist from server/*.ts (development, npm start)
// and ../../dist from build/server/*.js (the installed package).
const distDirectory = [new URL('../dist', import.meta.url), new URL('../../dist', import.meta.url)].map((url) => fileURLToPath(url)).find((path) => existsSync(join(path, 'index.html'))) ?? fileURLToPath(new URL('../dist', import.meta.url))

const app = express()
app.disable('x-powered-by')

// The one owner of the Hermes connection state. Every route reads it; none starts its own.
const agentManager = new AgentManager({ verify: verifyHermes })

app.use('/api', (request, response, next) => {
  response.set('Cache-Control', 'no-store')
  // Request count and duration per route pattern (never per URL, so no ids or queries are kept),
  // and a note that a browser is using the API so the connection monitor stays awake.
  const started = process.hrtime.bigint()
  response.on('finish', () => recordRequest(`${request.method} ${request.route?.path ?? '(unmatched)'}`, Number(process.hrtime.bigint() - started) / 1e6, response.statusCode))
  agentManager.touch()
  next()
})

const startedAt = new Date().toISOString()
app.get('/api/health', (_request, response) => { response.json({ ok: true, apiVersion: API_VERSION, startedAt }) })

// Optional access code (off by default): locks every other /api route until it is entered.
installAccess(app)

// Connection state and counters. In-memory only: reading them never starts or restarts Hermes.
app.get('/api/agent/status', (_request, response) => { response.json(agentManager.status()) })
app.get('/api/diagnostics', (_request, response) => { response.json({ agent: agentManager.status(), ...diagnosticsSnapshot() }) })
// Optional profile lock (off by default): a PIN withholds the private data of chosen agents.
const privacyOf = installProfileLock(app)

// Manual refresh bypasses cached values while sharing any in-flight collection.
const cacheRead = (request: Request): CacheRead => ({ now: Date.now(), forceRefresh: request.query.fresh === '1' })
// Every snapshot is shared and cached; the private data of locked agents is withheld per request.
const routes: Record<string, (now: CacheRead, privacy: Privacy) => Promise<unknown> | unknown> = {
  '/api/runtime': getSnapshot,
  '/api/dashboard': async (now, privacy) => redactDashboard(await getDashboard(now), privacy),
  '/api/tasks': async (now, privacy) => redactTasks(await getTaskBoard(now), privacy),
  '/api/calendar': async (now, privacy) => redactCalendar(await getCalendar(now), privacy),
  '/api/activity': async (now, privacy) => redactActivity(await getActivity(now), privacy),
  '/api/knowledge': getKnowledge,
  '/api/office': async (now, privacy) => redactOffice(await getOffice(now), privacy),
  '/api/batcave': async (now, privacy) => redactOffice(await getOffice(now), privacy),
  '/api/channels': getChannels,
  '/api/logs': async (now, privacy) => redactLogs(await getLogs(now), privacy),
  '/api/command-log': () => getCommandLog(),
}
for (const [path, handler] of Object.entries(routes)) {
  app.get(path, async (request, response) => {
    const now = cacheRead(request)
    response.json(await handler(now, await privacyOf(request)))
  })
}
const locked = (response: Response, agent: string) => response.status(423).json({ error: `🔒 ${agent} is locked. Enter the PIN to see it.`, locked: 'profile', agent })
app.get('/api/usage', async (request, response) => {
  const now = cacheRead(request)
  response.json(redactUsage(await getUsage(Number(request.query.days) || 7, now), await privacyOf(request)))
})
app.get('/api/tasks/:id', async (request, response) => {
  const board = typeof request.query.board === 'string' && request.query.board ? request.query.board : undefined
  const privacy = await privacyOf(request)
  const listed = (await getTaskBoard()).tasks.data.find((task) => task.id === request.params.id && task.board === board)
  if (listed && isHidden(privacy, listed.assignee)) { locked(response, listed.assignee!); return }
  const detail = await getTaskDetail(String(request.params.id), Date.now(), board)
  if (!detail) { response.status(404).json({ error: 'Unknown task.' }); return }
  const assignee = detail.task.data?.assignee
  if (isHidden(privacy, assignee)) { locked(response, assignee!); return }
  response.json(detail)
})

// Folders: read-only view of each agent's own folder. Only agents the server resolved
// (every Hermes profile this machine reports, and OpenCode when installed) can be opened.
async function agentFolders() {
  const runtime = await getSnapshot()
  return resolveAgentFolders(runtime.profiles.data.map((profile) => profile.name))
}
async function openFolder(profile: string) {
  const folders = await agentFolders()
  const folder = folders.find((item) => item.profile === profile)
  if (!folder) throw new FolderError('Unknown agent.', 404)
  if (!folder.available) throw new FolderError(folder.reason ?? 'Folder not available.', 404)
  // Other agents' folders inside this one are hidden, and the Hermes profiles folder always is.
  return { folder, excluded: [...excludedFor(folder, folders), ...(await alwaysHiddenFor(folder))] }
}
function folderRoute(handler: (request: Request) => Promise<unknown>) {
  return async (request: Request, response: Response) => {
    try {
      response.json(await handler(request))
    } catch (error) {
      if (error instanceof FolderError) { response.status(error.status).json({ error: error.message }); return }
      throw error
    }
  }
}
app.get('/api/memory', folderRoute(async (request) => redactMemory(await collectMemory(await agentFolders()), await privacyOf(request))))
app.get('/api/folders', folderRoute(async () => ({ agents: (await agentFolders()).map(publicAgent), fetchedAt: new Date().toISOString() })))
/** A locked agent's folder answers 423 (Locked) until the PIN unlocks it in this browser. */
async function guardFolder(request: Request) {
  const profile = String(request.params.profile)
  if (isHidden(await privacyOf(request), profile)) throw new FolderError(`🔒 ${profile} is locked. Enter the PIN to see it.`, 423)
  return openFolder(profile)
}
app.get('/api/folders/:profile/list', folderRoute(async (request) => {
  const { folder, excluded } = await guardFolder(request)
  return listFolder(folder, request.query.path, excluded)
}))
app.get('/api/folders/:profile/file', folderRoute(async (request) => {
  const { folder, excluded } = await guardFolder(request)
  return readFolderFile(folder, request.query.path, excluded)
}))

app.use('/api', (_request, response) => { response.status(404).json({ error: 'Not found' }) })

if (existsSync(distDirectory)) {
  app.use(express.static(distDirectory))
  app.get(/^(?!\/api\/).*/, (_request, response) => { response.sendFile('index.html', { root: distDirectory }) })
}

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  void _next
  console.error('Batcave request failed:', error instanceof Error ? error.message : error)
  response.status(500).json({ error: 'Internal error' })
})

const server = app.listen(PORT, HOST, () => {
  console.log(`Batcave listening on http://${HOST}:${PORT}${existsSync(distDirectory) ? ' (serving built UI)' : ' (API only; run the Vite dev server for the UI)'}`)
  // Verify Hermes once, now, so the first page load finds a known state instead of starting the work.
  void agentManager.initialize()
  // Start the slow Hermes reads (tens of seconds on some machines) before the first page asks for
  // them. Requests that arrive meanwhile join these reads. BATCAVE_PREWARM=0 turns this off.
  if (process.env.BATCAVE_PREWARM !== '0') {
    const warmStarted = Date.now()
    void getDashboard(Date.now()).then(
      () => logEvent('Server', 'Initial data ready', { durationMs: Date.now() - warmStarted }),
      () => logEvent('Server', 'Initial data read failed'),
    )
  }
})
// Browsers poll every 10 to 60 s. Node's default keep-alive (5 s) would close the socket between
// polls and force a new connection each time; keep it open a little longer than the slowest poll gap.
server.keepAliveTimeout = 65_000
server.headersTimeout = 66_000

let shuttingDown = false
function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  logEvent('Server', 'Shutting down', { signal })
  agentManager.stop()
  flushSnapshots()
  const ended = terminateChildProcesses()
  if (ended > 0) logEvent('Server', 'Ended running Hermes commands', { count: ended })
  server.close(() => process.exit(0))
  server.closeIdleConnections?.()
  // Do not wait on a browser that keeps a connection open.
  setTimeout(() => { server.closeAllConnections?.(); process.exit(0) }, 3_000).unref()
}
process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
