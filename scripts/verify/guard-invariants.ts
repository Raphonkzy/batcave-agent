import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface InvariantResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

const REQUIRED_OLD_ROUTES = [
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

const REQUIRED_HASHES = [
  '#/batcave',
  '#/agents',
  '#/usage',
  '#/task-board',
  '#/calendar',
  '#/activity',
  '#/memory',
  '#/folders',
  '#/logs',
  '#/settings',
]

const REQUIRED_CAMERA_PRESETS = [
  'deck',
  'hangar',
  'lobby',
  'manor',
  'overview',
]

export function checkInvariants(root = process.cwd()): InvariantResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. Check routes.ts
  const routesPath = path.join(root, 'src/routes.ts')
  if (!fs.existsSync(routesPath)) {
    errors.push('src/routes.ts is missing!')
  } else {
    const routesContent = fs.readFileSync(routesPath, 'utf8')
    for (const route of REQUIRED_OLD_ROUTES) {
      if (!routesContent.includes(`'${route}'`) && !routesContent.includes(`"${route}"`)) {
        errors.push(`Required route '${route}' missing from src/routes.ts`)
      }
    }
    // Slugs are generated from navigation labels by pageSlug, not literal hash strings.
    // Restrict coverage to the declared list: comments and aliases are not routes.
    const declaration = routesContent.match(/export\s+const\s+navigation\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? ''
    const labels = [...declaration.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '').matchAll(/(['"])(.*?)\1/g)].map((match) => match[2])
    const hashes = new Set(labels.map((label) => `#/${label.toLowerCase().replace(/\s+/g, '-')}`))
    for (const hash of REQUIRED_HASHES) {
      if (!hashes.has(hash)) errors.push(`Required hash '${hash}' missing from navigation in src/routes.ts`)
    }
  }

  // 2. Check query params in mockAgents.ts
  const mockPath = path.join(root, 'src/hooks/mockAgents.ts')
  if (!fs.existsSync(mockPath)) {
    errors.push('src/hooks/mockAgents.ts is missing!')
  } else {
    const mockContent = fs.readFileSync(mockPath, 'utf8')
    if (!mockContent.includes('mockAgents')) {
      errors.push('mockAgents query parameter logic missing from src/hooks/mockAgents.ts')
    }
    if (!mockContent.includes("'cycle'") && !mockContent.includes('"cycle"')) {
      errors.push('mockAgents=cycle query parameter handling missing')
    }
  }

  // 3. Check quality query param ?noAutoQuality
  const qualityPath = path.join(root, 'src/pages/manorQuality.ts')
  if (!fs.existsSync(qualityPath)) {
    errors.push('src/pages/manorQuality.ts is missing!')
  } else {
    const qualityContent = fs.readFileSync(qualityPath, 'utf8')
    if (!qualityContent.includes('noAutoQuality')) {
      errors.push('noAutoQuality query parameter handling missing')
    }
  }

  // 4. Check security: redaction, Access Code, Profile Lock
  const privacyPath = path.join(root, 'server/privacy.ts')
  const accessPath = path.join(root, 'server/access.ts')
  const profileLockPath = path.join(root, 'server/profile-lock.ts')
  for (const [name, p] of [['privacy', privacyPath], ['access', accessPath], ['profile-lock', profileLockPath]]) {
    if (!fs.existsSync(p)) {
      errors.push(`Security module ${name} at ${p} is missing!`)
    }
  }

  // 5. Check no external GLB / external CDN in src/
  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        scanDir(full)
      } else if (entry.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx') || full.endsWith('.css') || full.endsWith('.html'))) {
        const content = fs.readFileSync(full, 'utf8')
        if (/https?:\/\/[^\s"']+\.glb/i.test(content)) {
          errors.push(`External GLB URL detected in ${full}`)
        }
        if (/https?:\/\/cdn\./i.test(content) || /https?:\/\/unpkg\.com/i.test(content) || /https?:\/\/cdnjs\./i.test(content)) {
          errors.push(`Forbidden external CDN URL detected in ${full}`)
        }
      }
    }
  }
  scanDir(path.join(root, 'src'))

  // 6. Check camera presets in manorViews.ts or ZoneLayout.ts
  const manorViewsPath = path.join(root, 'src/pages/manorViews.ts')
  if (fs.existsSync(manorViewsPath)) {
    const viewsContent = fs.readFileSync(manorViewsPath, 'utf8')
    for (const preset of REQUIRED_CAMERA_PRESETS) {
      if (!viewsContent.includes(preset)) {
        errors.push(`Required camera preset '${preset}' missing from src/pages/manorViews.ts`)
      }
    }
  } else {
    errors.push('src/pages/manorViews.ts is missing!')
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = checkInvariants()
  if (!result.ok) {
    console.error('INVARIANT GUARD VIOLATIONS DETECTED:')
    for (const err of result.errors) {
      console.error(`- ${err}`)
    }
    process.exit(1)
  }
  console.log('Invariant guard: all checks passed.')
}
