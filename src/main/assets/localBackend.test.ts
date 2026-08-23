import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { AssetType } from '@shared/domain/asset'
import type { AsyncCatalog } from '@main/project/catalogClient'
// `hashOrNull` where the backend is wired, `hashSource` where a test states the value it expects:
// the first is what production injects, the second is the same answer without the `null` arm.
import { hashOrNull, hashSource } from '@main/media/runner'
import { memoryCatalog } from '@main/project/catalog-fixtures'
import {
  createLocalBackend,
  extensionFromUrl,
  type Download,
  type LocalBackend,
} from './localBackend'

const BYTES = new Uint8Array([1, 2, 3, 4])

describe('file naming', () => {
  it('keeps the extension the URL carries', () => {
    expect(extensionFromUrl('https://cdn.example/x/render.WEBP?token=abc', 'image')).toBe('.webp')
  })

  it('falls back per type when the URL carries none, or carries nonsense', () => {
    expect(extensionFromUrl('https://cdn.example/render', 'image')).toBe('.png')
    expect(extensionFromUrl('https://cdn.example/render.a-very-long-thing', 'mesh')).toBe('.glb')
    expect(extensionFromUrl('not a url', 'video')).toBe('.mp4')
  })

  // The API controls the URL, and a name is now taken from it — only its extension, and only
  // when it looks like one. `../../.ssh/id_rsa` would otherwise be written outside the project.
  it('refuses an extension that would climb out of the project', () => {
    expect(extensionFromUrl('https://cdn.example/take/../../.ssh/id_rsa', 'audio')).toBe('.mp3')
    expect(extensionFromUrl('https://cdn.example/take.wav/../..', 'audio')).toBe('.mp3')
  })
})

