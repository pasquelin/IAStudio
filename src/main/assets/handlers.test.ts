import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { CHANNELS } from '@shared/ipc'
import type { Asset } from '@shared/domain/asset'
import type { CloudAsset } from '@shared/domain/cloudAsset'
import { invoke as invokeChannel, resetHandlers } from '@main/ipc/testHarness'
import { recordFailuresTo } from '@main/scenario/client'
import { createActivityLog, type ActivityLog } from '@main/project/activityLog'
import { memoryCatalog } from '@main/project/catalog-fixtures'
import type { AsyncCatalog } from '@main/project/catalogClient'
import type { RemoteAssetCatalog } from '@main/scenario/assetCatalog'
import { registerAssetHandlers, type AssetHandlerDeps } from './handlers'
import type { CloudBackend } from './cloudBackend'

vi.mock('electron', async () => (await import('@main/ipc/testHarness')).mockElectron())

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  // The harness answers `unknown`, and every caller knows the shape its own channel returns.
  // A guard here would be a second copy of the contract `shared/ipc.ts` already states.
  const answer: unknown = await invokeChannel(channel, ...args)
  return answer as T
}

function localAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset_1',
    name: 'Boulder',
    type: 'image',
    location: 'local',
    path: 'assets/img/asset_1.png',
    tags: [],
    createdAt: '2026-08-06T10:00:00.000Z',
    ...overrides,
  }
}

function cloudAsset(id: string): CloudAsset {
  return {
    id,
    name: 'Boulder',
    type: 'image',
    remoteType: 'txt2img',
    ownerId: 'proj_a',
    createdAt: '2026-08-06T10:00:00.000Z',
    updatedAt: '2026-08-06T10:00:00.000Z',
    privacy: 'private',
    tags: [],
    collectionIds: [],
  }
}

type Harness = {
  catalog: AsyncCatalog
  cloud: CloudBackend
  journal: ActivityLog
  /** The rows the describe channel handed over — what proves the ids were resolved first. */
  described: Asset[]
  listed: unknown[]
  searched: unknown[]
  tagged: unknown[]
  deleted: string[][]
  pulled: string[]
  pushed: string[]
  removedFiles: string[]
  /** The moves a rename ordered, in order — a name is a file name now, and this is that half. */
  renamedFiles: { id: string; name: string }[]
}

function setup(
  overrides: {
    remote?: Partial<RemoteAssetCatalog>
    push?: CloudBackend['push']
    renameFile?: AssetHandlerDeps['renameFile']
  } = {},
): Harness {
  resetHandlers()
  const catalog = memoryCatalog()
  onTestFinished(catalog.close)
  const listed: unknown[] = []
  const searched: unknown[] = []
  const tagged: unknown[] = []
  const deleted: string[][] = []
  const pulled: string[] = []
  const pushed: string[] = []
  const removedFiles: string[] = []
  const renamedFiles: { id: string; name: string }[] = []

  const remote: RemoteAssetCatalog = {
    list: request => {
      listed.push(request)
      return Promise.resolve({ assets: [cloudAsset('remote_1')], token: null })
    },
    search: request => {
      searched.push(request)
      return Promise.resolve({ assets: [cloudAsset('remote_2')], token: null })
    },
    getBulk: ids => Promise.resolve(ids.map(cloudAsset)),
    updateTags: (assetId, add, remove) => {
      tagged.push({ assetId, add, remove })
      return Promise.resolve()
    },
    deleteMany: ids => {
      deleted.push([...ids])
      return Promise.resolve()
    },
    downloadUrl: () => Promise.resolve('https://cdn/fresh'),
    ...overrides.remote,
  }

  const cloud: CloudBackend = {
    pull: async asset => {
      pulled.push(asset.id)
      return await catalog.add(localAsset({ id: `local_${asset.id}`, remoteAssetId: asset.id }))
    },
    push:
      overrides.push ??
      (async assetId => {
        pushed.push(assetId)
        const asset = await catalog.find(assetId)
        if (!asset) throw new Error('missing')
        return asset
      }),
  }

  // The real one, on the same in-memory catalogue: what reaches the journal is part of what a
  // handler does, and a spy would only prove the call was made.
  const journal = createActivityLog({
    catalog: () => catalog,
    broadcast: () => {},
    now: () => '2026-08-08T10:00:00.000Z',
  })

  const described: Asset[] = []

  registerAssetHandlers({
    catalog: () => catalog,
    remote: () => remote,
    cloud: () => cloud,
    // The real one is exercised in `autoCaption.test.ts`; here it must only stay out of the way.
    captionArrivals: async () => {},
    describeAssets: async assets => {
      described.push(...assets)
      return assets.length
    },
    removeFile: async asset => {
      removedFiles.push(asset.id)
    },
    // The disk itself is exercised in `assetFile.test.ts`; what this harness has to show is
    // that the handler moves the file BEFORE the row, and files the path it comes back with.
    renameFile:
      overrides.renameFile ??
      (async (asset, name) => {
        renamedFiles.push({ id: asset.id, name })
        return asset.path ? `assets/img/${name}.png` : undefined
      }),
    activeOwnerId: () => 'proj_a',
    journal: () => journal,
  })

  return {
    catalog,
    cloud,
    journal,
    described,
    listed,
    searched,
    tagged,
    deleted,
    pulled,
    pushed,
    removedFiles,
    renamedFiles,
  }
}

