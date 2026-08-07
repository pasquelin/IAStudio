import {
  FEATURED_TAG,
  OFFICIAL_TAG,
  PERIOD_DAYS,
  SKYBOX_TAG,
  type ModelDescriptor,
  type ModelPage,
  type ModelPeriod,
  type ModelQuery,
  type ModelSort,
  type ModelSummary,
} from '@shared/domain/model'
import { familyOf, translateSchema, type ScenarioInput } from './schema'

/**
 * A model as the API returns it, reduced to what the studio reads. Narrower than the SDK
 * type on purpose: it is the whole contract with the outside world, and it is what lets the
 * registry be tested without a network.
 */
export type RemoteModel = {
  id: string
  name?: string
  capabilities?: readonly string[]
  tags?: readonly string[]
  source?: string
  shortDescription?: string
  createdAt?: string
  thumbnail?: { url?: string }
  /** Pictures the model's owner published. Measured: 629 of the 642 public models have some. */
  exampleAssetIds?: readonly string[]
  inputs?: readonly ScenarioInput[]
}

export type RemoteAsset = {
  id: string
  url?: string
  /** `video/mp4`, `model/gltf-binary`, `audio/mpeg`… — `url` is only showable when it is an image. */
  mimeType?: string
  /** A still the API renders for what cannot be shown directly: video, 3D and audio all have one. */
  thumbnail?: { url?: string }
}

export type CatalogPage = {
  models: readonly RemoteModel[]
  /** Continuation for the same listing, or `null` when it is exhausted. */
  token: string | null
}

export type ListRequest = {
  privacy: 'private' | 'public'
  pageSize: number
  token?: string
  sort: ModelSort
  /** Narrows the request to Scenario's own models, which the API can filter server-side. */
  official: boolean
  /**
   * ONE tag, as a coarse pre-filter. Measured: the API unions the tags it is given — `Video`
   * alone answers 127 models, `Kling` alone 23, and `Video,Kling` answers 139. Passing every
   * chosen tag would therefore WIDEN the result with each filter added. The exact match is
   * made here instead, and this only narrows what has to be walked.
   */
  tag?: string
  /** ISO date the models must be newer than, already resolved from the requested span. */
  createdAfter?: string
}

export type SearchRequest = {
  query: string
  limit: number
  offset: number
}

export type ModelCatalog = {
  list: (request: ListRequest) => Promise<CatalogPage>
  search: (request: SearchRequest) => Promise<CatalogPage>
  retrieve: (modelId: string) => Promise<{ model: RemoteModel }>
  /** Signed URLs for asset ids, in one request. */
  assetUrls: (assetIds: readonly string[]) => Promise<readonly RemoteAsset[]>
}

export type ModelRegistry = {
  search: (query: ModelQuery) => Promise<ModelPage>
  describe: (modelId: string) => Promise<ModelDescriptor>
  /** Signed picture URL per asset id, absent for the ones the API has nothing for. */
  previews: (assetIds: readonly string[]) => Promise<Record<string, string>>
  invalidate: () => void
}

export type RegistryOptions = {
  catalog: () => ModelCatalog
  ttlMs?: number
  now?: () => number
}

const DEFAULT_TTL_MS = 10 * 60 * 1000
const DEFAULT_LIMIT = 24
const PAGE_SIZE = 100

/**
 * Filters the API cannot apply — family, capability, community-only — are applied here, so a
 * selective one can empty several pages in a row. The walk stops anyway and hands back its
 * cursor: an infinite list asks again on its own, and a request that walks the whole
 * catalogue before answering is exactly the freeze this pagination exists to avoid.
 */
const MAX_PAGES_PER_REQUEST = 5

/** One round trip per screenful of cards; the endpoint takes the ids in a single body. */
const PREVIEW_BATCH = 50

