# Grand Manor: pool-facing architectural refinement

## Orientation and original problems
World +Y is up, +Z is south; surface Y=11, upper Y=14.5, command deck Y=0. The pool is beyond the +Z end of the building. The original world configuration incorrectly put the entrance at (0,11,-8), facing -Z, with steps/driveway/roundabout extending to Z=-46. That is the rear. Glass was placed over solid exterior walls; adaptive lounge generation overfilled the public room; the service pantry lacked a working kitchen; large private wings depended on circulation through the library.

## Final plan
The footprint and pool remain adaptive to crew size. At 12 agents the main building spans X=-17.5..17.5, Z=-8..25.1 (irregular outline), with the front terrace/pool deck extending to Z=31.1. Entrance threshold=(0,11,25.1), outward normal=(0,0,1). Pool center=(14,11,28.1), size=8x4, unchanged.

| Space | Location / changes |
|---|---|
| Entrance terrace | +Z, X=-6..2; flush stone floor; open double doors, symmetrical planters and lanterns |
| Entrance hall | Central front, 12x3; marble floor, chandelier, paired console tables, unobstructed central runner |
| Main lounge | Central, Z=4.5..22.1 at 12 agents; two seven-seat purple salons, 2.1m central aisle, west-wall fireplace |
| Grand ballroom (internal ID grandFoyer) | Rear center, X=-6..6, Z=-8..4.5; checkerboard floor, circular medallion, golden chandelier and twin stairs retained; filler rugs removed |
| Billiards | Rear-left; green table retained with >=1.5m wall clearance and 1.2m furniture-free playable perimeter |
| Dining | Left wing; long table, paired seating and chandelier retained; direct kitchen access |
| Kitchen/pantry | Existing butlerPantry footprint; stove/oven counter, sink/tap, upper cabinets, refrigerator, island, pantry/wine storage and service counter |
| Gym | Dark left-wing room; existing treadmills, dumbbells, bench and bag retained |
| Gym bathroom | Adjacent grandBath; vanity, thermal bath, toilet stalls, shower panel/wet floor and marble finish |
| Master/guest rooms | Right wing; existing suites retained, larger master bed with brass detailing, guest beds, bedside tables, desks, wardrobes and ensuite tub/vanity/shower/toilet strips |
| Private corridor | Extended eastCorridor and cross-hall where needed; bedroom entrances only from corridor |
| Library | Rear-right; tall shelves, reading desk/chairs and catwalk retained; access through quiet private corridor, no direct ballroom doorway |

Small rosters gain unassigned master/guest accommodation inside the existing manor bounds; assigned suites and ownership are retained. Large rosters retain additional private suites rather than deleting agent accommodation.

## Exterior and shell changes
Removed rear driveway, roundabout and misleading rear entrance. Replaced them with lawn and a continuous +Z approach, open gate leaves, front stone terrace and offset pool-west connector. Pool, water spill and surrounding cliff retained. Three loungers regrouped at deck edges; balustrade split around connector; obstructing deck lamp relocated. All approach dimensions come from estateConfig(layout), not fixed screen directions. Exterior camera now looks from the pool-facing side. Ground-level windows share aperture definitions with wall meshing so glass is not embedded in solid walls.

## Validation and scope
Architecture tests cover counts 1,2,6,12,24,40,48: entrance axis, walkable pool connector, door clearance, playable billiards perimeter, kitchen/gym-bath adjacency, private access, real window apertures, asset preservation and reachability. Pre-change SHA-256 fingerprints cover untouched Command Deck/Upper Level zones, item geometry, walls, doors and stops (generated IDs excluded). Historical agent mapping remains identical; explicit capacity deltas allow the two salons and new entrance zones. No dependencies added to the project.

## Verification results
- Full suite: 370 tests across 42 files passed.
- Lint: zero errors; one React Fast Refresh export warning.
- Production build: passed; large-chunk warning remains.
- Chromium captured the actual scene in top and front views with no browser errors, using low quality and software rendering. High-quality screenshot capture timed out; high-quality visual appearance is not verified.
- Captures: [top view](images/batcave-manor-top.png), [front view](images/batcave-manor-front.png). These are captures, not a completed human visual review.

## Limitations
Bathrooms use existing open-plan ensuite/privacy-screen conventions, not enclosed separately zoned master/guest bathrooms. Master luxury is expressed by a larger bed and detailing rather than a larger room footprint. Door leaves are static/open, not interactive hinged objects; collision/path rules use the modeled opening. Window apertures are visual shell subdivisions, not traversable exterior doors. Agent navigation covers the front terrace/pool deck; the gate approach is exterior visual geometry, not an expanded agent walking grid. No roof or upper-floor architecture was redesigned.