describe('browsing the library', () => {
  let harness: Harness

  beforeEach(() => {
    harness = setup()
  })

  it('takes the plain listing when nothing needs the search index', async () => {
    await invoke(CHANNELS.cloudBrowse, { types: ['mesh'] })

    expect(harness.searched).toHaveLength(0)
    expect(harness.listed[0]).toMatchObject({ types: expect.arrayContaining(['img23d']) })
  })

  it('takes the search index for a tag, which the listing cannot answer', async () => {
    // `GET /assets?tags=` honours tags for public assets only — search is the only way.
    await invoke(CHANNELS.cloudBrowse, { tags: ['hero'] })

    expect(harness.listed).toHaveLength(0)
    expect(harness.searched[0]).toMatchObject({ filter: 'tags = "hero"' })
  })

  it('takes the search index for free text', async () => {
    await invoke(CHANNELS.cloudBrowse, { text: 'boulder' })
    expect(harness.searched[0]).toMatchObject({ query: 'boulder' })
  })

  it('keeps newest-first when the index answers in the listing place', async () => {
    // Left to itself the index ranks by relevance, and the shelf merges this source with two
    // others on `createdAt` alone: typing a word would reorder one lane of three.
    await invoke(CHANNELS.cloudBrowse, { text: 'boulder' })
    expect(harness.searched[0]).toMatchObject({ sortBy: ['createdAt:desc'] })
  })

  it('asks for no order at all when the caller searches for what fits best', async () => {
    // Relevance is never a value the API is told — it refuses `score` as a sort field — but the
    // ranking it applies when nothing overrules it. An agent asking for stone textures wants it.
    await invoke(CHANNELS.cloudBrowse, { text: 'boulder', order: 'relevance' })
    expect(harness.searched[0]).not.toHaveProperty('sortBy')
  })

  it('marks a ranked page apart from a stamped one', async () => {
    setup({ remote: { search: () => Promise.resolve({ assets: [], token: '40' }) } })

    const stamped = await invoke<{ cursor: string | null }>(CHANNELS.cloudBrowse, { text: 'a' })
    const ranked = await invoke<{ cursor: string | null }>(CHANNELS.cloudBrowse, {
      text: 'a',
      order: 'relevance',
    })

    expect(stamped.cursor).toBe('o:40')
    expect(ranked.cursor).toBe('r:40')
  })

  it('reads a ranked cursor in the order it was made, not in the one the query asks for', async () => {
    // A client that forgets to repeat `order` would otherwise take offset 40 of one ranking for
    // the next page of another: rows repeated, rows never seen, and nothing to notice it by.
    await invoke(CHANNELS.cloudBrowse, { text: 'boulder', cursor: 'r:40' })

    expect(harness.searched[0]).not.toHaveProperty('sortBy')
    expect(harness.searched[0]).toMatchObject({ offset: 40 })
  })

  it('keeps newest-first for a relevance asked with no words to rank by', async () => {
    // Over an unqueried index, relevance is not a ranking — it is whatever order the shard
    // answers in, which is worse than the stamp for every reader.
    await invoke(CHANNELS.cloudBrowse, { tags: ['hero'], order: 'relevance' })
    expect(harness.searched[0]).toMatchObject({ sortBy: ['createdAt:desc'] })
  })

  it('narrows a search too, not only a listing', async () => {
    // The index knows the API's eight media classes, not our six: asking for skies through it
    // comes back as every image, and only this filter tells them apart.
    setup({
      remote: {
        search: () =>
          Promise.resolve({
            assets: [{ ...cloudAsset('a'), type: 'skybox' }, cloudAsset('b')],
            token: null,
          }),
      },
    })

    const page = await invoke<{ assets: CloudAsset[] }>(CHANNELS.cloudBrowse, {
      text: 'sunset',
      types: ['skybox'],
    })
    expect(page.assets.map(asset => asset.id)).toEqual(['a'])
  })

  it('narrows here what the API could not narrow itself', async () => {
    // Asking for pictures sends no type filter at all, so the page may hold other kinds.
    setup({
      remote: {
        list: () =>
          Promise.resolve({
            assets: [cloudAsset('a'), { ...cloudAsset('b'), type: 'mesh' }],
            token: null,
          }),
      },
    })

    const page = await invoke<{ assets: CloudAsset[] }>(CHANNELS.cloudBrowse, { types: ['image'] })
    expect(page.assets.map(asset => asset.id)).toEqual(['a'])
  })

  it('refuses a page larger than the API allows', async () => {
    await expect(invoke(CHANNELS.cloudBrowse, { pageSize: 5000 })).rejects.toThrow()
  })
})

