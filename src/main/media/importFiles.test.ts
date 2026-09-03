import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { importFiles } from './importFiles'

describe('importFiles', () => {
  it('copies an outside file into the chosen project folder and adopts that copy', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const source = `${root}.glb`
    await mkdir(join(root, 'Models'))
    await writeFile(source, 'mesh')
    const adopt = vi.fn(async (path: string): Promise<Asset | null> => ({
      id: 'asset-1',
      name: 'outside',
      type: 'mesh',
      location: 'local',
      path,
      tags: [],
      createdAt: '2026-09-03T00:00:00.000Z',
    }))

    const imported = await importFiles([source], 'Models', {
      projectPath: () => root,
      names: async () => [],
      adopt,
    })

    const copiedName = basename(source)
    expect(await readFile(join(root, 'Models', copiedName), 'utf8')).toBe('mesh')
    expect(adopt).toHaveBeenCalledWith(`Models/${copiedName}`)
    expect(imported).toHaveLength(1)
  })

  it('keeps an existing project file and gives the arriving copy a free name', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const source = `${root}.glb`
    const sourceName = basename(source)
    await writeFile(source, 'new')
    await writeFile(join(root, sourceName), 'kept')

    await importFiles([source], '', {
      projectPath: () => root,
      names: async () => [sourceName],
      adopt: async () => null,
    })

    expect(await readFile(join(root, sourceName), 'utf8')).toBe('kept')
    expect(await readFile(join(root, sourceName.replace('.glb', ' 2.glb')), 'utf8')).toBe('new')
  })
})
