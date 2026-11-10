# Critical manor, camera and drawer corrections

## Exact architectural cause
- `src/utils/layout/structure.ts` builds walls independently per walkable floor. Shared room walls use the smaller neighboring height; the grand foyer is 7.5 m high above y=11, while the lounge is 3.5 m and the library 5.5 m. This omitted the exposed upper bands above the shared walls.
- `roofPlan.ts` correctly selected highest room-volume tops, but no vertical envelope connected unequal room tops. Existing-wall sampling could not detect walls that never existed.
- Roof rendering was restricted to Upper Level even in Full Walls. Grand Manor Full Walls also excluded the upper-floor shell.

## Correction
- Added a room-volume envelope, subtracting existing wall coverage and preserving intentional door apertures. Only missing vertical masonry bands are added; no floor slabs cross the double-height foyer or staircase voids.
- Full Walls now includes the complete upper shell and roof on both surface-floor views. Cutaway and Walls Down retain their intentional floor inspection behavior; camera side changes do not modify the Full Walls enclosure.
- Existing room footprints, furnishings, pool/front orientation, roof sections, grounds and gate are preserved.

## Reproduction and rendered evidence
Baseline rendered rays missed the foyer south upper band at y=17 and east above-library band at y=18. After repair both hit masonry; the north control ray also hits. Roof rays over every roof-plan section have zero misses.
Ten actual application captures are saved in `/tmp/batcave-enclosure`: front, rear, left, right, four elevated corners, top, central close-up. Self-contained preview gallery: `docs/critical-enclosure-gallery.html`. Capture harness freezes the sole camera loop only during QA screenshots. Automated rendered geometry is verified; no claim of independent human visual approval is made. Artifact auto-open was unavailable in WSL.

## Camera
- Left drag rotates; right and middle drag pan in screen space; wheel zooms. Q/E retained.
- Canvas-only 5 CSS-pixel classifier tracks maximum excursion, suppresses post-drag clicks including out-and-back gestures, preserves ordinary clicks, and cleans up on cancellation/blur/unmount.
- R/Home explicitly reset (R still rotates in placement mode); F focuses selected objects/characters/gate; Escape closes interactions.
- Single OrbitControls owner retained, numeric preset identity retained, no reinitialization on resize/unrelated renders.
- Rendered Grand Manor and Command Deck pass left rotation without object selection, right pan with unchanged orientation, wheel zoom and settled-camera stability. Real gate mesh selection passes with the updated controls. Unit regressions cover reset, transition interruption, follow interruption, resize persistence and gesture cleanup.

## Drawer root cause and correction
- The backdrop started below the header but its child was fixed at top=0. A legacy global nav margin-top:50px also shifted the new drawer; nav links inherited space-between alignment.
- Drawer now uses shared header height and 272px width, zero inherited navigation margin, left-aligned icon/label units, internal scrolling and a 12% black backdrop without blur. Existing routes, focus trap, pin behavior and closed default preserved.
- Rendered bounds pass 1920x1080, 1600x900, 1366x768, 1280x720 and 800x650: top=header bottom=48px, width=272px, bottom=viewport bottom, no overflow, correct label gap, no blur. Escape, close, burger, outside click, navigation and camera-isolation checks pass.

## Technical verification
422 tests across 57 files pass. Lint clean. TypeScript, production build and git diff whitespace checks pass. Existing unresolved optional Gilroy asset and large scene-chunk build warnings remain. Isolated development crew / unavailable API responses used for browser QA; live backend behavior is not replaced. Real GPU performance is not accepted by these software-renderer runs.
