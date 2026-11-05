import * as THREE from 'three'
import { barkMap, carbonMap, carpetMap, concreteBump, concreteMap, corrugatedMap, fabricMap, hazardMap, leafMap, mahoganyMap, marbleBump, marbleMap, rockBump, rockMap, rugMap, steelPlateMap, velvetMap } from './textures.ts'
// Shared geometry and materials for the Tactical Manor. Built once and reused by every item, so
// a bigger crew adds instances, not materials or draw calls.
export type GeoKey = 'box' | 'cyl' | 'oct' | 'hex' | 'sphere' | 'cone' | 'tri' | 'ico' | 'plane' | 'torus'
export type MatKey =
  | 'gunmetal' | 'blackSteel' | 'carbon' | 'concrete' | 'grating' | 'rubber' | 'hazard' | 'chrome' | 'darkGlass' | 'glass' | 'rock'
  | 'ledCyan' | 'ledAmber' | 'ledRed' | 'ledGreen' | 'ledViolet' | 'ledWhite' | 'blinkA' | 'blinkB' | 'holo' | 'screenOff' | 'corrugated'
  | 'mahogany' | 'darkWood' | 'oak' | 'brass' | 'silver' | 'marble' | 'velvet' | 'velvetCream' | 'leather' | 'felt' | 'linen' | 'duvet'
  | 'stone' | 'flame' | 'lampWarm' | 'bankerGreen' | 'paper' | 'pot' | 'leaf' | 'bark' | 'crystal' | 'rug' | 'carpet' | 'porcelain' | 'mannequin'
  | 'wetRock' | 'grassBlade' | 'gravel' | 'marbleBlack'
