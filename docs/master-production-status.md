# Master production specification — verified status

Date: 2026-11-10. This is an incremental production-improvement pass, **not full acceptance of the master specification**.

## Inspected

- React/TypeScript application shell, sidebar routing and operational pages.
- React Three Fiber scene composition, instancing, procedural character parts, joint-group animation, camera controls, selection, floor visibility and adaptive-quality reporting.
- Layout generation, room geometry, circulation grids, pool/ground intersections, roof and enclosure helpers, estate geometry, waterfall and existing elevator.
- Backend read routes, Hermes/OpenCode roster relationships, Memory/Folder security boundaries and tests.
- Git history: committed layout ac50309 / current HEAD d35243a compared with uncommitted redesign. Source pipeline and missing production assets documented in `production-asset-pipeline.md`.

## Completed and verified in this continuation

### Showcase isolation

The developer-only `/?characterShowcase` view no longer has gameplay toolbar controls or a persisted side panel over its inspection controls. A browser test reproduced the interception before the fix; the same interaction now succeeds without force-clicking.

All existing profiles (`bruce`, `dick`, `jason`, `tim`, `damian`, `barbara`, `alfred`, default) were exercised with front, side, rear, three-quarter and face captures. Idle/procedural walk preview controls were exercised for each. Forty PNGs and an audit JSON are stored at `/tmp/batcave-character-audit/` on this machine. These are inspection evidence, not approval of anatomy, costume fidelity, rigging or natural animation.

### Rendering and controls

- Removed the scene's inherited ultrawide width cap in the preceding implementation pass.
- Strengthened browser regression to wait for actual canvas sizing and assert canvas/viewport agreement. Previous overflow-only checks could pass while the canvas was still stale; those earlier results are superseded.
- Correct canvas dimensions verified at 1280×800, 1920×1080, 2560×1080, 800×650 and 390×844. Canvas height is viewport minus the 48px application header.
- No horizontal page overflow or audited visible controls outside viewport bounds at those sizes.
- Floor/environment button transitions and cutaway modes preserve the current camera position and orientation in the audited sequence; zero measured position drift.
- Sidebar closed by default, Escape dismissal, exactly one fullscreen action and enter/exit behavior verified.
- Sunrise/noon/sunset/night change actual sun intensity/direction, sky and environment intensity, not just background color.
- Added explicit time presets and numeric local/manual clock; midnight minute rounding is tested.
- Render-stat frame timings now use a rolling 300-frame window rather than permanently retaining startup samples.

### Operational pages

Agents, Missions, Task Board, Calendar, Activity, Usage, Memory, Folders, Logs and Settings render nonblank content and produce no browser runtime errors in isolated offline smoke testing. This verifies route/error rendering, not every interactive workflow.

A temporarily started **built** backend returned HTTP 200 for `/api/health`, `/api/memory`, `/api/folders`, `/api/tasks` and `/api/office`. Memory/Folders reported one agent; Office reported one station. No profile contents or private data were printed. Successful HTTP responses do not prove every source is populated or that file contents are editable.

### Tests

- `npm test`: **439 tests passed, 63 test files passed**.
- `npm run lint`: passed, no ESLint warnings/errors.
- `npm run build`: passed, including client and server TypeScript compilation.
- `git diff --check`: passed.
- `scripts/verify/showcase-and-routes.mjs`: passed, zero browser runtime errors.
- `scripts/verify/master-browser.mjs`: passed, zero browser runtime errors.
- jsdom reports its existing unavailable canvas `getContext` implementation in WebGL-fallback tests; actual WebGL is covered separately by Chromium.
- Existing Gilroy font-resolution warnings and a large scene-chunk warning remain in the production build.

## Geometry implemented in the preceding master-spec pass

- Separate west garden pool court and open pergola/privacy planting, avoiding the entrance approach.
- Subtracted pool footprint from paving, lawn and intersecting cliff support slabs so ground surfaces cannot cover the water volume; clipped subtraction and layout-clearance tests added.
- Added layered rock shoulders and a visible spring source around the animated Command Deck waterfall, retaining foam and quality-dependent mist.
- Existing manor wall/roof enclosure helpers, gate interaction, navigation and backend contracts retained.

