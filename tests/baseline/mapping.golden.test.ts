import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { generateAllMappings, type MappingRun } from '../../scripts/verify/generate-golden-mapping.ts'

describe('Agent to zone mapping golden test', () => {
  it('matches the baseline golden mapping identically', () => {
    const goldenPath = path.join(process.cwd(), 'docs/batcave-redesign/BASELINE/mapping.golden.json')
    expect(fs.existsSync(goldenPath)).toBe(true)
    const golden: MappingRun[] = JSON.parse(fs.readFileSync(goldenPath, 'utf8'))
    const current = generateAllMappings()

    expect(current.length).toBe(golden.length)
    for (let i = 0; i < golden.length; i++) {
      const g = golden[i]
      const c = current[i]
      expect(c.agentCount).toBe(g.agentCount)
      expect(c.mode).toBe(g.mode)

      // Compare agent mapping: zone, kind, seat, state, seated, pose
      expect(c.agents.length).toBe(g.agents.length)
      for (let j = 0; j < g.agents.length; j++) {
        expect(c.agents[j].id).toBe(g.agents[j].id)
        expect(c.agents[j].seat).toBe(g.agents[j].seat)
        expect(c.agents[j].state).toBe(g.agents[j].state)
        expect(c.agents[j].room).toBe(g.agents[j].room)
        expect(c.agents[j].kind).toBe(g.agents[j].kind)
        expect(c.agents[j].zone).toBe(g.agents[j].zone)
        expect(c.agents[j].seated).toBe(g.agents[j].seated)
        expect(c.agents[j].pose).toBe(g.agents[j].pose)
      }

      // Compare zone capacities
      expect(c.zoneCapacities).toEqual(g.zoneCapacities)
    }
  }, 30_000)
})
