import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkInvariants } from '../../scripts/verify/guard-invariants.ts'

const roots: string[] = []
const fixtureFiles = ['src/routes.ts', 'src/hooks/mockAgents.ts', 'src/pages/manorQuality.ts', 'src/pages/manorViews.ts', 'server/privacy.ts', 'server/access.ts', 'server/profile-lock.ts']
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'batcave-invariants-'))
  roots.push(root)
  for (const file of fixtureFiles) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), readFileSync(file, 'utf8'))
  }
  return root
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

describe('guard-invariants verification harness', () => {
  it('passes on the clean baseline codebase', () => {
    const result = checkInvariants()
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('passes on an isolated valid fixture', () => {
    expect(checkInvariants(fixture()).errors).toEqual([])
  })

  it.each(['Usage', 'Task Board', 'Settings'])('rejects missing %s navigation even when its name survives in a comment', (label) => {
    const root = fixture()
    const file = path.join(root, 'src/routes.ts')
    writeFileSync(file, readFileSync(file, 'utf8').replace(`'${label}'`, '') + `\n// '${label}' is no longer in navigation\n`)
    const result = checkInvariants(root)
    expect(result.ok).toBe(false)
    expect(result.errors).toContain(`Required hash '#/${label.toLowerCase().replace(/ /g, '-')}' missing from navigation in src/routes.ts`)
  })

  it.each(['src/routes.ts', 'server/privacy.ts', 'src/pages/manorViews.ts'])('rejects a missing required file: %s', (file) => {
    const root = fixture()
    rmSync(path.join(root, file))
    expect(checkInvariants(root).ok).toBe(false)
  })

  it.each(['https://example.com/model.glb', 'https://cdn.example.com/script.js'])('rejects external assets: %s', (url) => {
    const root = fixture()
    writeFileSync(path.join(root, 'src/asset.ts'), `export const asset = '${url}'`)
    const result = checkInvariants(root)
    expect(result.ok).toBe(false)
    expect(result.errors.some((error) => /External GLB|Forbidden external CDN/.test(error))).toBe(true)
  })
})
