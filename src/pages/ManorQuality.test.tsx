// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ frame: undefined as undefined | (() => void) }))
vi.mock('@react-three/fiber', () => ({ useFrame: (callback: () => void) => { mock.frame = callback }, useThree: () => ({ gl: { info: { render: { calls: 1, triangles: 2 }, memory: { geometries: 3, textures: 4 } } }, scene: { traverseVisible: () => {} } }) }))
import { FrameReporter } from './ManorQuality.tsx'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
describe('render statistics sampling', () => {
  it('replaces old frame timings after 300 samples', async () => {
    let now = 0
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now)
    const host = document.createElement('div'), root = createRoot(host)
    try {
      await act(async () => root.render(<FrameReporter onSample={() => {}}/>))
      for (let i = 0; i < 301; i++) { now += 100; mock.frame?.() }
      expect(window.__batcaveRenderStats?.p50).toBe(100)
      for (let i = 0; i < 400; i++) { now += 10; mock.frame?.() }
      expect(window.__batcaveRenderStats?.p50).toBe(10)
      expect(window.__batcaveRenderStats?.p95).toBe(10)
    } finally { await act(async () => root.unmount()); clock.mockRestore() }
  })
})
