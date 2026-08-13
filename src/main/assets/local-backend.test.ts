import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { AssetType } from '@shared/domain/asset'
import type { AsyncCatalog } from '@main/project/catalog-client'
import { memoryCatalog } from '@main/project/catalog-fixtures'
import {
  createLocalBackend,
  extensionOf,
  relativePathFor,
  type Download,
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
  let catalog: AsyncCatalog
  let backend: LocalBackend

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'scenario-assets-'))
    await mkdir(join(root, 'assets/img'), { recursive: true })
    await mkdir(join(root, 'assets/aud'), { recursive: true })
    await mkdir(join(root, 'assets/tex'), { recursive: true })
    await mkdir(join(root, 'assets/3d'), { recursive: true })
    await mkdir(join(root, '.index/posters'), { recursive: true })

    catalog = memoryCatalog()
    backend = createLocalBackend({
      download: () => Promise.resolve(BYTES),
      projectPath: () => root,
      catalog: () => catalog,
      now: () => '2026-08-06T10:00:00.000Z',
    })
  })

  afterEach(async () => {
    await catalog.close()
    await rm(root, { recursive: true, force: true })
  })

  // Pulling a twin twice lands on the same id on purpose. Rebuilding the row from the request
  // alone dropped what the user had put on it.
  it('keeps the tags and the creation date when a row is written again', async () => {
    await catalog.add({
      id: 'asset_1',
      name: 'Boulder',
      type: 'image',
      location: 'local',
      tags: ['hero', 'final'],
      createdAt: '2026-08-01T09:00:00.000Z',
    })

    const rewritten = await backend.importFromUrl({
      id: 'asset_1',
      url: 'https://cdn.example/render.png',
      name: 'Boulder',
      type: 'image',
      remoteAssetId: 'asset_remote',
    })

    expect(rewritten.tags).toEqual(['final', 'hero'])
    expect(rewritten.createdAt).toBe('2026-08-01T09:00:00.000Z')
    // The file did change, and that is what the local stamp is for.
    expect(rewritten.localChangedAt).toBe('2026-08-06T10:00:00.000Z')
  })

  it('keeps what the request says nothing about', async () => {
    await catalog.add({
      id: 'asset_1',
      name: 'Take',
      type: 'audio',
      location: 'local',
      tags: [],
      createdAt: '2026-08-01T09:00:00.000Z',
      hash: 'abc123',
      peaksPath: '.index/peaks/abc123.bin',
    })

    const rewritten = await backend.importFromUrl({
      id: 'asset_1',
      url: 'https://cdn.example/take.wav',
      name: 'Take',
      type: 'audio',
    })

    expect(rewritten.hash).toBe('abc123')
    expect(rewritten.peaksPath).toBe('.index/peaks/abc123.bin')
  })

  it('records everything a generation reported about an import', async () => {
    const generation = { modelId: 'model_flux', modelLabel: 'Flux', prompt: 'moss', params: {} }
    const asset = await backend.importFromUrl({
      id: 'asset_1',
      url: 'https://cdn.example/render.png',
      name: 'Albedo',
      type: 'texture',
      jobId: 'job_1',
      remoteAssetId: 'asset_remote',
      remoteOwnerId: 'proj_a',
      remoteUpdatedAt: '2026-08-06T09:00:00.000Z',
      groupId: 'job_1',
      outputIndex: 0,
      generation,
      derivedFrom: 'asset_source',
      map: 'baseColor',
      mapInverted: true,
    })

    expect(asset).toMatchObject({
      groupId: 'job_1',
      outputIndex: 0,
      generation,
      derivedFrom: 'asset_source',
      map: 'baseColor',
      mapInverted: true,
      remoteOwnerId: 'proj_a',
      remoteUpdatedAt: '2026-08-06T09:00:00.000Z',
    })
  })

  // Downloaded from the very twin it points at: the two cannot differ yet.
  it('counts an imported asset as settled with its twin', async () => {
    const asset = await backend.importFromUrl({
      id: 'asset_1',
      url: 'https://cdn.example/render.png',
      name: 'Boulder',
      type: 'image',
      remoteAssetId: 'asset_remote',
    })

    expect(asset).toMatchObject({
      syncStatus: 'synced',
      remoteSyncedAt: '2026-08-06T10:00:00.000Z',
      localChangedAt: '2026-08-06T10:00:00.000Z',
    })
  })

  it('leaves a file that came from nowhere in particular without a twin', async () => {
    const asset = await backend.importFromUrl({
      id: 'asset_1',
      url: 'https://cdn.example/render.png',
      name: 'Boulder',
      type: 'image',
    })

    expect(asset.syncStatus).toBeUndefined()
    expect(asset.remoteSyncedAt).toBeUndefined()
    expect(asset.groupId).toBeUndefined()
    expect(asset.outputIndex).toBeUndefined()
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
    await expect(catalog.find('asset_1')).resolves.toEqual(asset)
  })

  /**
   * The one door every asset comes through, which is why extracting a model's pictures hangs off
   * it rather than off each import site. Told AFTER the catalogue holds the row: a listener that
   * goes looking for what just arrived — that extraction does exactly that — would find nothing.
   */
  it('says what landed, once the catalogue can answer for it', async () => {
    // The look-up is STARTED from the listener and awaited from the body: an `async` listener's
    // promise is dropped — `onImported` answers `void` — so an expectation inside one would
    // reject into the void and the case would pass on the very regression it guards.
    const asked: Promise<unknown>[] = []
    const watched = createLocalBackend({
      download: () => Promise.resolve(BYTES),
      projectPath: () => root,
      catalog: () => catalog,
      now: () => '2026-08-06T10:00:00.000Z',
      onImported: imported => {
        asked.push(catalog.find(imported.id))
      },
    })

    await watched.importFromUrl({
      id: 'asset_1',
      url: 'https://cdn.example/tree.glb',
      name: 'Tree',
      type: 'mesh',
    })

    expect(await Promise.all(asked)).toEqual([expect.objectContaining({ id: 'asset_1' })])
  })

  /**
   * The deps say a listener that throws must not cost the asset, and the row is committed by the
   * time one is called: an import reported as failed for an asset the project holds is worse
   * than the errand that failed.
   */
  it('keeps the import when a listener throws', async () => {
    const watched = createLocalBackend({
      download: () => Promise.resolve(BYTES),
      projectPath: () => root,
      catalog: () => catalog,
      now: () => '2026-08-06T10:00:00.000Z',
      onImported: () => {
        throw new Error('a listener that has its own troubles')
      },
    })

    await watched.importFromUrl({
      id: 'asset_2',
      url: 'https://cdn.example/tree.glb',
      name: 'Tree',
      type: 'mesh',
    })

    await expect(catalog.find('asset_2')).resolves.not.toBeNull()
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
    await expect(catalog.find('asset_1')).resolves.toBeNull()
  })

  it('writes bytes the renderer produced, such as an edited take', async () => {
    const edited = new Uint8Array([9, 9, 9])
    const asset = await backend.importFromBytes(
      {
        id: 'asset_2',
        name: 'Pad (edited)',
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
    await expect(catalog.find('asset_2')).resolves.toEqual(asset)
  })

  it('overwrites an asset in place, keeping its identity', async () => {
    await backend.importFromBytes(
      { id: 'asset_2', name: 'Pad', type: 'audio', extension: '.wav', jobId: 'job_1' },
      new Uint8Array([1, 2, 3]),
    )

    const replaced = await backend.replaceBytes('asset_2', new Uint8Array([4, 5]), '.wav')

    expect(replaced).toMatchObject({ id: 'asset_2', name: 'Pad', jobId: 'job_1', bytes: 2 })
    expect(await readFile(join(root, 'assets/aud/asset_2.wav'))).toEqual(Buffer.from([4, 5]))
  })

  // An edited take goes back as a wav; leaving it under its old name would hand every reader
  // a file whose extension lies about what is inside it.
  it('renames the file when the bytes are no longer of the same kind, and drops the old one', async () => {
    await backend.importFromBytes(
      { id: 'asset_3', name: 'Import', type: 'audio', extension: '.mp3' },
      new Uint8Array([1]),
    )

    const replaced = await backend.replaceBytes('asset_3', new Uint8Array([4, 5]), '.wav')

    expect(replaced.path).toBe('assets/aud/asset_3.wav')
    expect(await readFile(join(root, 'assets/aud/asset_3.wav'))).toEqual(Buffer.from([4, 5]))
    await expect(readFile(join(root, 'assets/aud/asset_3.mp3'))).rejects.toThrow()
  })

  it('refuses to replace an asset the catalogue does not hold', async () => {
    await expect(backend.replaceBytes('nobody', new Uint8Array([1]), '.wav')).rejects.toThrow()
  })

  /**
   * A LINKED asset keeps its bytes where the user left them and its `path` empty on purpose, so
   * editing one had no file to replace and was refused outright — a picture dragged in from the
   * desktop could never be saved back. The edit lands in the project instead, and the row gains
   * the `path` it did not have.
   */
  it('brings a linked asset into the project rather than refusing the edit', async () => {
    await catalog.add({
      id: 'asset_5',
      name: 'Capture',
      type: 'image',
      location: 'local',
      sourcePath: '/Users/someone/Desktop/Capture.png',
      tags: [],
      createdAt: '2026-08-12T08:00:00.000Z',
    })

    const replaced = await backend.replaceBytes('asset_5', new Uint8Array([4, 5]), '.png')

    expect(replaced).toMatchObject({
      id: 'asset_5',
      name: 'Capture',
      path: 'assets/img/asset_5.png',
    })
    expect(await readFile(join(root, 'assets/img/asset_5.png'))).toEqual(Buffer.from([4, 5]))
  })

  // The file the user only pointed at is not ours to delete: the studio owns the copy it wrote.
  it('leaves the linked file where it was', async () => {
    const linked = join(root, 'outside.png')
    await writeFile(linked, Buffer.from([9]))
    await catalog.add({
      id: 'asset_6',
      name: 'Capture',
      type: 'image',
      location: 'local',
      sourcePath: linked,
      tags: [],
      createdAt: '2026-08-12T08:00:00.000Z',
    })

    await backend.replaceBytes('asset_6', new Uint8Array([4, 5]), '.png')

    expect(await readFile(linked)).toEqual(Buffer.from([9]))
  })

  it('records what the new bytes say about themselves, and drops the stale waveform', async () => {
    await backend.importFromBytes(
      { id: 'asset_4', name: 'Take', type: 'audio', extension: '.wav' },
      new Uint8Array([1]),
    )
    // A waveform computed at ingest, describing the take before any edit.
    await catalog.add({ ...(await catalog.find('asset_4'))!, peaksPath: '.index/peaks/old.bin' })

    const replaced = await backend.replaceBytes('asset_4', new Uint8Array([4, 5]), '.wav', {
      duration: 6_000_000,
      codec: 'pcm_s16le',
      sampleRate: 48_000,
      channels: 1,
    })

    expect(replaced.probe?.duration).toBe(6_000_000)
    // Stale peaks would draw a shape the ear no longer hears.
    expect(replaced.peaksPath).toBeUndefined()
    expect((await catalog.find('asset_4'))?.peaksPath).toBeUndefined()
  })

  it('carries the probe of bytes written beside the source', async () => {
    const asset = await backend.importFromBytes(
      {
        id: 'asset_5',
        name: 'Take (edited)',
        type: 'audio',
        extension: '.wav',
        probe: { duration: 2_000_000, codec: 'pcm_s16le', sampleRate: 48_000, channels: 2 },
      },
      new Uint8Array([1, 2]),
    )

    expect(asset.probe).toMatchObject({ duration: 2_000_000, channels: 2 })
  })
})

