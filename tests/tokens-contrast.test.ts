import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Reads the shipped design tokens (src/styles/tokens.css) so this guards the real palette.
const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
function token(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\b`))
  if (!match) throw new Error(`Token --${name} is missing or not a 6-digit hex colour`)
  return match[1]
}
function hexToRgb(hex: string): [number, number, number] {
  const num = Number.parseInt(hex.replace('#', ''), 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}
function luminance([r, g, b]: [number, number, number]): number {
  const a = [r, g, b].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722
}
function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(hexToRgb(a)), luminance(hexToRgb(b))]
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

describe('design tokens meet WCAG contrast', () => {
  const surfaces = ['surface', 'surface-2']

  it('primary text passes AAA (7:1) on every surface', () => {
    for (const surface of [...surfaces, 'surface-3']) expect(contrast(token('text'), token(surface)), `text on ${surface}`).toBeGreaterThanOrEqual(7)
  })

  it('secondary and muted text pass AA (4.5:1) on the panel surfaces', () => {
    for (const surface of surfaces) {
      expect(contrast(token('text-2'), token(surface)), `text-2 on ${surface}`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(token('text-3'), token(surface)), `text-3 on ${surface}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('the accent is readable as text on white and as a button background behind white text', () => {
    expect(contrast(token('accent'), token('surface'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token('accent-ink'), token('accent'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token('accent-hover'), token('accent-soft'))).toBeGreaterThanOrEqual(4.5)
  })

  it('status text colours pass AA on their tinted backgrounds', () => {
    for (const tone of ['good', 'warn', 'bad']) expect(contrast(token(tone), token(`${tone}-soft`)), tone).toBeGreaterThanOrEqual(4.5)
  })
})