describe('the public feed', () => {
  let harness: Harness

  beforeEach(() => {
    harness = setup()
  })

  it('searches what everyone published, newest first', async () => {
    await invoke(CHANNELS.cloudExplore, { type: 'image' })

    // Never the plain listing: `GET /assets` answers for this key alone.
    expect(harness.listed).toHaveLength(0)
    expect(harness.searched[0]).toMatchObject({
      publicFeed: true,
      sortBy: ['createdAt:desc'],
      offset: 0,
    })
  })

  it('looks for what was typed, keeping the order the shelf merges on', async () => {
    await invoke(CHANNELS.cloudExplore, { type: 'image', text: 'dragon' })

    // The order stands with a text as without one: the shelf interleaves this feed with the
    // library and the project on `createdAt`, and a page ranked by relevance carries no stamp
    // that merge could place.
    expect(harness.searched[0]).toMatchObject({
      query: 'dragon',
      publicFeed: true,
      sortBy: ['createdAt:desc'],
    })
  })

  it('asks for the whole feed when nothing was typed', async () => {
    await invoke(CHANNELS.cloudExplore, { type: 'image', text: '   ' })
    expect(harness.searched[0]).not.toHaveProperty('query')
  })

  it('leaves out anything the API flagged', async () => {
    await invoke(CHANNELS.cloudExplore, { type: 'video' })
    expect(harness.searched[0]).toMatchObject({ filter: expect.stringContaining('nsfw IS EMPTY') })
  })

  it('types the hits again, because the filter casts wider than the studio decides', async () => {
    setup({
      remote: {
        search: () =>
          Promise.resolve({
            assets: [{ ...cloudAsset('a'), type: 'texture' }, cloudAsset('b')],
            token: null,
          }),
      },
    })

    const page = await invoke<{ assets: CloudAsset[] }>(CHANNELS.cloudExplore, { type: 'texture' })
    expect(page.assets.map(asset => asset.id)).toEqual(['a'])
  })

  // The thumbnail a hit does not carry is filled in by `cloudAssetOfHit`, one layer down — see
  // `assetNormalizer.test.ts` and `assetCatalog.test.ts`. The fake catalogue here answers with
  // `CloudAsset`s directly, so it never crosses that reader.

  it('walks past a page the retyping emptied rather than reporting the end', async () => {
    // The filter casts wider than the studio decides, so a whole page can fall to it. Handed up
    // empty, it reads as the end of the feed: the grid does not ask again on an empty grid.
    let round = 0
    setup({
      remote: {
        search: () => {
          round += 1
          const dropped: CloudAsset = { ...cloudAsset('a'), type: 'video' }
          const assets = round === 1 ? [dropped] : [cloudAsset('b')]
          return Promise.resolve({ assets, token: String(round * 40) })
        },
      },
    })

    const page = await invoke<{ assets: CloudAsset[] }>(CHANNELS.cloudExplore, { type: 'image' })
    expect(page.assets.map(asset => asset.id)).toEqual(['b'])
  })

  it('gives up after a few empty rounds rather than walking the whole index', async () => {
    const audioAsset: CloudAsset = { ...cloudAsset('a'), type: 'audio' }
    // A kind nobody has published would otherwise cost a search quota per page, to the end.
    const { searched } = setup({
      remote: {
        search: () => Promise.resolve({ assets: [audioAsset], token: '40' }),
      },
    })

    const page = await invoke<{ assets: CloudAsset[]; cursor: string | null }>(
      CHANNELS.cloudExplore,
      { type: 'image' },
    )
    expect(page.assets).toEqual([])
    expect(searched.length).toBeLessThanOrEqual(3)
    // The cursor stays live on purpose: the feed is not over, this handler simply stopped
    // spending quota on it. `useExplore` is what carries on from here.
    expect(page.cursor).not.toBeNull()
  })

  it('walks by offset, and marks the cursor as the index produced it', async () => {
    setup({
      remote: { search: () => Promise.resolve({ assets: [cloudAsset('a')], token: '40' }) },
    })

    const page = await invoke<{ cursor: string | null }>(CHANNELS.cloudExplore, { type: 'image' })
    expect(page.cursor).toBe('o:40')
  })

  it('reads back the offset it handed out', async () => {
    await invoke(CHANNELS.cloudExplore, { type: 'image', cursor: 'o:40' })
    expect(harness.searched[0]).toMatchObject({ offset: 40 })
  })

  it('caps how far into the index a cursor may point', async () => {
    // `o:1e99` passes validation — it is a short string — and asks the index for an offset no
    // index can answer for.
    await invoke(CHANNELS.cloudExplore, { type: 'image', cursor: 'o:1e99' })

    const asked = harness.searched[0]
    expect(asked).toMatchObject({ offset: 10_000 })
  })

  it('bounds the offset it walks to itself, not only the one handed in', async () => {
    // The empty-round loop reads the API's own token back as an offset, and that token is just
    // as much an outside value as the cursor. Recorded HERE and not through the harness: this
    // override replaces the `search` the harness records through, so its log would stay empty
    // and an assertion over it would hold vacuously.
    const offsets: unknown[] = []
    setup({
      remote: {
        search: request => {
          offsets.push(request.offset)
          return Promise.resolve({
            assets: [{ ...cloudAsset('a'), type: 'audio' }],
            token: 'later',
          })
        },
      },
    })

    await invoke(CHANNELS.cloudExplore, { type: 'image' })

    expect(offsets.length).toBeGreaterThan(0)
    expect(offsets.every(offset => Number.isFinite(offset))).toBe(true)
  })

  it('stops walking once the offset can no longer move', async () => {
    // A token the bound clamps, or one that is not a number, asks the index the very same
    // question again — and the search is billed either way.
    const offsets: number[] = []
    setup({
      remote: {
        search: request => {
          offsets.push(request.offset)
          return Promise.resolve({
            assets: [{ ...cloudAsset('a'), type: 'audio' }],
            token: 'not-a-number',
          })
        },
      },
    })

    await invoke(CHANNELS.cloudExplore, { type: 'image' })
    expect(offsets).toEqual([0])
  })

  it('refuses a feed of everything: the masonry shows one kind at a time', async () => {
    await expect(invoke(CHANNELS.cloudExplore, {})).rejects.toThrow()
  })
})

