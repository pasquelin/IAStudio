import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FolderEntry } from '@shared/domain/folder'
import { createGameScripts, type GameScriptStore } from './gameScripts'

const entry = (path: string): FolderEntry => ({ path, name: path, kind: 'file' })

describe('the scripts a project holds', () => {
  let root: string
  let scripts: GameScriptStore
  let walked: FolderEntry[]

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ia-scripts-'))
    walked = []
    scripts = createGameScripts({ rootOf: () => root, walk: async () => walked })
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('reads every script whole, in one order', async () => {
    await mkdir(join(root, 'Scripts'), { recursive: true })
    await writeFile(join(root, 'Scripts', 'Walk.ts'), 'walk', 'utf8')
    await writeFile(join(root, 'Door.ts'), 'door', 'utf8')
    walked = [entry('Scripts/Walk.ts'), entry('Door.ts'), entry('picture.png')]

    expect(await scripts.list()).toEqual([
      { path: 'Door.ts', source: 'door' },
      { path: 'Scripts/Walk.ts', source: 'walk' },
    ])
  })

  /** The walk and the read are two moments: a file renamed in between is not a fault. */
  it('skips a file the walk saw and the disk has lost', async () => {
    walked = [entry('Gone.ts')]

    expect(await scripts.list()).toEqual([])
  })

  it('writes a script of the project', async () => {
    expect(await scripts.write('Door.ts', 'open')).toBe(true)

    expect(await readFile(join(root, 'Door.ts'), 'utf8')).toBe('open')
  })

  /**
   * 🛑 Every path here comes from the WINDOW, which invariant 1 does not trust with the disk.
   */
  it('refuses a path that leaves the project, however it is spelt', async () => {
    expect(await scripts.write('../escaped.ts', 'no')).toBe(false)
    expect(await scripts.write('Scripts/../../escaped.ts', 'no')).toBe(false)
    expect(await scripts.write(join(root, '..', 'absolute.ts'), 'no')).toBe(false)
  })

  it('refuses what is not a script, and what the studio keeps for itself', async () => {
    expect(await scripts.write('notes.txt', 'no')).toBe(false)
    expect(await scripts.write('.index/secret.ts', 'no')).toBe(false)
  })

  it('answers nothing at all with no project open', async () => {
    const closed = createGameScripts({ rootOf: () => null, walk: async () => walked })

    expect(await closed.list()).toEqual([])
    expect(await closed.write('Door.ts', 'open')).toBe(false)
  })
})
