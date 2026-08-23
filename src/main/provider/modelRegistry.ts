import {
  FEATURED_TAG,
  LOCAL_RUNTIME,
  PERIOD_DAYS,
  PROVIDER_MAINTAINER,
  SYSTEM_TAG_PREFIX,
  tagOfFamily,
  type ModelDescriptor,
  type ModelPage,
  type ModelPeriod,
  type ModelQuery,
  type ModelSort,
  type ModelSummary,
} from '@shared/domain/model'
import { SCENARIO_CLOUD } from '@shared/domain/aiCloud'
import { localFieldsOf } from '@shared/domain/localFields'
import { modelThumbnailUrl, type LocalModel } from '@shared/domain/localModel'
import type { WatchCredentials } from './credentialsWatch'
import { familyOf, translateSchema, type ProviderInput } from './schema'

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
  /** Pictures the model's owner published. Measured: 628 of the 640 public models have some. */
  exampleAssetIds?: readonly string[]
  /**
   * Read against `PROVIDER_MAINTAINER`. Listing, search index and `GET /models/{id}` all carry
   * it — measured on every public model of all three, unlike `accessRestrictions` below.
   */
  complianceMetadata?: { maintainer?: string }
  /**
   * Whose catalogue the model sits in, carried by the record on all three paths — which is what
   * lets `summaryOf` answer without being told which pass fetched it.
   *
   * A plain string, for the reason `ModelSummary.source` is one.
   */
  privacy?: string
  /**
   * The plan grade below which the API refuses this model. Widened from the SDK's union on
   * purpose — see `ModelSummary.requiredPlanLevel`, which two models already contradict.
   *
   * `null` is a real answer, not a missing one: measured, `GET /models` always grades a model
   * with a number, while `POST /search/models` answers `null` for every hit — the search index
   * does not carry the field. That is why the search path is graded from `grades` below.
   */
  accessRestrictions?: number | null
  inputs?: readonly ProviderInput[]
}

type RemoteAsset = {
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
  /**
   * ONE tag, as a coarse pre-filter. Measured: the API unions the tags it is given — `Video`
   * alone answers 127 models, `Kling` alone 23, and `Video,Kling` answers 139. Passing every
   * chosen tag would therefore WIDEN the result with each filter added. The exact match is
   * made here instead, and this only narrows what has to be walked.
   *
   * Never one from `SYSTEM_TAG_PREFIX`, which the endpoint answers nothing for. `preFilter`
   * is where that is decided.
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
}

export type RegistryOptions = {
  catalog: () => ModelCatalog
  /** Required: everything cached here belongs to one account, and none of the keys say which. */
  watch: WatchCredentials
  /**
   * The models on THIS machine that serve a space — never the assistant or the recognition model,
   * which answer a role and belong to no panel. Read on each call: one is added while this runs.
   */
  localModels: () => readonly LocalModel[]
  /** Whether a local model's weights are on this disk. Read per call: an install lands mid-panel. */
  isInstalled: (modelId: string) => boolean
  /** Names the knobs of a local model's form. The main process holds the language as a service. */
  translate: (key: string) => string
  ttlMs?: number
  now?: () => number
}

const DEFAULT_TTL_MS = 10 * 60 * 1000
const DEFAULT_LIMIT = 24
const PAGE_SIZE = 100
/** Stale entries used to sit in these maps for the life of the process. */
const MAX_CACHED = 64

/**
 * Filters the API cannot apply — family, capability, community-only — are applied here, so a
 * selective one can empty several pages in a row. The walk stops anyway and hands back its
 * cursor: an infinite list asks again on its own, and a request that walks the whole
 * catalogue before answering is exactly the freeze this pagination exists to avoid.
 */
const MAX_PAGES_PER_REQUEST = 5

/** One round trip per screenful of cards; the endpoint takes the ids in a single body. */
const PREVIEW_BATCH = 50

/**
 * Every plan grade the catalogue has answered so far, by model id.
 *
 * MEASURED: `GET /models` grades every model with a number, while `POST /search/models` answers
 * `null` on every hit — the search index does not carry the field. Without this, a model found
 * by name came back ungraded and was offered as runnable, while the very same model in the
 * listing was greyed out. Grades do not change under a model, so remembering what the listings
 * said is enough to grade most search hits too.
 *
 * NOT cleared by the credential purge, unlike every other cache here: a grade is a property of
 * the model, not of who is asking.
 */
