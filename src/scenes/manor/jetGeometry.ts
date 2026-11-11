import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
/** A swept-back trapezoid wing: root chord along the fuselage, tip set back and narrower. `side` mirrors it. */
function wingGeometry(side: 1 | -1): THREE.BufferGeometry {
  const outline = new THREE.Shape()
  outline.moveTo(0, 1.3)
  outline.lineTo(3.1 * side, -1.1)
  outline.lineTo(3.1 * side, -1.9)
  outline.lineTo(0, -2.1)
  outline.closePath()
  return new THREE.ExtrudeGeometry(outline, { depth: 0.08, bevelEnabled: false }).rotateX(Math.PI / 2)
}
type JetMaterial = 'blackSteel' | 'carbon' | 'gunmetal' | 'ledCyan' | 'darkGlass'
/**
 * The delta-wing jet as one merged geometry per material (five meshes instead of nineteen), built
 * once. Mirrored parts are written out for each side rather than scaled by -1, which would flip
 * their faces inside out.
 */
export function jetGeometries(): Record<JetMaterial, THREE.BufferGeometry> {
  const pieces: Record<JetMaterial, THREE.BufferGeometry[]> = { blackSteel: [], carbon: [], gunmetal: [], ledCyan: [], darkGlass: [] }
  const matrix = new THREE.Matrix4()
  const add = (material: JetMaterial, geometry: THREE.BufferGeometry, position: [number, number, number], rotation: [number, number, number], scale: [number, number, number]) => {
    const piece = (geometry.index ? geometry.toNonIndexed() : geometry).clone()
    piece.applyMatrix4(matrix.compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale)))
    pieces[material].push(piece)
  }
  const box = new THREE.BoxGeometry()
  const cone3 = new THREE.ConeGeometry(0.5, 1, 3)
  const cone4 = new THREE.ConeGeometry(0.5, 1, 4)
  const tube = new THREE.CylinderGeometry(0.5, 0.5, 1, 16)
  const ring = new THREE.TorusGeometry(0.16, 0.025, 6, 20)
  add('blackSteel', cone3, [0, 0, 0], [Math.PI / 2, 0, 0], [1.5, 6.2, 0.55])
  add('carbon', box, [0, -0.18, -0.6], [0, 0, 0], [1.1, 0.3, 3.4])
  for (const side of [-1, 1] as const) {
    add('carbon', wingGeometry(side), [0.35 * side, -0.1, 0], [0, 0, 0], [1, 1, 1])
    add('blackSteel', box, [3.42 * side, -0.35, -1.5], [0, 0, -1.1 * side], [0.06, 0.55, 0.8])
    add('gunmetal', box, [1.9 * side, -0.12, -1.95], [0, 0.65 * side, 0], [2.4, 0.05, 0.2])
    add('ledCyan', box, [3.15 * side, -0.08, -1.5], [0, 0, 0], [0.04, 0.03, 0.7])
    add('gunmetal', tube, [0.45 * side, -0.12, -2.65], [Math.PI / 2, 0, 0], [0.36, 0.8, 0.36])
    add('ledCyan', ring, [0.45 * side, -0.12, -3.06], [0, 0, 0], [1, 1, 1])
    add('blackSteel', box, [side * 0.5, 0.45, -2.3], [0, 0, side * 0.35], [0.05, 0.7, 0.9])
  }
  add('darkGlass', cone4, [0, 0.22, 1.1], [-0.22, Math.PI / 4, 0], [0.6, 0.45, 1.3])
  // Parked jet: four struts and feet meet the turntable at local y=-0.95.
  for (const side of [-1, 1]) for (const z of [-1.4, 1.4]) {
    add('gunmetal', tube, [side * 0.5, -0.55, z], [0, 0, 0], [0.08, 0.7, 0.08])
    add('gunmetal', box, [side * 0.5, -0.9, z], [0, 0, 0], [0.3, 0.1, 0.5])
  }
  const merged = {} as Record<JetMaterial, THREE.BufferGeometry>
  for (const key of Object.keys(pieces) as JetMaterial[]) merged[key] = mergeGeometries(pieces[key])!
  for (const list of Object.values(pieces)) for (const piece of list) piece.dispose()
  for (const geometry of [box, cone3, cone4, tube, ring]) geometry.dispose()
  return merged
}
