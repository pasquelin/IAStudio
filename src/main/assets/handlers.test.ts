import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '@shared/ipc'
import type { Asset } from '@shared/domain/asset'
import type { CloudAsset } from '@shared/domain/cloud-asset'
import { invoke as invokeChannel, resetHandlers } from '@main/ipc/test-harness'
import { createActivityLog, type ActivityLog } from '@main/project/activity-log'
import { memoryCatalog } from '@main/project/catalog-fixtures'
import type { AsyncCatalog } from '@main/project/catalog-client'
import type { RemoteAssetCatalog } from '@main/scenario/asset-catalog'
import { registerAssetHandlers } from './handlers'
import type { CloudBackend } from './cloud-backend'

vi.mock('electron', async () => (await import('@main/ipc/test-harness')).mockElectron())

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
}

function setup(
  overrides: { remote?: Partial<RemoteAssetCatalog>; push?: CloudBackend['push'] } = {},
): Harness {
  resetHandlers()
  const catalog = memoryCatalog()
  const listed: unknown[] = []
  const searched: unknown[] = []
  const tagged: unknown[] = []
  const deleted: string[][] = []
  const pulled: string[] = []
  const pushed: string[] = []
  const removedFiles: string[] = []

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
    // The real one is exercised in `auto-caption.test.ts`; here it must only stay out of the way.
    captionArrivals: async () => {},
    describeAssets: async assets => {
      described.push(...assets)
      return assets.length
    },
    removeFile: async asset => {
      removedFiles.push(asset.id)
    },
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

  it('draws each tile from the public thumbnail, not the whole file', async () => {
    // A search hit carries only the signed URL of the original — 28 MB for one upscaled texture,
    // against 1.6 KB for its thumbnail, and a width appended to it answers 302.
    setup({
      remote: {
        search: () =>
          Promise.resolve({
            assets: [{ ...cloudAsset('a'), url: 'https://cdn.example/assets-transform/a?p=100' }],
            token: null,
          }),
      },
    })

    const page = await invoke<{ assets: CloudAsset[] }>(CHANNELS.cloudExplore, { type: 'image' })
    expect(page.assets[0]?.thumbnailUrl).toBe('https://cdn.example/thumbnails/a')
  })

  it('leaves a thumbnail the API did name alone', async () => {
    setup({
      remote: {
        search: () =>
          Promise.resolve({
            assets: [
              {
                ...cloudAsset('a'),
                url: 'https://cdn.example/assets-transform/a',
                thumbnailUrl: 'https://cdn.example/its/own.png',
              },
            ],
            token: null,
          }),
      },
    })

    const page = await invoke<{ assets: CloudAsset[] }>(CHANNELS.cloudExplore, { type: 'image' })
    expect(page.assets[0]?.thumbnailUrl).toBe('https://cdn.example/its/own.png')
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

  it('refuses a feed of everything: the masonry shows one kind at a time', async () => {
    await expect(invoke(CHANNELS.cloudExplore, {})).rejects.toThrow()
  })
})

describe('what resembles the account own work', () => {
  it('measures the likeness against the library latest asset', async () => {
    const harness = setup()
    await invoke(CHANNELS.cloudSimilar)

    expect(harness.listed[0]).toMatchObject({ pageSize: 1 })
    // `remote_1` is what the listing answers with in the harness above.
    expect(harness.searched[0]).toMatchObject({ like: ['remote_1'], publicFeed: true })
  })

  it('asks for no order at all, since the API ranks by likeness', async () => {
    // Naming a sort on a semantic search silently drops the ranking that is the whole point.
    const harness = setup()
    await invoke(CHANNELS.cloudSimilar)

    expect(harness.searched[0]).not.toHaveProperty('sortBy')
  })

  it('takes the reference back out of its own results', async () => {
    // The API answers with the reference itself, at the top.
    setup({
      remote: {
        list: () => Promise.resolve({ assets: [cloudAsset('ref')], token: null }),
        search: () =>
          Promise.resolve({ assets: [cloudAsset('ref'), cloudAsset('other')], token: null }),
      },
    })

    const page = await invoke<{ assets: CloudAsset[] }>(CHANNELS.cloudSimilar)
    expect(page.assets.map(asset => asset.id)).toEqual(['other'])
  })

  it('answers nothing when the account holds nothing to compare', async () => {
    setup({ remote: { list: () => Promise.resolve({ assets: [], token: null }) } })

    expect(await invoke(CHANNELS.cloudSimilar)).toBeNull()
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
