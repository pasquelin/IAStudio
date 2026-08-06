import type Scenario from '@scenario-labs/sdk'
import { OFFICIAL_TAG, type ModelSort } from '@shared/domain/model'
import { log } from '@main/log'
import type { CatalogPage, ListRequest, ModelCatalog, SearchRequest } from './model-registry'

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

/**
 * The cursor is empty rather than absent once a listing is exhausted. A SHORT page is not the
 * same thing: with a server-side tag or date filter, the API returns fewer than `pageSize`
 * and still hands back a token, and treating that as the end truncated the catalogue silently.
 * An empty page is the end — that is the guard the SDK's own paginator applies.
 */
function tokenAfter(token: string | undefined, received: number): string | null {
  return token && received > 0 ? token : null
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
    list: async ({ privacy, pageSize, token, sort, official, tag, createdAfter }: ListRequest) => {
      // `tags` and `score` ordering are public-only, and sorting private models by score would
      // additionally require a `status` filter the studio has no reason to impose.
      const wanted = tag ?? (official ? OFFICIAL_TAG : undefined)
      const params = {
        pageSize,
        privacy,
        ...(token ? { paginationToken: token } : {}),
        ...(privacy === 'public'
          ? {
              // A date bound is only honoured alongside the date order — the API says so, and
              // answers 400 otherwise. Asking for one silently overrides the chosen sort.
              ...(createdAfter ? { ...NEWEST_FIRST, createdAfter } : sortParams(sort)),
              ...(wanted ? { tags: wanted } : {}),
            }
          : {}),
      }

      log.info('scenario', `GET /models ${JSON.stringify(params)}`)
      const page = await client.models.list(params)
      log.info('scenario', `GET /models → ${page.models.length} models`)

      return {
        models: page.models,
        token: tokenAfter(page.nextPaginationToken, page.models.length),
      }
    },

    search: async ({ query, limit, offset }: SearchRequest): Promise<CatalogPage> => {
      // `public`: the search index defaults to the caller's own models, the same trap the
      // catalogue listing sets — see the note above.
      const params = { query, limit, offset, public: true }

      log.info('scenario', `POST /search/models ${JSON.stringify(params)}`)
      const page = await client.search.modelSearch(params)
      log.info('scenario', `POST /search/models → ${page.hits.length}/${page.estimatedTotalHits}`)

      const next = offset + page.hits.length

      return {
        models: page.hits,
        // `estimatedTotalHits` is an estimate and can exceed what the index really holds; an
        // empty page would otherwise hand back the very offset it was asked for, forever.
        token: page.hits.length > 0 && next < page.estimatedTotalHits ? String(next) : null,
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
      log.info('scenario', `POST /assets/get-bulk ${assetIds.length} ids`)
      const { assets } = await client.assets.getBulk({ assetIds: [...assetIds] })
      return assets
    },
  }
}
