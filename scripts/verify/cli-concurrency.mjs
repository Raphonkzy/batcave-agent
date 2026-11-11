// Measures how long Hermes reads take one at a time versus a few at once, to choose the CLI
// concurrency limit (BATCAVE_CLI_CONCURRENCY). Usage: node scripts/verify/cli-concurrency.mjs
import { execFile } from 'node:child_process'

const env = { ...process.env, NO_COLOR: '1', TERM: 'dumb', PYTHONIOENCODING: 'utf-8' }
const run = (args) => new Promise((resolve) => {
  const started = Date.now()
  execFile('hermes', args, { timeout: 90_000, env }, (error) => resolve({ ms: Date.now() - started, ok: !error }))
})
const commands = [
  ['-p', 'default', 'cron', 'list', '--all'],
  ['sessions', 'list', '--limit', '20'],
  ['kanban', 'boards', 'list', '--json'],
  ['skills', 'list', '--enabled-only'],
]

for (const width of [1, 2, 4]) {
  const started = Date.now()
  const results = []
  for (let index = 0; index < commands.length; index += width) results.push(...await Promise.all(commands.slice(index, index + width).map(run)))
  console.log(`concurrency ${width}: ${Date.now() - started} ms total; each ${results.map((r) => `${r.ms}${r.ok ? '' : ' FAILED'}`).join(', ')}`)
}