/**
 * The still of an asset whose own file no browser can decode. Without it, a mesh that WAS a
 * picture in the library becomes an icon the instant it is downloaded — which is how this was
 * reported, and what the poster path answers.
 */
describe('the still brought down beside the bytes', () => {
  const POSTER = new Uint8Array([7, 7, 7])

  let root: string
  let catalog: AsyncCatalog
  let backend: LocalBackend
  let download: Mock<Download>

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'scenario-posters-'))
    for (const folder of ['assets/3d', 'assets/img', 'assets/tex', 'assets/sky', 'assets/vid']) {
      await mkdir(join(root, folder), { recursive: true })
    }
    await mkdir(join(root, 'assets/aud'), { recursive: true })
    await mkdir(join(root, '.index/posters'), { recursive: true })

    catalog = memoryCatalog()
    download = vi.fn<Download>(url => Promise.resolve(url.includes('thumb') ? POSTER : BYTES))
    backend = createLocalBackend({
      download,
      projectPath: () => root,
      catalog: () => catalog,
      now: () => '2026-08-06T10:00:00.000Z',
    })
  })

  afterEach(async () => {
    await catalog.close()
    await rm(root, { recursive: true, force: true })
  })

  it('writes it under the project and records where', async () => {
    const asset = await backend.importFromUrl({
      id: 'asset_1',
      url: 'https://cdn.example/model.glb',
      name: 'Skeleton',
      type: 'mesh',
      thumbnailUrl: 'https://cdn.example/thumb/asset_remote.jpg',
    })

    expect(asset.posterPath).toBe('.index/posters/asset_1.jpg')
    expect(await readFile(join(root, '.index/posters/asset_1.jpg'))).toEqual(Buffer.from(POSTER))
  })

  /**
   * A picture answers for itself, and a rush and a take get their still at ingest — one recorded
   * here would be painted UNDER the waveform of every audio clip, since a timeline clip reads
   * `posterUrl` like every other surface. Only a `.glb` has nothing that decodes.
   */
  it('writes none for a kind that has a picture of its own', async () => {
    const alreadyShowable: AssetType[] = ['image', 'texture', 'skybox', 'video', 'audio']
    for (const type of alreadyShowable) {
      const asset = await backend.importFromUrl({
        id: `asset_${type}`,
        url: `https://cdn.example/render.${type === 'audio' ? 'mp3' : 'png'}`,
        name: 'Boulder',
        type,
        thumbnailUrl: 'https://cdn.example/thumb/asset_remote.jpg',
      })

      expect(asset.posterPath).toBeUndefined()
    }

    // One download per asset, and not one thumbnail among them.
    expect(download).toHaveBeenCalledTimes(5)
  })

  // The model is the asset; the still is a convenience. A CDN answering 404 must not cost the
  // import that carries it.
  it('imports the asset all the same when the still cannot be fetched', async () => {
    download.mockImplementation((url: string) =>
      url.includes('thumb') ? Promise.reject(new Error('404')) : Promise.resolve(BYTES),
    )

    const asset = await backend.importFromUrl({
      id: 'asset_3',
      url: 'https://cdn.example/model.glb',
      name: 'Skeleton',
      type: 'mesh',
      thumbnailUrl: 'https://cdn.example/thumb/gone.jpg',
    })

    expect(asset.path).toBe('assets/3d/asset_3.glb')
    expect(asset.posterPath).toBeUndefined()
  })

  // Pulling the same twin twice is ordinary. A still that failed the second time must leave the
  // one already on disk, which is a true picture of the same asset.
  it('keeps the still an earlier pull wrote when a later one fails', async () => {
    await backend.importFromUrl({
      id: 'asset_4',
      url: 'https://cdn.example/model.glb',
      name: 'Skeleton',
      type: 'mesh',
      thumbnailUrl: 'https://cdn.example/thumb/asset_remote.jpg',
    })

    download.mockImplementation((url: string) =>
      url.includes('thumb') ? Promise.reject(new Error('404')) : Promise.resolve(BYTES),
    )
    const again = await backend.importFromUrl({
      id: 'asset_4',
      url: 'https://cdn.example/model.glb',
      name: 'Skeleton',
      type: 'mesh',
      thumbnailUrl: 'https://cdn.example/thumb/asset_remote.jpg',
    })

    expect(again.posterPath).toBe('.index/posters/asset_4.jpg')
  })

  // The name follows the extension the CDN's URL carried, and a second pull can carry another.
  // The file the row stops pointing at is ours, and nothing would ever come back for it.
  it('drops the still it replaces when the new one lands under another name', async () => {
    await backend.importFromUrl({
      id: 'asset_6',
      url: 'https://cdn.example/model.glb',
      name: 'Skeleton',
      type: 'mesh',
      thumbnailUrl: 'https://cdn.example/thumb/asset_remote.jpg',
    })
    expect(await readFile(join(root, '.index/posters/asset_6.jpg'))).toEqual(Buffer.from(POSTER))

    const again = await backend.importFromUrl({
      id: 'asset_6',
      url: 'https://cdn.example/model.glb',
      name: 'Skeleton',
      type: 'mesh',
      thumbnailUrl: 'https://cdn.example/thumb/asset_remote.webp',
    })

    expect(again.posterPath).toBe('.index/posters/asset_6.webp')
    await expect(readFile(join(root, '.index/posters/asset_6.jpg'))).rejects.toThrow()
  })

  it('asks for nothing when the request carries no still', async () => {
    const asset = await backend.importFromUrl({
      id: 'asset_5',
      url: 'https://cdn.example/model.glb',
      name: 'Skeleton',
      type: 'mesh',
    })

    expect(asset.posterPath).toBeUndefined()
    expect(download).toHaveBeenCalledTimes(1)
  })
})
