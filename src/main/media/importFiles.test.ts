import { access, mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
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

  it('keeps a file created after the destination names were listed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const source = `${root}.glb`
    const destination = join(root, basename(source))
    await writeFile(source, 'arriving')
    await writeFile(destination, 'concurrent')

    const imported = await importFiles([source], '', {
      projectPath: () => root,
      names: async () => [],
      adopt: async () => null,
      documents: async () => [],
      importBundle: async () => null,
    })

    expect(await readFile(destination, 'utf8')).toBe('concurrent')
    expect(imported.failed).toEqual([basename(source)])
  })

  it('opens an OpenRaster document instead of cataloguing it as a flat image', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const source = `${root}.ora`
    await writeFile(source, 'open raster')
    const path = basename(source)
    const document: DocumentDescriptor = {
      id: 'document-1',
      kind: 'image',
      workspace: 'image',
      title: 'Picture',
      path,
    }
    const adopt = vi.fn(async () => null)

    const imported = await importFiles([source], '', {
      projectPath: () => root,
      names: async () => [],
      adopt,
      documents: async () => [document],
      importBundle: async () => null,
    })

    expect(await readFile(join(root, path), 'utf8')).toBe('open raster')
    expect(imported.documents).toEqual([document])
    expect(adopt).not.toHaveBeenCalled()
  })

  it('canonicalises an uppercase document extension before listing it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const source = `${root}.MTLX`
    await writeFile(source, '<materialx/>')
    const name = basename(source).replace('.MTLX', '.mtlx')
    const document: DocumentDescriptor = {
      id: 'document-2',
      kind: 'material',
      workspace: 'materials',
      title: 'Material',
      path: name,
    }

    const imported = await importFiles([source], '', {
      projectPath: () => root,
      names: async () => [],
      adopt: async () => null,
      documents: async () => [document],
      importBundle: async () => null,
    })

    expect(await readFile(join(root, name), 'utf8')).toBe('<materialx/>')
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
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    await mkdir(join(root, 'Edits'))
    const montage = { content: '{}', media: [], folder: 'Bande' }
    const importBundle = vi.fn(async () => montage)

    const imported = await importFiles(['/outside/Bande.otioz'], 'Edits', {
      projectPath: () => root,
      names: async () => [],
      adopt: async () => null,
      documents: async () => [],
      importBundle,
    })

    expect(importBundle).toHaveBeenCalledWith('/outside/Bande.otioz', root, 'Edits', {})
    expect(imported.montages).toEqual([montage])
  })

  it('returns earlier imports when a later file cannot be copied', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const source = `${root}.png`
    const missing = `${root}-missing.png`
    await writeFile(source, 'picture')
    const adopted: Asset = {
      id: 'asset-2',
      name: 'picture',
      type: 'image',
      location: 'local',
      tags: [],
      createdAt: '2026-09-04T00:00:00.000Z',
    }

    const imported = await importFiles([source, missing], '', {
      projectPath: () => root,
      names: async () => [],
      adopt: async () => adopted,
      documents: async () => [],
      importBundle: async () => null,
    })

    expect(imported.assets).toEqual([adopted])
    expect(imported.failed).toEqual([basename(missing)])
  })

  it('removes a partial copy when the import is cancelled', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const source = `${root}.mp4`
    const controller = new AbortController()
    await writeFile(source, Buffer.alloc(8 * 1024 * 1024))

    const imported = await importFiles(
      [source],
      '',
      {
        projectPath: () => root,
        names: async () => [],
        adopt: async () => null,
        documents: async () => [],
        importBundle: async () => null,
      },
      {
        signal: controller.signal,
        onStep: () => controller.abort(),
      },
    )

    await expect(access(join(root, basename(source)))).rejects.toThrow()
    expect(imported.failed).toEqual([])
  })

  it('removes an asset copy when cataloguing it fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const source = `${root}.png`
    await writeFile(source, 'picture')

    const imported = await importFiles([source], '', {
      projectPath: () => root,
      names: async () => [],
      adopt: async () => {
        throw new Error('catalogue unavailable')
      },
      documents: async () => [],
      importBundle: async () => null,
    })

    await expect(access(join(root, basename(source)))).rejects.toThrow()
    expect(imported.failed).toEqual([basename(source)])
  })

  it('removes document copies when listing them fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const source = `${root}.mtlx`
    await writeFile(source, '<materialx/>')

    const imported = await importFiles([source], '', {
      projectPath: () => root,
      names: async () => [],
      adopt: async () => null,
      documents: async () => {
        throw new Error('documents unavailable')
      },
      importBundle: async () => null,
    })

    await expect(access(join(root, basename(source)))).rejects.toThrow()
    expect(imported.failed).toEqual([basename(source)])
  })

  it('does not follow a destination symlink outside the project', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const outside = await mkdtemp(join(tmpdir(), 'ia-studio-outside-'))
    const source = `${root}.png`
    await writeFile(source, 'picture')
    await symlink(outside, join(root, 'Escape'))

    const imported = await importFiles([source], 'Escape', {
      projectPath: () => root,
      names: async () => [],
      adopt: async () => null,
      documents: async () => [],
      importBundle: async () => null,
    })

    await expect(access(join(outside, basename(source)))).rejects.toThrow()
    expect(imported.failed).toEqual([basename(source)])
  })
})
