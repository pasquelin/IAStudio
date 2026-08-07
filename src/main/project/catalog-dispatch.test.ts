import { describe, expect, it } from 'vitest'
import { createCatalog, type Catalog } from './catalog'
import { openMemoryDatabase } from './sqlite-memory'
import { dispatchCatalogRequest } from './catalog-dispatch'
import type { Asset } from '@shared/domain/asset'

function catalogOf(): Catalog {
  return createCatalog(openMemoryDatabase())
}

const asset: Asset = {
  id: 'asset-1',
  name: 'sunset concept',
  type: 'image',
  location: 'local',
  tags: ['sky'],
  createdAt: '2026-08-07T10:00:00.000Z',
}

describe('dispatchCatalogRequest', () => {
  it('adds an asset and answers with it', () => {
    const response = dispatchCatalogRequest(catalogOf(), { id: 1, op: 'add', asset })

    expect(response).toEqual({ id: 1, ok: true, value: asset })
  })

  it('finds an asset that was added', () => {
    const catalog = catalogOf()
    dispatchCatalogRequest(catalog, { id: 1, op: 'add', asset })

    const response = dispatchCatalogRequest(catalog, { id: 2, op: 'find', assetId: 'asset-1' })

    expect(response).toEqual({ id: 2, ok: true, value: asset })
  })

  it('answers null rather than failing for an asset that is not there', () => {
    const response = dispatchCatalogRequest(catalogOf(), { id: 3, op: 'find', assetId: 'absent' })

    expect(response).toEqual({ id: 3, ok: true, value: null })
  })

  it('searches and answers the matching page', () => {
    const catalog = catalogOf()
    dispatchCatalogRequest(catalog, { id: 1, op: 'add', asset })

    const response = dispatchCatalogRequest(catalog, { id: 4, op: 'search', query: { limit: 10 } })

    expect(response).toEqual({ id: 4, ok: true, value: [asset] })
  })

  // The worker must answer every request: a thrown query that killed the message loop would
  // leave the main process waiting on a promise nobody ever settles.
  it('reports a failure as a response rather than throwing', () => {
    const failing: Catalog = {
      add: () => {
        throw new Error('disk is full')
      },
      find: () => null,
      search: () => [],
      close: () => {},
    }

    const response = dispatchCatalogRequest(failing, { id: 5, op: 'add', asset })

    expect(response).toEqual({ id: 5, ok: false, error: 'disk is full' })
  })

  it('keeps the request id on a failure, so the caller knows which promise to reject', () => {
    const failing: Catalog = {
      add: () => asset,
      find: () => null,
      search: () => {
        throw new Error('malformed query')
      },
      close: () => {},
    }

    const response = dispatchCatalogRequest(failing, { id: 77, op: 'search', query: {} })

    expect(response).toMatchObject({ id: 77, ok: false })
  })
})
