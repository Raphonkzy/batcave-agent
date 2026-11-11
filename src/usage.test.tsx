import { describe, expect, it } from 'vitest'
import { formatCost, sourceLabel } from './usage.ts'

describe('token usage view', () => {
  it('labels kinds of work and formats estimated costs', () => {
    expect(sourceLabel('kanban')).toBe('Kanban tasks')
    expect(sourceLabel('cron')).toBe('Cron jobs')
    expect(sourceLabel('matrix')).toBe('Matrix')
    expect(formatCost(undefined)).toBe('—')
    expect(formatCost(0.0123)).toBe('$0.0123')
    expect(formatCost(27.584)).toBe('$27.58')
  })

})
