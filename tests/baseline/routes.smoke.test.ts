import { describe, expect, it } from 'vitest'
import { navigation, pageFromHash, pageSlug, type Page } from '../../src/routes.ts'
import { parseMockRequest } from '../../src/hooks/mockAgents.ts'

describe('routes smoke test', () => {
  const REQUIRED_OLD_PAGES: Page[] = [
    'Batcave',
    'Agents',
    'Usage',
    'Task Board',
    'Calendar',
    'Activity',
    'Memory',
    'Folders',
    'Logs',
    'Settings',
  ]

  it('contains all 10 required original navigation pages', () => {
    for (const p of REQUIRED_OLD_PAGES) {
      expect(navigation).toContain(p)
      const slug = pageSlug(p)
      expect(pageFromHash(`#/${slug}`)).toBe(p)
    }
  })

  it('correctly maps backward compatibility aliases', () => {
    expect(pageFromHash('#/dashboard')).toBe('Batcave')
    expect(pageFromHash('#/office')).toBe('Batcave')
    expect(pageFromHash('#/knowledge')).toBe('Memory')
  })

  it('correctly parses mockAgents query parameters', () => {
    expect(parseMockRequest('?mockAgents=12')).toEqual({ kind: 'count', count: 12 })
    expect(parseMockRequest('?mockAgents=cycle')).toEqual({ kind: 'cycle' })
    expect(parseMockRequest('?mockAgents=0')).toEqual({ kind: 'count', count: 0 })
    expect(parseMockRequest('')).toBeNull()
  })
})
