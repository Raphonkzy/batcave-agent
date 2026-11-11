# Batcave v2 - Architecture Decision Records (DECISIONS.md)

This log records architectural decisions made following the Decision Ladder (D1-D5).

## ADR-001: Font Fallback Strategy for Gilroy
- **Context**: Gilroy is a commercial font not shipped by default in the repo. Section 5.2 allows user-provided Gilroy in `public/fonts/gilroy/` but strictly forbids illegal downloads or external CDN hotlinks.
- **Decision**: Define `@font-face` referencing `/fonts/gilroy/Gilroy-*.woff2` with `font-display: swap`. Provide official fallbacks using `@fontsource/plus-jakarta-sans` and `@fontsource/jetbrains-mono`, followed by modern system sans-serif stacks.
- **Consequence**: Perfect graceful degradation. When Gilroy files are added to `public/fonts/gilroy/`, the browser immediately renders Gilroy; otherwise, Plus Jakarta Sans provides a clean, modern aesthetic.

## ADR-002: Missions Data Tier Classification (Tier 2 - Partial)
- **Context**: Audit revealed Hermes Kanban tasks carry `task.assignee`, but some tasks are unassigned.
- **Decision**: In accordance with Section 5.5, classify data layer as **Tier 2 (SEBAGIAN)**. Build Swimlane, List, and Flow views displaying real assignments, and cleanly group unassigned tasks into an "Unassigned / Belum Ditugaskan" lane. Strictly forbid guessing or hallucinating task-agent relationships.
- **Consequence**: 100% adherence to Invariant 12.

## ADR-003: Performance Baseline & Software WebGL Evaluation
- **Context**: Headless test environment executes Chromium using SwiftShader software OpenGL.
- **Decision**: Absolute FPS on SwiftShader is unrepresentative of GPU hardware. Performance budgets are evaluated relative to baseline draw calls (112-136 calls), triangles (66k-100k), geometries (43-61), and frame-times as specified in Section 3.4 item 6.
- **Consequence**: Objective, reliable performance gating without hardware GPU false negatives.

## ADR-004: Invariant Guard Enforcement Script
- **Context**: Invariants must be machine-enforced at every Quality Gate.
- **Decision**: Created `scripts/verify/guard-invariants.ts` and executable wrapper `scripts/guard-invariants` verified by `tests/baseline/guard-invariants.test.ts`.
- **Consequence**: Immediate detection of illegal route drops, query parameter regressions, security bypasses, or external CDN additions.

## ADR-005: Persistent Side Navigation Layout (Intentional Design Conflict Override)
- **Context**: The original `DESIGN_BRIEF.md` specified a topbar-only shell with no sidebar and a floating bottom dock, requiring users to open search (⌘K) or bottom shortcuts to navigate routes. The system owner explicitly requested a persistent side navigation menu that is always visible on all pages (including Batcave 3D Home) without requiring search clicks.
- **Decision**: Introduce `.mo-side-nav` with responsive modes: full 224px width on desktop (>=1100px), 64px rail mode on tablets (760-1099px), and collapsible drawer with `.mo-nav-toggle` below 760px. Remove `.mo-bottom-dock` and obsolete dock elements. All 11 routes are permanently accessible grouped into *Operasi* and *Sistem*. Maintain 100% compliance with Invariant 6 (no legacy sidebar selectors `#app-sidebar` or `.drawer`).
- **Consequence**: Instant one-click navigation across all 11 routes on all screen sizes, cleaner layout architecture, and zero obstruction of 3D stage controls.

## ADR-006: "Lot" Interface — House-Simulation Game Layout (supersedes ADR-005 and the Minimal Obsidian palette)
- **Context**: The owner asked for a completely different, simpler and minimalist interface in the style of a house-simulation game, using the Gilroy font from `public/fonts/gilroy`, with the 3D scene left exactly as it is. The previous shell (top bar, side navigation, dark obsidian palette) and its 3,900-line stylesheet were replaced.
- **Decision**:
  - The 3D lot fills the screen. Navigation is a capsule of round mode buttons at the top right: **Live** (the 3D Batcave), **Work** (Missions, Task Board, Calendar, Activity), **Crew** (Agents, Usage, Memory, Folders) and an options menu (Logs, Settings, Search, Refresh, Full screen). Grouping lives in `src/navigation.ts`; the 11 routes, hashes and aliases in `routes.ts` are unchanged.
  - Every non-Live page opens as a rounded window over the paused lot, with the mode's pages as tabs and a round close button. Escape closes it. Each mode reopens on the page it was left on.
  - The live HUD: lot plate with the local clock and key numbers (top left), quick-panel buttons (right), a household-style crew panel with round portraits and a selection diamond (bottom left), and floor / wall / camera controls (bottom right). The agent pie menu, name tags, dialogs and panels use the same style.
  - Light palette: white panels, one blue accent, green for the selection diamond and progress bars. Tokens are in `src/styles/tokens.css` and their WCAG contrast is tested against the real file (`tests/tokens-contrast.test.ts`).
  - Gilroy is loaded from WOFF2 files converted from the user's TTF/OTF files. The old `@font-face` rules pointed at `.woff2` files that did not exist, so Gilroy never loaded before. `public/` stays out of git (commercial font), with the ADR-001 fallback unchanged.
  - The 3D scene, camera, characters and their components are unchanged. Only the HTML around the canvas and the canvas container's CSS changed.
  - Product names in UI strings stay generic ("house-simulation game"), as required by the originality rule.
