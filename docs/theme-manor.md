# Tactical Manor

The 3D Office is the Tactical Manor: a two-level scene with an operational command deck in a cave and a residential manor on the cliff above it. Everything is procedural: no images, no models and no 3D text. It is the only 3D office; the earlier Day and Night office scenes and the theme picker were removed, and the whole app uses the dark palette. Browsers without WebGL get a simple 2D view of the rooms.

## Opening it

Open the Office (`#/office`). There is nothing to switch on.

## The scene

| Level | Height | What is there |
| --- | --- | --- |
| Command deck | y 0 (basin at -2, ceiling at 4) | walled rooms behind glass partitions: the **command center** (curved display wall with its middle against the north wall, console arc, octagonal war table, glass elevator in the north-west corner), the **operations room** (one desk per agent in straight rows facing the command center), the **suit vault** (5 glass pods on the west wall, a maintenance bench), the **armory** (weapon racks on the west wall, gear benches down the middle), the **server room**, the **forensics lab** (lockers on the east wall, the slab), the **training room** (heavy bags on the east wall, sparring mats); then the open hangar (delta jet, armoured interceptor, bikes, painted parking bays) and the catwalk over the plunge basin |
| Manor, ground floor | y 11 | foyer, hearth lounge, billiards, dining, butler's pantry, gym (treadmills, dumbbell rack, bench, heavy bag), a grand communal spa (sunken thermal bath, four-basin vanity, three private water-closet stalls), two-storey library with a reading nook, first suites, terrace with an 8 x 4 infinity pool spilling into the chasm. Corridors carry a wine-red runner and brass wall sconces. |
| Manor, upper floor | y 14.5 | landing, west wing of suites and, from 3 agents, an east wing reached by a gallery |

A glass elevator joins the levels, and a waterfall falls from the pool lip down the cliff to the basin, with a pulsing foam ring and drifting mist where it lands. Each private suite has an ensuite bathroom (a freestanding marble tub, a vanity with a mirror, and a walk-in glass shower), and the ground floor has a shared grand communal spa. The cliff-top lawn carries a field of procedural grass tufts, kept strictly outdoors: a granite foundation curb raises the interior floor above the lawn, and the grass is masked out of the building footprint and the paved terrace. There is exactly one private suite per agent. Rooms carry no labels in 3D; agent name tags are 2D overlays.

## Tidy by rule

Nothing is scattered. Every piece either stands with its back to a wall, facing into its room, or sits in a straight row down the room's middle. Every seat faces what it belongs to: desk chairs their desks, console chairs the display wall, dining chairs the table, sofas the coffee table, reading chairs each other across a lamp table, sun loungers the pool. Floor that would otherwise stand bare gets a flat, square, axis-aligned finish: an inset plate on the deck, a painted parking bay in the hangar, a rug in the manor, a mat in the gym, teak decking on the terrace. Tests in `src/utils/layout/computeLayout.test.ts` check all of this for 1, 2, 6, 12, 24 and 40 agents, together with the spec's limits (no bare square over 3 x 3, at most 30 % unused floor).

## The crew

- Each role (`bruce`, `barbara`, `dick`, `jason`, `tim`, `alfred`) wears its own original gear in its own colour. `alfred` has no suit pod.
- `default` is a tactical combat automaton: a faceted chassis, reverse-joint legs and a violet multi-lens sensor array.
- `opencode` and every other profile get a fallback look derived from the name, the same on every device.
- Busy agents go to their role station. Idle agents rest in the manor. `Sleep` sends them to their own suites.
- An agent under profile lock shows `Locked`, and its screens show only a padlock.

## Controls

| Control | Effect |
| --- | --- |
| `Command Deck` / `Hangar Bay` / `Manor Lobby` / `Grand Manor` / `Full Overview` | Camera presets (stored in `batcave.manorView`, default `Command Deck`) |
| `Upper Floor` | Shows or hides the upper floor (`batcave.manorUpper`) |
| `Sleep` | Idle agents sleep in their suites (`batcave.manorSleep`) |
| `Pan` | Dragging moves the view instead of rotating it |
| `Reset view` | Back to the current preset |
| Mouse / touch | Drag to rotate, right-drag or two fingers to pan, scroll or pinch to zoom, click an agent for details |

