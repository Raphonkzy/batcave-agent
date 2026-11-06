# Tactical Manor (v5): plan and decisions

Branch: `theme/tactical-manor`, started fresh from `main`. The earlier v3 attempt is kept, unchanged, on `theme/tactical-manor-v3`. Reused from it: the theme picker, the seeded random and noise helpers, the procedural texture helpers and the route planner (rewritten here for three floors).

## Baseline (`main`, Windows)

| Command | Result |
| --- | --- |
| `npm run lint` | passes |
| `npm test` | 122 passed, 2 failed, 7 skipped. The failures are environmental: `server/activity-folders.test.ts` (symlink creation denied, EPERM) and the file-mode checks in `server/access.test.ts` and `server/profile-lock.test.ts` (Windows ignores 0o600). `server/` is off limits, so they stay. |
| `npm run build` | passes; `Office3D` chunk 1,009.75 kB (gzip 272.14 kB) |

## Decisions agreed with the owner

1. **Original gear, not costume replicas.** Every structure in the spec is built (two levels, cliff, waterfall, elevator, five-pod suit vault, hangar with delta jet, armoured interceptor and bikes, war table, N suites, library, hearth, infinity pool) and every role keeps its colour, but the character gear is an original design. Pointed ears, scalloped capes, finned gauntlets, chest chevrons, crossed sticks, full red helmets and staffs are not reproduced. The pods display the same original suits.
2. **Package name.** `package.json` carries the repository name the owner chose. The zero-hit search for protected names covers code, UI strings, comments and the theme docs; package metadata is outside it.
3. **Statuses.** The server only reports `Idle`, `Working`, `Reviewing`, `Collaborating`, `Offline`, `Unknown`, and `server/` cannot change. `Deploying`, `Triage`, `Researching` and `Cron` therefore appear only in the dev mock; live data shows the server's own state. `Locked` is shown for agents under profile lock.
4. **English UI.** The theme picker (`Day`, `Night`, `Tactical Manor`) and every control in Manor mode are English. Strings shared with the Day and Night scenes stay as they are, so those themes do not change.
5. **Profiles.** `default` is the combat automaton; `opencode` and any other profile get the deterministic fallback look. The spec's `profileLock: true` is the existing `privacy: 'locked'` field. Profile ids are data keys and appear in lower case only.
6. **No room labels in 3D.** Agent name tags remain, as 2D overlays.

## Code map

| Concern | Location |
| --- | --- |
| Layout engine (pure) | `src/utils/layout/computeLayout.ts` with `dimensions.ts`, `zones.ts`, `subterranean.ts`, `surface.ts`, `structure.ts`, `geometry.ts`, `types.ts` |
| Routes between any two points, three floors | `src/utils/layout/navigation.ts` |
| Theme choice | `src/preferences.ts` (key `mc.theme`, values `day` / `night` / `manor`, old `light` / `dark` still read) |
| Classic scenes (untouched) | `src/pages/Office3D.tsx`, `src/scene3d/*`, `src/office3d-layout.ts` |

## Layout in one paragraph

The deck (y 0) is one open hall: the curved display wall (radius 6, 140 degrees) and console arc round the octagonal war table at (0, 2.5), the desk grid south of it (`cols = min(6, ceil(sqrt(1.5 N)))`), the suit vault on the west wall, three server banks and the forensics slab on the east, the hangar across the south and a catwalk over the basin (y -2) beyond the east wall. The glass elevator stands behind the display wall and comes up at the back of the foyer (y 11). The manor's core column is the foyer, then the hearth lounge stretching south to the terrace; the west wing holds billiards, dining and the butler's pantry; the east wing the two-storey library and the first ground-floor suites. Twin stairs climb to the upper floor (y 14.5): a landing, the west wing of suites and, from 3 agents, an east wing reached by a gallery. Suites: a third upstairs west, half the rest downstairs east, the remainder upstairs east. The terrace and the 8 x 4 pool sit at the south-east, the pool's east edge spilling into the chasm.

## Interpretations