describe('what resembles an asset the caller names', () => {
  it('measures the likeness against the asset it was given', async () => {
    // Never against a reference chosen here: "the library's most recent" is what the HOME wants,
    // and baking it in left the channel unusable for a right-click on some other asset.
    const harness = setup()
    await invoke(CHANNELS.cloudSimilar, 'asset_named')

    expect(harness.listed).toHaveLength(0)
    expect(harness.searched[0]).toMatchObject({ like: ['asset_named'], publicFeed: true })
  })

  it('asks for no order at all, since the API ranks by likeness', async () => {
    // Naming a sort on a semantic search silently drops the ranking that is the whole point.
    const harness = setup()
    await invoke(CHANNELS.cloudSimilar, 'asset_named')

    expect(harness.searched[0]).not.toHaveProperty('sortBy')
  })

  it('takes the reference back out of its own results', async () => {
    // The API answers with the reference itself, at the top.
    setup({
      remote: {
        search: () =>
          Promise.resolve({ assets: [cloudAsset('ref'), cloudAsset('other')], token: null }),
      },
    })

    const assets = await invoke<CloudAsset[]>(CHANNELS.cloudSimilar, 'ref')
    expect(assets.map(asset => asset.id)).toEqual(['other'])
  })

  it('refuses an empty reference rather than asking the index for nothing', async () => {
    setup()
    await expect(invoke(CHANNELS.cloudSimilar, '')).rejects.toThrow()
  })
})

