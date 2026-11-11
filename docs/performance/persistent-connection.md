# Persistent Hermes connection and navigation performance

Measured on Windows 11, Node 26, headless Chromium with a software WebGL renderer, a real local Hermes install (7 profiles). Raw numbers: `before.json`, `after.json`. Re-run with `scripts/verify/navigation-metrics.py` and `scripts/verify/backend-restart.py`.

## A. Root cause

Batcave does not hold a socket to Hermes. Hermes is the `hermes` CLI plus its home folder, read by the Express server through `execFile` (one command at a time, 3 to 6 s each on this machine; a full dashboard read is about 21 commands). The browser polls Express over HTTP. There is no WebSocket or EventSource, and no React Router (hash navigation in `App.tsx`). Four defects together produced the repeated "Connecting":

1. **Page-owned data.** Every page called `usePolling`, which kept its state in the component. Leaving a page discarded the data, so returning started again at `pending`, which the UI prints as "Connecting to crew" or "Connecting". Each visit also fetched again: 1.69 API requests per navigation, and 58 `/api/profile-lock` requests from per-component copies of `useProfileLock`.
2. **In-flight requests aborted by their own timer.** `usePolling` aborted the running request every time its interval fired (10 s for the crew). When the server needed longer than that, the browser abandoned every attempt and stayed in `pending` indefinitely. This was reproduced: the crew indicator was still "Connecting to crew" 90 s after load although the server had finished the work.
3. **Blocking cache expiry on the server.** Cached snapshots lived 45 s. The first request after that waited for the CLI again: `/api/dashboard` took 41.8 s after a 50 s idle gap.
4. **The 3D page was rebuilt on every visit.** The Batcave page was unmounted on navigation. Each visit created two WebGL contexts (one throwaway probe in `webglAvailable()`, one for the canvas) and left about 240 DOM nodes and 40 listeners behind (the unmounted page stays reachable; a heap snapshot pointed at react-three-fiber's store, which was not confirmed further): 733 to 5,835 DOM nodes after 20 rounds on the same page.

## B. Architecture changes

- **Backend `AgentManager`** (`server/agent-manager.ts`): one instance per process. States NOT_INITIALIZED, INITIALIZING, CONNECTED, RECONNECTING, DISCONNECTED, ERROR. "Connected" means a verification just succeeded (state files in the Hermes home, or `hermes profile list` at the front of the command queue). Initialization is a shared promise; later calls return the current status. A routine re-check runs every 30 s only while a browser has used the API in the last 2 min. Failures retry with exponential backoff (2 s base, 60 s cap, +-25% jitter), at most one verification at a time. `stop()` clears the timer.
- **Stale-while-revalidate cache** (`cachedSource` in `server/mission-control.ts`): an expired snapshot up to 5 min old is returned at once and refreshed once in the background. Manual refresh (`?fresh=1`) still waits for new data. A failed refresh is not retried for 5 s.
- **Start-up**: Hermes is verified, and the dashboard read starts, as soon as the server listens (`BATCAVE_PREWARM=0` disables the read).
- **Processes**: running CLI children are tracked and ended on SIGINT/SIGTERM; HTTP keep-alive raised to 65 s; graceful `server.close()`.
- **Diagnostics**: `GET /api/agent/status` (in-memory, never starts Hermes) and `GET /api/diagnostics` (request counts and timings per route pattern, cache hit/miss/stale/coalesced counters, CLI spawn counts, memory). Structured log lines such as `[AgentManager] State CONNECTED -> RECONNECTING {"failures":1}`; per-call events are not logged.
- **Frontend data store** (`src/data-store.ts`, `src/polling.ts`): one entry per API path holding data, the in-flight request and one timer, shared by every component and kept after unmount. Mounting a page shows cached data and refreshes silently only if it is older than the page's interval. Concurrent identical requests join one. Polls never overlap and are never aborted by the next tick; failures back off (interval doubling, cap 60 s, +-20% jitter); hidden tabs pause and resume once on return. Unchanged payloads keep the same object, so readers do not re-render. `useProfileLock` now uses the store.
- **`AgentProvider`** (`src/agent/`): mounted once above the page switch. Pages read the same connection state with `useAgentConnection()`. It tells apart first connection, server initialization, reconnecting (Hermes or the server link lost), and disconnected or error. A lost server link keeps the last status but is shown as reconnecting, never as live. A background re-check never shows a loading screen. Settings has an "Agent connection" panel with the counters.
- **Kept-alive 3D scene** (`App.tsx`, `Office.tsx`, `ManorOffice3D.tsx`): the Batcave page mounts on first visit and then stays mounted, hidden and `inert`, at the same size (no canvas resize). While hidden: `frameloop="never"`, no shortcuts, no clock, no fetching, dialogs closed, no re-render from the shell. Released after 10 min away. WebGL support is probed once per page load instead of once per visit.

Transport decision: no SSE or WebSocket. The data comes from CLI snapshots that change slowly; one 10 s poll of an in-memory endpoint is cheaper and simpler than a stream, and keeps the access-code and cookie behaviour unchanged.

## C. Files

New: `server/agent-manager.ts`, `server/diagnostics.ts`, `src/data-store.ts`, `src/agent/connection.ts`, `src/agent/AgentProvider.tsx`, `src/open-dialog.ts`, `src/pages/AgentConnectionPanel.tsx`, tests (`server/agent-manager.test.ts`, `src/agent/connection.test.ts`), `scripts/verify/navigation-metrics.py`, `scripts/verify/backend-restart.py`, `docs/performance/*`.
Changed: `server/index.ts`, `server/mission-control.ts`, `src/polling.ts`, `src/profile-lock.ts`, `src/App.tsx`, `src/pages/Office.tsx`, `src/pages/ManorOffice3D.tsx`, `src/pages/ManorQuality.tsx`, `src/pages/Settings.tsx`, `src/components/shell/SceneResourceStatus.tsx`, `src/hooks/useAgents.ts`, `src/styles.css`, `vitest.setup.ts`, `src/polling.test.tsx`, `server/mission-control.test.ts`.

## D. Measurements (20 rounds through all 11 pages = 220 navigations)

| Metric | Before | After |
| --- | --- | --- |
| API requests per navigation (includes background timers) | 1.69 (372 total) | 0.67 (147 total) |
| Navigations that showed a Connecting/Loading indicator | 55 of 220 | 0 of 220 |
| WebGL contexts created during navigation | 40 | 0 |
| DOM nodes on the Batcave page, start, round 5, 10, 20 | 733, 1,771, 3,051, 5,835 | 407, 409, 409, 409 |
| JS event listeners, same samples | 320, 486, 690, 1,140 | 270-307, flat |
| JS heap, same samples (MB) | 13.5, 15.8, 17.8, 23.2 | 13.0, 14.3, 14.3, 14.6 |
| Median navigation commit (two animation frames) | 14.1 ms | 14.2 ms in an A/B on non-3D pages (13.2 ms without the kept scene); 27 ms median over the full 11-page run, which includes returns to the 3D page |
| `/api/dashboard` right after cache expiry (50 s idle) | 41.8 s | 0.026 s |
| Cold start, first `/api/dashboard` | 34.7 s | 32.3 s (the CLI cost is unchanged; it now starts at server start) |
| EventSource / WebSocket connections | 0 | 0 |

Remaining requests after the change are timers (dashboard 15 s, crew 10 s, agent status 10 s), and one refresh per visit to Logs, which polls every 5 s by design.
The first before-run (the first run) agrees with `before.json`. Another before-run could not finish: with a cold cache the page stayed on "Connecting to crew" for 90 s (defect 2).

## E. Acceptance tests

| Test | Result |
| --- | --- |
| 1 Normal navigation: stays connected, no new initialization, no Connecting screen | Passed (0 of 220 navigations showed a loading indicator; the manager reports `initializations: 1`) |
| 2 Repeated navigation (20 rounds): initialization count 1, no growth | Passed (DOM nodes, listeners and WebGL contexts flat; heap +1.6 MB over the run, see F) |
| 3 Long-running task survives navigation | Not applicable as written. Batcave is a read-only dashboard: it starts no agent tasks. What exists is Kanban/session data read from Hermes; it is held in the shared store and on the server, so it survives navigation. Not tested with a live long-running task |
| 4 Concurrent requests share one manager and one read | Passed (unit tests for the shared initialization promise and for cache coalescing; live counters show `coalesced` reads and `initializations: 1`) |
| 5 Temporary interruption between backend and Hermes | Passed in unit tests (RECONNECTING, DISCONNECTED, backoff 1 s/2 s/4 s/8 s capped, recovery counted once, no second initialization). Not exercised against a real broken Hermes install |
| 6 Backend restart | Passed (`backend-restart.py`): loss detected in 10 s, "Reconnecting to the Batcave server" shown, page stayed rendered with no loading screen and no reload, "Hermes connected" 17.6 s after the server returned, new server initialized once |
| 7 Performance | Measured, see D |

Also: `tsc -b`, `eslint .` (0 warnings), `vitest run` (475 passed, 4 skipped as before), `npm run build`, `scripts/guard-invariants` all pass.

## F. Remaining issues

- A cold server still needs about 30 s (here) to read Hermes the first time; that is the CLI speed and the one-command-at-a-time rule, not changed. After that, reads are instant.
- Heap grew 13.0 to 14.6 MB over 20 rounds in the last run (it was +9.7 MB before). It flattened after round 5 but a longer run was not done.
- The per-visit leak of an unmounted 3D page was measured but its exact retainer was not pinned down (a heap snapshot pointed at react-three-fiber's store). Navigation no longer unmounts the scene, so it no longer happens per visit; it can still happen when the scene is released after 10 min away.
- Median navigation time over the full run went from 14 to 27 ms, while the A/B shows no difference on non-3D pages; the extra is the return to the 3D page. Not investigated further. Its p95 is 2.1 s with the software renderer (3.0 to 4.9 s before).
- The restart test and the first loads under a software WebGL renderer starve the Hermes CLI of CPU (11 of 12 commands timed out during one run). This is a property of the test machine and not of the change, but it was not verified on a GPU machine.
- `TASK.md` says "server/ must not be changed". It belongs to an earlier, finished task; this one required server changes.
