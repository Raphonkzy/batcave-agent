# Batcave v2 - Area Ownership Matrix

| Profile / Agent | Role | Write Areas & File Ownership | Core Responsibilities |
| :--- | :--- | :--- | :--- |
| **bruce** (A0) | Orchestrator & Tactical Commander | `docs/batcave-redesign/**`, integration merges | WP breakdown, wave management, decision escalation via Decision Ladder, Quality Gate execution, final report authoring. |
| **jason** (A1 / A9) | DevOps, Harness & Verifier | `scripts/verify/**`, `tests/baseline/**`, `docs/batcave-redesign/BASELINE/**`, `tests/**`, `scripts/guard-invariants` | Audits, baseline metrics, golden tests, invariant guards, screenshot/perf harnesses, independent accessibility & regression verification. |
| **barbara** (A2 / A8) | Lead Software Engineer (UI & System) | `src/styles.css`, `src/routes.ts`, `src/App.tsx`, `src/ui.tsx`, `src/pages/**` (except 3D engine internals), `public/fonts/**` | Gilroy typography integration, design tokens, fundamental UI components, shell navigation, 10 revamped pages + 2D pixel fallback. |
| **tim** (A3 / A6) | Lead Researcher & Architect (Layout & Data) | `src/utils/layout/**`, layout validation, `src/types.ts` (Missions extensions), selector pure functions, mock layer | Centralized furniture source of truth, `LayoutValidator`, scale metrics, lobby redesign, Missions pure data selectors & mock extensions. |
| **dick** (A4 / A5 / A7) | QA & 3D Specialist (Environment & Camera) | `src/scenes/manor/**`, `src/pages/ManorOffice3D.tsx`, `src/pages/Missions.tsx` (3D scene link) | Exterior world construction, Sims-style camera navigation (levels, wall cutaway modes, rotation snapping, follow cam), Missions UI view. |
| **alfred** | Butler & Hygiene Custodian | Repository cleanliness, scratch prune, git branch hygiene | Workspace cleanliness, memory and token stewardship, preventing debris accumulation. |
