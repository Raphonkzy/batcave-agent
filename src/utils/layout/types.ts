// Types for the Tactical Manor layout. Units are scene units (1 unit ~ 1 metre), x to the right,
// z towards the viewer (south), y up. An item's local +z is its front: the side a person uses it from.
export type Vec3 = [number, number, number]
export interface BoundingBox { minX: number; maxX: number; minZ: number; maxZ: number }
/** The three walkable floors: the subterranean deck, the manor ground floor and its upper floor. */
export type LevelId = 'subterranean' | 'surface' | 'surfaceUpper'
export const LEVEL_Y: Record<LevelId, number> = { subterranean: 0, surface: 11, surfaceUpper: 14.5 }
export type ZoneKind = 'open' | 'room' | 'suite' | 'corridor' | 'outdoor'
export type NamedZone =
  | 'commandAmphitheater' | 'operationsRoom' | 'suitVault' | 'armory' | 'serverBastion' | 'forensicsLab' | 'trainingRoom' | 'hangarBay' | 'basinCatwalk'
  | 'grandFoyer' | 'hearthLounge' | 'grandLibrary' | 'billiardsRoom' | 'diningHall' | 'butlerPantry' | 'gym' | 'grandBath'
  | 'eastCorridor' | 'upperLanding' | 'upperCorridor' | 'upperGallery' | 'upperEastLink' | 'upperEastCorridor' | 'terracePool'
/** Suites are numbered from 0: suite n belongs to the agent in seat n + 1. */
export type ZoneId = NamedZone | `suite-${number}`
export interface Zone { id: ZoneId; kind: ZoneKind; level: LevelId; rect: BoundingBox; height: number; owner?: number }
export type ItemType =
  // Subterranean command deck and hangar
  | 'holoPanel' | 'consoleArc' | 'consoleChair' | 'warTable' | 'desk' | 'chair' | 'elevatorShaft'
  | 'suitPod' | 'suitBench' | 'utilityConsole' | 'armoryLocker' | 'weaponRack' | 'gearBench' | 'serverBank' | 'serverTerminal'
  | 'forensicsSlab' | 'diagnosticRack' | 'sparringMat' | 'punchingBag' | 'floorPlate'
  | 'turntablePad' | 'tacticalJet' | 'interceptorBay' | 'armoredInterceptor' | 'pursuitBike'
  | 'vtolPad' | 'assaultVtol' | 'apcBay' | 'combatApc' | 'bikeDock' | 'subDock' | 'submersiblePod'
  | 'serviceLane' | 'hydraulicLift' | 'toolChest' | 'diagBench' | 'workbench' | 'autoDock' | 'catwalkConsole'
  // Surface manor
  | 'grandStair' | 'fireplace' | 'chesterfield' | 'coffeeTable' | 'rug' | 'tallBookshelf' | 'spiralStair'
  | 'readingChair' | 'studyDesk' | 'deskChair' | 'billiardsTable' | 'cueRack' | 'leatherChair' | 'radioCabinet' | 'banquetTable'
  | 'highChair' | 'sideboard' | 'pantryCounter' | 'wineRack' | 'teaTrolley' | 'bed' | 'pedestal' | 'execDesk'
  | 'armchair' | 'wardrobe' | 'privacyScreen' | 'sunLounger' | 'infinityPool' | 'sideTable'
  | 'treadmill' | 'dumbbellRack' | 'weightBench' | 'exerciseMat' | 'teakDeck'
  | 'soakingTub' | 'vanityCounter' | 'showerScreen' | 'bathWall' | 'consoleTable' | 'wallSconce' | 'runnerRug' | 'wallArt'
  | 'sunkenBath' | 'bathBench' | 'vanityRow' | 'toiletStall'
  | 'receptionDesk' | 'alabasterWall' | 'lobbyMedallion' | 'roundRug' | 'tubChair' | 'loungeTable' | 'luggageTrolley' | 'marbleUrn'
export interface LayoutItem {
  id: string
  type: ItemType
  zone: ZoneId
  level: LevelId
  /** Centre of the footprint; y is the floor the item stands on. */
  x: number
  y: number
  z: number
  /** Footprint along local x (w) and local z (d) before rotation, and height. */
  w: number
  d: number
  h: number
  rotY: number
  /** Extra meaning: a profile id for role stations and suit pods, a variant for others. */
  role?: string
  /** Seat that owns it (desks, suites, beds): seat n + 1 owns index n. */
  owner?: number
}
/** Where an agent can stand, sit or lie. `facing` is the direction it looks (0 = +z). */
export interface Stop {
  id: string
  kind: string
  zone: ZoneId
  level: LevelId
  x: number
  y: number
  z: number
  facing: number
  seated?: boolean
  /** Seat this stop belongs to (desks, beds), or the profile it is reserved for (role stations). */
  owner?: number
  profile?: string
}
/** A wall between two zones (or on the outside), already split around its doors. */
export interface WallSegment { level: LevelId; axis: 'x' | 'z'; at: number; from: number; to: number; exterior: boolean; side?: 'north' | 'south' | 'east' | 'west'; height: number }
export interface Door { level: LevelId; axis: 'x' | 'z'; at: number; center: number; width: number; between: [ZoneId, ZoneId] }
/** A way between floors: the glass elevator or a staircase. Agents step on at `from` and off at `to`. */
export interface LevelLink { kind: 'elevator' | 'stairs'; a: { level: LevelId; x: number; z: number }; b: { level: LevelId; x: number; z: number }; via: Vec3[] }
/** Walking grid of a floor. `soft` cells (seats, beds) can be crossed but routes avoid them. */
export interface PathGrid { level: LevelId; y: number; minX: number; minZ: number; cols: number; rows: number; blocked: boolean[]; soft?: boolean[] }
export interface NavigationGraph { resolution: number; grids: PathGrid[]; stops: Stop[]; links: LevelLink[] }
export interface CameraPreset { position: Vec3; target: Vec3; minDistance: number; maxDistance: number; pan: BoundingBox }
export interface ManorLayoutData {
  agentCount: number
  bounds: BoundingBox & { height: number }
  levels: {
    subterranean: { y: number; bounds: BoundingBox }
    transition: { yStart: number; yEnd: number }
    surface: { y: number; bounds: BoundingBox }
  }
  zones: Record<NamedZone, BoundingBox> & { bedroomSuites: BoundingBox[] }
  /** Every zone with its level and kind (the named ones above plus each suite). */
  zoneList: Zone[]
  items: LayoutItem[]
  walls: WallSegment[]
  doors: Door[]
  paths: NavigationGraph
  camera: { commandDeck: CameraPreset; hangarBay: CameraPreset; grandManor: CameraPreset; manorLobby: CameraPreset; overview: CameraPreset }
  /** The chasm the pool spills into, open from the surface down to the basin. */
  chasm: BoundingBox & { waterY: number; floorY: number }
  /** The glass elevator between the deck (y 0) and the manor (y 11). */
  elevator: { x: number; z: number; radius: number; bottom: number; top: number }
  /** Desk grid of the command deck. */
  deskGrid: { cols: number; rows: number }
}
