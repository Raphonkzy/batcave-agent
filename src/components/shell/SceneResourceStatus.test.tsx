import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SceneResourceStatus } from './SceneResourceStatus.tsx'

describe('scene resource status', () => {
  it.each(['pending', 'failed', 'ready'] as const)('keeps %s status compact with diagnostics and retry', status => {
    const html = renderToStaticMarkup(<SceneResourceStatus request={{status, data: {}, message: 'Connection failed', refreshing: false, refresh: vi.fn()}}/>)
    expect(html).toContain('<details')
    expect(html).toContain('<summary>')
    expect(html).toContain('role="status"')
    expect(html).not.toContain('empty-state')
    expect(html).not.toContain(' open=""')
    expect(html).toContain('Retry crew data')
  })
})
