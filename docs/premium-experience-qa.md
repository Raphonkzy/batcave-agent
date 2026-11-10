# Premium experience QA — implementation pass

## Implemented
- Persistent scene during pending/failed crew requests; compact connection disclosure, diagnostics and retry.
- Shared toolbar grouping, page breadcrumb, grouped existing sidebar destinations, focus/disabled states, quality settings moved into Controls & help after rendered QA reproduced a 1000px overlap.
- Shared window/aperture rules on ground and upper floors, window jambs/mullions/sills, shell-based cornices and pilasters, pool-facing portico and lamps.
- Roof underside, slate course articulation and chimney cap; footprint planning unchanged.
- Batched estate ironwork with selectable, reversible hinged gate leaves; duplicate static leaves removed. Contextual open/close and focus actions, geometry-local hover tint, reduced-motion handling and scene-session state preservation. Pool orientation and existing approach preserved.
- Rectangular framed glass elevator, lit car and animated doors tracking existing agent travel. No passenger floor-selection UI added.
- Actual object-instance surface tinting and isolated cloned materials for the animated jet; shared originals restored. Placement preview footprint remains an intentional build-mode validity indicator.
- Updated by the critical correction pass: left click selects, left drag rotates, right/middle drag pan; Q/E and wheel retained; R/Home explicitly reset. Both pointer selection and empty-space deselection reject non-left buttons.
- Rounded layered anatomy, neck/joint/boot/armor details, distinct existing gear/proportions, damped pose transitions and asynchronous subtle idle movement. Existing identities preserved.

## Verified
- Critical correction pass: 422 tests across 57 files pass. Lint has no warnings. TypeScript and production build pass; existing large scene-chunk warning remains.
- New regressions cover shared two-floor apertures at crew sizes 1/6/12/40, rectangular shaft rails, estate boundaries, instance identity alignment, highlight isolation/restoration, character identity and foot bounds, resource disclosure and mouse bindings.
- Rendered offline source: diagnostics/retry work and canvas remains mounted.
- Rendered Grand Manor and Command Deck: left drag rotates without selection; right drag translates without changing quaternion; wheel zooms; no post-interaction drift.
- Corrected rendered checks pass at 1920x1080, 1600x900, 1366x768, 1000x700, 800x650 and 390x844: no horizontal overflow, overlapping visible controls or offscreen visible buttons in the audited header/toolbar/HUD groups. Small-window audit caught the quality-picker overlap and drove its structural relocation.
- Both-floor rendered wall sampling: 247 samples, zero misses. No browser runtime errors in the completed assertion sequence. This is sampling, not exhaustive exterior visual approval.
- Software-renderer upper-manor sample: 116 calls, 182306 triangles, 49 geometries, 24 textures, six lights. Reported 1.5 FPS is not acceptable as a gameplay performance result; real GPU profiling remains required. Closed-disclosure controls are filtered by actual visibility. Follow-up rendered audit verifies expanded help/quality bounds at 1920x1080, 1366x768, 1000x700, 800x650 and 390x844, with internal scrolling and no horizontal overflow.

## Not yet accepted / remaining work
This is not a declaration that the entire master directive or an AAA art-quality standard is complete.
- Gate open/close interaction is verified through actual mesh picking and contextual controls: intermediate animation frames, settled status, Escape dismissal, scene-transition state preservation and no UI camera leakage. Browser audit exits 0 with no runtime errors. Gate collision, vehicle driveway simulation and vehicle entry remain unimplemented; the contextual panel states these limitations.
- Elevator reuses the existing deck-to-manor route; no upper-floor stop, passenger destination selector, synchronized passenger boarding queue, or complete shaft/floor aperture validation.
- Characters remain procedural six-bone rigs, not imported/skinned production character assets. Running, articulated knees/elbows, cape dynamics and all interaction-specific animations remain unimplemented.
- No new cinematic lighting/postprocessing pipeline or complete environment-wide asset overhaul. Existing scene-specific light rig/material architecture retained.
- Exhaustive exterior-angle visual approval, glass/reflection review, complete cross-scene gameplay rerun, fullscreen visual review and real GPU performance acceptance remain outstanding.
- Browser uses isolated 503 API responses and explicit development-only mock crew for deterministic QA, not replacement application data. Successful live backend flows are not validated here.
- Software-renderer results are not evidence of normal desktop GPU frame rate.
