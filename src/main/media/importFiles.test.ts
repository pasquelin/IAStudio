import { access, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { DocumentDescriptor } from '@shared/domain/document'
import { importFiles } from './importFiles'

describe('importFiles', () => {
  it('copies an outside file into the chosen project folder and adopts that copy', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const source = `${root}.obj`
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
      documents: async () => [],
      importBundle: async () => null,
    })

    const copiedName = basename(source)
    expect(await readFile(join(root, 'Models', copiedName), 'utf8')).toBe('mesh')
    expect(adopt).toHaveBeenCalledWith(`Models/${copiedName}`)
    expect(imported.assets).toHaveLength(1)
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
      documents: async () => [],
      importBundle: async () => null,
    })

    expect(await readFile(join(root, sourceName), 'utf8')).toBe('kept')
    expect(await readFile(join(root, sourceName.replace('.glb', ' 2.glb')), 'utf8')).toBe('new')
  })

  it('copies an outside standard document and returns the descriptor read from that copy', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const source = `${root}.mtlx`
    await writeFile(source, '<materialx/>')
    const path = basename(source)
    const document: DocumentDescriptor = {
      id: 'document-1',
      kind: 'material',
      workspace: 'materials',
      title: 'Material',
      path,
    }

    const imported = await importFiles([source], '', {
      projectPath: () => root,
      names: async () => [],
      adopt: async () => null,
      documents: async () => [document],
      importBundle: async () => null,
    })

    expect(await readFile(join(root, path), 'utf8')).toBe('<materialx/>')
    expect(imported.documents).toEqual([document])
  })

  it('removes and reports a glTF that is not a readable studio document', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const source = `${root}.gltf`
    await writeFile(source, '{"asset":{"version":"2.0"}}')
    const name = basename(source)

    const imported = await importFiles([source], '', {
      projectPath: () => root,
      names: async () => [],
      adopt: async () => null,
      documents: async () => [],
      importBundle: async () => null,
    })

    await expect(access(join(root, name))).rejects.toThrow()
    expect(imported.refused).toEqual([{ name, extension: 'gltf' }])
  })

  it('hands an outside montage bundle to its unpacker', async () => {
    const montage = { content: '{}', media: [], folder: 'Bande' }
    const importBundle = vi.fn(async () => montage)

    const imported = await importFiles(['/outside/Bande.otioz'], 'Edits', {
      projectPath: () => '/project',
      names: async () => [],
      adopt: async () => null,
      documents: async () => [],
      importBundle,
    })

    expect(importBundle).toHaveBeenCalledWith('/outside/Bande.otioz', 'Edits')
    expect(imported.montages).toEqual([montage])
  })
})
