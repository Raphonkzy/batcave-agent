# Batcave v2 - Comprehensive Technical & Architectural Audit (Wave 0)

Date: 2026-11-05
Auditor: Jason Todd (DevOps & Harness Verifier) & Bruce Wayne (Tactical Commander)
Status: Completed & Verified

---

## 1. General Architecture & Stack Audit (3.1)

### 1.1 Technical Stack
- **Framework & Runtime**: React 19.1.1, Node.js >= 20, TypeScript ~5.9.2.
- **Bundler & Tooling**: Vite 7.1.7, `@vitejs/plugin-react` 5.0.4, tsx 4.20.5.
- **3D Graphics Engine**: Three.js 0.186.1, `@react-three/fiber` 9.8.1.
- **Backend & Middleware**: Express 5.1.0 (`server/index.ts`), proxy via Vite on `/api` -> `http://127.0.0.1:3001`.
- **Testing & Quality**: Vitest 3.2.7, ESLint 9.36.0 (`eslint.config.js` with TypeScript-ESLint flat config).
- **Styling Architecture**: `src/styles.css` with dark palette CSS custom properties (`--c-0b0e0c` to `--c-ffd5cc`), DM Sans & DM Mono fonts, and 2D pixel-art fallback sprite styling.

### 1.2 Directory Structure
```
batcave-agent/
├── bin/                       # CLI entry point (bin/batcave.js)
├── docs/                      # Documentation & screenshots
│   └── batcave-redesign/      # Redesign workspace & artifacts
├── public/                    # Static assets
│   └── fonts/gilroy/          # Gilroy commercial font placeholder directory
├── scripts/                   # Verification & invariant guards
│   ├── guard-invariants       # Shell wrapper
│   └── verify/                # Invariant checks, mapping generators
├── server/                    # Node/Express API server
│   ├── access.ts              # Access Code security middleware
│   ├── folders.ts             # Sandboxed file explorer API
│   ├── memory.ts              # Agent soul/memory inspection
│   ├── mission-control.ts     # Hermes CLI probe aggregations & Kanban
│   ├── privacy.ts             # Redaction & sanitization engine
│   └── profile-lock.ts        # Agent profile locking & PIN authorization
├── src/                       # Frontend application source
│   ├── components/            # UI components (agent rigs, HUD, dialogs)
│   ├── hooks/                 # Data hooks (useAgents, mockAgents)
│   ├── pages/                 # Page views (Batcave 3D, TaskBoard, Agents, etc.)
│   ├── scenes/manor/          # Three.js 3D Tactical Manor scene
│   └── utils/layout/          # Procedural layout generator & zone definitions
└── tests/                     # Unit, integration, characterization & baseline tests
    └── baseline/              # Invariant guard, golden mapping, smoke, security
```

### 1.3 Data Flow & Polling Pipeline
- **Polling Hooks**: `usePolling<T>(url, intervalMs)` implements resilient SWR polling with `AbortController`, stale data retention on network failure, and global refresh triggers via `RefreshContext`.
- **State Serialization**:
  - `/api/dashboard`: Aggregated status (runtime profiles, task counts, calendar, command health).
  - `/api/office`: Real-time agent station roster, states, seats, and activities.
  - `/api/tasks`: Hermes Kanban snapshot (`tasks.data` array).
  - `/api/tasks/:id`: Detailed task run history and timestamps.
- **Mock Layer (`src/hooks/mockAgents.ts`)**:
  - Activated conditionally in development builds via `?mockAgents=N` (fixed count) or `?mockAgents=cycle` (oscillates 1 to 40 agents).
  - Pure deterministic state assignment using Mulberry32 PRNG seed.
  - Stripped entirely from production bundles (`import.meta.env.DEV` check).

### 1.4 Baseline Build & Verification Telemetry
- **Test Suite**: 287 tests across 28 test files passing cleanly (24.05s).
- **Typecheck**: `tsc --noEmit` returns 0 diagnostics (0 bytes error output).
- **Linter**: ESLint returns 0 warnings, 0 errors.
- **Production Build**: Built in 7.86s:
  - Client index JS: 320.74 kB (gzip: 97.35 kB)
  - CSS bundle: 60.39 kB (gzip: 13.00 kB)
  - 3D Manor Three.js chunk: 1,086.67 kB (gzip: 303.34 kB)

