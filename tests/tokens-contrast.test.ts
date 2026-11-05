import { describe, expect, it } from 'vitest'

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const num = Number.parseInt(clean, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function luminance([r, g, b]: [number, number, number]): number {
  const a = [r, g, b].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722
}

function contrast(hex1: string, hex2: string): number {
  const lum1 = luminance(hexToRgb(hex1))
  const lum2 = luminance(hexToRgb(hex2))
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)
  return (brightest + 0.05) / (darkest + 0.05)
}

describe('Design tokens WCAG AA contrast verification', () => {
  const backgrounds = {
    canvas: '#0a0d0b',
    surface1: '#121714',
    surface2: '#18201b',
    surface3: '#222d26',
  }

  const texts = {
    primary: '#f5f2ea',
    secondary: '#9ea79e',
    goldAccent: '#f2c58a',
    emerald: '#4fb986',
  }

  it('ensures primary text passes WCAG AAA on all backgrounds (>= 7:1)', () => {
    for (const [bgName, bg] of Object.entries(backgrounds)) {
      const ratio = contrast(texts.primary, bg)
      expect(ratio, `Primary text on ${bgName} must exceed 7:1`).toBeGreaterThanOrEqual(7.0)
    }
  })

  it('ensures secondary text passes WCAG AA on canvas and main surfaces (>= 4.5:1)', () => {
    expect(contrast(texts.secondary, backgrounds.canvas)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(texts.secondary, backgrounds.surface1)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(texts.secondary, backgrounds.surface2)).toBeGreaterThanOrEqual(4.5)
  })

  it('ensures brand gold accent passes WCAG AA on canvas and surfaces (>= 4.5:1)', () => {
    expect(contrast(texts.goldAccent, backgrounds.canvas)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(texts.goldAccent, backgrounds.surface1)).toBeGreaterThanOrEqual(4.5)
  })

  it('ensures operational emerald badge accent passes WCAG AA on dark canvas (>= 4.5:1)', () => {
    expect(contrast(texts.emerald, backgrounds.canvas)).toBeGreaterThanOrEqual(4.5)
  })
})