- **Empty floor.** A floor cell is "in use" within 0.6 units of furniture, of a wall or of the floor's edge, or inside a door clearance, a stair or elevator landing, or a stop. Thresholds are unchanged (largest empty square 3 x 3, unused share 30 %). Decor (racks, crates, plants, chairs, cabinets) only fills squares at least 1.5 units across, so aisles stay open.
- **The manor's footprint is not a rectangle.** Rooms are sized by what they hold; the cliff-top outside them is grounds, not floor.
- **Camera "Y about 2.5 / 13.5".** The presets aim at those heights; the camera itself stands above and in front, so the whole floor is visible.

## How it was built

- **Phase A**: theme picker, the layout engine (two levels, one suite per agent, routes over three floors) and its tests.
- **Data**: `src/hooks/useAgents.ts` polls the server, or in development serves the mock from `src/hooks/mockAgents.ts`. The mock is behind `import.meta.env.DEV`, so the production build drops it. Checked by searching `dist/` for the mock's identifiers: none found.
- **Phase B**: the scene, as its own lazy page (`src/pages/ManorOffice3D.tsx`); `Office3D` only chooses between it and the classic scene. Draw calls are kept down by instancing every repeated part, tinting instances instead of adding materials, merging floors by finish and drawing glows as one point cloud.
- **Phase C**: the crew (`src/components/agent/`): original role gear, the combat automaton, role stations, idle rest and sleep, screens that follow the agent's state, 2D name tags.
- **Phase D**: quality levels with automatic step-down, reduced motion, mock tests, an originality test that scans code, comments and these docs for protected names, package metadata, and these measurements.

Phase D draw-call savings: the jet and the spikes cast shadows only on High, and on Medium only the crew's main parts do; the overview draws only the hangar and catwalk of the deck (the rest is under rock), screens are drawn only in the deck view, and the command spot casts no shadow in the overview.

## Measurements (Phase D)

Draw calls, Medium quality, 1280 x 800, including the shadow pass. Lights: 6 in every case.

| Agents | Command Deck | Full Overview | Grand Manor |
| --- | --- | --- | --- |
| 1 | 114 | 126 | 71 |
| 12 | 127 | 138 | 85 |
| 24 | 126 | 138 | 84 |
| 40 | 126 | 137 | 84 |

A 120-second run of `?mockAgents=cycle` (1 to 40 agents and back) on Low raised no exceptions.

Bundle: `ManorOffice3D` lazy chunk 115.86 kB (gzip 41.55 kB); `Office3D` chunk 1,010.86 kB (gzip 272.66 kB, +1.1 kB over `main`).

Frame rate is not measured here: this machine renders in software (SwiftShader, 1 to 4 FPS for any scene, Day and Night included). The 60 / 45 / 30 FPS targets have to be checked on a real GPU.

## Known limits

- `Deploying`, `Triage`, `Researching` and `Cron` appear only in the mock, because the server does not produce them.
- The desk grid has no lower block beyond 48 agents; the mock caps at 60.
- Test results on Windows: only the baseline's environmental `server/` failures (symlink EPERM, 0o600 file modes), nothing else.

## Redesign after review (owner's request)

- **One theme.** The theme picker, the Day and Night office scene (`Office3D.tsx`, `scene3d/environment.tsx`, `scene3d/props.tsx`, `office3d-layout.ts`) and the light palette were removed. The Office loads `ManorOffice3D` directly; the 2D rooms remain only for browsers without WebGL.
- **Walled deck.** The deck is now rooms behind glass partitions: command center (display wall against the north wall, console arc, war table at (0, -1.1), elevator moved to the north-west corner), operations room (the desks), suit vault, armory (new), server room, forensics lab, training room (new); the hangar and catwalk stay open. The foyer's stairs moved in to x = ±2.6 so the elevator fits in its north-west corner.
- **Gym** in the manor's west wing, south of the pantry.
- **No scattered decor.** The old filler dropped crates, chairs and plants in the middle of empty squares, all facing the same way. It is replaced by flat, square finishes (deck plates, hangar bays, rugs, gym mats, teak decking). New tests check that every seat faces what it belongs to, that every seated stop matches its seat, and that wall pieces have their back to a wall.
- **Draw calls (Medium, 1280 x 800):** N=1: deck 118, overview 127, manor 73; N=12: 130, 140, 86; N=40: 129, 139, 86. Six lights throughout.

