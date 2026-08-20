import type Scenario from '@scenario-labs/sdk'
import type { CloudAsset } from '@shared/domain/cloudAsset'
import { log } from '@main/log'
import { cloudAssetOfHit, cloudAssetOfListing } from './assetNormalizer'
import { offsetAfter, tokenAfter } from './cursor'
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
  getBulk: (params: { assetIds: string[] }) => Promise<{ assets: unknown[] }>
  updateTags: (assetId: string, body: TagsBody) => Promise<unknown>
  deleteMultiple: (body: { assetIds: string[] }) => Promise<unknown>
  requestDownload: (
    assetId: string,
    body: { targetFormat?: DownloadFormat },
  ) => Promise<{ url: string }>
}

type RemoteAssetPage = {
  assets: CloudAsset[]
  /** Opaque, and `null` at the end. `/assets` reports neither an offset nor a total. */
  token: string | null
}

type AssetListRequest = {
  pageSize: number
  token?: string
  /** `metadata.type` values — the only axis `GET /assets` filters on. */
  types?: readonly RemoteAssetType[]
  collectionId?: string
}

type AssetSearchRequest = {
  query?: string
  /** The Meilisearch-style expression built by `filterExpression`. */
  filter?: string
  limit: number
  offset: number
  /**
   * Searches what everyone published rather than what this key owns. Named for the errand and
   * not after the SDK's `public`, which cannot be destructured — it is a reserved word.
   */
  publicFeed?: boolean
  /** `attribute:asc|desc` pairs. `score` is NOT among them — see `NEWEST_FIRST`. */
  sortBy?: readonly string[]
  /**
   * Asset ids to look like. The API answers by visual and semantic likeness, and includes the
   * references themselves — the caller takes them back out.
   */
  like?: readonly string[]
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

/**
 * The real SDK, narrowed to the port above. The only place the two shapes meet — everything
 * else, tests included, takes the port.
 */
export function assetBackendOf(client: Scenario): AssetBackend {
  return {
    list: params => client.assets.list(params),
    search: params => client.search.assetSearch(params),
    getBulk: params => client.assets.getBulk(params),
    updateTags: (assetId, body) => client.assets.updateTags(assetId, body),
    deleteMultiple: body => client.assets.deleteMultiple(body),
    requestDownload: (assetId, body) => client.assets.download.request(assetId, body),
  }
}

/** Binds the studio's narrow catalogue to whatever answers for the API. */
export function assetCatalogOf(backend: AssetBackend): RemoteAssetCatalog {
  return {
    list: async ({ pageSize, token, types, collectionId }) => {
      const params = {
        pageSize: Math.min(pageSize, PAGE_SIZE_MAX),
        // Asked for rather than left to the server. The endpoint documents both parameters and
        // no default order, so a listing without them is whatever the API feels like returning —
        // and every caller here wants the same thing: what was made most recently, first.
        sortBy: 'createdAt',
        sortDirection: 'desc',
        ...(token ? { paginationToken: token } : {}),
        ...(types?.length ? { types: [...types] } : {}),
        ...(collectionId ? { collectionId } : {}),
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
    search: async ({ query, filter, limit, offset, publicFeed, sortBy, like }) => {
      const params = {
        ...(query ? { query } : {}),
        ...(filter ? { filter } : {}),
        ...(publicFeed ? { public: true } : {}),
        ...(sortBy?.length ? { sortBy: [...sortBy] } : {}),
        ...(like?.length ? { images: { like: [...like] } } : {}),
        limit: Math.min(limit, PAGE_SIZE_MAX),
        offset,
      }

      log.info('scenario', `POST /search/assets ${JSON.stringify(params)}`)
      const page = await backend.search(params)
      log.info('scenario', `POST /search/assets → ${page.hits.length}/${page.estimatedTotalHits}`)

      return {
        assets: page.hits.map(cloudAssetOfHit).filter(asset => asset !== null),
        token: offsetAfter(offset, page.hits.length, page.estimatedTotalHits),
      }
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