describe('local backend', () => {
  let root: string
  let catalog: AsyncCatalog
  let backend: LocalBackend

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'scenario-assets-'))
    // No landing folder is laid down: `DEFAULT_ASSET_FOLDERS` is a default now, not a layout, and
    // every import below writes into a folder that has to be created on the way. A user who threw
    // `Images/` away gets it back rather than an import that fails.
    await mkdir(join(root, '.index/posters'), { recursive: true })

    catalog = memoryCatalog()
    backend = createLocalBackend({
      download: () => Promise.resolve(BYTES),
      projectPath: () => root,
      catalog: () => catalog,
      now: () => '2026-08-06T10:00:00.000Z',
      hash: hashOrNull,
    })
  })

  afterEach(async () => {
    await catalog.close()
    await rm(root, { recursive: true, force: true })
  })

  /**
   * The API states no duration beside the bytes it hands over: a generated take reached the
   * timeline as an untimed clip — five arbitrary seconds — and nothing said whether it carried
   * a sound, which is what decides that a drop lays down one clip or two.
   */
  it('reads a downloaded take back for its length and its tracks', async () => {
    const probeFile = vi.fn(async () => ({
      duration: 5_400_000,
      codec: 'h264',
      width: 848,
      height: 480,
      sampleRate: 48_000,
      channels: 2,
    }))
    const probing = createLocalBackend({
      download: () => Promise.resolve(BYTES),
      projectPath: () => root,
      catalog: () => catalog,
      now: () => '2026-08-06T10:00:00.000Z',
      hash: hashOrNull,
      probeFile,
    })

    const asset = await probing.importFromUrl({
      id: 'asset_1',
      url: 'https://cdn.example/take.mp4',
      name: 'Terrier',
      type: 'video',
    })

    expect(asset.probe?.duration).toBe(5_400_000)
    expect(asset.probe?.channels).toBe(2)
    // The file that was just written, never the URL it came from.
    expect(probeFile).toHaveBeenCalledWith(join(root, 'Video/Terrier.mp4'))
  })

  // A tool the user has not installed must cost nothing but the length nobody could read.
  it('imports the take all the same when nothing can read it back', async () => {
    const probing = createLocalBackend({
      download: () => Promise.resolve(BYTES),
      projectPath: () => root,
      catalog: () => catalog,
      now: () => '2026-08-06T10:00:00.000Z',
      hash: hashOrNull,
      probeFile: () => Promise.reject(new Error('no ffprobe')),
    })

    const asset = await probing.importFromUrl({
      id: 'asset_1',
      url: 'https://cdn.example/take.mp4',
      name: 'Terrier',
      type: 'video',
    })

    expect(asset.path).toBe('Video/Terrier.mp4')
    expect(asset.probe).toBeUndefined()
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

  /**
   * Now that the file is named after the row, a second pull has somewhere else to land: the free
   * name beside the one it wrote the first time. Two files for one asset, the row pointing at
   * the newer and nothing ever coming back for the older.
   */
  it('lands a twin pulled twice on the file it landed on the first time', async () => {
    const first = await backend.importFromUrl({
      id: 'asset_1',
      url: 'https://cdn.example/render.png',
      name: 'Boulder',
      type: 'image',
    })

    const second = await backend.importFromUrl({
      id: 'asset_1',
      url: 'https://cdn.example/render.png',
      name: 'Boulder',
      type: 'image',
    })

    expect(second.path).toBe(first.path)
    expect(await readdir(join(root, 'Images'))).toEqual(['Boulder.png'])
  })

  /**
   * A second pull must not put the API's wording back over a name the user has since chosen —
   * and not on ONE of the two either: writing the request's name into the row while the file
   * kept the user's is the two-name problem again, in the opposite direction.
   */
  it('keeps the name the row carries when the request brings another', async () => {
    await backend.importFromUrl({
      id: 'asset_1',
      url: 'https://cdn.example/render.png',
      name: 'Boulder',
      type: 'image',
    })

    // As a rename leaves it: the row and the file say the same thing, which is the whole point.
    const held = await catalog.find('asset_1')
    if (held) await catalog.add({ ...held, name: 'Ruelle bleue', path: 'Images/Ruelle bleue.png' })

    const rewritten = await backend.importFromUrl({
      id: 'asset_1',
      url: 'https://cdn.example/render.png',
      name: 'Boulder',
      type: 'image',
    })

    expect(rewritten.name).toBe('Ruelle bleue')
    expect(rewritten.path).toBe('Images/Ruelle bleue.png')
  })

  /** The suffix follows the bytes: a take that comes back re-encoded stops claiming to be a wav. */
  it('re-suffixes the file it already has rather than laying a second one beside it', async () => {
    await backend.importFromBytes(
      { id: 'asset_2', name: 'Prise', type: 'audio', extension: '.mp3' },
      new Uint8Array([1]),
    )

    const rewritten = await backend.importFromUrl({
      id: 'asset_2',
      url: 'https://cdn.example/take.wav',
      name: 'Prise',
      type: 'audio',
    })

    expect(rewritten.path).toBe('Audio/Prise.wav')
  })

  /**
   * A generation made on this machine is already a file: reading it to write it back put video,
   * audio, meshes and panoramas through the main process's heap whole, twice.
   */
  it('moves a file already on this machine instead of copying its bytes through', async () => {
    const source = join(root, 'handover.png')
    await writeFile(source, BYTES)

    const asset = await backend.importFromFile(
      { id: 'asset_1', name: 'Cube', type: 'image', extension: '.png' },
      source,
    )

    expect(asset.path).toBe('Images/Cube.png')
    expect(await readFile(join(root, asset.path ?? ''))).toEqual(Buffer.from(BYTES))
    // The length comes off the file that landed, there being no buffer to measure.
    expect(asset.bytes).toBe(BYTES.byteLength)
    await expect(readFile(source)).rejects.toThrow()
  })

  // One folder per kind, and the catalogue reads a texture's channel off the folder it sits in.
  it('files each kind under its own folder', async () => {
    const landed = async (type: AssetType): Promise<string | undefined> => {
      const asset = await backend.importFromBytes(
        { id: `asset_${type}`, name: 'Prise', type, extension: '.bin' },
        BYTES,
      )
      return asset.path
    }

    expect(await landed('mesh')).toBe('3D/Prise.bin')
    expect(await landed('audio')).toBe('Audio/Prise.bin')
    expect(await landed('skybox')).toBe('Sky/Prise.bin')
  })

  /**
   * A job of four outputs lands four times under one prompt, and there is nobody to ask. The
   * suffix is the studio's own doing — a name a user typed is refused instead.
   */
  it('suffixes a second asset that would land on the same file', async () => {
    const first = await backend.importFromUrl({
      id: 'asset_1',
      url: 'https://cdn.example/a.png',
      name: 'Ruelle bleue',
      type: 'image',
    })
    const second = await backend.importFromUrl({
      id: 'asset_2',
      url: 'https://cdn.example/b.png',
      name: 'Ruelle bleue',
      type: 'image',
    })

    expect(first.path).toBe('Images/Ruelle bleue.png')
    expect(second.path).toBe('Images/Ruelle bleue 2.png')
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

    expect(rewritten.peaksPath).toBe('.index/peaks/abc123.bin')
    // Not among them: the file was written again, so the fingerprint describes what is on the
    // disk now rather than what the row remembered.
    expect(rewritten.hash).toBe(await hashSource(join(root, 'Audio/Take.wav')))
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

  it("records a generation's remote id without counting it as synced", async () => {
    const asset = await backend.importFromUrl({
      id: 'asset_1',
      url: 'https://cdn.example/render.png',
      name: 'Boulder',
      type: 'image',
      remoteAssetId: 'asset_remote',
      sync: false,
    })

    expect(asset.remoteAssetId).toBe('asset_remote')
    expect(asset.syncStatus).toBeUndefined()
    // Same clock as `localChangedAt`, so the library page does not read as a conflict and a
    // follow-up generation reuses the id rather than pushing a duplicate.
    expect(asset.remoteSyncedAt).toBe('2026-08-06T10:00:00.000Z')
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
      // The name, never the id: a folder of `asset_40f76c36-8ad4-….png` says nothing about
      // what is in it, and the row that does say could not be joined to it by eye.
      path: 'Images/Boulder.png',
      bytes: 4,
      jobId: 'job_1',
      remoteAssetId: 'asset_remote',
    })

    expect(await readFile(join(root, 'Images/Boulder.png'))).toEqual(Buffer.from(BYTES))
    await expect(catalog.find('asset_1')).resolves.toEqual(asset)
  })

  /**
   * Measured on the running app before this existed: a picture pulled from the library, moved out
   * of `Images/` with the Finder, was DATED rather than followed — the rescan looks a lost row up
   * by its fingerprint, and every row that came through this door carried none. Only a file picked
   * off a disk was ever fingerprinted, by the ingest, and that is not how assets reach a project
   * here: they are generated or pulled.
   *
   * Compared against `hashSource` itself rather than against a literal, because the value proves
   * nothing on its own — what matters is that it is the SAME one the rescan will compute.
   */
  it('fingerprints the file it wrote, so a rescan can follow it when the user files it away', async () => {
    const asset = await backend.importFromUrl({
      id: 'asset_1',
      url: 'https://cdn.example/render.png',
      name: 'Boulder',
      type: 'image',
    })

    expect(asset.hash).toBe(await hashSource(join(root, 'Images/Boulder.png')))
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
      hash: hashOrNull,
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
      hash: hashOrNull,
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
      hash: hashOrNull,
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
      // Cleaned on the way to the disk, having nobody to refuse it to: the studio wrote this
      // name itself, and a user's own is refused instead — see `checkAssetName`.
      path: 'Audio/Pad (edited).wav',
      bytes: 3,
      derivedFrom: 'asset_1',
    })
    expect(await readFile(join(root, 'Audio/Pad (edited).wav'))).toEqual(Buffer.from(edited))
    await expect(catalog.find('asset_2')).resolves.toEqual(asset)
  })

  it('overwrites an asset in place, keeping its identity', async () => {
    await backend.importFromBytes(
      { id: 'asset_2', name: 'Pad', type: 'audio', extension: '.wav', jobId: 'job_1' },
      new Uint8Array([1, 2, 3]),
    )

    const replaced = await backend.replaceBytes('asset_2', new Uint8Array([4, 5]), '.wav')

    expect(replaced).toMatchObject({ id: 'asset_2', name: 'Pad', jobId: 'job_1', bytes: 2 })
    expect(await readFile(join(root, 'Audio/Pad.wav'))).toEqual(Buffer.from([4, 5]))
  })

  // An edited take goes back as a wav; leaving it under its old name would hand every reader
  // a file whose extension lies about what is inside it.
  it('renames the file when the bytes are no longer of the same kind, and drops the old one', async () => {
    await backend.importFromBytes(
      { id: 'asset_3', name: 'Import', type: 'audio', extension: '.mp3' },
      new Uint8Array([1]),
    )

    const replaced = await backend.replaceBytes('asset_3', new Uint8Array([4, 5]), '.wav')

    expect(replaced.path).toBe('Audio/Import.wav')
    expect(await readFile(join(root, 'Audio/Import.wav'))).toEqual(Buffer.from([4, 5]))
    await expect(readFile(join(root, 'Audio/Import.mp3'))).rejects.toThrow()
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
      // Its own name, the row having no file of ours to keep the stem of — and free, which is
      // asked of the folder rather than of the catalogue.
      path: 'Images/Capture.png',
    })
    expect(await readFile(join(root, 'Images/Capture.png'))).toEqual(Buffer.from([4, 5]))
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

  // Same reasoning as the waveform above: the fingerprint the row carried describes bytes that
  // are gone. Left alone, it would send a rescan hunting for a file nobody can produce, and would
  // have a fresh import of the ORIGINAL bytes turned away as a duplicate of this row.
  it('re-fingerprints the take when its bytes are replaced', async () => {
    await backend.importFromBytes(
      { id: 'asset_5', name: 'Take', type: 'audio', extension: '.wav' },
      new Uint8Array([1]),
    )
    const before = (await catalog.find('asset_5'))?.hash

    const replaced = await backend.replaceBytes('asset_5', new Uint8Array([4, 5]), '.wav')

    expect(replaced.hash).not.toBe(before)
    expect(replaced.hash).toBe(await hashSource(join(root, 'Audio/Take.wav')))
  })

  // Dropping the waveform is only half the job. Nothing used to derive the new one — `ingest`
  // hangs off the file picker alone — so applying an edit left every clip of that take
  // waveform-less, in every montage, for good.
  it('says the take changed, so a fresh waveform can be derived from the new bytes', async () => {
    const landed: string[] = []
    const watched = createLocalBackend({
      download: () => Promise.resolve(BYTES),
      projectPath: () => root,
      catalog: () => catalog,
      now: () => '2026-08-06T10:00:00.000Z',
      hash: hashOrNull,
      onImported: asset => {
        landed.push(asset.id)
      },
    })
    await watched.importFromBytes(
      { id: 'asset_7', name: 'Take', type: 'audio', extension: '.wav' },
      new Uint8Array([1]),
    )
    landed.length = 0

    await watched.replaceBytes('asset_7', new Uint8Array([4, 5]), '.wav')

    expect(landed).toEqual(['asset_7'])
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
      hash: hashOrNull,
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
   * A grid of video tiles is a grid of identical grey rectangles otherwise, and so is a clip on
   * the strip — both read `posterUrl`. The still the library already holds is the cheapest true
   * picture of the take there is; nothing needs decoding to show it.
   */
  it('writes one for a rush, whose own file no grid can paint', async () => {
    const asset = await backend.importFromUrl({
      id: 'asset_2',
      url: 'https://cdn.example/take.mp4',
      name: 'Terrier',
      type: 'video',
      thumbnailUrl: 'https://cdn.example/thumb/asset_remote.jpg',
    })

    expect(asset.posterPath).toBe('.index/posters/asset_2.jpg')
    expect(await readFile(join(root, '.index/posters/asset_2.jpg'))).toEqual(Buffer.from(POSTER))
  })

  /**
   * A picture answers for itself. A sound must NOT be given one: a timeline clip reads
   * `posterUrl` like every other surface, and the still would be painted under its waveform.
   */
  it('writes none for a kind that has a picture of its own', async () => {
    const alreadyShowable: AssetType[] = ['image', 'texture', 'skybox', 'audio']
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
    expect(download).toHaveBeenCalledTimes(4)
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

    expect(asset.path).toBe('3D/Skeleton.glb')
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
