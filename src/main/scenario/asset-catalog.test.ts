import { describe, expect, it } from 'vitest'
import { assetCatalogOf, type AssetBackend } from './asset-catalog'

function listing(id: string, overrides: Record<string, unknown> = {}): unknown {
  return {
    id,
    kind: 'image',
    mimeType: 'image/png',
    ownerId: 'proj_a',
    createdAt: '2026-08-06T10:00:00.000Z',
    updatedAt: '2026-08-06T10:00:00.000Z',
    privacy: 'private',
    tags: [],
    collectionIds: [],
    metadata: { kind: 'image', type: 'txt2img' },
    ...overrides,
  }
}

type Recorded = {
  list: unknown[]
  search: unknown[]
  getBulk: unknown[]
  deleted: unknown[]
  tagged: unknown[]
}

function backendSpy(overrides: Partial<AssetBackend> = {}): {
  backend: AssetBackend
  recorded: Recorded
} {
  const recorded: Recorded = { list: [], search: [], getBulk: [], deleted: [], tagged: [] }
  const backend: AssetBackend = {
    list: params => {
      recorded.list.push(params)
      return Promise.resolve({ assets: [] })
    },
    search: params => {
      recorded.search.push(params)
      return Promise.resolve({ hits: [], estimatedTotalHits: 0 })
    },
    getBulk: params => {
      recorded.getBulk.push(params)
      return Promise.resolve({ assets: params.assetIds.map(id => listing(id)) })
    },
    updateTags: (assetId, body) => {
      recorded.tagged.push({ assetId, body })
      return Promise.resolve(null)
    },
    deleteMultiple: body => {
      recorded.deleted.push(body)
      return Promise.resolve(null)
    },
    requestDownload: () => Promise.resolve({ url: 'https://cdn/fresh' }),
    ...overrides,
  }
  return { backend, recorded }
}

describe('listing the library', () => {
  it('drops the records that are not assets without ending the listing', async () => {
    // A page of nothing but captions is not the end: the token is judged on the raw page.
    const { backend } = backendSpy({
      list: () =>
        Promise.resolve({
          assets: [
            listing('asset_1'),
            listing('asset_2', { kind: 'json', metadata: { type: 'img2txt' } }),
          ],
          nextPaginationToken: 'next',
        }),
    })

    const page = await assetCatalogOf(backend).list({ pageSize: 50 })
    expect(page.assets.map(asset => asset.id)).toEqual(['asset_1'])
    expect(page.token).toBe('next')
  })

  it('reports the end when a page comes back empty', async () => {
    const { backend } = backendSpy({
      list: () => Promise.resolve({ assets: [], nextPaginationToken: 'still-here' }),
    })

    expect((await assetCatalogOf(backend).list({ pageSize: 50 })).token).toBeNull()
  })

  it('never asks for a page larger than the API allows', async () => {
    const { backend, recorded } = backendSpy()
    await assetCatalogOf(backend).list({ pageSize: 500 })

    expect(recorded.list[0]).toMatchObject({ pageSize: 100 })
  })
})