## High-fidelity finishing pass

A later refinement pass for realism and correctness:

- **Waterfall direction.** The sheet's texture now scrolls downward (towards the basin), with a pulsing additive foam ring at the plunge and 18 drifting mist puffs on high quality.
- **Infinity pool.** Clearer, nearly smooth water; the ripples drift towards the eastern vanishing edge where the water spills into the waterfall.
- **Wet rock.** Cave rock within 4 units of the waterfall's foot uses a darker, glossier `wetRock` material (lower roughness, a little metalness) to read as damp. Skipped in the full overview, where the basin is under the cliff.
- **Grass.** A deterministic field of 1,200-2,000 instanced grass blades on the cliff-top lawn (one draw call), each with a dark-root-to-bright-tip vertex gradient, random yaw, scale and a slight bend. Thinned on low quality; omitted in the full overview, where tufts are sub-pixel.
- **Ensuite bathrooms.** Each suite is now 6.5 deep (was 4.5); the extra depth holds an ensuite along the south wall: a freestanding marble tub, a vanity with a framed mirror, and a walk-in glass shower. The bedroom keeps its proven circulation; the wardrobe moved to the door wall. The ensuite parts reuse existing materials, so they add no draw calls.
- **Corridors.** Suite corridors carry a central wine-red runner rug and brass wall sconces (treated as wall-mounted, so they never block the path). No seating is placed in corridors.
- **Characters.** `barbara` has a slighter athletic silhouette and a high auburn ponytail from a gap in her cowl; the `default` automaton gained heel micro-thrusters. The vault still shows exactly five original combat suits (the steward has no pod), keeping the originality policy.

Draw calls (Medium, 1280 x 800), after the pass: N=12 deck 133, overview 141, manor 88; six lights throughout. The small rise over the previous 140 is the wet-rock split and the grass field; FPS targets must be checked on real GPU hardware (this machine renders in software).

## Architecture pass (v4.3)

- **Grass containment.** The grass field is masked out of the manor building footprint (the union of all surface and upper-floor rooms except the terrace, plus a 0.25 margin) and the paved terrace, and thinned with a smooth falloff towards the walls. A dark granite foundation curb (0.35 high) under the whole building raises the interior floor above the lawn, so no blade can poke through. Grass no longer renders indoors.
- **Grand Communal Spa.** A new ground-floor room (`grandBath`) in the west wing, south of the gym: a sunken thermal bath with a marble kerb, a four-basin vanity with a long mirror, three private water-closet stalls along the inner wall, and a towel bench. The west wing's south edge and the lounge depth grow to fit it, the same pattern used for the gym.
- **Lounge circulation.** The hearth-lounge sofa columns were pulled in to x = ±2.3 so a ~1-unit clear band stays along each side wall, where the doors to the west-wing rooms (billiards, dining, pantry, gym, spa) and the east wing sit. This keeps every room reachable as the lounge deepens.
- **Rock detail.** The cave/cliff rock texture gained horizontal sedimentary banding, bright mineral veins and sharp dark fissures (four-octave noise), at no draw-call cost.
- **Character clearance.** Barbara's ponytail now falls from a rubber-rimmed socket ring, in tapering segments held behind the cowl so it never clips the neck or collar; the commander's cape hangs with a 0.03-unit clearance behind the back and legs.

Draw calls (Medium, 1280 x 800): N=12 deck 132, overview 141, manor 88; six lights throughout. All 116 layout tests pass, including no-overlap, inside-zone, no-empty-3x3, reachability and orientation for 1-48 agents.

## Fleet, lobby and rebrand pass (v5.0 directive)

Adapted to the current state of the code: the Day and Night scenes and the theme picker no longer exist, so there is nothing to keep unchanged there; the header lives in `App.tsx` (there is no `Header.tsx`).

