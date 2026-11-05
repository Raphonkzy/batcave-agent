import { useEffect, useState } from 'react'
/** True when the viewer asked for less motion; animation then holds still. */
export function useReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches)
  useEffect(() => {
    const media = window.matchMedia?.(query)
    if (!media) return
    const onChange = () => setReduced(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return reduced
}
/** The browser's local hour, refreshed every minute (drives the Terrace light). */
export function useLocalHour(): number {
  const read = () => { const now = new Date(); return now.getHours() + now.getMinutes() / 60 }
  const [hour, setHour] = useState(read)
  useEffect(() => {
    const timer = window.setInterval(() => setHour(read()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return hour
}
