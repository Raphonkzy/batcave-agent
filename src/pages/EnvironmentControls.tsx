import { useState } from 'react'
import { useLocalHour } from '../scenes/manor/hooks.ts'

export interface EnvironmentSettings { realtime: boolean; hour: number; azimuth: number; intensity: number }
export const ENVIRONMENT_KEY = 'batcave.environment'
// Kept together so this controls module remains self-contained.
// eslint-disable-next-line react-refresh/only-export-components
export function readEnvironment(): EnvironmentSettings {
  const defaults = { realtime: true, hour: 12, azimuth: 0, intensity: 1 }
  try {
    const value = JSON.parse(localStorage.getItem(ENVIRONMENT_KEY) ?? '{}')
    const number = (key: string, low: number, high: number, fallback: number) => typeof value?.[key] === 'number' && Number.isFinite(value[key]) ? Math.max(low, Math.min(high, value[key])) : fallback
    return { realtime: typeof value?.realtime === 'boolean' ? value.realtime : true, hour: number('hour', 0, 24, 12), azimuth: number('azimuth', -180, 180, 0), intensity: number('intensity', 0, 2, 1) }
  } catch { return defaults }
}
// eslint-disable-next-line react-refresh/only-export-components
export function useEnvironment() {
  const [settings, setSettings] = useState(readEnvironment)
  const update = (patch: Partial<EnvironmentSettings>) => setSettings(previous => {
    const next = { ...previous, ...patch }
    try { localStorage.setItem(ENVIRONMENT_KEY, JSON.stringify(next)) } catch { /* storage is optional */ }
    return next
  })
  return { settings, update }
}
export function EnvironmentControls({ settings, onChange }: { settings: EnvironmentSettings; onChange: (patch: Partial<EnvironmentSettings>) => void }) {
  const localHour = useLocalHour()
  const minutes = ((Math.round((settings.realtime ? localHour : settings.hour) * 60) % 1440) + 1440) % 1440
  const label = String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0')
  return <fieldset className="mo-environment-controls"><legend>Environment lighting</legend>
    <label><input type="checkbox" checked={settings.realtime} onChange={event => onChange({ realtime: event.target.checked })}/> Use local clock</label>
    <div role="group" aria-label="Time presets">{([{name:'Sunrise',hour:6},{name:'Day',hour:12},{name:'Sunset',hour:17.5},{name:'Night',hour:0}]).map(preset => <button className="mo-btn mo-btn-ghost mo-btn-sm" type="button" key={preset.name} onClick={() => onChange({hour:preset.hour,realtime:false})}>{preset.name}</button>)}</div>
    <label>Time of day <output aria-label="Environment clock">{label}{settings.realtime ? ' · local' : ''}</output><input aria-label="Time of day" type="range" min="0" max="23.75" step="0.25" value={settings.hour} onChange={event => onChange({ hour: Number(event.target.value), realtime: false })}/></label>
    <label>Sun direction <output>{settings.azimuth}°</output><input aria-label="Sun direction" type="range" min="-180" max="180" step="5" value={settings.azimuth} onChange={event => onChange({ azimuth: Number(event.target.value) })}/></label>
    <label>Sun intensity <output>{settings.intensity.toFixed(1)}×</output><input aria-label="Sun intensity" type="range" min="0" max="2" step="0.1" value={settings.intensity} onChange={event => onChange({ intensity: Number(event.target.value) })}/></label>
  </fieldset>
}
