import * as THREE from 'three'
import { mulberry32 } from '../../scenes/manor/random.ts'
// Abstract pictures for every screen in the Tactical Manor, drawn from an agent's *state* only,
// never from task, log, session or memory text: pseudo-code streamlines, checklists, telemetry,
// graphs, node-and-arrow topology, a schedule strip, a screensaver, static, or a padlock for a
// locked agent. One small shared canvas per picture, redrawn a few times a second.
export type ScreenKind = 'code' | 'checklist' | 'telemetry' | 'graphs' | 'topology' | 'schedule' | 'idle' | 'unknown' | 'locked' | 'off'
export const SCREEN_KINDS: ScreenKind[] = ['code', 'checklist', 'telemetry', 'graphs', 'topology', 'schedule', 'idle', 'unknown', 'locked', 'off']
export const FEED_W = 128
export const FEED_H = 80
/** The colour each picture glows in (also used for the halo round the screen). */
export const GLOW: Record<ScreenKind, string> = { code: '#ffc400', checklist: '#00a8ff', telemetry: '#ff3a3a', graphs: '#00e6a0', topology: '#ffaa00', schedule: '#ffe0a3', idle: '#8f7ae6', unknown: '#8a8f99', locked: '#9aa0aa', off: '#000000' }
/** The picture a working agent's screen shows, by profile. */
const SIGNATURE: Record<string, ScreenKind> = { bruce: 'topology', barbara: 'code', dick: 'checklist', jason: 'telemetry', tim: 'graphs', alfred: 'schedule', default: 'telemetry' }
export function screenKindFor(station: { id: string; state: string; privacy?: string }): ScreenKind {
  if (station.privacy === 'locked') return 'locked'
  switch (station.state) {
    case 'Idle': return 'idle'
    case 'Unknown': return 'unknown'
    case 'Offline': return 'off'
    case 'Reviewing': return 'checklist'
    case 'Collaborating': case 'Triage': return 'topology'
    case 'Deploying': return 'telemetry'
    case 'Researching': return 'graphs'
    case 'Cron': return 'schedule'
    default: return SIGNATURE[station.id.toLowerCase()] ?? 'code'
  }
}
function scanlines(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  for (let y = 0; y < FEED_H; y += 2) ctx.fillRect(0, y, FEED_W, 1)
}
/** Draw one frame of a picture at time `t` (seconds). Shapes only: there is no text anywhere. */
export function drawFeed(ctx: CanvasRenderingContext2D, kind: ScreenKind, t: number): void {
  const colour = GLOW[kind]
  ctx.globalAlpha = 1
  ctx.fillStyle = kind === 'off' ? '#030405' : '#06101a'
  ctx.fillRect(0, 0, FEED_W, FEED_H)
  switch (kind) {
    case 'code': {
      const row = 8
      const scroll = t * 14
      for (let line = -1; line < FEED_H / row + 1; line += 1) {
        const random = mulberry32((Math.floor(scroll / row) + line) * 7919 + 13)
        const y = line * row - (scroll % row)
        let x = 6 + Math.floor(random() * 3) * 6
        for (let word = 0; word < 4 && x < FEED_W - 12; word += 1) {
          const width = 8 + Math.floor(random() * 24)
          ctx.globalAlpha = 0.5 + random() * 0.45
          ctx.fillStyle = random() > 0.75 ? '#ffe9a0' : colour
          ctx.fillRect(x, y + 2, Math.min(width, FEED_W - x - 4), 3)
          x += width + 4
        }
      }
      break
    }
    case 'checklist': {
      const done = Math.floor(t * 0.8) % 7
      for (let item = 0; item < 6; item += 1) {
        const y = 7 + item * 12
        ctx.strokeStyle = colour
        ctx.lineWidth = 1.5
        ctx.strokeRect(8, y, 8, 8)
        if (item < done) { ctx.beginPath(); ctx.moveTo(10, y + 4); ctx.lineTo(12, y + 6.5); ctx.lineTo(16, y + 1.5); ctx.stroke() }
        ctx.globalAlpha = item < done ? 0.45 : 0.9
        ctx.fillStyle = colour
        ctx.fillRect(24, y + 3, 40 + ((item * 37) % 50), 3)
        ctx.globalAlpha = 1
      }
      break
    }
    case 'telemetry': {
      ctx.strokeStyle = colour
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let x = 0; x <= FEED_W; x += 2) ctx.lineTo(x, 30 + Math.sin(x * 0.12 + t * 4) * 9 + Math.sin(x * 0.31 + t * 7) * 4)
      ctx.stroke()
      for (let bar = 0; bar < 10; bar += 1) {
        const h = 6 + Math.abs(Math.sin(bar * 1.7 + t * 2.3)) * 22
        ctx.fillStyle = bar === Math.floor(t * 2) % 10 ? '#ffffff' : colour
        ctx.fillRect(8 + bar * 11, FEED_H - 6 - h, 7, h)
      }
      break
    }
    case 'graphs': {
      ctx.strokeStyle = 'rgba(0,230,160,0.25)'
      for (let x = 0; x < FEED_W; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, FEED_H); ctx.stroke() }
      for (const [phase, alpha] of [[0, 1], [2, 0.55]] as const) {
        ctx.globalAlpha = alpha
        ctx.strokeStyle = colour
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let x = 0; x <= FEED_W; x += 4) ctx.lineTo(x, 46 - Math.sin(x * 0.05 + t * 0.6 + phase) * 16 - x * 0.12)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.fillStyle = colour
      ctx.beginPath(); ctx.arc(104, 18, 10, -Math.PI / 2, -Math.PI / 2 + ((t * 0.4) % 1) * Math.PI * 2); ctx.lineTo(104, 18); ctx.fill()
      break
    }
    case 'topology': {
      const nodes: [number, number][] = [[20, 18], [64, 12], [108, 20], [36, 56], [92, 58], [64, 40]]
      const links = [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [0, 3], [2, 4]]
      ctx.strokeStyle = colour
      ctx.lineWidth = 1.2
      for (const [a, b] of links) { ctx.beginPath(); ctx.moveTo(...nodes[a]); ctx.lineTo(...nodes[b]); ctx.stroke() }
      nodes.forEach(([x, y], index) => { ctx.fillStyle = index === 5 ? '#ffffff' : colour; ctx.fillRect(x - 5, y - 4, 10, 8) })
      const link = links[Math.floor(t * 1.5) % links.length]
      const along = (t * 1.5) % 1
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(nodes[link[0]][0] + (nodes[link[1]][0] - nodes[link[0]][0]) * along - 2, nodes[link[0]][1] + (nodes[link[1]][1] - nodes[link[0]][1]) * along - 2, 4, 4)
      break
    }
    case 'schedule': {
      for (let lane = 0; lane < 5; lane += 1) {
        ctx.fillStyle = 'rgba(255,224,163,0.15)'
        ctx.fillRect(6, 8 + lane * 14, FEED_W - 12, 9)
        const random = mulberry32(lane * 31 + 7)
        for (let block = 0; block < 3; block += 1) {
          ctx.fillStyle = colour
          ctx.globalAlpha = 0.6 + random() * 0.4
          ctx.fillRect(10 + random() * 90, 9 + lane * 14, 8 + random() * 16, 7)
        }
        ctx.globalAlpha = 1
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(6 + ((t * 8) % (FEED_W - 12)), 4, 1.5, FEED_H - 8)
      break
    }
    case 'idle': {
      for (let orb = 0; orb < 3; orb += 1) {
        const x = 64 + Math.sin(t * 0.25 + orb * 2.1) * 40
        const y = 40 + Math.cos(t * 0.2 + orb * 1.7) * 22
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 24)
        gradient.addColorStop(0, ['rgba(143,122,230,0.8)', 'rgba(110,190,255,0.7)', 'rgba(255,170,220,0.6)'][orb])
        gradient.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, FEED_W, FEED_H)
      }
      break
    }
    case 'unknown': {
      const random = mulberry32(Math.floor(t * 8) + 1)
      for (let index = 0; index < 220; index += 1) {
        const shade = 40 + Math.floor(random() * 70)
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`
        ctx.fillRect(Math.floor(random() * FEED_W), Math.floor(random() * FEED_H), 3, 2)
      }
      break
    }
    case 'locked': {
      ctx.globalAlpha = 0.65 + Math.sin(t * 1.2) * 0.1
      ctx.strokeStyle = colour
      ctx.lineWidth = 4
      ctx.beginPath(); ctx.arc(64, 30, 12, Math.PI, 0); ctx.lineTo(76, 38); ctx.moveTo(52, 30); ctx.lineTo(52, 38); ctx.stroke()
      ctx.fillStyle = colour
      ctx.fillRect(46, 38, 36, 26)
      ctx.fillStyle = '#06101a'
      ctx.fillRect(61, 46, 6, 10)
      ctx.globalAlpha = 1
      break
    }
    case 'off': break
  }
  scanlines(ctx)
}
export interface ScreenFeeds { textures: Record<ScreenKind, THREE.CanvasTexture>; update: (time: number) => void }
let shared: ScreenFeeds | undefined
/** The shared canvases, one per picture. Created on first use (browser only). */
export function screenFeeds(): ScreenFeeds {
  if (shared) return shared
  const entries = SCREEN_KINDS.map((kind) => {
    const canvas = document.createElement('canvas')
    canvas.width = FEED_W
    canvas.height = FEED_H
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return [kind, texture, canvas.getContext('2d')!] as const
  })
  shared = {
    textures: Object.fromEntries(entries.map(([kind, texture]) => [kind, texture])) as Record<ScreenKind, THREE.CanvasTexture>,
    update: (time) => { for (const [kind, texture, ctx] of entries) { drawFeed(ctx, kind, time); texture.needsUpdate = true } },
  }
  return shared
}
