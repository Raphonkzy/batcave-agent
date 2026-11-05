import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { computeLayout } from '../../utils/layout/computeLayout.ts'
import { buildBatches, partsFor } from './batches.ts'
import { SPECIAL_TYPES } from './parts.ts'
import { jaggedFaces, MAX_REAL_LIGHTS, QUALITY, rockMass, spikes, terraceSun } from './ZoneLayout.ts'

const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => { const path = join(dir, name); return statSync(path).isDirectory() ? walk(path) : [path] })
const sceneFiles = () => [...walk(join(process.cwd(), 'src/scenes')), ...walk(join(process.cwd(), 'src/components')).filter(() => true)].filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith('.test.ts'))

describe('Tactical Manor scene', () => {
  it('declares at most six real lights, and no ambient or hemisphere light', () => {
    const source = sceneFiles().map((file) => readFileSync(file, 'utf8')).join('\n')
    const lights = source.match(/<(spotLight|pointLight|directionalLight|ambientLight|hemisphereLight|rectAreaLight)\b/g) ?? []
    expect(lights.length).toBeLessThanOrEqual(MAX_REAL_LIGHTS)
    expect(lights.filter((tag) => tag.includes('ambient') || tag.includes('hemisphere'))).toEqual([])
    expect(source).not.toMatch(/new THREE\.(Spot|Point|Directional|Ambient|Hemisphere)Light/)
  })
  it('renders no 3D text: no text meshes, text sprites or canvas lettering in the scene', () => {
    for (const file of sceneFiles()) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toMatch(/fillText|strokeText|TextGeometry|<Text\b|FontLoader|signTexture/)
    }
  })
  it('gives every item type parts to draw, except the ones with their own component', () => {
    const layout = computeLayout(40)
    for (const type of new Set(layout.items.map((item) => item.type))) {
      const sample = layout.items.find((item) => item.type === type)!
      if (SPECIAL_TYPES.has(type)) expect(partsFor(sample)).toEqual([])
      else expect(partsFor(sample).length, type).toBeGreaterThan(0)
    }
  })
  it('shares geometry and material between instances, so batches do not grow with the crew', () => {
    const count = (n: number) => buildBatches(computeLayout(n).items.filter((item) => item.level === 'subterranean')).length
    expect(count(40)).toBeLessThanOrEqual(count(12) + 2)
    for (const batch of buildBatches(computeLayout(12).items)) if (batch.colors) expect(batch.colors.length).toBe(batch.matrices.length)
  })
  it('follows the browser clock on the terrace: daylight 06:00-18:00, cool moonlight otherwise', () => {
    for (const hour of [6, 9.5, 12, 17.9]) expect(terraceSun(hour).daylight).toBe(true)
    for (const hour of [0, 5.9, 18, 23.5]) expect(terraceSun(hour)).toMatchObject({ daylight: false, color: '#88aaff' })
  })
  it('builds the rock deterministically and halves decoration on low quality', () => {
    const layout = computeLayout(12)
    expect(JSON.stringify(jaggedFaces(layout, 1))).toBe(JSON.stringify(jaggedFaces(layout, 1)))
    expect(JSON.stringify(spikes(layout, 1))).toBe(JSON.stringify(spikes(layout, 1)))
    const full = spikes(layout, QUALITY.high.density).hanging.length
    const low = spikes(layout, QUALITY.low.density).hanging.length
    expect(low).toBeLessThanOrEqual(Math.ceil(full * 0.6))
    expect(rockMass(layout).cliff[0].h).toBeCloseTo(7, 1)
  })
  it('turns shadows and mist down with quality', () => {
    expect(QUALITY.high).toMatchObject({ shadows: 'all', mist: true })
    expect(QUALITY.medium).toMatchObject({ shadows: 'main', mist: false })
    expect(QUALITY.low).toMatchObject({ shadows: 'none', mist: false, density: 0.5, screens: 'static' })
  })
})
