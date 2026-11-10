// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { EnvironmentControls } from './EnvironmentControls.tsx'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
describe('environment clock and presets', () => {
  it('normalizes midnight and lets presets take manual control', async () => {
    const host=document.createElement('div'),root=createRoot(host),onChange=vi.fn()
    try {
      await act(async()=>root.render(<EnvironmentControls settings={{realtime:false,hour:23.999,azimuth:0,intensity:1}} onChange={onChange}/>))
      expect(host.querySelector('output[aria-label="Environment clock"]')?.textContent).toBe('00:00')
      const sunset=[...host.querySelectorAll('button')].find(button=>button.textContent==='Sunset')!
      await act(async()=>sunset.click())
      expect(onChange).toHaveBeenCalledWith({hour:17.5,realtime:false})
    } finally { await act(async()=>root.unmount()) }
  })
})
