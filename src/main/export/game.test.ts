import { mkdtemp, readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '@shared/ipc'
import type { GameExportOutcome } from '@shared/domain/gameExport'
import { invoke, resetHandlers } from '@main/ipc/testHarness'
import { registerGameExportHandler } from './game'

vi.mock('electron', async () => (await import('@main/ipc/testHarness')).mockElectron())

const SCENE = JSON.stringify({ nodes: [] })

describe('the door onto a game written out of the studio', () => {
  let chosen: string
  let project: string
  let runtime: string

  beforeEach(async () => {
    resetHandlers()
    chosen = await mkdtemp(join(tmpdir(), 'game-export-'))
    project = await mkdtemp(join(tmpdir(), 'game-project-'))
    runtime = join(project, 'gameRuntime')
    await mkdir(runtime, { recursive: true })
    await writeFile(join(runtime, 'runtime.js'), '// bundle')
    registerGameExportHandler({
      pickFolder: () => Promise.resolve<string | null>(chosen),
      projectPath: () => project,
      assetsById: () => Promise.resolve([]),
      runtimeFolder: () => runtime,
    })
  })

  const exporting = async (over: Record<string, unknown> = {}) =>
    (await invoke(CHANNELS.gameExport, {
      title: 'Demo',
      entryScene: 'doc-1',
      scenes: [{ id: 'doc-1', title: 'Menu', content: SCENE }],
      scripts: [],
      ...over,
    })) as GameExportOutcome | null

  it('answers the folder NAME and writes the game inside it', async () => {
    const outcome = await exporting()

    expect(outcome).toMatchObject({ folder: 'Demo', scenes: 1 })
    expect((await readdir(join(chosen, 'Demo'))).sort()).toEqual([
      'game.json',
      'index.html',
      'runtime.js',
      'scenes',
    ])
  })

  /** 🛑 A title is a person's words, and a folder name is not — `..` climbs out of the choice. */
  it('writes a game whose title would climb out of the folder inside it', async () => {
    await exporting({ title: '../../evil' })

    expect(await readdir(chosen)).toEqual(['evil'])
  })

  /**
   * The half a caller with no screen needs: a folder NAMED rather than picked. What guards it is
   * the project's own boundary, since nobody is there to choose one outside.
   */
  describe('a folder the caller names', () => {
    it('writes there without raising a picker', async () => {
      const pickFolder = vi.fn(() => Promise.resolve<string | null>(chosen))
      resetHandlers()
      registerGameExportHandler({
        pickFolder,
        projectPath: () => project,
        assetsById: () => Promise.resolve([]),
        runtimeFolder: () => runtime,
      })

      expect(await exporting({ folder: 'Builds' })).toMatchObject({ folder: 'Demo' })
      expect(await readdir(join(project, 'Builds', 'Demo'))).toContain('index.html')
      expect(pickFolder).not.toHaveBeenCalled()
    })

    it('refuses a folder that climbs out of the project', async () => {
      expect(await exporting({ folder: '../elsewhere' })).toBeNull()
    })

    /** 🛑 ONE folder, which is what `folderInsideProject` says its own safety rests on: it reads
     * what the disk resolves to and refuses nothing about the SHAPE of a name. */
    it('refuses a path where a folder name was asked for', async () => {
      expect(await exporting({ folder: 'Builds/Nested' })).toBeNull()
    })

    it('picks as before when the folder is empty', async () => {
      await exporting({ folder: '' })

      expect(await readdir(chosen)).toEqual(['Demo'])
    })
  })

  it('answers nothing when nobody picked a folder, and asks nothing with no project', async () => {
    resetHandlers()
    registerGameExportHandler({
      pickFolder: () => Promise.resolve<string | null>(null),
      projectPath: () => null,
      assetsById: () => Promise.resolve([]),
      runtimeFolder: () => runtime,
    })

    expect(await exporting()).toBeNull()
  })

  /** In development the folder exists only once `pnpm game:runtime` has run, and git ignores it. */
  it('says a game has no runtime rather than letting an ENOENT out', async () => {
    resetHandlers()
    registerGameExportHandler({
      pickFolder: () => Promise.resolve<string | null>(chosen),
      projectPath: () => project,
      assetsById: () => Promise.resolve([]),
      runtimeFolder: () => join(project, 'nowhere'),
    })

    await expect(exporting()).rejects.toThrow(/pnpm game:runtime/)
  })

  it('copies the scene it was handed, whole', async () => {
    await exporting()

    expect(await readFile(join(chosen, 'Demo/scenes/doc-1.gltf'), 'utf8')).toBe(SCENE)
  })
})