describe('what a decorative band is allowed to write in the journal', () => {
  afterEach(() => recordFailuresTo(null))

  it('leaves the journal alone when a shelf is refused', async () => {
    // The journal is what one opens after a job went wrong. A band that polls on its own would
    // fill it with requests nobody made, and the push that really failed scrolls off the top.
    //
    // `cloudBrowse` is in here too: it reads like a browser's channel, but both of its callers
    // are shelves of the home, and the lookalikes band opens on one of them.
    const noted: string[] = []
    recordFailuresTo((_scope, detail) => noted.push(detail))

    setup({
      remote: {
        search: () => Promise.reject(new Error('429 too many requests')),
        list: () => Promise.reject(new Error('429 too many requests')),
      },
    })

    await expect(invoke(CHANNELS.cloudExplore, { type: 'image' })).rejects.toThrow()
    await expect(invoke(CHANNELS.cloudSimilar, 'asset_1')).rejects.toThrow()
    await expect(invoke(CHANNELS.cloudBrowse, {})).rejects.toThrow()
    expect(noted).toEqual([])
  })

  it('still writes it for a call the user did make', async () => {
    // The contrast is the point: silence belongs to the reads nobody asked for, not to every
    // failure. Deleting a selection is a gesture, and its refusal belongs in the journal.
    const noted: string[] = []
    recordFailuresTo((_scope, detail) => noted.push(detail))

    const harness = setup({
      remote: { deleteMany: () => Promise.reject(new Error('429 too many requests')) },
    })
    await harness.catalog.add(localAsset({ remoteAssetId: 'remote_1' }))

    await expect(invoke(CHANNELS.assetsRemove, ['asset_1'], true)).rejects.toThrow()
    expect(noted).toHaveLength(1)
  })

  it('still tells the caller it was refused rather than answering an empty band', async () => {
    // An empty answer would be indistinguishable from an account that holds nothing alike, and
    // the shelf would take itself off the page until the key changes.
    setup({ remote: { search: () => Promise.reject(new Error('503')) } })

    await expect(invoke(CHANNELS.cloudSimilar, 'asset_1')).rejects.toThrow()
  })
})

