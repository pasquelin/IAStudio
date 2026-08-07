import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCatalog, type Catalog } from '@main/project/catalog'
import { openMemoryDatabase } from '@main/project/sqlite-memory'
import {
  createLocalBackend,
  extensionOf,
  relativePathFor,
  type LocalBackend,
} from './local-backend'

const BYTES = new Uint8Array([1, 2, 3, 4])

describe('file naming', () => {
  it('keeps the extension the URL carries', () => {
    expect(extensionOf('https://cdn.example/x/render.WEBP?token=abc', 'image')).toBe('.webp')
  })

  it('falls back per type when the URL carries none, or carries nonsense', () => {
    expect(extensionOf('https://cdn.example/render', 'image')).toBe('.png')
    expect(extensionOf('https://cdn.example/render.a-very-long-thing', 'mesh')).toBe('.glb')
    expect(extensionOf('not a url', 'video')).toBe('.mp4')
  })

  // The API controls the URL; the file name must come from an identifier we minted.
  it('names the file after our own identifier, never after the URL', () => {
    const extension = extensionOf('https://cdn.example/../../evil.png', 'image')
    expect(relativePathFor('asset_1', extension, 'image')).toBe('assets/img/asset_1.png')
  })

  it('refuses an extension that would climb out of the project', () => {
    expect(relativePathFor('a', '/../../.ssh/id_rsa', 'audio')).toBe('assets/aud/a.mp3')
    expect(relativePathFor('a', '.wav/../..', 'audio')).toBe('assets/aud/a.mp3')
  })

  it('files each type under its own folder', () => {
    expect(relativePathFor('a', '.glb', 'mesh')).toBe('assets/3d/a.glb')
    expect(relativePathFor('a', '.wav', 'audio')).toBe('assets/aud/a.wav')
    expect(relativePathFor('a', '.hdr', 'skybox')).toBe('assets/sky/a.hdr')
  })
})

describe('local backend', () => {
  let root: string
  let catalog: Catalog
  let backend: LocalBackend

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'scenario-assets-'))
    await mkdir(join(root, 'assets/img'), { recursive: true })
    await mkdir(join(root, 'assets/aud'), { recursive: true })

    catalog = createCatalog(openMemoryDatabase())
    backend = createLocalBackend({
      download: () => Promise.resolve(BYTES),
      projectPath: () => root,
      catalog: () => catalog,
      now: () => '2026-08-06T10:00:00.000Z',
    })
  })

  afterEach(async () => {
    catalog.close()
    await rm(root, { recursive: true, force: true })
  })

  it('writes the file to disk and indexes it', async () => {
    const asset = await backend.importFromUrl({
      id: 'asset_1',
      url: 'https://cdn.example/render.png',
      name: 'Boulder',
      type: 'image',
      jobId: 'job_1',
      remoteAssetId: 'asset_remote',
    })

    expect(asset).toMatchObject({
      id: 'asset_1',
      location: 'local',
      path: 'assets/img/asset_1.png',
      bytes: 4,
      jobId: 'job_1',
      remoteAssetId: 'asset_remote',
    })

    expect(await readFile(join(root, 'assets/img/asset_1.png'))).toEqual(Buffer.from(BYTES))
    expect(catalog.find('asset_1')).toEqual(asset)
  })

  it('indexes nothing when the download fails', async () => {
    const failing = createLocalBackend({
      download: vi.fn(() => Promise.reject(new Error('offline'))),
      projectPath: () => root,
      catalog: () => catalog,
      now: () => '2026-08-06T10:00:00.000Z',
    })

    await expect(
      failing.importFromUrl({
        id: 'asset_1',
        url: 'https://cdn.example/render.png',
        name: 'Boulder',
        type: 'image',
      }),
    ).rejects.toThrow('offline')

    // An asset in the catalogue with no file behind it is worse than no asset at all.
    expect(catalog.find('asset_1')).toBeNull()
  })

  it('writes bytes the renderer produced, such as an edited take', async () => {
    const edited = new Uint8Array([9, 9, 9])
    const asset = await backend.importFromBytes(
      {
        id: 'asset_2',
        name: 'Nappe (montée)',
        type: 'audio',
        extension: '.wav',
        derivedFrom: 'asset_1',
      },
      edited,
    )

    expect(asset).toMatchObject({
      path: 'assets/aud/asset_2.wav',
      bytes: 3,
      derivedFrom: 'asset_1',
    })
    expect(await readFile(join(root, 'assets/aud/asset_2.wav'))).toEqual(Buffer.from(edited))
    expect(catalog.find('asset_2')).toEqual(asset)
  })

  it('overwrites an asset in place, keeping its identity', async () => {
    await backend.importFromBytes(
      { id: 'asset_2', name: 'Nappe', type: 'audio', extension: '.wav', jobId: 'job_1' },
      new Uint8Array([1, 2, 3]),
    )

    const replaced = await backend.replaceBytes('asset_2', new Uint8Array([4, 5]))

    expect(replaced).toMatchObject({ id: 'asset_2', name: 'Nappe', jobId: 'job_1', bytes: 2 })
    expect(await readFile(join(root, 'assets/aud/asset_2.wav'))).toEqual(Buffer.from([4, 5]))
  })

  it('refuses to replace an asset it has no file for', async () => {
    await expect(backend.replaceBytes('nobody', new Uint8Array([1]))).rejects.toThrow()
  })
})