type Grades = Map<string, number>

/**
 * Whether the model belongs to Scenario's public catalogue rather than to this account.
 *
 * BOTH conditions, and the privacy one is not redundant: measured 2026-08-15, the one model this
 * account has trained answers `maintainer: Scenario` like the catalogue does, so that field
 * alone filed the user's own models as official — and "Community" then hid the very models only
 * they can see.
 *
 * It buys the PRIVATE case and only that: a model the user trained and then PUBLISHED would
 * read as official. `ownerId` would tell it apart — measured, all 640 public models share one,
 * where this account's own model carries its project's — but keying authorship to an opaque id
 * held in no contract is worse than the case it fixes: the day Scenario publishes under a
 * second owner, the whole catalogue turns community and nothing reddens. Left as is knowingly.
 */
const isOfficial = (model: RemoteModel): boolean =>
  model.privacy === 'public' && model.complianceMetadata?.maintainer === PROVIDER_MAINTAINER

function summaryOf(model: RemoteModel, grades: Grades): ModelSummary {
  const tags = model.tags ?? []
  const summary: ModelSummary = {
    id: model.id,
    // An unnamed model is still usable; showing its id beats showing nothing.
    name: model.name ?? model.id,
    family: familyOf(model.capabilities, tags),
    runsOn: SCENARIO_CLOUD,
    source: model.source ?? 'other',
    origin: isOfficial(model) ? 'official' : 'community',
    featured: tags.includes(FEATURED_TAG),
    capabilities: model.capabilities ?? [],
    tags,
  }

  // `thumbnail` is set on 160 of the 640 public models; the rest are pictured by an example.
  const [preview] = model.exampleAssetIds ?? []
  if (preview) summary.previewAssetId = preview

  if (model.shortDescription) summary.description = model.shortDescription
  if (model.thumbnail?.url) summary.thumbnail = model.thumbnail.url
  if (model.createdAt) summary.createdAt = model.createdAt
  // `typeof` and not `!== undefined`: the search index answers `null`, which would otherwise be
  // written into a `number | undefined` field and read as a grade of nothing. Not `if (…)`
  // either — grade 0 is the free tier, and truthiness would drop it to "ungraded".
  const grade =
    typeof model.accessRestrictions === 'number' ? model.accessRestrictions : grades.get(model.id)

  if (grade !== undefined) {
    summary.requiredPlanLevel = grade
    grades.set(model.id, grade)
  }

  return summary
}

/**
 * A model on THIS machine, as the panel reads it — the same shape as a cloud's, which is the whole
 * point of merging the two catalogues: one set of filters, one search, one grid, `<DynamicForm/>`.
 *
 * `null` for a model with no family: the assistant and the recognition model answer a ROLE, and
 * the manager screen is where those are chosen. They never appear in a space's panel.
 */