---

## 2. 3D Scene & World Structure Audit (3.2)

### 2.1 Scene Composition & Hierarchy
- **Subterranean Cave**: Subterranean basin at Y = -2, command deck floor at Y = 0. Contains operations room, war amphitheater, suit vault, armory, server bastion, forensics lab, training gym, and hangar bay with vehicle fleet.
- **Surface Manor**: Ground floor at Y = 11, upper mezzanine at Y = 14.5. Contains grand foyer, hearth lounge, grand library, dining hall, butler pantry, gym, infinity pool terrace, and modular agent bedroom suites.
- **Cutaway Architecture**: Geometry-level cutaway. The south and east perimeter walls are truncated to `CUTAWAY_WALL = 1.0` units while interior walls are `INTERIOR_WALL = 2.4` units to permit unobstructed high-angle camera observation.
- **Chasm & Waterfall**: Eastern cliff side drops from Y = 11 to Y = -2 with animated procedural waterfall mesh and subterranean rock cavern walls.

### 2.2 Bounding Box & World Coordinates
- **Floor Coordinates**:
  - Subterranean Deck: `X: [-32, 28]`, `Z: [-28, 28]`, `Y: 0`
  - Surface Manor: `X: [-28, 28]`, `Z: [-24, 24]`, `Y: 11`
  - Total World Height: 21 units (`Y: -2` to `Y: 19`)
- **Exterior Boundaries**: Currently, exterior bounds truncate sharply at the cliff edge with no extended terrain, perimeter estate walls, or formal grounds.

### 2.3 Camera System & Presets
- Implemented in `src/scenes/manor/ManorCamera.tsx` using Three.js `OrbitControls`.
- Controls: Right-click/Middle-click/Two-finger drag = Pan; Left-click/One-finger drag = Orbit; Scroll/Pinch = Zoom.
- Damping: `dampingFactor = 0.06`, polar angle bounded `[0.15, PI/2 - 0.05]`.
- Existing 5 Presets:
  1. `Command Deck`: Position `(0, 18, 24)`, target `(0, 0, 2)`
  2. `Hangar Bay`: Position `(0, 16, 28)`, target `(0, 0, 14)`
  3. `Manor Lobby`: Position `(0, 22, 16)`, target `(0, 11, -3)`
  4. `Grand Manor`: Position `(0, 28, 22)`, target `(0, 11, 4)`
  5. `Full Overview`: Position `(26, 32, 34)`, target `(0, 5, 0)`

### 2.4 Furniture Placement & Layout Architecture
- **Single Source of Truth**: `src/utils/layout/computeLayout.ts` dynamically creates all furniture items, walls, doors, stops, and navigation links.
- **Rendering Pipeline**: `src/scenes/manor/batches.ts` merges static geometry into instanced batches (`Instanced.tsx`), ensuring draw calls remain bounded regardless of crew size.
- **Current Inventory**:
  - **Lobby (`grandFoyer`)**:
    - 1x `receptionDesk` (4.0 x 1.5 x 1.1)
    - 1x `alabasterWall` (5.6 x 0.2 x 3.4)
    - 1x `lobbyMedallion` (5.2 x 5.2 x 0.04)
    - 2x `roundRug` (3.0 x 3.0)
    - 2x `loungeTable` (0.7 x 0.7 x 0.45)
    - 8x `tubChair` (0.7 x 0.7 x 0.85)
    - 1x `luggageTrolley` (1.2 x 0.6 x 1.4)
    - 3x `marbleUrn` (0.7 x 0.7 x 1.6)
    - 2x `grandStair` (twin bifurcated staircase flights)
  - **Hearth Lounge (`hearthLounge`)**:
    - 1x `fireplace` (3.0 x 1.2 x 3.5)
    - 1x `rug` (4.6 x 4.2)
    - 1x `coffeeTable` (1.2 x 0.8 x 0.42)
    - 1x `chesterfield` (2.6 x 0.95 x 0.85, back sofa)
    - 2x `chesterfield` (1.8 x 0.95 x 0.85, side sofas)

