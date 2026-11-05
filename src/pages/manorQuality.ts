import { useCallback, useRef, useState } from 'react'
import type { Quality } from '../scenes/manor/ZoneLayout.ts'
// Quality setting (High / Medium / Low), kept per browser under `batcave.quality`, with an automatic
// step down when the frame rate stays below 30 FPS for 5 seconds in a row.
export const QUALITY_KEY = 'batcave.quality'
export const QUALITY_LEVELS: Quality[] = ['high', 'medium', 'low']
export const QUALITY_LABELS: Record<Quality, string> = { high: 'High', medium: 'Medium', low: 'Low' }
export const LOW_FPS = 30
export const LOW_FPS_SECONDS = 5
export function parseQuality(value: string | null): Quality { return value === 'high' || value === 'low' || value === 'medium' ? value : 'medium' }
export const lowerQuality = (quality: Quality): Quality => (quality === 'high' ? 'medium' : 'low')
/** Seconds-per-sample FPS readings in, the quality to use out: steps down after enough slow seconds. */
export function nextQuality(current: Quality, slowSeconds: number): Quality { return slowSeconds >= LOW_FPS_SECONDS && current !== 'low' ? lowerQuality(current) : current }
export function useQuality() {
  const [choice, setStored] = useState<Quality>(() => { try { return parseQuality(localStorage.getItem(QUALITY_KEY) ?? localStorage.getItem('ruang.quality')) } catch { return 'medium' } })
  const [quality, setQuality] = useState<Quality>(choice)
  const slow = useRef(0)
  const setChoice = useCallback((next: Quality) => {
    setStored(next)
    setQuality(next)
    slow.current = 0
    try { localStorage.setItem(QUALITY_KEY, next) } catch { /* per-browser convenience only */ }
  }, [])
  // Development only: ?noAutoQuality keeps the chosen level (for measuring on slow software renderers).
  const fixed = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('noAutoQuality')
  const report = useCallback((fps: number) => {
    if (fixed) return
    slow.current = fps < LOW_FPS ? slow.current + 1 : 0
    setQuality((current) => {
      const next = nextQuality(current, slow.current)
      if (next !== current) slow.current = 0
      return next
    })
  }, [fixed])
  return { quality, choice, setChoice, report }
}
