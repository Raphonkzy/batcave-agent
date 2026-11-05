// Named dimensions of the Tactical Manor (section 5.1 of the spec) and the sizes that follow from
// the number of agents. Pure numbers only: no scene objects.
export const DECK_Y = 0
export const BASIN_Y = -2
export const CAVE_CEILING = 4
export const SURFACE_Y = 11
export const UPPER_Y = 14.5
export const MANOR_TOP = 19
// Command center: the display wall curves round the war table with its middle against the north
// wall; the console arc follows it on the inside.
export const ARC_RADIUS = 6.5
export const ARC_HEIGHT = 2.8
export const ARC_SPAN = (100 * Math.PI) / 180
export const ARC_PANELS = 7
export const CONSOLE_RADIUS = 4.8
export const CONSOLE_SEAT_RADIUS = 3.9
export const WAR_TABLE = { x: 0, z: -1.1, radius: 2.2, height: 0.85 }
/** South edge of the command center; the operations room starts here, behind a glass wall. */
export const COMMAND_SOUTH = 3.5
export const COMMAND_MIN_W = 16
// Operations room: one desk per agent in rows facing the command center.
export const DESK_W = 2.6
export const DESK_D = 1.2
export const DESK_PITCH_X = 4
export const DESK_PITCH_Z = 3
/** Gap between the glass wall and the first row of desks. */
export const DESK_GRID_Z = COMMAND_SOUTH + 1.2
export const MAX_DESK_COLUMNS = 6
// Suit vault, server bastion, forensics lab
export const SUIT_PODS = ['bruce', 'barbara', 'dick', 'jason', 'tim'] as const
export const POD = { baseRadius: 0.65, baseHeight: 0.2, glassRadius: 0.55, glassHeight: 2.5, capHeight: 0.15, spacing: 2, wallOffset: 1 }
export const SERVER_BANK = { length: 4, depth: 0.8, height: 3.5, count: 3, aisle: 1.2 }
export const FORENSICS_SLAB = { w: 3, d: 1.5 }
export const SIDE_STRIP = 7
/** The vault ends here; the armory runs south of it, down to the hangar. */
export const VAULT_SOUTH = 3
/** The server room ends at -1.5 and the forensics lab here; the training room runs south of it. */
export const SERVER_SOUTH = -1.5
export const FORENSICS_SOUTH = 4
export const WEAPON_RACK = { w: 1.6, d: 0.4, h: 2.2, pitch: 1.8 }
export const GEAR_BENCH = { w: 0.9, d: 1.8, h: 0.9, pitch: 3 }
export const SPARRING_MAT = 3
export const GYM_D = 6
// Hangar bay
// Two rows of vehicles with a servicing aisle between them: the flight wing (turntable jet, assault
// VTOL) and the heavy interceptor in front, the APC, the bike dock and the workshop behind, and the
// wet dock with the recon submersible on the catwalk beside them.
export const TURNTABLE_DIAMETER = 9
export const INTERCEPTOR_BAY = { w: 5, d: 8 }
export const VTOL_PAD = { w: 7.8, d: 7.2 }
export const APC_BAY = { w: 8.4, d: 4.4 }
export const BIKE_DOCK = { w: 4.8, d: 2.8, h: 0.3 }
export const SUB_DOCK = { w: 2.8, d: 5.4 }
export const GANTRY_Y = 3.8
export const HANGAR_DEPTH = 18
export const HANGAR_MIN_WIDTH = 30
// The wet dock: a steel grating platform over the basin, wide enough for the submersible's dive planes.
export const CATWALK_WIDTH = 3.2
export const CHASM_WIDTH = 5
// The glass elevator: in the north-west corner of the command center, behind the end of the
// display wall, and in the north-west corner of the foyer above.
export const ELEVATOR = { x: -5.15, z: -7.1, radius: 0.75 }
export const NORTH_Z = -8
// Surface manor
// The hotel lobby: deep enough for the reception desk, the medallion between the twin staircases
// and two seating clusters in front of them, with the staircases' feet kept clear.
export const FOYER = { w: 12, d: 12.5 }
export const CORE_HALF = FOYER.w / 2
// Deep enough for a bedroom plus a wall-hugging ensuite strip along the south wall.
export const SUITE = { w: 5, d: 6.5, ensuite: 2 }
export const CORRIDOR_W = 1.5
export const BILLIARDS_D = 7
export const LIBRARY = { minW: 8, d: 6, height: 5.5, catwalkY: 14 }
export const PANTRY_D = 5
export const BATH_D = 6.5
// The mezzanine landing over the lobby: deep enough for 2.2 units of clear floor at the stairs' tops.
export const LANDING_D = 2.2
export const TERRACE = { minW: 12, d: 6 }
export const POOL = { w: 8, d: 4, depth: 1 }
export const FIREPLACE = { w: 3, d: 1.2, h: 3.5 }
export const LOUNGE_MODULE = { w: 5, d: 4.6, seats: 7 }
export const DINING_SEAT_PITCH = 0.8
export const WALL_MARGIN = 1