describe('renaming and tagging', () => {
  let harness: Harness

  beforeEach(() => {
    harness = setup()
  })

  it('changes only what was named', async () => {
    await harness.catalog.add(localAsset({ tags: ['stone'] }))
    const updated = await invoke<Asset>(CHANNELS.assetsUpdate, 'asset_1', { name: 'Rock' })

    expect(updated).toMatchObject({ name: 'Rock', tags: ['stone'] })
  })

  /**
   * The correction the extension cannot make: a normal map and an albedo are both PNGs. The row
   * is what remembers it, and the FILE does not move — a row carries its own path, and what the
   * studio calls a picture has never been decided by the folder it sits in.
   */
  it('writes what a file is, leaving the file where it is', async () => {
    await harness.catalog.add(localAsset({ type: 'image', path: 'Repérages/ruelle.png' }))

    const updated = await invoke<Asset>(CHANNELS.assetsUpdate, 'asset_1', { type: 'texture' })

    expect(updated).toMatchObject({ type: 'texture', path: 'Repérages/ruelle.png' })
  })

  it('tells the library which tags moved, not the whole set', async () => {
    await harness.catalog.add(localAsset({ tags: ['stone', 'draft'], remoteAssetId: 'remote_1' }))
    await invoke(CHANNELS.assetsUpdate, 'asset_1', { tags: ['stone', 'hero'] })

    expect(harness.tagged[0]).toEqual({ assetId: 'remote_1', add: ['hero'], remove: ['draft'] })
  })

  it('keeps the local change when the library cannot be told', async () => {
    // The tags are the project's own first; a network that is down must not lose the edit.
    const offline = setup({
      remote: { updateTags: () => Promise.reject(new Error('offline')) },
    })
    await offline.catalog.add(localAsset({ remoteAssetId: 'remote_1' }))

    const updated = await invoke<Asset>(CHANNELS.assetsUpdate, 'asset_1', { tags: ['hero'] })
    expect(updated.tags).toEqual(['hero'])
  })

  it('says so rather than inventing a row for an asset that is gone', async () => {
    await expect(invoke(CHANNELS.assetsUpdate, 'asset_gone', { name: 'x' })).rejects.toThrow()
  })

  /**
   * The whole of this change: the shelf read « je veux un model avec son skeleton » where the
   * explorer read `asset_40f76c36-8ad4-….png`, and renaming wrote the catalogue alone — so the
   * two only ever drifted further apart.
   */
  it('moves the file with the name, and files it where it landed', async () => {
    await harness.catalog.add(localAsset({ path: 'assets/img/asset_1.png' }))

    const updated = await invoke<Asset>(CHANNELS.assetsUpdate, 'asset_1', { name: 'Ruelle' })

    expect(harness.renamedFiles).toEqual([{ id: 'asset_1', name: 'Ruelle' }])
    expect(updated).toMatchObject({ name: 'Ruelle', path: 'assets/img/Ruelle.png' })
  })

  /** Tagging is not renaming: a row whose name nobody touched has no file to move. */
  it('leaves the file alone when only the tags changed', async () => {
    await harness.catalog.add(localAsset({ path: 'assets/img/asset_1.png' }))
    await invoke(CHANNELS.assetsUpdate, 'asset_1', { tags: ['hero'] })

    expect(harness.renamedFiles).toEqual([])
  })

  /**
   * A linked rush keeps its bytes where the user left them, and its row keeps the path it had —
   * `undefined` from the move must not erase it.
   */
  it('keeps the path of an asset whose file is not ours to move', async () => {
    const renameFile = async (): Promise<undefined> => undefined
    const linked = setup({ renameFile })
    await linked.catalog.add(localAsset({ path: 'assets/img/asset_1.png' }))

    const updated = await invoke<Asset>(CHANNELS.assetsUpdate, 'asset_1', { name: 'Prise 4' })
    expect(updated).toMatchObject({ name: 'Prise 4', path: 'assets/img/asset_1.png' })
  })

  /**
   * Refused rather than cleaned on the way to the disk: `safeFileName` would turn `Vue 3/4` into
   * `Vue 3 4` in the folder while the catalogue kept the slash — the two names apart again.
   */
  it('refuses a name no file system would hold', async () => {
    await harness.catalog.add(localAsset({ path: 'assets/img/asset_1.png' }))

    await expect(invoke(CHANNELS.assetsUpdate, 'asset_1', { name: 'Vue 3/4' })).rejects.toThrow(
      'invalid',
    )
    expect(harness.renamedFiles).toEqual([])
  })

  /** The row must not be renamed over a move that failed: it would name a file that is gone. */
  it('leaves the row untouched when the folder refused the move', async () => {
    const clash = setup({
      renameFile: () => Promise.reject(new Error('duplicate')),
    })
    await clash.catalog.add(localAsset({ name: 'Ruelle', path: 'assets/img/Ruelle.png' }))

    await expect(invoke(CHANNELS.assetsUpdate, 'asset_1', { name: 'Photo' })).rejects.toThrow(
      'duplicate',
    )
    expect(await clash.catalog.find('asset_1')).toMatchObject({ name: 'Ruelle' })
  })
})

describe('removing assets', () => {
  let harness: Harness

  beforeEach(() => {
    harness = setup()
  })

  it('drops the row and the file it owns', async () => {
    await harness.catalog.add(localAsset())
    await invoke(CHANNELS.assetsRemove, ['asset_1'], false)

    expect(harness.removedFiles).toEqual(['asset_1'])
    expect(await harness.catalog.find('asset_1')).toBeNull()
  })

  it('leaves the library alone unless it was asked', async () => {
    await harness.catalog.add(localAsset({ remoteAssetId: 'remote_1' }))
    await invoke(CHANNELS.assetsRemove, ['asset_1'], false)

    expect(harness.deleted).toHaveLength(0)
  })

  it('deletes the twins before the rows that point at them', async () => {
    // A row dropped first leaves nothing saying what to delete on the other side.
    await harness.catalog.add(localAsset({ remoteAssetId: 'remote_1' }))
    await invoke(CHANNELS.assetsRemove, ['asset_1'], true)

    expect(harness.deleted).toEqual([['remote_1']])
    expect(await harness.catalog.find('asset_1')).toBeNull()
  })
})