function localSummaryOf(model: LocalModel, installed: boolean): ModelSummary | null {
  if (model.family === undefined) return null

  return {
    id: model.id,
    name: model.name,
    family: model.family,
    runsOn: LOCAL_RUNTIME,
    source: model.source,
    // `origin` says who PUBLISHES, and nothing running on this machine is published by the cloud
    // the studio was built on — which is what `official` means here.
    origin: 'community',
    installed,
    ...(model.files.length === 0 ? { downloadable: false } : {}),
    diskBytes: model.diskBytes,
    featured: false,
    capabilities: model.capabilities ?? [],
    tags: [],
    // Always one: the manifest names its own, and a modality's generic picture stands in for a
    // model the person supplied. A card with nothing to draw is what this exists to prevent.
    thumbnail: modelThumbnailUrl(model),
    ...(model.summary === undefined ? {} : { description: model.summary }),
  }
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
 * Where a listing starts. `official` skips the private pass outright: `isOfficial` refuses a
 * private model whatever else it says, so that page could only be discarded.
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
  if (query.runsOn && summary.runsOn !== query.runsOn) return false
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
 * A chosen tag comes first — it is what the user asked for. Failing that, the three families
 * whose tag the API indexes are worth asking for by it: four to thirteen models out of six
 * hundred, and walking the public catalogue page by page to keep them costs eight round trips
 * to fill one screen. Every other family is dense enough that the local filter settles it.
 *
 * Nothing from `SYSTEM_TAG_PREFIX` leaves, whichever of the two it came from: the endpoint
 * answers zero models for those, so the pre-filter would not shorten the walk but empty it.
 *
 * The skyboxes are narrowed by nothing at all — `tagOfFamily` already answers nothing for a
 * family holding several tags, and this refuses `sc:skybox` besides, should one ever be asked
 * for by hand. `matches` classifies them off the records instead. Measured 2026-08-15, the walk
 * does reach them: the four sit at offsets 178, 231, 248 and 302 of the score-ordered public
 * listing, so one request's five pages of a hundred bring them all back.
 */
function preFilter(query: ModelQuery): string | undefined {
  const wanted = query.tags?.[0] ?? (query.family ? tagOfFamily(query.family) : undefined)
  return wanted?.startsWith(SYSTEM_TAG_PREFIX) ? undefined : wanted
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
  watch,
  localModels,
  isInstalled,
  translate,
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
  /** Survives `invalidate` on purpose — see `Grades`: a grade belongs to the model, not the account. */
  const grades: Grades = new Map()

  const fresh = <T>(entry: Cached<T> | null | undefined): T | null =>
    entry && now() - entry.at < ttlMs ? entry.value : null

  const take = <T>(map: Map<string, Cached<T>>, key: string): T | null => {
    const entry = map.get(key)
    const value = fresh(entry)
    if (value === null || entry === undefined) return null
    map.delete(key)
    map.set(key, entry)
    return value
  }

  const prune = <T>(map: Map<string, Cached<T>>): void => {
    for (const [key, entry] of map) {
      if (now() - entry.at >= ttlMs) map.delete(key)
    }
    while (map.size > MAX_CACHED) {
      const oldest = map.keys().next().value
      if (oldest === undefined) break
      map.delete(oldest)
    }
  }

  const remember = <T>(map: Map<string, Cached<T>>, key: string, value: T): void => {
    map.delete(key)
    map.set(key, { at: now(), value })
    prune(map)
  }

  const withLiveLocals = (page: ModelPage, query: ModelQuery): ModelPage => {
    if (query.cursor !== undefined) return page

    const since = query.since ? cutoff(query.since, now()) : null
    const locals = localSummaries().filter(summary => matches(summary, query, since))
    const seen = new Set(locals.map(summary => summary.id))
    const remotes = page.items.filter(item => item.runsOn !== LOCAL_RUNTIME && !seen.has(item.id))
    const limit = query.limit ?? DEFAULT_LIMIT
    return { items: [...locals, ...remotes].slice(0, limit), cursor: page.cursor }
  }

  // The form a model on this machine offers, derived from its MODALITY — see `localFields.ts`.
  const describedLocally = (modelId: string): ModelDescriptor | null => {
    const model = localModels().find(one => one.id === modelId)
    if (!model) return null

    return {
      // 🛑 A model this machine holds NEVER reaches the API, whatever is missing from its
      // manifest. `localSummaryOf` answers null for one that names no family, and falling through
      // to `described` then sent a local id to Scenario — measured: `404 Model ssd-1b not found`,
      // journalled as a generation failure, and on another endpoint it would have been paid for.
      // A manifest that says too little is a defect of ours, and it is answered from here.
      ...(localSummaryOf(model, isInstalled(model.id)) ?? {
        id: model.id,
        name: model.name,
        family: 'other',
        runsOn: LOCAL_RUNTIME,
        source: model.source,
        origin: 'community',
        installed: isInstalled(model.id),
        diskBytes: model.diskBytes,
        featured: false,
        capabilities: model.capabilities ?? [],
        tags: [],
        thumbnail: modelThumbnailUrl(model),
      }),
      // `text` where a manifest names no modality: a form that disappeared would be worse than one
      // knob too many, which is the whole of invariant 5.
      fields: localFieldsOf(model.modality ?? 'text', model.fieldOverrides ?? {}, translate),
    }
  }

  /**
   * What this machine offers the panel, recomposed only when the list itself changes.
   *
   * Read on every search — so on every keystroke of the browser's field — where the remote side
   * is held by the TTL. The list is a handful of manifests and it moves once a gesture.
   */
  let summarised: { of: readonly LocalModel[]; items: readonly ModelSummary[] } | null = null
  let installedMark = ''

  const localSummaries = (): readonly ModelSummary[] => {
    const own = localModels()
    // Recomposed on the LIST and on what is installed: memoising on the list alone left a model
    // greyed as absent for the rest of the session after its download landed.
    const present = own.map(model => isInstalled(model.id)).join()
    if (summarised?.of !== own || installedMark !== present) {
      installedMark = present
      summarised = {
        of: own,
        items: own.flatMap(model => localSummaryOf(model, isInstalled(model.id)) ?? []),
      }
    }

    return summarised.items
  }

  /** The one place a model's schema is fetched, cached per model for the registry's own TTL. */
  const described = async (modelId: string): Promise<ModelDescriptor> => {
    const cached = fresh(descriptors.get(modelId))
    if (cached) return cached

    const { model } = await catalog().retrieve(modelId)
    const value: ModelDescriptor = {
      ...summaryOf(model, grades),
      fields: translateSchema(model.inputs),
    }

    remember(descriptors, modelId, value)
    return value
  }

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
    // one of its sources — a cutout listing narrows server-side, so its page holds nine models
    // and must not be served back to Image — but every family resolving to no tag, skyboxes
    // among them, asks the identical question and shares one page. Keying the family itself
    // would make each of them repay a walk the previous one had already downloaded.
    //
    // The chosen origin is absent for the same reason: nothing of it leaves. It picks where the
    // walk starts, which `serialize(cursor)` already says, and `matches` reads authorship off
    // the records — so "Official" and "All" are the same pages under two names.
    const tag = preFilter(query)
    const key = `${tag ?? ''}|${query.sort ?? ''}|${query.since ?? ''}|${query.search?.trim() ?? ''}|${serialize({ ...cursor, ...(cursor.mode === 'list' ? { skip: 0 } : {}) })}`
    const cached = fresh(fetched.get(key))
    if (cached) return cached

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
            ...(tag ? { tag } : {}),
            ...(query.since ? { createdAfter: cutoff(query.since, now()) } : {}),
            ...(cursor.token ? { token: cursor.token } : {}),
          })

    remember(fetched, key, page)
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

  const invalidate = (): void => {
    pages.clear()
    fetched.clear()
    descriptors.clear()
    previews.clear()
    ownsModels = null
  }

  watch(invalidate)

  return {
    search: async query => {
      const key = JSON.stringify(query)
      const cached = take(pages, key)
      if (cached) return withLiveLocals(cached, query)

      const limit = query.limit ?? DEFAULT_LIMIT
      const since = query.since ? cutoff(query.since, now()) : null
      const items: ModelSummary[] = []
      /**
       * One walk covers the private listing then the public one, and a model the user trained
       * AND published comes out of both — the API documents `privacy: 'public'` as including
       * community models. Two entries of the same id would also collide as a React key.
       */
      const seen = new Set<string>()

      // The local catalogue rides on the FIRST page and is never paginated: it is a handful of
      // manifests held in memory, so a cursor into it would be machinery for a list that cannot
      // fill one screen. It comes first because it is the side that costs nothing to run.
      if (query.cursor === undefined) {
        for (const summary of localSummaries()) {
          if (!matches(summary, query, since)) continue

          seen.add(summary.id)
          items.push(summary)
        }
      }

      // Nothing remote is walked when the person asked for this machine alone: the pages could
      // only be discarded, and each of them is a round trip.
      let cursor: Cursor | null =
        query.runsOn === LOCAL_RUNTIME ? null : (deserialize(query.cursor) ?? startOf(query))
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

          const summary = summaryOf(model, grades)
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
      remember(pages, key, value)
      return value
    },

    describe: async modelId => describedLocally(modelId) ?? (await described(modelId)),

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

          for (const id of batch) remember(previews, id, found.get(id) ?? null)
        }),
      )

      const resolved: Record<string, string> = {}
      for (const id of wanted) {
        const url = fresh(previews.get(id))
        if (url) resolved[id] = url
      }
      return resolved
    },
  }
}
