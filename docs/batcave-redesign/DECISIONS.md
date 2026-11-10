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