These changes are implemented and regression-tested, but exhaustive art-direction approval, natural rock silhouette review, pool reflections, pergola clearance and every exterior/interior camera angle are **not accepted as complete**.

## Measured rendering — not performance acceptance

Latest Chromium run uses forced SwiftShader software rendering, device scale factor 0.5, low quality, six development mock agents, a development server, screenshots and scripted scene transitions. These are **not hardware GPU benchmarks or steady-state measurements**.

| Scene sample | Reported FPS | Calls | Triangles | p50 frame ms | p95 frame ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Grand Manor | 1.4 | 117 | 170,012 | 82.9 | 2902.2 |
| Upper Level | 1.8 | 117 | 170,012 | 217.2 | 2878.6 |
| Command Deck | 0.7 | 118 | 177,010 | 359.3 | 2619.4 |

Observed canvas-ready timing: 10,754 ms (includes 2.2s scripted settling delay and development loading). Browser-reported JS heap sample ~37.3 MB; this is not GPU memory. Some render statistics may lag scene switches by a frame; figures are diagnostic snapshots. Real GPU frame-time captures, stable per-scene windows, actual hardware tiers and 60 FPS acceptance remain outstanding.

Raw results and scene PNGs: `/tmp/batcave-master-qa/` (temporary machine-local evidence, not committed assets).

## Partial or unimplemented requirements

### Mansion restoration

Not restored to an asserted historical reference. The sole committed layout has a −Z entrance; uncommitted redesign has a +Z entrance and different lounge composition. The request's reference screenshot is absent. No arbitrary room reset or relocation was performed in this continuation. The exact intended historical composition needs confirmation before a destructive restoration.

### Characters and animation

No new production character GLB, Blender source, skinned humanoid skeleton, weight painting, facial topology, individual fingers, authored animation clips or cloth simulation was created. Existing characters remain procedural and do not meet the specified stylized-realistic anatomy/identity standard. Damian still uses a generic fallback. **No character or animation is production-approved.** The showcase exposes this gap instead of disguising placeholders as finished assets. See `production-asset-pipeline.md` for asset delivery and QA requirements.

### Elevator, vehicles and gameplay

Existing elevator cabin/door motion tracks the existing deck-to-manor travel route. Passenger floor selection, upper-floor stop, boarding queues, complete floor apertures and synchronized passenger/cabin interaction remain incomplete. No new driving, collision physics, vehicle entry/exit animation, production vehicle assets or broad interaction animation set was implemented.

### Hermes files and security

The existing folder/file API is read-only. Memory displays supported real profile documents; unsupported saves remain unavailable. No fake Save button or unsafe write route was added. Real editing requires an explicitly designed, permission-checked backend contract. Profile-lock, path-confinement and redaction protections remain intact.

### Asset/performance pipeline

No production LOD character sets, compressed textures, optimized hero GLBs, true environment-specific asset streaming or hardware GPU acceptance. Source remains React/TypeScript/R3F/Three.js with existing IDs and API relationships preserved.

## Files changed in this continuation

- `src/pages/Office.tsx`: suppress gameplay overlay/persisted panel in developer showcase only.
- `src/pages/ManorQuality.tsx`: rolling frame-time sample window.
- `src/pages/EnvironmentControls.tsx`: actual clock and time presets.
- `src/pages/Office.showcase.test.tsx`: showcase/normal UI isolation regression.
- `src/pages/ManorQuality.test.tsx`: sample replacement regression.
- `src/pages/EnvironmentControls.test.tsx`: clock normalization and preset regression.
- `scripts/verify/master-browser.mjs`: assert actual canvas sizing, include renderer metadata.
- `docs/master-production-status.md`: this evidence and limitations report.

The working tree also contains earlier implementation changes. They were preserved, not silently overwritten or attributed solely to this continuation.