export const deskGrid = (n: number) => {
  const cols = Math.max(1, Math.min(MAX_DESK_COLUMNS, n, Math.ceil(Math.sqrt(1.5 * n))))
  return { cols, rows: Math.ceil(n / cols) }
}
export const suiteColumns = (n: number) => (n <= 8 ? 1 : 2)
/** Width of each manor wing: wide enough for its rooms and its suite columns along a corridor. */
export const wingWidth = (n: number) => Math.max(LIBRARY.minW, suiteColumns(n) * SUITE.w + CORRIDOR_W)
/** Lounge sofa modules: one U-shaped set seats seven; capacity is half the crew. */
export const loungeModules = (n: number) => Math.ceil(Math.ceil(n / 2) / LOUNGE_MODULE.seats)
/** Banquet table: N + 2 high-back chairs, split over both long sides. */
export const diningPlan = (n: number) => {
  const chairs = n + 2
  const perSide = Math.ceil(chairs / 2)
  const length = perSide * DINING_SEAT_PITCH + 0.6
  return { chairs, perSide, length, depth: Math.max(6, length + 2.4) }
}
/** Suites in three runs: the upper west wing, the ground east wing, then the upper east wing. */
export const suiteSplit = (n: number) => {
  const upper = Math.ceil(n / 3)
  const ground = Math.ceil((n - upper) / 2)
  return { upper, ground, upperEast: n - upper - ground }
}
/** The upper east wing starts south of the library, behind a short link from the foyer gallery. */
export const UPPER_EAST_Z = NORTH_Z + LIBRARY.d + LANDING_D
/** Everything the layout needs to know about its size, from the crew size alone. */
export function plan(agentCount: number) {
  const n = Math.max(1, Math.floor(Number.isFinite(agentCount) ? agentCount : 1))
  const { cols, rows } = deskGrid(n)
  const gridW = cols * DESK_PITCH_X
  const commandW = Math.max(COMMAND_MIN_W, gridW + 2)
  const ww = wingWidth(n)
  const W = Math.max(commandW + 2 * SIDE_STRIP, 2 * (CORE_HALF + ww), HANGAR_MIN_WIDTH)
  const half = W / 2
  // South edge of the operations room, the armory and the training room: the hangar starts here.
  const gridEnd = Math.max(DESK_GRID_Z + rows * DESK_PITCH_Z + 0.3, FORENSICS_SOUTH + SPARRING_MAT + 1.2)
  const sc = suiteColumns(n)
  const split = suiteSplit(n)
  const upperRows = Math.ceil(split.upper / sc)
  const groundRows = Math.ceil(split.ground / sc)
  const dining = diningPlan(n)
  const loungeRows = Math.ceil(loungeModules(n) / 2)
  const loungeMin = NORTH_Z + FOYER.d + FIREPLACE.d + 0.8 + loungeRows * LOUNGE_MODULE.d + 0.6
  const westSouth = NORTH_Z + BILLIARDS_D + dining.depth + PANTRY_D + GYM_D + BATH_D
  const eastSouth = NORTH_Z + LIBRARY.d + groundRows * SUITE.d
  const upperSouth = NORTH_Z + LANDING_D + upperRows * SUITE.d
  const upperEastRows = Math.ceil(split.upperEast / sc)
  const upperEastSouth = UPPER_EAST_Z + upperEastRows * SUITE.d
  // The lounge stretches down to the terrace, so the terrace always opens off it.
  const terraceZ = Math.max(loungeMin, westSouth, eastSouth, upperSouth, upperEastSouth)
  const terraceX0 = Math.min(half - (TERRACE.minW + 2), 2)
  const southZ = Math.max(gridEnd + HANGAR_DEPTH, terraceZ + TERRACE.d)
  return { n, cols, rows, gridW, commandW, ww, W, half, gridEnd, sc, split, upperRows, groundRows, upperEastRows, dining, loungeRows, terraceZ, terraceX0, southZ }
}
export type Plan = ReturnType<typeof plan>
