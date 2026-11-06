/**
 * World Configuration for Batcave 3D (Tactical Manor Estate)
 * Defines entrance threshold D, facing vector F, lot bounds, gate position, and path geometry.
 */

export const WORLD_CONFIG = {
  entrance: {
    // Threshold D: Outer threshold of manor front doors at ground surface level (Y = 11)
    threshold: [0, 11, -8.0] as [number, number, number],
    // Facing vector F: Outward normal along XZ plane from entrance pointing towards exterior yard
    facing: [0, 0, -1] as [number, number, number],
  },
  gate: {
    position: [0, 11, -46.0] as [number, number, number],
    width: 7.0,
  },
  lot: {
    minX: -32,
    maxX: 32,
    minZ: -48,
    maxZ: 32,
    surfaceY: 11,
  },
  pathPolyline: [
    [0, 11, -8.0],   // Ambang pintu D
    [0, 11, -9.5],   // Ujung teras 2 anak tangga
    [0, 11, -20.0],  // Jalan setapak batu (lebar 2.0m)
    [0, 11, -25.0],  // Titik tengah bundaran taman formal
    [0, 11, -30.0],  // Ujung bundaran
    [0, 11, -46.0],  // Pintu gerbang utama
  ] as [number, number, number][],
}

export function dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function sub(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function dist(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

