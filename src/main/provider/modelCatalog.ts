import type Scenario from '@scenario-labs/sdk'
import type { ModelSort } from '@shared/domain/model'
import { log } from '@main/log'
import { offsetAfter, tokenAfter } from './cursor'
import type { CatalogPage, ListRequest, ModelCatalog, SearchRequest } from './modelRegistry'

/**
 * The API sorts public models by `score` — usage and popularity blended — when asked for
 * nothing else. `createdAt` is the only other order worth offering: `updatedAt` moves when a
 * description is edited, which is not a change a user is looking for.
 *
 * `sortDirection` goes ONLY with a date order. The reference says it is "ignored" alongside
 * `score`; the API answers 400 "must be used together with sortBy to createdAt or updatedAt".
 * Score is descending on its own — the best models first is the only order that makes sense.
 */
type SortParams = { sortBy: 'score' } | { sortBy: 'createdAt'; sortDirection: 'desc' | 'asc' }

const NEWEST_FIRST: SortParams = { sortBy: 'createdAt', sortDirection: 'desc' }
const OLDEST_FIRST: SortParams = { sortBy: 'createdAt', sortDirection: 'asc' }

function sortParams(sort: ModelSort): SortParams {
  if (sort === 'recent') return NEWEST_FIRST
  if (sort === 'oldest') return OLDEST_FIRST
  return { sortBy: 'score' }
}

/** Where the pictures are served from — the hosts the renderer's CSP has to allow, never a URL. */
function hostsOf(assets: readonly { url?: string; thumbnail?: { url?: string } }[]): string {
  const hosts = new Set(
    assets.flatMap(asset =>
      [asset.url, asset.thumbnail?.url].flatMap(url => (url ? [URL.parse(url)?.host ?? '?'] : [])),
    ),
  )
  return hosts.size ? [...hosts].join(' ') : 'no url at all'
}

/**
 * Binds the registry's narrow catalogue to the real SDK. The only file where the two meet, so
 * a change in the SDK's shape lands here rather than throughout the registry.
 */
export function catalogOf(client: Scenario): ModelCatalog {
  return {
    /**
     * `GET /models` answers with the caller's OWN trained models only, and nothing says so in
     * the signature. A fresh account has trained none, so the picker came back empty while the
     * whole catalogue sat behind `privacy: 'public'` — measured: 0 private, 642 public. The
     * registry walks private first: a model the user trained outranks the six hundred others.
     */
    list: async ({ privacy, pageSize, token, sort, tag, createdAfter }: ListRequest) => {
      // `tags` and `score` ordering are public-only, and sorting private models by score would
      // additionally require a `status` filter the studio has no reason to impose.
      const params = {
        pageSize,
        privacy,
        ...(token ? { paginationToken: token } : {}),
        ...(privacy === 'public'
          ? {
              // A date bound is only honoured alongside the date order — the API says so, and
              // answers 400 otherwise. Asking for one silently overrides the chosen sort.
              ...(createdAfter ? { ...NEWEST_FIRST, createdAfter } : sortParams(sort)),
              ...(tag ? { tags: tag } : {}),
            }
          : {}),
      }

      log.info('provider', `GET /models ${JSON.stringify(params)}`)
      const page = await client.models.list(params)
      log.info('provider', `GET /models → ${page.models.length} models`)

      return {
        models: page.models,
        token: tokenAfter(page.nextPaginationToken, page.models.length),
      }
    },

    search: async ({ query, limit, offset }: SearchRequest): Promise<CatalogPage> => {
      // `public`: the search index defaults to the caller's own models, the same trap the
      // catalogue listing sets — see the note above.
      const params = { query, limit, offset, public: true }

      log.info('provider', `POST /search/models ${JSON.stringify(params)}`)
      const page = await client.search.modelSearch(params)
      log.info('provider', `POST /search/models → ${page.hits.length}/${page.estimatedTotalHits}`)

      return {
        models: page.hits,
        token: offsetAfter(offset, page.hits.length, page.estimatedTotalHits),
      }
    },

    retrieve: modelId => client.models.retrieve(modelId),

    /**
     * One round trip for a whole screen of cards.
     *
     * NOT `models.getBulk({ thumbnail: true })`, whose reference promises a fallback to the
     * first training image: measured on the first twelve public models, it answered zero URLs.
     * Third-party models have no training images here. Their example assets do have one.
     */
    assetUrls: async assetIds => {
      log.info('provider', `POST /assets/get-bulk ${assetIds.length} ids`)
      const { assets } = await client.assets.getBulk({ assetIds: [...assetIds] })
      // The one call of the catalogue that answered into silence, which is what left a missing
      // thumbnail unreadable for three sittings.
      log.info(
        'provider',
        `POST /assets/get-bulk → ${assets.length}/${assetIds.length} assets, ${hostsOf(assets)}`,
      )
      return assets
    },
  }
}
