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

  it('names the file that was dropped in a refusal, not the free name its copy took', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const source = `${root}.gltf`
    const name = basename(source)
    await writeFile(source, '{"asset":{"version":"2.0"}}')
    await writeFile(join(root, name), 'held')

    const imported = await importFiles([source], '', {
      projectPath: () => root,
      names: async () => [name],
      adopt: async () => null,
      documents: async () => [],
      importBundle: async () => null,
    })

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

  it('copies the binary and the pictures a glTF points at into a folder of its own', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const outside = await mkdtemp(join(tmpdir(), 'ia-studio-source-'))
    const source = join(outside, 'Niveau.gltf')
    await writeFile(
      source,
      JSON.stringify({
        asset: { version: '2.0' },
        buffers: [{ uri: 'Niveau.bin' }],
        images: [{ uri: 'textures/peau.png' }],
      }),
    )
    await writeFile(join(outside, 'Niveau.bin'), 'binaire')
    await mkdir(join(outside, 'textures'))
    await writeFile(join(outside, 'textures', 'peau.png'), 'image')
    const document: DocumentDescriptor = {
      id: 'document-3',
      kind: 'scene',
      workspace: '3d',
      title: 'Niveau',
      path: 'Niveau/Niveau.gltf',
    }

    const imported = await importFiles([source], '', {
      projectPath: () => root,
      names: async () => [],
      adopt: async () => null,
      documents: async () => [document],
      importBundle: async () => null,
    })

    expect(await readFile(join(root, 'Niveau', 'Niveau.bin'), 'utf8')).toBe('binaire')
    expect(await readFile(join(root, 'Niveau', 'textures', 'peau.png'), 'utf8')).toBe('image')
    expect(imported.documents).toEqual([document])
  })

  it('catalogues a picture a document points at, which is what relinks it to its texture', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const outside = await mkdtemp(join(tmpdir(), 'ia-studio-source-'))
    const source = join(outside, 'Bois.mtlx')
    await writeFile(
      source,
      '<materialx version="1.39"><input name="file" type="filename" value="albedo.png" /></materialx>',
    )
    await writeFile(join(outside, 'albedo.png'), 'image')
    const adopt = vi.fn(async () => null)

    await importFiles([source], 'Matieres', {
      projectPath: () => root,
      names: async () => [],
      adopt,
      documents: async () => [],
      importBundle: async () => null,
    })

    expect(adopt).toHaveBeenCalledWith('Matieres/Bois/albedo.png')
  })

  it('imports a document whose neighbour is missing and names the file it could not find', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const outside = await mkdtemp(join(tmpdir(), 'ia-studio-source-'))
    const source = join(outside, 'Ciel.gltf')
    await writeFile(
      source,
      JSON.stringify({
        asset: { version: '2.0' },
        nodes: [{ name: 'Horizon', extras: { iastudio: { source: 'Ciel.hdr' } } }],
      }),
    )
    const document: DocumentDescriptor = {
      id: 'document-4',
      kind: 'skybox',
      workspace: 'skyboxes',
      title: 'Ciel',
      path: 'Ciel/Ciel.gltf',
    }

    const imported = await importFiles([source], '', {
      projectPath: () => root,
      names: async () => [],
      adopt: async () => null,
      documents: async () => [document],
      importBundle: async () => null,
    })

    expect(imported.documents).toEqual([document])
    expect(imported.failed).toEqual(['Ciel.hdr'])
  })

  it('leaves a self-contained glTF where every other import lands', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const outside = await mkdtemp(join(tmpdir(), 'ia-studio-source-'))
    const source = join(outside, 'Seul.gltf')
    await writeFile(
      source,
      JSON.stringify({
        asset: { version: '2.0' },
        buffers: [{ uri: 'data:application/octet-stream;base64,AAAA' }],
      }),
    )
    const document: DocumentDescriptor = {
      id: 'document-5',
      kind: 'scene',
      workspace: '3d',
      title: 'Seul',
      path: 'Seul.gltf',
    }

    const imported = await importFiles([source], '', {
      projectPath: () => root,
      names: async () => [],
      adopt: async () => null,
      documents: async () => [document],
      importBundle: async () => null,
    })

    expect(imported.documents).toEqual([document])
    await expect(access(join(root, 'Seul'))).rejects.toThrow()
  })

  it('takes the whole folder away when a document that owned one is refused', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const outside = await mkdtemp(join(tmpdir(), 'ia-studio-source-'))
    const source = join(outside, 'Cassee.gltf')
    await writeFile(
      source,
      JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'Cassee.bin' }] }),
    )
    await writeFile(join(outside, 'Cassee.bin'), 'binaire')

    const imported = await importFiles([source], '', {
      projectPath: () => root,
      names: async () => [],
      adopt: async () => null,
      documents: async () => [],
      importBundle: async () => null,
    })

    await expect(access(join(root, 'Cassee'))).rejects.toThrow()
    expect(imported.refused).toEqual([{ name: 'Cassee.gltf', extension: 'gltf' }])
  })

  it('leaves no folder behind when the import is cancelled while copying the neighbours', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const outside = await mkdtemp(join(tmpdir(), 'ia-studio-source-'))
    const source = join(outside, 'Lourd.gltf')
    await writeFile(
      source,
      JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'Lourd.bin' }] }),
    )
    await writeFile(join(outside, 'Lourd.bin'), Buffer.alloc(8 * 1024 * 1024))
    const controller = new AbortController()
    const documents = vi.fn(async () => [])

    const imported = await importFiles(
      [source],
      '',
      {
        projectPath: () => root,
        names: async () => [],
        adopt: async () => null,
        documents,
        importBundle: async () => null,
      },
      { signal: controller.signal, onStep: () => controller.abort() },
    )

    await expect(access(join(root, 'Lourd'))).rejects.toThrow()
    expect(imported.documents).toEqual([])
  })

  it('does not follow a neighbour that a symbolic link takes out of the source folder', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ia-studio-import-'))
    const outside = await mkdtemp(join(tmpdir(), 'ia-studio-source-'))
    const elsewhere = await mkdtemp(join(tmpdir(), 'ia-studio-elsewhere-'))
    await writeFile(join(elsewhere, 'secret.png'), 'private key')
    await symlink(join(elsewhere, 'secret.png'), join(outside, 'peau.png'))
    await symlink(elsewhere, join(outside, 'textures'))
    const source = join(outside, 'Niveau.gltf')
    await writeFile(
      source,
      JSON.stringify({
        asset: { version: '2.0' },
        images: [{ uri: 'peau.png' }, { uri: 'textures/secret.png' }],
      }),
    )
    const document: DocumentDescriptor = {
      id: 'document-7',
      kind: 'scene',
      workspace: '3d',
      title: 'Niveau',
      path: 'Niveau/Niveau.gltf',
    }

    const imported = await importFiles([source], '', {
      projectPath: () => root,
      names: async () => [],
      adopt: async () => null,
      documents: async () => [document],
      importBundle: async () => null,
    })

    await expect(access(join(root, 'Niveau', 'peau.png'))).rejects.toThrow()
    await expect(access(join(root, 'Niveau', 'textures', 'secret.png'))).rejects.toThrow()
    expect(imported.failed).toEqual(['peau.png', 'secret.png'])
  })
})
