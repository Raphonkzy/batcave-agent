import { mkdtemp, mkdir, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const race = vi.hoisted(() => ({ beforeOpen: undefined as undefined | ((file: string) => Promise<void>) }))
vi.mock('node:fs/promises', async (original) => {
  const actual = await original<typeof import('node:fs/promises')>()
  return { ...actual, open: async (...args: Parameters<typeof actual.open>) => {
    await race.beforeOpen?.(String(args[0]))
    return actual.open(...args)
  } }
})
import { listFolder, readFolderFile } from './folders.js'

let temporary: string | undefined
afterEach(async () => {
  race.beforeOpen = undefined
  if (temporary) await rm(temporary, { recursive: true, force: true })
})
async function fixture() {
  temporary = await mkdtemp(path.join(tmpdir(), 'batcave-race-'))
  const base = path.join(temporary, 'agent')
  const outside = path.join(temporary, 'outside')
  await mkdir(path.join(base, 'docs'), { recursive: true })
  await mkdir(outside)
  await writeFile(path.join(base, 'docs', 'note.md'), 'safe')
  await writeFile(path.join(outside, 'note.md'), 'outside private data')
  return { folder: { profile: 'coder', directory: base }, base, outside }
}

describe.skipIf(process.platform !== 'linux')('descriptor-anchored folder confinement', () => {
  it('refuses a leaf replaced by a symlink after validation', async () => {
    const { folder, base, outside } = await fixture()
    race.beforeOpen = async (file) => {
      if (!file.endsWith('/note.md')) return
      race.beforeOpen = undefined
      await rename(path.join(base, 'docs', 'note.md'), path.join(base, 'docs', 'old.md'))
      await symlink(path.join(outside, 'note.md'), path.join(base, 'docs', 'note.md'))
    }
    await expect(readFolderFile(folder, 'docs/note.md')).rejects.toMatchObject({ status: 403 })
  })

  it('refuses parent replacement before opening that parent', async () => {
    const { folder, base, outside } = await fixture()
    race.beforeOpen = async (file) => {
      if (!file.endsWith('/docs')) return
      race.beforeOpen = undefined
      await rename(path.join(base, 'docs'), path.join(base, 'old-docs'))
      await symlink(outside, path.join(base, 'docs'))
    }
    await expect(readFolderFile(folder, 'docs/note.md')).rejects.toMatchObject({ status: 403 })
  })

  it('keeps using the opened directory if its original path is replaced later', async () => {
    const { folder, base, outside } = await fixture()
    race.beforeOpen = async (file) => {
      if (!file.endsWith('/note.md')) return
      race.beforeOpen = undefined
      await rename(path.join(base, 'docs'), path.join(base, 'old-docs'))
      await symlink(outside, path.join(base, 'docs'))
    }
    expect((await readFolderFile(folder, 'docs/note.md')).content).toBe('safe')
  })

  it('refuses a directory swapped before listing and preserves safe symlinks', async () => {
    const { folder, base, outside } = await fixture()
    await symlink(path.join(base, 'docs', 'note.md'), path.join(base, 'alias.md'))
    expect((await readFolderFile(folder, 'alias.md')).content).toBe('safe')
    race.beforeOpen = async (file) => {
      if (!file.endsWith('/docs')) return
      race.beforeOpen = undefined
      await rename(path.join(base, 'docs'), path.join(base, 'old-docs'))
      await symlink(outside, path.join(base, 'docs'))
    }
    await expect(listFolder(folder, 'docs')).rejects.toMatchObject({ status: 403 })
  })
})
