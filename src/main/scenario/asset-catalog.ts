import type Scenario from '@scenario-labs/sdk'
import { isRecord } from '@shared/guards'
import type { CloudAsset } from '@shared/domain/cloud-asset'
import { log } from '@main/log'
import { cloudAssetOfHit, cloudAssetOfListing } from './asset-normalizer'
import { tokenAfter } from './cursor'
import { chunk, DELETE_MAX, GET_BULK_MAX, PAGE_SIZE_MAX } from './limits'

/**
 * The API's own closed unions, taken from the SDK rather than restated.
 *
 * `metadata.type` is a free string when it comes back from the API — the eighty values grow
 * without warning, and narrowing what we *read* would drop assets. But what we *send* as a
 * filter has to be a value the API knows, and the SDK already enumerates those: deriving them
 * here means a filter that no longer exists is a compile error rather than a 400 at runtime.
 */
type ListParams = NonNullable<Parameters<Scenario['assets']['list']>[0]>
type SearchParams = Parameters<Scenario['search']['assetSearch']>[0]
type TagsBody = Parameters<Scenario['assets']['updateTags']>[1]

export type RemoteAssetType = NonNullable<ListParams['types']>[number]
export type DownloadFormat = NonNullable<
  Parameters<Scenario['assets']['download']['request']>[1]['targetFormat']
>

/**
 * What this file asks the SDK for, and nothing more — the same narrow port `uploader.ts` takes,
 * so a test hands in a recorder rather than building a whole `Scenario`.
 *
 * The responses stay `unknown`: they are normalised right here, and typing them against the SDK
 * would only mean restating a shape the normaliser already reads defensively.
 */
export type AssetBackend = {
  list: (params: ListParams) => Promise<{ assets: unknown[]; nextPaginationToken?: string }>
  search: (params: SearchParams) => Promise<{ hits: unknown[]; estimatedTotalHits: number }>
  retrieve: (assetId: string) => Promise<unknown>
  getBulk: (params: { assetIds: string[] }) => Promise<{ assets: unknown[] }>
  updateTags: (assetId: string, body: TagsBody) => Promise<unknown>
  deleteMultiple: (body: { assetIds: string[] }) => Promise<unknown>
  requestDownload: (
    assetId: string,
    body: { targetFormat?: DownloadFormat },
  ) => Promise<{ url: string }>
}

export type RemoteAssetPage = {
  assets: CloudAsset[]
  /** Opaque, and `null` at the end. `/assets` reports neither an offset nor a total. */
  token: string | null
}

export type AssetListRequest = {
  pageSize: number
  token?: string
  /** `metadata.type` values — the only axis `GET /assets` filters on. */
  types?: readonly RemoteAssetType[]
  collectionId?: string
  /** Children of one asset: how the channels of a PBR pack are found again. */
  parentAssetId?: string
  sort?: 'recent' | 'oldest'
}

export type AssetSearchRequest = {
  query?: string
  /** The Meilisearch-style expression built by `filter-expression`. */
  filter?: string
  limit: number
  offset: number
}

/**
 * Everything the studio asks the API about assets, and nothing more.
 *
 * The same narrow port `ModelCatalog` is for models, for the same reason: this is the ONE file
 * where the SDK and the studio meet for assets, so a change in the SDK's shape lands here
 * rather than throughout the store. A test hands in a recorder instead of a client.
 */
export type RemoteAssetCatalog = {
  list: (request: AssetListRequest) => Promise<RemoteAssetPage>
  search: (request: AssetSearchRequest) => Promise<RemoteAssetPage>
  retrieve: (assetId: string) => Promise<CloudAsset | null>
  getBulk: (assetIds: readonly string[]) => Promise<CloudAsset[]>
  updateTags: (assetId: string, add: readonly string[], remove: readonly string[]) => Promise<void>
  deleteMany: (assetIds: readonly string[]) => Promise<void>
  /**
   * A fresh signed URL, and a conversion when one is asked for. Used instead of the `url` an
   * asset arrives with, which expires — and it is what turns an fbx into a glb on the way down,
   * since the CDN converts and the scene only loads glb.
   */
  downloadUrl: (assetId: string, targetFormat?: DownloadFormat) => Promise<string>
}

function sortParams(sort: AssetListRequest['sort']): Record<string, string> {
  if (sort === undefined) return {}
  return { sortBy: 'createdAt', sortDirection: sort === 'oldest' ? 'asc' : 'desc' }
}