- **Header.** The header and the tab title now carry the name the owner chose, read from `src/brand.ts` (and `index.html` for the first paint). `originality.test.ts` allows that name in those two files only and still forbids it everywhere else, including these docs. Going back is one edit in each file. The name is a protected one, so using it in a public repository is a trademark exposure, taken on the owner's instruction.
- **Hangar.** The yellow boxes on the floor were the hangar's own bare-floor finishing (an outlined plate, drawn wherever the 3x3 rule needed floor covered). Bare hangar floor is now a plain plate, and the servicing aisle is a marked lane; yellow hazard stripes remain only round pads that hold a vehicle, the lifts and the turntable. The vertical yellow beam was the overhead bridge across the bay; it is gone, and only one rail along the north glass wall remains. The deck grew deeper (hangar 18 deep, catwalk 3.2 wide) to hold the fleet: jet, assault VTOL, interceptor, combat APC, four pursuit bikes in one dock with charging posts, workshop (two lifts, workbench, two diagnostic benches, three tool chests) and the recon submersible on the wet dock. The hangar floor is steel grating.
- **Lobby.** The foyer grew from 12 x 8 to 12 x 12.5 to hold the reception desk, the medallion between the staircases and two seating clusters in front of the stairs' feet. The staircases moved to x = +-3.6 (the elevator sits in the north-west corner), are bowed slightly towards their walls, are marble with a glass balustrade and brass handrail on the open side only, and leave 2.2 x 2.2 clear at the foot. The mezzanine landing is 2.2 deep. The hearth lounge keeps its U-shaped sofa sets (the idle agents' seating); only the foyer's furniture was redone.
- **Cameras.** Two new views, Hangar Bay and Manor Lobby, alongside Command Deck, Grand Manor and Full Overview. OrbitControls use damping 0.06 and rotate/pan/zoom speeds 0.7/0.7/0.9; the polar angle stops just above the horizon of the target (pi/2 - 0.05, not pi/2 + 0.05 as the directive wrote), so the camera can never dip under the deck floor.
- **Performance.** The delta jet is merged into five meshes (it was nineteen), and several one-off batches share existing ones, so every view stays under 140 draw calls with six lights. Draw calls (Medium): deck 111-124, hangar 92-123, lobby 61-75, manor 78-92, overview 124-138 for 1, 12 and 40 agents.

## Simulasi Rumah & Lot HUD pass (PERINTAH KERJA 3-Level & Interaksi Agent)

- **Persistent Navigation:** `SideNav.tsx` across all 11 routes with 224px open / 64px rail states, mobile drawer toggle, and ADR-005 in `docs/batcave-redesign/DECISIONS.md`. Bottom dock cleanly removed.
- **Full Canvas & Safe-Area:** Removed colliding legacy `.office-3d` fixed aspect-ratio / border styles. `Canvas` now fills 100% of viewport with safe-area offsets calculated via `ResizeObserver` on `.mo-lot-hud`, writing `--hud-bottom` for camera goal margins.
- **3-Level System & Wall Modes:**
  - 3 levels: `upper` (`Lantai 2`), `ground` (`Grand Manor`), `deck` (`Command Deck`).
  - Wall modes: `wallsUp` (1, full height + roof), `cutaway` (2, south/east camera-facing walls lowered to 1.0m), `wallsDown` (3, 0.3m low curb).
- **Procedural Roof:** Slate shingle hip/gable roof over central core, west wing, and east library, stone chimney over hearth, copper ridge caps, merged buffers (<= 4 draw calls total). Only renders when `level === 'upper' && wallMode === 'wallsUp'`.
- **Simulation Lot HUD:** 3-cluster bottom HUD (`mo-lot-hud`) with left cluster (agent panel, summary, and roster strip), center cluster (3-level vertical elevator lift buttons + wall mode segmented control), and right cluster (snap Q/E, zoom +/-, reset R, focus F, zone focus popover).
- **Agent Interaction:** Raycasted hover outline/tooltip, single click selects agent (3D diamond plumbob marker, 5-slot radial menu, left HUD summary), double click toggles follow mode (`useFrame` tracking agent every frame).
- **Draw calls (Medium, 1280 x 800):** Command Deck 111-124, Grand Manor 74-92, Lantai 2 68-98 across 1-40 agents. Strict ceiling <= 150 draw calls observed. Exactly 6 lights.
