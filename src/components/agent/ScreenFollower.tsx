import { useFrame } from '@react-three/fiber'
import { useMemo, type MutableRefObject, type RefObject } from 'react'
import * as THREE from 'three'

/**
 * Keeps a DOM element (the agent's action menu) pinned to an agent while it walks: each frame the
 * anchor is projected to the screen and written to the element's left/top, without a React render.
 * `drop` lowers the point from the label anchor (head height) to the middle of the body.
 */
export function ScreenFollower({ anchors, anchorKey, target, drop = 1 }: {
  anchors: MutableRefObject<Map<string, THREE.Object3D>>
  anchorKey: string | null
  target: RefObject<HTMLElement | null>
  drop?: number
}) {
  const point = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, gl }) => {
    const element = target.current
    const anchor = anchorKey ? anchors.current.get(anchorKey) : undefined
    if (!element || !anchor) return
    anchor.getWorldPosition(point)
    point.y -= drop
    point.project(camera)
    const rect = gl.domElement.getBoundingClientRect()
    const onScreen = anchor.visible && point.z < 1
    element.style.visibility = onScreen ? 'visible' : 'hidden'
    if (!onScreen) return
    element.style.left = `${rect.left + ((point.x + 1) / 2) * rect.width}px`
    element.style.top = `${rect.top + ((1 - point.y) / 2) * rect.height}px`
  })
  return null
}