describe('searching the library', () => {
  it('stops paging once the offset reaches what the index estimated', async () => {
    const { backend } = backendSpy({
      search: () => Promise.resolve({ hits: [listing('asset_1')], estimatedTotalHits: 1 }),
    })

    const page = await assetCatalogOf(backend).search({ limit: 20, offset: 0 })
    expect(page.assets).toHaveLength(1)
    // An estimate can exceed what the index holds; without this the same offset comes back forever.
    expect(page.token).toBeNull()
  })

  it('hands back the next offset while hits remain', async () => {
    const { backend } = backendSpy({
      search: () => Promise.resolve({ hits: [listing('asset_1')], estimatedTotalHits: 30 }),
    })

    expect((await assetCatalogOf(backend).search({ limit: 20, offset: 0 })).token).toBe('1')
  })

  it('says nothing about the public feed when it was not asked for', async () => {
    // An absent flag and `public: false` are not the same request: one searches this key's
    // library, the other would ask the API to leave it out.
    const { backend, recorded } = backendSpy()
    await assetCatalogOf(backend).search({ limit: 20, offset: 0 })

    expect(recorded.search[0]).not.toHaveProperty('public')
    expect(recorded.search[0]).not.toHaveProperty('sortBy')
  })

  it('asks for the public feed under the name the SDK gives it', async () => {
    const { backend, recorded } = backendSpy()
    await assetCatalogOf(backend).search({ limit: 20, offset: 0, publicFeed: true })

    expect(recorded.search[0]).toMatchObject({ public: true })
  })

  it('passes an order through, and drops an empty one', async () => {
    const { backend, recorded } = backendSpy()
    await assetCatalogOf(backend).search({ limit: 20, offset: 0, sortBy: ['createdAt:desc'] })
    await assetCatalogOf(backend).search({ limit: 20, offset: 0, sortBy: [] })

    expect(recorded.search[0]).toMatchObject({ sortBy: ['createdAt:desc'] })
    expect(recorded.search[1]).not.toHaveProperty('sortBy')
  })

  it('asks for a likeness under the shape the SDK expects', async () => {
    const { backend, recorded } = backendSpy()
    await assetCatalogOf(backend).search({ limit: 20, offset: 0, like: ['asset_1'] })
    await assetCatalogOf(backend).search({ limit: 20, offset: 0, like: [] })

    expect(recorded.search[0]).toMatchObject({ images: { like: ['asset_1'] } })
    expect(recorded.search[1]).not.toHaveProperty('images')
  })

  it('copies the order, so the SDK cannot rewrite a caller constant', async () => {
    const order: readonly string[] = ['createdAt:desc']
    const { backend, recorded } = backendSpy()
    await assetCatalogOf(backend).search({ limit: 20, offset: 0, sortBy: order })

    expect(Object.values(recorded.search[0] ?? {})).not.toContain(order)
  })
})

describe('bulk calls the API caps', () => {
  it('splits a fetch of more than two hundred ids', async () => {
    const { backend, recorded } = backendSpy()
    const ids = Array.from({ length: 250 }, (_, index) => `asset_${index}`)

    const assets = await assetCatalogOf(backend).getBulk(ids)

    expect(recorded.getBulk).toHaveLength(2)
    expect(assets).toHaveLength(250)
  })

  it('splits a delete of more than a hundred ids', async () => {
    const { backend, recorded } = backendSpy()
    const ids = Array.from({ length: 250 }, (_, index) => `asset_${index}`)

    await assetCatalogOf(backend).deleteMany(ids)

    expect(recorded.deleted).toHaveLength(3)
  })

  it('asks for nothing at all when given nothing', async () => {
    const { backend, recorded } = backendSpy()

    expect(await assetCatalogOf(backend).getBulk([])).toEqual([])
    await assetCatalogOf(backend).deleteMany([])

    expect(recorded.getBulk).toHaveLength(0)
    expect(recorded.deleted).toHaveLength(0)
  })
})

describe('tagging', () => {
  it('sends additions and removals in one idempotent call', async () => {
    const { backend, recorded } = backendSpy()
    await assetCatalogOf(backend).updateTags('asset_1', ['hero'], ['draft'])

    expect(recorded.tagged[0]).toEqual({
      assetId: 'asset_1',
      body: { strict: false, add: ['hero'], _delete: ['draft'] },
    })
  })

  it('leaves out the half that has nothing to say', async () => {
    const { backend, recorded } = backendSpy()
    await assetCatalogOf(backend).updateTags('asset_1', ['hero'], [])

    expect(recorded.tagged[0]).toEqual({
      assetId: 'asset_1',
      body: { strict: false, add: ['hero'] },
    })
  })
})

describe('resolving a file to download', () => {
  it('asks the API for a fresh URL rather than reusing the expiring one', async () => {
    const { backend } = backendSpy()
    expect(await assetCatalogOf(backend).downloadUrl('asset_1')).toBe('https://cdn/fresh')
  })

  it('asks for a conversion when the studio needs another format', async () => {
    let asked: unknown = null
    const { backend } = backendSpy({
      requestDownload: (assetId, body) => {
        asked = { assetId, body }
        return Promise.resolve({ url: 'https://cdn/mesh.glb' })
      },
    })

    await assetCatalogOf(backend).downloadUrl('asset_1', 'glb')
    expect(asked).toEqual({ assetId: 'asset_1', body: { targetFormat: 'glb' } })
  })
})