/** Binds the studio's narrow catalogue to whatever answers for the API. */
export function assetCatalogOf(backend: AssetBackend): RemoteAssetCatalog {
  return {
    list: async ({ pageSize, token, types, collectionId, parentAssetId, sort }) => {
      const params = {
        pageSize: Math.min(pageSize, PAGE_SIZE_MAX),
        ...(token ? { paginationToken: token } : {}),
        ...(types?.length ? { types: [...types] } : {}),
        ...(collectionId ? { collectionId } : {}),
        ...(parentAssetId ? { parentAssetId } : {}),
        ...sortParams(sort),
      }

      log.info('scenario', `GET /assets ${JSON.stringify(params)}`)
      const page = await backend.list(params)
      log.info('scenario', `GET /assets → ${page.assets.length} assets`)

      return {
        // A record we cannot show is dropped, not turned into a blank cell: the library holds
        // captioning output and canvases alongside media.
        assets: page.assets.map(cloudAssetOfListing).filter(asset => asset !== null),
        // Counted on the raw page, not on what survived the filter: a page of nothing but
        // captions is not the end of the listing.
        token: tokenAfter(page.nextPaginationToken, page.assets.length),
      }
    },

    /**
     * The only way to filter one's OWN assets by tag: `GET /assets?tags=` is documented as
     * public-only. It also costs a separate quota, which is why this is the debounced path and
     * never the one taken at rest.
     */
    search: async ({ query, filter, limit, offset }) => {
      const params = {
        ...(query ? { query } : {}),
        ...(filter ? { filter } : {}),
        limit: Math.min(limit, PAGE_SIZE_MAX),
        offset,
      }

      log.info('scenario', `POST /search/assets ${JSON.stringify(params)}`)
      const page = await backend.search(params)
      log.info('scenario', `POST /search/assets → ${page.hits.length}/${page.estimatedTotalHits}`)

      const next = offset + page.hits.length

      return {
        assets: page.hits.map(cloudAssetOfHit).filter(asset => asset !== null),
        // `estimatedTotalHits` is an estimate and can exceed what the index really holds; an
        // empty page would otherwise hand back the very offset it was asked for, forever.
        token: page.hits.length > 0 && next < page.estimatedTotalHits ? String(next) : null,
      }
    },

    retrieve: async assetId => {
      log.info('scenario', `GET /assets/${assetId}`)
      // `GET /assets/{id}` wraps its answer in `{ asset }`, unlike the listing which is already
      // an array of them. Handing the envelope to the normaliser reads as an asset with no id.
      const response = await backend.retrieve(assetId)
      return cloudAssetOfListing(isRecord(response) ? response.asset : null)
    },

    getBulk: async assetIds => {
      const collected: CloudAsset[] = []

      // Batched here rather than at the call sites: 200 is one of four different bulk limits,
      // and going over one is refused whole rather than partly served.
      for (const batch of chunk(assetIds, GET_BULK_MAX)) {
        log.info('scenario', `POST /assets/get-bulk ${batch.length} ids`)
        const { assets } = await backend.getBulk({ assetIds: batch })
        collected.push(...assets.map(cloudAssetOfListing).filter(asset => asset !== null))
      }

      return collected
    },

    updateTags: async (assetId, add, remove) => {
      log.info('scenario', `PUT /assets/${assetId}/tags +${add.length} -${remove.length}`)
      // `strict: false` makes it idempotent — adding a tag an asset already carries is not an
      // error worth failing a bulk tagging over.
      await backend.updateTags(assetId, {
        strict: false,
        ...(add.length ? { add: [...add] } : {}),
        ...(remove.length ? { _delete: [...remove] } : {}),
      })
    },

    deleteMany: async assetIds => {
      // There is no single-asset delete endpoint; the bulk one is the only door, capped at 100.
      for (const batch of chunk(assetIds, DELETE_MAX)) {
        log.info('scenario', `DELETE /assets ${batch.length} ids`)
        await backend.deleteMultiple({ assetIds: batch })
      }
    },

    downloadUrl: async (assetId, targetFormat) => {
      log.info('scenario', `POST /assets/${assetId}/download ${targetFormat ?? ''}`)
      const { url } = await backend.requestDownload(assetId, {
        ...(targetFormat ? { targetFormat } : {}),
      })
      return url
    },
  }
}