### 2.5 Anchors & Zone Capacity
- Defined in `layout.paths.stops` (`Stop` objects).
- Total capacities per zone scale dynamically:
  - `operationsRoom`: N desks (1 desk per agent for N = 1..40+).
  - `commandAmphitheater`: 8 war table briefing stops (`warRing`) + 1 command seat (`warCommand`).
  - `hearthLounge` & `grandFoyer`: 15+ lounge seating stops (`sofa`, `lobby`).
  - `bedroomSuites`: N suites, N beds, N suite desks (scales with agent count).
- Over-capacity behavior: When idle seats exceed lounge capacity, agents overflow to private suites (`suiteDesk` and `bed`).

### 2.6 Scale Estimation
- Standard interior door height: 2.4 units -> 1 unit corresponds to **1.0 meter**.
- Ceilings: 3.5m (deck/rooms) to 7.5m (foyer atrium).
- Desks: 2.6m x 1.2m x 0.85m.

### 2.7 Layout Anomalies & Defects Identified
1. **Fireplace Separation**: The grand fireplace is located in `hearthLounge` rather than being the commanding focal element of the grand hotel lobby as specified in Section 5.7.
2. **Scattered Lobby Furniture**: The current lobby uses two separate 4-chair circles around small cocktail tables rather than an integrated, formal hearth lounge composition with sofa, coffee table, and side armchairs.
3. **Corridor Clearances**: Entry path from south portal to the grand twin staircases and central reception desk requires guaranteed clearance corridor (>= 2.0m) free from any seating bounding boxes.

---

## 3. Missions Data Model Audit (3.3)

### 3.1 Hermes Kanban Structure
- Extracted via `hermes kanban list --json` on backend.
- Object schema:
  - `id`: Unique string task identifier.
  - `title`: Task subject / title.
  - `status`: Lifecycle stage (`todo`, `ready`, `running`, `blocked`, `review`, `done`).
  - `assignee`: String matching agent profile name or alias (e.g. `bruce`, `barbara`, `coder`).
  - `priority`: Numeric priority (1 = high, 2 = medium, etc.).
  - `board`: Kanban board slug.
  - `private`: Boolean flag set by privacy middleware when locked.

### 3.2 Task-to-Agent Linkage
- **Field**: `task.assignee`.
- **Status Attributed**: When `task.assignee` matches an agent's id or alias, `station.currentTask` is populated with the task title, and `station.activity` is formatted as `"Kanban: <title>"`.
- **Telemetry Finding**:
  - Assigned tasks carry valid `assignee` values.
  - Unassigned tasks have `assignee: undefined` or empty strings.
  - **Audit Verdict**: **SEBAGIAN (Tier 2)**. Tasks without assignees are valid operational work items and must be aggregated in an `Unassigned / Belum Ditugaskan` category. Guessing or inventing assignees is strictly prohibited.

### 3.3 Temporal Data (Timestamps & Durations)
- Detailed task timestamps (`createdAt`, `startedAt`, `completedAt`) exist in `/api/tasks/:id` (`TaskDetail`), but are not uniformly present on all basic Kanban card summaries.
- **Rule**: Timeline view will only be enabled if >= 80% of active tasks contain a valid `startedAt` timestamp; otherwise, the tab will present an informative banner explaining data availability.

### 3.4 Profile Lock Impact
- Locked agents' attributed tasks have titles transformed to `[REDACTED]` / `🔒 Private task` and `private: true`.
- Redaction is strictly enforced before data reaches the client.

---

## 4. Wave 0 Audit Summary

| Component | Audit Status | Quality Metric |
| :--- | :--- | :--- |
| **General Architecture** | PASSED | Zero TypeScript errors, zero lint warnings, 287/287 tests green. |
| **3D Scene Pipeline** | PASSED | Software WebGL functional; draw calls (71-136), triangles (66k-100k) measured. |
| **Missions Data Layer** | PASSED | Tier 2 established; `task.assignee` verified as sole link. |
| **Security & Invariants** | PASSED | Invariant guard test green; golden mapping identical across 96 runs. |
