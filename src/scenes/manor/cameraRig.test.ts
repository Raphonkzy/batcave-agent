import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildObstacles, CAMERA_CONFIG, focusGoal, framingDistance, pushOutOfBoxes, retargetGoal, type Box } from './cameraRig.ts'
import { computeLayout } from './ZoneLayout.ts'

const wall: Box = { minX: -5, maxX: 5, minY: 0, maxY: 4, minZ: -0.15, maxZ: 0.15 }
const margin = 0.45
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

describe('camera obstruction', () => {
  it('pushes the camera back out through the side it came from', () => {
    const pos = v(0, 2, 0.1), prev = v(0, 2, 3)
    expect(pushOutOfBoxes(pos, prev, [wall], margin)).toBe(true)
    expect(pos.z).toBeCloseTo(0.15 + margin)
    const behind = v(0, 2, -0.1)
    pushOutOfBoxes(behind, v(0, 2, -3), [wall], margin)
    expect(behind.z).toBeCloseTo(-0.15 - margin)
  })
  it('slides along a wall: only the penetrating axis changes', () => {
    const pos = v(2, 2, 0.2), prev = v(1, 2, 2)
    pushOutOfBoxes(pos, prev, [wall], margin)
    expect(pos.x).toBe(2); expect(pos.y).toBe(2)
  })
  it('leaves free space alone and passes over low obstacles', () => {
    const pos = v(0, 9, 0), before = pos.clone()
    expect(pushOutOfBoxes(pos, v(0, 9, 1), [wall], margin)).toBe(false)
    expect(pos.equals(before)).toBe(true)
  })
  it('keeps the camera above a floor plate it came down onto', () => {
    const floor: Box = { minX: -10, maxX: 10, minY: 10.4, maxY: 11, minZ: -10, maxZ: 10 }
    const pos = v(0, 11.1, 0)
    pushOutOfBoxes(pos, v(0, 14, 0), [floor], margin)
    expect(pos.y).toBeCloseTo(11 + margin)
  })
  it('resolves overlapping boxes without leaving the camera inside any', () => {
    const other: Box = { ...wall, minZ: 0.6, maxZ: 0.9 }
    const pos = v(0, 2, 0.2)
    pushOutOfBoxes(pos, v(0, 2, 3), [wall, other], margin)
    for (const b of [wall, other]) {
      const inside = pos.x > b.minX - margin && pos.x < b.maxX + margin && pos.y > b.minY - margin && pos.y < b.maxY + margin && pos.z > b.minZ - margin && pos.z < b.maxZ + margin
      expect(inside).toBe(false)
    }
  })
  it('builds solid geometry for every floor view from the real layout', () => {
    const layout = computeLayout(6)
    const deck = buildObstacles(layout, 'deck', 'wallsUp'), upper = buildObstacles(layout, 'upper', 'wallsUp')
    expect(deck.length).toBeGreaterThan(0)
    expect(upper.length).toBeGreaterThan(deck.length)
    expect([...deck, ...upper].every(b => Object.values(b).every(Number.isFinite) && b.maxX > b.minX && b.maxY > b.minY && b.maxZ > b.minZ)).toBe(true)
    expect(buildObstacles(layout, 'ground', 'wallsDown').length).toBeLessThan(buildObstacles(layout, 'ground', 'wallsUp').length)
  })
})

describe('camera framing', () => {
  const fov = 40
  it('keeps a comfortable current distance and never zooms far out', () => {
    expect(framingDistance(1, fov, 16 / 9, 6)).toBe(6)
    expect(framingDistance(1, fov, 16 / 9, 200)).toBeLessThan(30)
    expect(framingDistance(3, fov, 16 / 9, 2)).toBeGreaterThan(8)
  })
  it('frames larger objects farther away and fits narrow viewports', () => {
    expect(framingDistance(4, fov, 16 / 9, 0)).toBeGreaterThan(framingDistance(1, fov, 16 / 9, 0))
    expect(framingDistance(2, fov, 0.5, 0)).toBeGreaterThan(framingDistance(2, fov, 2.4, 0))
  })
  it('focus keeps the viewing direction', () => {
    const target = v(0, 10, 0), camera = v(10, 25, 30)
    const dir = camera.clone().sub(target).normalize()
    const goal = focusGoal(camera, target, v(5, 1, 5), 2, fov, 16 / 9)
    expect(goal.position.clone().sub(goal.target).normalize().distanceTo(dir)).toBeLessThan(1e-6)
    expect(goal.target.toArray()).toEqual([5, 1, 5])
  })
  it('retarget preserves rotation and zoom and stays inside the pan area', () => {
    const target = v(0, 10, 0), camera = v(10, 25, 30)
    const preset = { position: [0, 50, 50] as [number, number, number], target: [500, 20, -500] as [number, number, number], minDistance: 2, maxDistance: 100, pan: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 } }
    const goal = retargetGoal(camera, target, preset)
    const before = camera.clone().sub(target), after = goal.position.clone().sub(goal.target)
    expect(after.distanceTo(before)).toBeLessThan(1e-6)
    expect(goal.target.toArray()).toEqual([30, 20, -30])
  })
  it('exposes sane configurable limits', () => {
    expect(CAMERA_CONFIG.minPolarAngle).toBeGreaterThan(0)
    expect(CAMERA_CONFIG.maxPolarAngle).toBeLessThan(Math.PI / 2)
    expect(CAMERA_CONFIG.minDistance).toBeLessThan(CAMERA_CONFIG.maxDistance)
  })
})
