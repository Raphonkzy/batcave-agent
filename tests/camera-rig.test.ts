import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

describe('CameraRig logic & snap rotation math', () => {
  it('correctly calculates 90 degree snap rotation around target', () => {
    const target = new THREE.Vector3(0, 11, 0)
    const position = new THREE.Vector3(0, 20, 20)
    const offset = position.clone().sub(target)

    // Snap rotate +90 degrees (clockwise around Y)
    const offsetRight = offset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
    const posRight = target.clone().add(offsetRight)

    expect(posRight.x).toBeCloseTo(20, 4)
    expect(posRight.y).toBeCloseTo(20, 4)
    expect(posRight.z).toBeCloseTo(0, 4)

    // Snap rotate -90 degrees (counter-clockwise)
    const offsetLeft = offset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2)
    const posLeft = target.clone().add(offsetLeft)

    expect(posLeft.x).toBeCloseTo(-20, 4)
    expect(posLeft.y).toBeCloseTo(20, 4)
    expect(posLeft.z).toBeCloseTo(0, 4)
  })
})
