import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The 2D fallback office keeps its own stylesheet (src/styles/office-2d.css).
const officeStyles = readFileSync(new URL('./styles/office-2d.css', import.meta.url), 'utf8')
const allStyles = [readFileSync(new URL('./styles.css', import.meta.url), 'utf8'), ...readdirSync(new URL('./styles/', import.meta.url)).map((name) => readFileSync(new URL(`./styles/${name}`, import.meta.url), 'utf8'))]

function loungeSeat(selector: string) {
  const match = officeStyles.match(new RegExp(`\\.lounge \\.${selector} \\{([^}]*)\\}`))
  expect(match, `${selector} should have a Lounge placement rule`).not.toBeNull()
  return match![1]
}

describe('Lounge station layout', () => {
  it('gives each named seat one explicit, distinct horizontal placement', () => {
    const sofa = loungeSeat('lounge-seat-1')
    const leftChair = loungeSeat('lounge-seat-2')
    const rightChair = loungeSeat('lounge-seat-3')

    expect(sofa).toContain('left: 37%')
    expect(sofa).toContain('right: auto')
    expect(leftChair).toContain('left: 10%')
    expect(leftChair).toContain('right: auto')
    expect(rightChair).toContain('left: auto')
    expect(rightChair).toContain('right: 9%')
  })
})

describe('Local stylesheet assets', () => {
  it('does not import fonts or stylesheets over HTTP', () => {
    for (const sheet of allStyles) {
      expect(sheet).not.toMatch(/@import\s+(?:url\()?['"]?https?:\/\//i)
      expect(sheet).not.toMatch(/url\(\s*['"]?https?:\/\//i)
    }
  })
})