function summaryOf(model: RemoteModel): ModelSummary {
  const tags = model.tags ?? []
  const summary: ModelSummary = {
    id: model.id,
    // An unnamed model is still usable; showing its id beats showing nothing.
    name: model.name ?? model.id,
    family: familyOf(model.capabilities, tags),
    source: model.source ?? 'other',
    origin: tags.includes(OFFICIAL_TAG) ? 'official' : 'community',
    featured: tags.includes(FEATURED_TAG),
    capabilities: model.capabilities ?? [],
    tags,
  }

  // `thumbnail` is set on 160 of the 642 public models; the rest are pictured by an example.
  const [preview] = model.exampleAssetIds ?? []
  if (preview) summary.previewAssetId = preview

  if (model.shortDescription) summary.description = model.shortDescription
  if (model.thumbnail?.url) summary.thumbnail = model.thumbnail.url
  if (model.createdAt) summary.createdAt = model.createdAt

  return summary
}

/**
 * Where the next page resumes. Opaque to the renderer, which only ever hands it back: the two
 * listings paginate differently — a token for the catalogue, an offset for the search index —
 * and the panel has no business knowing which one answered it.
 */
type Cursor =
  | {
      mode: 'list'
      privacy: 'private' | 'public'
      token?: string
      /**
       * How much of that page was already handed out. A server page holds several screenfuls,
       * and without this the remainder of a half-read page would be skipped outright.
       */
      skip?: number
    }
  | { mode: 'search'; offset: number }

function serialize(cursor: Cursor): string {
  if (cursor.mode === 'search') return `s:${cursor.offset}`
  // Token last: it comes from the API and may hold colons of its own.
  return `l:${cursor.privacy}:${cursor.skip ?? 0}:${cursor.token ?? ''}`
}

function deserialize(value: string | undefined): Cursor | null {
  if (!value) return null

  if (value.startsWith('s:')) {
    const offset = Number(value.slice(2))
    return Number.isInteger(offset) && offset >= 0 ? { mode: 'search', offset } : null
  }

  const [, privacy, skipped, ...rest] = value.split(':')
  if (privacy !== 'private' && privacy !== 'public') return null

  const skip = Number(skipped)
  if (!Number.isInteger(skip) || skip < 0) return null

  const token = rest.join(':')
  return { mode: 'list', privacy, ...(skip ? { skip } : {}), ...(token ? { token } : {}) }
}

/**
 * Where a listing starts. `official` skips the private pass outright: a model the user
 * trained is theirs, never Scenario's, so that page could only be discarded.
 */