describe('moving assets between the two sides', () => {
  let harness: Harness

  beforeEach(() => {
    harness = setup()
  })

  it('brings down each asset in turn rather than all at once', async () => {
    await invoke(CHANNELS.cloudPull, ['remote_1', 'remote_2'])
    expect(harness.pulled).toEqual(['remote_1', 'remote_2'])
  })

  it('keeps the assets it did bring down when one of them fails', async () => {
    // The bytes of the first are already on disk and its row already added; a single rejection
    // would leave the caller unable to say which ids made it.
    const flaky = setup()
    flaky.cloud.pull = asset => {
      if (asset.id === 'remote_2') return Promise.reject(new Error('not-found'))
      return Promise.resolve(localAsset({ id: `local_${asset.id}` }))
    }

    const outcomes = await invoke<{ assetId: string; ok: boolean }[]>(CHANNELS.cloudPull, [
      'remote_1',
      'remote_2',
      'remote_3',
    ])

    expect(outcomes.map(one => [one.assetId, one.ok])).toEqual([
      ['remote_1', true],
      ['remote_2', false],
      ['remote_3', true],
    ])
  })

  it('reports what each push did, successes and failures alike', async () => {
    const flaky = setup({
      push: assetId => {
        if (assetId === 'asset_2') return Promise.reject(new Error('upload-too-large'))
        return Promise.resolve(localAsset({ id: assetId }))
      },
    })
    await flaky.catalog.add(localAsset({ id: 'asset_1' }))
    await flaky.catalog.add(localAsset({ id: 'asset_2' }))

    const outcomes = await invoke<{ assetId: string; ok: boolean }[]>(CHANNELS.cloudPush, [
      'asset_1',
      'asset_2',
    ])

    // One refusal does not hide the one that went up.
    expect(outcomes.map(one => [one.assetId, one.ok])).toEqual([
      ['asset_1', true],
      ['asset_2', false],
    ])
  })

  it('records on the asset why its push failed', async () => {
    const failing = setup({ push: () => Promise.reject(new Error('upload-too-large')) })
    await failing.catalog.add(localAsset())

    await invoke(CHANNELS.cloudPush, ['asset_1'])

    const asset = await failing.catalog.find('asset_1')
    expect(asset?.syncStatus).toBe('error')
    expect(asset?.syncError).toBeTruthy()
  })

  it('plans without sending anything', async () => {
    await harness.catalog.add(localAsset())
    const plan = await invoke<{ summary: Record<string, number> }>(
      CHANNELS.cloudPlan,
      ['asset_1'],
      'push',
    )

    expect(plan.summary).toMatchObject({ push: 1 })
    expect(harness.pushed).toHaveLength(0)
  })

  it('refuses a policy it does not know', async () => {
    await expect(invoke(CHANNELS.cloudPlan, ['asset_1'], 'mirror')).rejects.toThrow()
  })
})

describe('what a plan reads off an asset', () => {
  it('carries every stamp the catalogue holds', async () => {
    const full = setup()
    await full.catalog.add(
      localAsset({
        remoteAssetId: 'remote_1',
        remoteOwnerId: 'proj_a',
        remoteUpdatedAt: '2026-08-06T09:00:00.000Z',
        remoteSyncedAt: '2026-08-06T09:00:00.000Z',
        localChangedAt: '2026-08-06T12:00:00.000Z',
      }),
    )

    const plan = await invoke<{ summary: Record<string, number> }>(
      CHANNELS.cloudPlan,
      ['asset_1'],
      'two-way',
    )

    // Edited here since the two agreed, untouched there: it goes up.
    expect(plan.summary).toMatchObject({ push: 1, pull: 0, conflict: 0 })
  })

  it('reads an asset that holds no file as one to fetch', async () => {
    const cloudOnly = setup()
    await cloudOnly.catalog.add(
      localAsset({ path: undefined, location: 'cloud', remoteAssetId: 'remote_1' }),
    )

    const plan = await invoke<{ summary: Record<string, number> }>(
      CHANNELS.cloudPlan,
      ['asset_1'],
      'pull',
    )

    expect(plan.summary).toMatchObject({ pull: 1 })
  })

  it('skips an asset the catalogue no longer holds rather than failing the plan', async () => {
    setup()
    const plan = await invoke<{ actions: unknown[] }>(CHANNELS.cloudPlan, ['asset_gone'], 'push')

    expect(plan.actions).toEqual([])
  })
})

