import * as THREE from 'three'

export function highlightColor(base: THREE.Color, selected: boolean): THREE.Color {
  return base.clone().lerp(new THREE.Color('#dac99a'), selected ? .28 : .14)
}
