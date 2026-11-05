import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// Guard for the theme's originality rule: no protected character or vehicle names, and no
// emblem glyphs, anywhere in the code, UI strings, comments or the theme's documentation. The
// words are assembled from pieces so this file does not contain them either. Profile ids are data
// keys and appear in lower case only, so character names are checked in their capitalised form.
const join2 = (...parts: string[]) => parts.join('')
const ANY_CASE = [join2('bat', 'man'), join2('bat', 'girl'), join2('night', 'wing'), join2('red ', 'hood'), join2('rob', 'in\\b'), join2('got', 'ham'), join2('way', 'ne\\b'), join2('jok', 'er'), join2('bat', 'mobile'), join2('bat', 'wing'), join2('bat', '-?signal')]
const CAPITALISED = [join2('Alf', 'red')]
const GLYPHS = ['\u{1F987}']

const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => { const path = join(dir, name); return statSync(path).isDirectory() ? walk(path) : [path] })
function files(): string[] {
  const root = process.cwd()
  const docs = ['README.md', 'docs/theme-manor.md', 'docs/theme-manor-plan.md', 'docs/PROJECT-METADATA.md', 'docs/CHANGES.md', 'index.html'].map((file) => join(root, file)).filter(existsSync)
  return [...walk(join(root, 'src')), ...docs].filter((file) => /\.(ts|tsx|css|md|html)$/.test(file))
}
describe('originality', () => {
  it('has none of the protected names or emblems in code, UI, comments or the theme docs', () => {
    const anyCase = new RegExp(ANY_CASE.join('|'), 'i')
    const capitalised = new RegExp(`\\b(${CAPITALISED.join('|')})\\b`)
    const hits = files().flatMap((file) => {
      const text = readFileSync(file, 'utf8')
      return anyCase.test(text) || capitalised.test(text) || GLYPHS.some((glyph) => text.includes(glyph)) ? [file] : []
    })
    expect(hits).toEqual([])
  })
})