describe('walking through the pages of the library', () => {
  it('hands the listing back the token it gave out', async () => {
    const paged = setup()
    await invoke(CHANNELS.cloudBrowse, { cursor: 't:page-2' })

    expect(paged.listed[0]).toMatchObject({ token: 'page-2' })
  })

  it('reads the search cursor as the offset it is', async () => {
    const paged = setup()
    await invoke(CHANNELS.cloudBrowse, { text: 'moss', cursor: 'o:40' })

    expect(paged.searched[0]).toMatchObject({ offset: 40 })
  })

  // Clearing the search box while holding a page used to hand "40" to the listing as a token.
  it('ignores a cursor the other side produced', async () => {
    const paged = setup()
    await invoke(CHANNELS.cloudBrowse, { cursor: 'o:40' })
    await invoke(CHANNELS.cloudBrowse, { text: 'moss', cursor: 't:page-2' })

    expect(paged.listed[0]).not.toHaveProperty('token')
    expect(paged.searched[0]).toMatchObject({ offset: 0 })
  })

  it('starts at the beginning when the cursor makes no sense', async () => {
    const paged = setup()
    await invoke(CHANNELS.cloudBrowse, { text: 'moss', cursor: 'o:not-a-number' })

    expect(paged.searched[0]).toMatchObject({ offset: 0 })
  })

  it('says which side a cursor came from, so the next page goes back to it', async () => {
    setup({
      remote: {
        list: () => Promise.resolve({ assets: [], token: 'page-3' }),
        search: () => Promise.resolve({ assets: [], token: '60' }),
      },
    })

    const listed = await invoke<{ cursor: string | null }>(CHANNELS.cloudBrowse, {})
    const searched = await invoke<{ cursor: string | null }>(CHANNELS.cloudBrowse, { text: 'a' })

    expect(listed.cursor).toBe('t:page-3')
    expect(searched.cursor).toBe('o:60')
  })

  it('narrows a listing to a collection', async () => {
    const scoped = setup()
    await invoke(CHANNELS.cloudBrowse, { collectionId: 'col_1' })

    expect(scoped.listed[0]).toMatchObject({ collectionId: 'col_1' })
  })
})

describe('removing assets that were never sent up', () => {
  it('asks the library for nothing when none of them has a twin', async () => {
    const local = setup()
    await local.catalog.add(localAsset())
    await invoke(CHANNELS.assetsRemove, ['asset_1'], true)

    expect(local.deleted).toHaveLength(0)
    expect(await local.catalog.find('asset_1')).toBeNull()
  })
})

describe('describing a selection', () => {
  let harness: Harness

  beforeEach(() => {
    resetHandlers()
    harness = setup()
  })

  it('hands the catalogue rows over, and answers how many were named', async () => {
    await harness.catalog.add(localAsset({ id: 'asset_1', remoteAssetId: 'remote_1' }))
    await harness.catalog.add(localAsset({ id: 'asset_2', remoteAssetId: 'remote_2' }))

    await expect(invoke(CHANNELS.assetsDescribe, ['asset_1', 'asset_2'])).resolves.toBe(2)
    expect(harness.described.map(asset => asset.id)).toEqual(['asset_1', 'asset_2'])
  })

  // A selection can outlive the rows it points at — a delete in another window.
  it('drops the ids the catalogue no longer knows', async () => {
    await harness.catalog.add(localAsset({ id: 'asset_1' }))

    await expect(invoke(CHANNELS.assetsDescribe, ['asset_1', 'asset_gone'])).resolves.toBe(1)
    expect(harness.described.map(asset => asset.id)).toEqual(['asset_1'])
  })
})