With `prefers-reduced-motion`, the camera jumps instead of flying, the lanterns stop flickering and the waterfall holds still.

## Quality

Stored in `batcave.quality`. The default is `Medium`.

| Level | Shadows | Water and screens | Decor |
| --- | --- | --- | --- |
| High | all shadow lights | mist at the plunge basin, animated scanlines | full |
| Medium | command spot only (off in the overview, where the deck is under rock) | simpler waterfall, simple screens | full |
| Low | none | no mist, static screens, no fog | half the stalactites and floor finishes |

If the frame rate stays below 30 FPS for 5 seconds in a row, the quality drops one level for the session and the widget shows `auto-lowered`. The saved choice is kept.

## Lights

The scene uses exactly 6 lights, plus an image-based fill from a generated room environment:

1. Command spot over the war table (cool white, the Medium shadow light)
2. Hangar spot (amber), over the turntable
3. Hearth point light (flickers)
4. Lobby point light, hung with the chandelier over the floor medallion
5. Sun / moon directional light over the terrace, following the local hour
6. Fill point light that follows the camera focus

## Development mock

Only in `npm run dev`; a production build contains none of it.

- `/?mockAgents=12#/office` shows 12 synthetic agents (up to 60). The mix covers `Working`, `Reviewing`, `Collaborating`, `Deploying`, `Triage`, `Researching`, `Cron` and `Idle`, with at least one locked agent.
- `/?mockAgents=cycle#/office` grows the crew from 1 to 40 and back, one step every 1.5 s.
- `&noAutoQuality` keeps the chosen quality (useful on software renderers).
- `window.__batcaveRenderStats` reports fps, draw calls, triangles, lights, meshes and shadow casters.

`Deploying`, `Triage`, `Researching` and `Cron` exist only in the mock. The server reports `Idle`, `Working`, `Reviewing`, `Collaborating` and `Unknown`, and live data shows exactly those.

## The fleet (hangar and wet dock)

Two rows of vehicles with a marked servicing lane between them. Every pad has a vehicle on it, and no bare floor is ever outlined in yellow.

| Row | From west to east |
| --- | --- |
| Front | the turntable with the delta-wing jet, the assault VTOL (hexagonal-prism fuselage, two ducted fans, four landing struts), the armoured interceptor, the automaton's dock |
| Back | the six-wheeled combat APC (three armoured layers, vision slits, hexagonal comms dome), the four-bike dock with charging posts, the workshop (two hydraulic lifts, a workbench, two diagnostic benches, three tool chests) |
| Wet dock | on the catwalk over the basin, a steel grating platform holding the recon submersible (torpedo hull, dome canopy, dive planes, propeller) |

The rows are spread over the full width of the bay and the back row stands against the south wall, so the arrangement follows the deck's size. The overhead rail runs along the north glass wall only; nothing hangs across the middle of the bay. Hazard stripes appear only round pads under a vehicle, the lifts and the turntable.

## The lobby

The foyer is a hotel lobby, 12 x 12.5: a curved Nero Marquina reception desk with fluted mahogany panelling before a backlit alabaster wall (three brass clocks, key cubbies), a diamond-inlaid marble medallion under a three-tier crystal chandelier, two circular conversation clusters (four velvet tub armchairs round a marble table, on a round plum rug), a brass luggage trolley and fluted marble urns. Twin marble staircases with glass balustrades and brass handrails rise to the mezzanine; the railing runs only along the open side of each flight. There are 2.2 x 2.2 units of clear floor at the foot of each staircase and 2.2 units of landing at the head, and the mezzanine's glass railing leaves an opening at each stair.

## Measured draw calls (Medium, 1280 x 800)

| Agents | Command Deck | Hangar Bay | Manor Lobby | Grand Manor | Full Overview |
| --- | --- | --- | --- | --- | --- |
| 1 | 111 | 110 | 61 | 78 | 124 |
| 12 | 124 | 123 | 75 | 92 | 136 |
| 40 | 122 | 92 | 75 | 87 | 138 |

Lights: 6 in every case. These counts include the shadow pass. Frame rate was not measured: the test machine renders in software (SwiftShader), so frame-rate targets have to be checked on real GPU hardware.