- **Consequence**: Fewer, larger controls; one consistent navigation model. The stylesheet is split into `src/styles/{tokens,base,controls,shell,hud,pages,office-2d}.css`. `office-2d.css` carries over the no-WebGL fallback room unchanged. A CSS blur behind windows was tried and dropped: it cost about 120 ms per navigation on a software renderer, so the paused frame is tinted instead (median navigation 18.7 ms, `docs/performance/after-ui.json`).

## ADR-007: "Cave" Theme and Compact HUD (supersedes the ADR-006 palette; keeps its layout)
- **Context**: The owner kept the house-simulation layout of ADR-006 but asked for the dark identity of the crew's cave instead of a bright game look, a bat mark instead of the diamond, fewer separate buttons, and a character preview in the crew card.
- **Decision**:
  - Palette: graphite surfaces (`--surface: #111318`), steel lines, one signal-yellow accent (`--accent: #f5c518`) with dark ink on it, and translucent glass HUD panels. Tokens in `src/styles/tokens.css`; contrast still tested against that file.
  - Mark: `src/components/ui/BatMark.tsx`, an original bat silhouette drawn as an inline SVG path (no image, no font glyph, not a copy of any trademarked emblem). Used in the status bar, the lock screen, the crew card placeholder and over the selected agent's name tag. The 3D selection marker in the scene (`Plumbob.tsx`) is part of the 3D scene and was left unchanged.
  - Fewer groups: the status bar is one capsule (mark, name, clock, connection, crew/tasks/errors); quick panels are one vertical capsule; the bottom right is one dock (rotate, zoom, reset, a single wall-mode cycle button, a floor stepper, and one settings menu holding areas, quality, lighting and controls help). "Controls & help", the zone popover and the "Move character" strip no longer float separately.
  - Crew card: a 72x84 portrait renders the agent's own procedural model (`agentGear` + `characterParts`) in a small on-demand canvas (`CrewPortrait.tsx`), lit by a procedural environment only, so the scene's six-light budget is unchanged. Next to it: name, state, role title and current activity; three actions (Locate, Follow, More). More holds Details, Missions, Logs and the move/stop/resume commands. The roster sits in the same card as small rings in each agent's suit colours.
  - Entrance animations only move or scale, never fade from 0: on a slow renderer the animation timeline can stall, and a fade then left menus invisible.
- **Consequence**: Bottom-left footprint about 360x150 px (was about 420x230 plus a separate roster and command strip). One extra WebGL context exists while the 3D page is mounted (the portrait); it renders a frame only when the selected agent changes.

## ADR-008: "Tactical" HUD, Direct Agent Interaction, One Side Panel (supersedes the ADR-007 styling)
- **Context**: The owner asked for a more professional, less rounded look that still reads as a night-ops game with house-simulation play; clicking a character directly; name tags only when needed; an action menu that follows a walking agent; no duplicated quick windows; no stuck "Connecting".
- **Decision**:
  - Style: small radii (2 to 6 px), hairline steel frames with an amber corner bracket, cut corners (`--chamfer`) only on accent elements (active mode, primary buttons, floor badge, portrait). Type: Barlow Condensed for headings, labels and numbers (uppercase, tracked) over Barlow for body text; both local via @fontsource. Gilroy is no longer used.
  - Agents: the crew hit volume wins over furniture along the same ray (`userData.crew`, checked in `InteractionLayer`), so a click on a character selects it and opens its action wheel. Name tags show only for the hovered or selected agent, or under keyboard focus. The action wheel is pinned to the agent every frame (`ScreenFollower`), so it follows while the agent walks. The 3D selection diamond (`Plumbob.tsx`) was removed at the owner's request.
  - Side panels: the Tasks, Calendar and Tokens quick windows duplicated full pages and were removed, with their right-edge rail. The three-tab panel became one Briefing panel (the operations overview) opened from the status bar. Its token block (also a duplicate of Usage) was removed. One panel means nothing can open behind another.
  - API: Hermes reads run four at a time (`BATCAVE_CLI_CONCURRENCY`, measured 38 s serial vs 10 s for four reads); the last good snapshots persist to `~/.config/batcave/snapshot-cache.json` (up to 15 min old) so a restarted server answers at once; the crew view waits at most 3 s for the slow live probe and otherwise reports live state as Unknown until it arrives; CLI reads time out after 90 s instead of 35 s; OpenCode is started through its Windows `.cmd` shim, and "not installed" is no longer counted as an error; the HUD error count covers the last 5 minutes.
- **Consequence**: Fewer surfaces and no duplicated views. Measured on this machine: a restarted server answered `/api/office` in 0.02 s (was 22 s cold); a cold server with no snapshot file in 18 s.