function firstCursor(query: ModelQuery): Cursor {
  if (query.search?.trim()) return { mode: 'search', offset: 0 }
  return { mode: 'list', privacy: query.origin === 'official' ? 'public' : 'private' }
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Start of the requested span, resolved here so the renderer never sends a moving date. */
function cutoff(period: ModelPeriod, at: number): string {
  return new Date(at - PERIOD_DAYS[period] * DAY_MS).toISOString()
}

/**
 * The picture that stands for an asset, or nothing showable at all.
 *
 * Measured across families: an image example carries its picture in `url` and nothing in
 * `thumbnail`; a video, a 3D mesh and an audio clip carry an unusable `url` and a still in
 * `thumbnail`. Reading `url` alone left every non-image workspace without a single card.
 */
function showable(asset: RemoteAsset): string | null {
  if (asset.thumbnail?.url) return asset.thumbnail.url
  return asset.mimeType?.startsWith('image/') && asset.url ? asset.url : null
}

/**
 * The whole narrowing, applied to every model whichever pass it came from.
 *
 * Nothing here is redundant with the request: the private listing accepts no `tags`, no sort
 * and no `createdAfter` at all — those are public-only parameters — so a model the user
 * trained would sail past every filter if this did not catch it. And the tag the request does
 * carry is a coarse union, never the exact set asked for.
 */
function matches(summary: ModelSummary, query: ModelQuery, since: string | null): boolean {
  if (query.family && summary.family !== query.family) return false
  if (query.origin && summary.origin !== query.origin) return false

  if (query.capabilities?.length) {
    const held = new Set(summary.capabilities)
    if (!query.capabilities.some(capability => held.has(capability))) return false
  }

  // Every chosen tag, unlike the API's union: a publisher AND a subject means both.
  if (query.tags?.length) {
    const held = new Set(summary.tags)
    if (!query.tags.every(tag => held.has(tag))) return false
  }

  if (since && (summary.createdAt === undefined || summary.createdAt < since)) return false

  return true
}

/**
 * The one tag the listing is narrowed by server-side, ahead of `matches`.
 *
 * A chosen tag comes first — it is what the user asked for. Failing that, a skybox listing is
 * worth asking the API for by tag: three models carry `SKYBOX_TAG` out of six hundred, and
 * walking the public catalogue page by page to keep three of them costs eight round trips to
 * fill one screen. Every other family is dense enough that the local filter settles it.
 */
function preFilter(query: ModelQuery): string | undefined {
  if (query.tags?.[0]) return query.tags[0]
  return query.family === 'skybox' ? SKYBOX_TAG : undefined
}

type Cached<T> = { at: number; value: T }

/**
 * Serves the catalogue one page at a time and caches what it has already walked. Listing the
 * six hundred public models up front cost a freeze on the first paint, and a model's schema
 * changes at Scenario's pace, not at ours: refetching on each keystroke would spend the rate
 * budget on data that is stable for hours.
 */
export function createModelRegistry({
  catalog,
  ttlMs = DEFAULT_TTL_MS,
  now = Date.now,
}: RegistryOptions): ModelRegistry {
  const pages = new Map<string, Cached<ModelPage>>()
  /** Raw server pages, keyed by the listing they belong to — see `fetchPage`. */
  const fetched = new Map<string, Cached<CatalogPage>>()
  const descriptors = new Map<string, Cached<ModelDescriptor>>()
  /**
   * `null` records an asset with nothing showable, so it is asked for once and not again.
   * Cached like the rest rather than forever: these URLs are signed and expire, and a stale
   * one leaves a card on its placeholder for the life of the process.
   */
  const previews = new Map<string, Cached<string | null>>()
  /**
   * Whether the account has trained any model at all. Measured on a fresh account: none. The
   * private pass then answers nothing, and paying that round trip once per filter combination
   * is a request spent to learn what the previous one already said.
   */
  let ownsModels: { at: number; value: boolean } | null = null

  const fresh = <T>(entry: Cached<T> | null | undefined): T | null =>
    entry && now() - entry.at < ttlMs ? entry.value : null

  /** Distinguishes "resolved to nothing" from "never asked", which `fresh` both read as null. */
  const held = (assetId: string): boolean => {
    const entry = previews.get(assetId)
    return entry !== undefined && now() - entry.at < ttlMs
  }

  /**
   * A server page holds four screenfuls, so the cursor stops inside one and comes back to it.
   * Without this the same hundred models are downloaded once per screenful — measured on a
   * full walk: 33 requests for 8 distinct pages, and 2 500 records reparsed for nothing.
   *
   * Keyed by what actually identifies the page, filters included: two queries differing by a
   * tag are two different listings even at the same token.
   */
  const fetchPage = async (cursor: Cursor, query: ModelQuery): Promise<CatalogPage> => {
    // Keyed by the tag that actually leaves, never by what it was derived from. The family is
    // one of its sources — a skybox listing narrows server-side, so its page holds three models
    // and must not be served back to Image — but the eight families that resolve to no tag ask
    // the identical question and go on sharing one page. Keying the family itself would have
    // made each of them repay a walk the previous one had already downloaded.
    const key = `${preFilter(query) ?? ''}|${query.sort ?? ''}|${query.origin ?? ''}|${query.since ?? ''}|${query.search?.trim() ?? ''}|${serialize({ ...cursor, ...(cursor.mode === 'list' ? { skip: 0 } : {}) })}`
    const cached = fresh(fetched.get(key))
    if (cached) return cached

    const tag = preFilter(query)
    const page =
      cursor.mode === 'search'
        ? await catalog().search({
            query: query.search?.trim() ?? '',
            limit: PAGE_SIZE,
            offset: cursor.offset,
          })
        : await catalog().list({
            privacy: cursor.privacy,
            pageSize: PAGE_SIZE,
            sort: query.sort ?? 'relevance',
            official: query.origin === 'official',
            ...(tag ? { tag } : {}),
            ...(query.since ? { createdAfter: cutoff(query.since, now()) } : {}),
            ...(cursor.token ? { token: cursor.token } : {}),
          })

    fetched.set(key, { at: now(), value: page })
    return page
  }

  const startOf = (query: ModelQuery): Cursor => {
    const first = firstCursor(query)
    const known = fresh(ownsModels)
    const skipPrivate = first.mode === 'list' && first.privacy === 'private' && known === false
    return skipPrivate ? { mode: 'list', privacy: 'public' } : first
  }

  /** Where the walk resumes: further into the same listing, or at the start of the next one. */
  const advance = (cursor: Cursor, token: string | null): Cursor | null => {
    if (cursor.mode === 'search') return token ? { mode: 'search', offset: Number(token) } : null
    if (token) return { mode: 'list', privacy: cursor.privacy, token }
    return cursor.privacy === 'private' ? { mode: 'list', privacy: 'public' } : null
  }

  return {
    search: async query => {
      const key = JSON.stringify(query)
      const cached = fresh(pages.get(key))
      if (cached) return cached

      const limit = query.limit ?? DEFAULT_LIMIT
      const since = query.since ? cutoff(query.since, now()) : null
      const items: ModelSummary[] = []
      /**
       * One walk covers the private listing then the public one, and a model the user trained
       * AND published comes out of both — the API documents `privacy: 'public'` as including
       * community models. Two entries of the same id would also collide as a React key.
       */
      const seen = new Set<string>()
      let cursor: Cursor | null = deserialize(query.cursor) ?? startOf(query)
      let walked = 0

      while (cursor && items.length < limit && walked < MAX_PAGES_PER_REQUEST) {
        const page: CatalogPage = await fetchPage(cursor, query)
        walked += 1

        if (cursor.mode === 'list' && cursor.privacy === 'private' && !cursor.token) {
          ownsModels = { at: now(), value: page.models.length > 0 }
        }

        const skip = cursor.mode === 'list' ? (cursor.skip ?? 0) : 0
        let read = 0

        for (const model of page.models.slice(skip)) {
          read += 1
          if (seen.has(model.id)) continue

          const summary = summaryOf(model)
          if (matches(summary, query, since)) {
            seen.add(model.id)
            items.push(summary)
          }
          if (items.length >= limit) break
        }

        // Stopping mid-page: resume from the very same page rather than from the next one.
        if (skip + read < page.models.length) {
          cursor =
            cursor.mode === 'search'
              ? { mode: 'search', offset: cursor.offset + read }
              : { mode: 'list', privacy: cursor.privacy, token: cursor.token, skip: skip + read }
          break
        }

        cursor = advance(cursor, page.token)
      }

      const value: ModelPage = { items, cursor: cursor ? serialize(cursor) : null }
      pages.set(key, { at: now(), value })
      return value
    },

    describe: async modelId => {
      const cached = fresh(descriptors.get(modelId))
      if (cached) return cached

      const { model } = await catalog().retrieve(modelId)
      const descriptor: ModelDescriptor = {
        ...summaryOf(model),
        fields: translateSchema(model.inputs),
      }

      descriptors.set(modelId, { at: now(), value: descriptor })
      return descriptor
    },

    previews: async assetIds => {
      const wanted = [...new Set(assetIds)]
      const missing = wanted.filter(id => fresh(previews.get(id)) === null && !held(id))
      const batches: string[][] = []

      for (let start = 0; start < missing.length; start += PREVIEW_BATCH) {
        batches.push(missing.slice(start, start + PREVIEW_BATCH))
      }

      // The batches know nothing of each other; running them in turn only adds up their latency.
      await Promise.all(
        batches.map(async batch => {
          const assets = await catalog().assetUrls(batch)
          const found = new Map(assets.map(asset => [asset.id, showable(asset)]))

          for (const id of batch) previews.set(id, { at: now(), value: found.get(id) ?? null })
        }),
      )

      const resolved: Record<string, string> = {}
      for (const id of wanted) {
        const url = fresh(previews.get(id))
        if (url) resolved[id] = url
      }
      return resolved
    },

    invalidate: () => {
      pages.clear()
      fetched.clear()
      descriptors.clear()
      previews.clear()
      ownsModels = null
    },
  }
}