const geometries = new Map<GeoKey, THREE.BufferGeometry>()
export function geometryFor(key: GeoKey): THREE.BufferGeometry {
  let geometry = geometries.get(key)
  if (geometry) return geometry
  switch (key) {
    case 'box': geometry = new THREE.BoxGeometry(1, 1, 1); break
    case 'cyl': geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 20); break
    case 'oct': geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 8).rotateY(Math.PI / 8); break
    case 'hex': geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 6).rotateY(Math.PI / 6); break
    case 'sphere': geometry = new THREE.SphereGeometry(0.5, 16, 12); break
    case 'cone': geometry = new THREE.ConeGeometry(0.5, 1, 12); break
    case 'tri': geometry = new THREE.ConeGeometry(0.5, 1, 3); break
    case 'ico': geometry = new THREE.IcosahedronGeometry(0.5, 0); break
    case 'plane': geometry = new THREE.PlaneGeometry(1, 1); break
    case 'torus': geometry = new THREE.TorusGeometry(0.5, 0.06, 6, 24).rotateX(Math.PI / 2); break
  }
  geometries.set(key, geometry)
  return geometry
}
const std = (parameters: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(parameters)
const glow = (color: string, intensity = 1.6) => std({ color: '#000000', emissive: color, emissiveIntensity: intensity, roughness: 0.4 })
let shared: Record<MatKey, THREE.Material> | undefined
/** Emissive materials whose brightness the scene animates (blinking LEDs, flames, lanterns). */
export const ANIMATED: MatKey[] = ['blinkA', 'blinkB', 'flame', 'holo']
export function manorMaterials(): Record<MatKey, THREE.Material> {
  if (shared) return shared
  shared = {
    gunmetal: std({ color: '#4a5058', metalness: 0.85, roughness: 0.38 }),
    blackSteel: std({ color: '#17191d', metalness: 0.8, roughness: 0.45 }),
    carbon: std({ color: '#ffffff', map: carbonMap(), metalness: 0.5, roughness: 0.35 }),
    concrete: std({ color: '#ffffff', map: concreteMap(), bumpMap: concreteBump(), bumpScale: 1, roughness: 0.92 }),
    grating: std({ color: '#ffffff', map: steelPlateMap(), metalness: 0.7, roughness: 0.45 }),
    rubber: std({ color: '#121417', roughness: 0.95 }),
    hazard: std({ color: '#ffffff', map: hazardMap(), roughness: 0.7 }),
    chrome: std({ color: '#d7dde3', metalness: 1, roughness: 0.15 }),
    darkGlass: std({ color: '#0b0d12', metalness: 0.6, roughness: 0.08 }),
    glass: std({ color: '#a9d8ea', transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.2, depthWrite: false }),
    rock: std({ color: '#ffffff', map: rockMap(), bumpMap: rockBump(), bumpScale: 2, roughness: 0.96 }),
    // Rock within reach of the waterfall's spray: darker, with a damp specular sheen.
    wetRock: std({ color: '#8f99a0', map: rockMap(), bumpMap: rockBump(), bumpScale: 1.6, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.2, metalness: 0.35 }),
    corrugated: std({ color: '#ffffff', map: corrugatedMap(), metalness: 0.6, roughness: 0.5 }),
    ledCyan: glow('#00ffcc'), ledAmber: glow('#ffaa00'), ledRed: glow('#ff2a2a'), ledGreen: glow('#3dff7a'), ledViolet: glow('#a855f7'), ledWhite: glow('#e6f2ff', 1.2),
    // Basic, so each LED keeps its own instance colour; the scene dims them to blink.
    blinkA: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), blinkB: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    holo: new THREE.MeshBasicMaterial({ color: '#00ffcc', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    screenOff: std({ color: '#05070a', metalness: 0.3, roughness: 0.2 }),
    mahogany: std({ color: '#ffffff', map: mahoganyMap(), roughness: 0.42 }),
    darkWood: std({ color: '#8a6a52', map: mahoganyMap(), roughness: 0.55 }),
    oak: std({ color: '#d9b98f', map: mahoganyMap(), roughness: 0.6 }),
    brass: std({ color: '#d4af37', metalness: 1, roughness: 0.28 }),
    silver: std({ color: '#cfd4da', metalness: 1, roughness: 0.22 }),
    marble: std({ color: '#ffffff', map: marbleMap(), bumpMap: marbleBump(), bumpScale: 0.3, roughness: 0.2 }),
    velvet: std({ color: '#6b1f2c', map: velvetMap(), roughness: 0.95 }),
    velvetCream: std({ color: '#efe3c4', map: velvetMap(), roughness: 0.95 }),
    leather: std({ color: '#7a3f1d', roughness: 0.5 }),
    felt: std({ color: '#1d6b3a', map: velvetMap(), roughness: 0.9 }),
    linen: std({ color: '#f1ece2', map: fabricMap(), roughness: 0.92 }),
    duvet: std({ color: '#ffffff', map: velvetMap(), roughness: 0.95 }),
    stone: std({ color: '#cbbfa8', map: concreteMap(), bumpMap: concreteBump(), bumpScale: 2, roughness: 0.95 }),
    flame: glow('#ff8a2a', 2.4), lampWarm: glow('#ffd59a', 1.5), bankerGreen: glow('#1fa34a', 1.1),
    paper: std({ color: '#ffffff', roughness: 0.6 }),
    pot: std({ color: '#7a4a32', roughness: 0.85 }),
    leaf: std({ color: '#ffffff', map: leafMap(), roughness: 0.8 }),
    bark: std({ color: '#ffffff', map: barkMap(), roughness: 0.9 }),
    crystal: std({ color: '#fff3d0', emissive: '#ffd99a', emissiveIntensity: 1.3, roughness: 0.1, metalness: 0.2 }),
    rug: std({ color: '#ffffff', map: rugMap(), roughness: 1 }),
    carpet: std({ color: '#3d2a5a', map: carpetMap(), roughness: 1 }),
    porcelain: std({ color: '#f6f4ef', roughness: 0.25 }),
    mannequin: std({ color: '#121316', roughness: 0.6, metalness: 0.2 }),
    // Grass blades carry their own vertex colour (dark root to bright tip), so the base is white.
    grassBlade: std({ color: '#ffffff', roughness: 0.85, side: THREE.DoubleSide, vertexColors: true }),
    gravel: std({ color: '#6b6560', roughness: 0.95 }),
    // Nero Marquina: the marble map in near-black, polished.
    marbleBlack: std({ color: '#1a1a1d', map: marbleMap(), bumpMap: marbleBump(), bumpScale: 0.3, roughness: 0.18 }),
  }
  return shared
}

/**
 * Materials that differ only in colour share one base material, tinted per instance, so the
 * whole manor needs far fewer draw calls (one per base material and shape).
 */
export const ALIAS: Partial<Record<MatKey, [MatKey, string]>> = {
  ledCyan: ['ledCyan', '#00ffcc'], ledAmber: ['ledCyan', '#ffaa00'], ledRed: ['ledCyan', '#ff2a2a'], ledGreen: ['ledCyan', '#3dff7a'], ledViolet: ['ledCyan', '#a855f7'], ledWhite: ['ledCyan', '#e6f2ff'],
  lampWarm: ['ledCyan', '#ffd59a'], bankerGreen: ['ledCyan', '#2fbf5a'], crystal: ['ledCyan', '#fff0c8'],
  mahogany: ['mahogany', '#ffffff'], darkWood: ['mahogany', '#8a6a52'], oak: ['mahogany', '#d9b98f'],
  velvet: ['velvet', '#6b1f2c'], velvetCream: ['velvet', '#efe3c4'], duvet: ['velvet', '#ffffff'], felt: ['velvet', '#1d6b3a'],
  marbleBlack: ['marble', '#1a1a1d'], brass: ['brass', '#d4af37'], silver: ['brass', '#cfd4da'], chrome: ['brass', '#d7dde3'],
  gunmetal: ['gunmetal', '#4a5058'], blackSteel: ['gunmetal', '#17191d'],
  concrete: ['concrete', '#ffffff'], stone: ['concrete', '#cbbfa8'],
  paper: ['paper', '#ffffff'], leather: ['paper', '#7a3f1d'], pot: ['paper', '#7a4a32'], rubber: ['paper', '#121417'], porcelain: ['paper', '#f6f4ef'], mannequin: ['paper', '#121316'],
}
const bases = new Map<MatKey, THREE.Material>()
/** White version of a base material, for instances that carry their own colour. */
export function tintBase(key: MatKey): THREE.Material {
  let material = bases.get(key)
  if (!material) {
    const source = manorMaterials()[key] as THREE.MeshStandardMaterial
    if (source.emissive && source.emissive.getHex() !== 0 && source.color.getHex() === 0) material = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })
    else { material = source.clone(); (material as THREE.MeshStandardMaterial).color.set('#ffffff') }
    bases.set(key, material)
  }
  return material
}
