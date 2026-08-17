import { CHANNELS } from '@shared/ipc'
import { withoutSourcePath, type Asset } from '@shared/domain/asset'
import { checkAssetName } from '@shared/domain/asset-name'
import { defined } from '@shared/guards'
import type { CloudAsset, CloudPage, CloudQuery, ExploreQuery } from '@shared/domain/cloud-asset'
import type { SyncOutcome } from '@shared/domain/sync'
import { handle } from '@main/ipc/handle'
import { log } from '@main/log'
import {
  describeFailure,
  failureOf,
  persistableFailure,
  quietlyReducedBy,
  reducedBy,
} from '@main/scenario/client'
import type { RemoteAssetCatalog } from '@main/scenario/assetCatalog'
import {
  filterExpression,
  publicFeedFilter,
  NSFW_EMPTY,
  PUBLIC_FEED_SORT,
} from '@main/scenario/filterExpression'
import { remoteTypesFor } from '@main/scenario/remoteTypes'
import { OFFSET_MAX, PAGE_SIZE_MAX } from '@main/scenario/limits'
import type { AsyncCatalog } from '@main/project/catalog-client'
import type { ActivityLog } from '@main/project/activity-log'
import type { AutoCaption, DescribeAssets } from './auto-caption'
import type { CloudBackend } from './cloud-backend'
import { planSync, type SyncSide } from './sync-plan'
import {
  parseActivityQuery,
  parseAlsoRemote,
  parseAssetChanges,
  parseAssetId,
  parseAssetIds,
  parseCloudQuery,
  parseExploreQuery,
  parseSyncPolicy,
} from './validation'

const DEFAULT_PAGE_SIZE = 50

export type AssetHandlerDeps = {
  catalog: () => AsyncCatalog
  remote: () => RemoteAssetCatalog
  cloud: () => CloudBackend
  /** Removes the file an asset owns, when it owns one. A linked rush is only unlinked. */
  removeFile: (asset: Asset) => Promise<void>
  /**
   * Moves the file an asset owns so that it is called after `name`, and answers where it landed.
   *
   * Injected rather than reached for, as `removeFile` is: this module knows the catalogue and
   * not the folder it describes, and the disk is what a test replaces here.
   */
  renameFile: (asset: Asset, name: string) => Promise<string | undefined>
  /** The project the active key opens onto, or null while nothing is authenticated. */
  activeOwnerId: () => string | null
  /** Where a failure goes now that it has somewhere to go. */
  journal: () => ActivityLog
  /** Names what arrives without a useful name. Never awaited, never allowed to throw. */
  captionArrivals: AutoCaption
  /** Names a chosen selection, whatever it is already called. */
  describeAssets: DescribeAssets
}

const reduced = reducedBy('assets')
/**
 * For the reads no surface asked for — see `quietlyReducedBy`.
 *
 * Which channels those are is a fact about their CALLERS, not about the errand: `cloudBrowse`
 * reads like a browser's channel and is one today, but both of its callers are shelves of the
 * home that poll as they appear. The day a panel the user drives calls one of these, the choice
 * is made again here.
 */
const quietly = quietlyReducedBy('assets')

/**
 * Whether this query has to go through the search index rather than the plain listing.
 *
 * Free text and tags are the two things `GET /assets` cannot answer for one's own assets, and
 * search costs a separate quota — so it is taken only when it is the only thing that works.
 */
function needsSearch(query: CloudQuery): boolean {
  return Boolean(query.text) || Boolean(query.tags?.length)
}

/**
 * Which side produced a cursor, carried in the cursor itself.
 *
 * The two endpoints paginate differently — the listing by opaque token, the index by numeric
 * offset — and both answers come back through one `CloudPage`. Unmarked, clearing the search
 * box while holding a page would hand `"40"` to the listing as a pagination token. Marking is
 * five characters and makes that impossible to write.
 */
const TOKEN_CURSOR = 't:'
const OFFSET_CURSOR = 'o:'

/**
 * A number the index will take, from whatever was handed in. Both cursors reach the API as an
 * offset, and both come from outside — one from the renderer, one from the API's own token.
 */
function boundedOffset(value: string | undefined): number {
  const offset = Number(value)
  if (!Number.isFinite(offset) || offset <= 0) return 0

  return Math.min(Math.floor(offset), OFFSET_MAX)
}

function offsetFrom(cursor: string | undefined): number {
  return cursor?.startsWith(OFFSET_CURSOR) ? boundedOffset(cursor.slice(OFFSET_CURSOR.length)) : 0
}

function tokenFrom(cursor: string | undefined): string | undefined {
  return cursor?.startsWith(TOKEN_CURSOR) ? cursor.slice(TOKEN_CURSOR.length) : undefined
}

function marked(prefix: string, token: string | null): string | null {
  return token === null ? null : `${prefix}${token}`
}

async function browse(remote: RemoteAssetCatalog, query: CloudQuery): Promise<CloudPage> {
  const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, PAGE_SIZE_MAX)

  const page = needsSearch(query)
    ? await remote
        .search({
          ...(query.text ? { query: query.text } : {}),
          ...defined({ filter: filterExpression(query) }),
          limit: pageSize,
          offset: offsetFrom(query.cursor),
        })
        .then(found => ({ ...found, cursor: marked(OFFSET_CURSOR, found.token) }))
    : await remote
        .list({
          pageSize,
          ...defined({
            token: tokenFrom(query.cursor),
            types: remoteTypesFor(query.types),
            collectionId: query.collectionId,
          }),
        })
        .then(found => ({ ...found, cursor: marked(TOKEN_CURSOR, found.token) }))

  // Applied to both branches, and after them. Neither endpoint narrows the way the studio does:
  // the listing sends no `types` at all for pictures, and the index only knows the API's eight
  // media classes, so a search for skies comes back as every image. A short page is the price;
  // the cursor still walks, and one filter here beats one per branch — the next source would
  // otherwise start over.
  const wanted = query.types
  const assets = wanted?.length
    ? page.assets.filter(asset => wanted.includes(asset.type))
    : page.assets

  return { assets, cursor: page.cursor }
}

/**
 * One page of the public feed — everything published, of one kind, newest first.
 *
 * The index is asked for the kind rather than handed the whole feed to sift, but the answer is
 * typed again here all the same: `publicFeedFilter` casts wider than `assetTypeOfRemote` decides,
 * on purpose. A short page is the price, and the cursor keeps walking.
 */
async function explore(remote: RemoteAssetCatalog, query: ExploreQuery): Promise<CloudPage> {
  const limit = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, PAGE_SIZE_MAX)
  const assets: CloudAsset[] = []
  let offset = offsetFrom(query.cursor)
  let token: string | null = null

  /**
   * Pulled again while the useful page is empty, because the loop that repairs a loss belongs
   * to the layer that loses. A whole page can fall to the retyping below, and a page of nothing
   * handed up reads as the end of the feed: the grid does not ask again on an empty grid — quite
   * rightly — so the band would stop on "nothing published" with more still to come.
   */
  for (let round = 0; round < EMPTY_ROUNDS_MAX; round += 1) {
    const page = await remote.search({
      filter: publicFeedFilter(query.type),
      publicFeed: true,
      sortBy: PUBLIC_FEED_SORT,
      limit,
      offset,
    })

    assets.push(...page.assets.filter(asset => asset.type === query.type))
    token = page.token

    if (assets.length > 0 || token === null) break

    // An offset that did not move asks the index the very same question again, and the answer
    // costs a search either way. Reachable two ways: a token the bound clamps to the ceiling, and
    // a token that is not a number at all.
    const next = boundedOffset(token)
    if (next === offset) break
    offset = next
  }

  return { assets, cursor: marked(OFFSET_CURSOR, token) }
}

/** How many lookalikes are worth a shelf. One row of tiles, and one search's worth of quota. */
const SIMILAR_SIZE = 12

/**
 * How many pages the feed may walk past before answering nothing. A bound, not a policy: the
 * search costs quota, and a kind nobody has published would otherwise walk the whole index.
 */
const EMPTY_ROUNDS_MAX = 3

/**
 * Published assets in the vein of one this caller names.
 *
 * The reference is an argument and not a decision taken here: "the library's most recent asset"
 * is what the HOME wants, and baking it in left the channel unusable for the next caller — a
 * "find lookalikes" on a right-click names the asset under the pointer.
 *
 * No `sortBy` here, deliberately: the API ranks by likeness, and asking for another order on a
 * semantic search silently drops the ranking that is the whole point.
 */
async function similar(remote: RemoteAssetCatalog, assetId: string): Promise<CloudAsset[]> {
  const page = await remote.search({
    like: [assetId],
    publicFeed: true,
    filter: NSFW_EMPTY,
    // One more than shown: the API answers with the reference itself, at the top.
    limit: SIMILAR_SIZE + 1,
    offset: 0,
  })

  return page.assets.filter(asset => asset.id !== assetId).slice(0, SIMILAR_SIZE)
}

/** The rows behind a list of ids, minus the ones the catalogue no longer holds. */
async function findMany(catalog: () => AsyncCatalog, ids: readonly string[]): Promise<Asset[]> {
  const found = await Promise.all(ids.map(id => catalog().find(id)))
  return found.filter(asset => asset !== null)
}

function sideOf(asset: Asset): SyncSide {
  return {
    assetId: asset.id,
    hasLocalFile: Boolean(asset.path ?? asset.sourcePath),
    ...defined({
      remoteAssetId: asset.remoteAssetId,
      remoteOwnerId: asset.remoteOwnerId,
      remoteUpdatedAt: asset.remoteUpdatedAt,
      remoteSyncedAt: asset.remoteSyncedAt,
      localChangedAt: asset.localChangedAt,
    }),
  }
}

export function registerAssetHandlers({
  catalog,
  remote,
  cloud,
  removeFile,
  renameFile,
  activeOwnerId,
  journal,
  captionArrivals,
  describeAssets,
}: AssetHandlerDeps): void {
  handle(CHANNELS.activityRead, (_event, query) => journal().read(parseActivityQuery(query)))
  handle(CHANNELS.assetsUpdate, async (_event, assetId, changes) => {
    const parsed = parseAssetChanges(changes)
    const asset = await catalog().find(assetId)
    if (!asset) throw new Error('asset-not-found')

    // Trimmed ONCE, and here rather than at each use: the row was written untrimmed while the
    // file took the trimmed form, so `«  Ruelle  »` in the catalogue sat over `Ruelle.png` on
    // the disk — the two names apart again, by two spaces nobody can see.
    const name = parsed.name?.trim()

    // Checked again on this side, and not left to the field that asked first: `safeFileName`
    // would quietly turn `Vue 3/4` into `Vue 3 4` on the disk while the catalogue kept the
    // slash — the same split, one layer below where it was before.
    const refused = name === undefined ? null : checkAssetName(name)
    if (refused) throw new Error(refused)

    // Before the catalogue, never after: a row renamed over a move that failed would point at
    // the file it no longer names, which is the state this whole change exists to end. The
    // throw travels — the renderer turns `duplicate` into a line in the journal.
    const path = name === undefined ? asset.path : await renameFile(asset, name)

    const updated: Asset = {
      ...asset,
      ...(name === undefined ? {} : { name }),
      ...(parsed.tags === undefined ? {} : { tags: [...parsed.tags] }),
      // The file does not move with it: a row carries its own path, and what the studio calls
      // a picture has never been decided by the folder it sits in.
      ...(parsed.type === undefined ? {} : { type: parsed.type }),
      ...(path === undefined ? {} : { path }),
    }
    const saved = await catalog().add(updated)

    // The library is told too, when there is a twin to tell. Best effort on purpose: the tags
    // are the project's own first, and a network that is down must not lose the rename.
    if (asset.remoteAssetId && parsed.tags) {
      const added = parsed.tags.filter(tag => !asset.tags.includes(tag))
      const removed = asset.tags.filter(tag => !parsed.tags?.includes(tag))
      try {
        await remote().updateTags(asset.remoteAssetId, added, removed)
      } catch (error) {
        log.warn('assets', describeFailure(error))
        // A warning rather than an error: the rename landed here, which is what the user asked
        // for. Only its twin in the library still says the old thing.
        journal().record({
          level: 'warn',
          topic: 'library',
          messageKey: 'activity.tagsNotSynced',
          params: { name: updated.name },
          detail: persistableFailure(error),
          assetId: asset.id,
        })
      }
    }

    return withoutSourcePath(saved)
  })

  handle(CHANNELS.assetsRemove, async (_event, assetIds, alsoRemote) => {
    const ids = parseAssetIds(assetIds)
    const wipeRemote = parseAlsoRemote(alsoRemote)

    const found = await findMany(catalog, ids)

    if (wipeRemote) {
      const twins = found.map(asset => asset.remoteAssetId).filter(id => id !== undefined)
      // Before the local rows: what is gone from the library can still be found again here,
      // while a row dropped first leaves nothing pointing at what to delete.
      if (twins.length > 0) await reduced(() => remote().deleteMany(twins))
    }

    for (const asset of found) {
      await removeFile(asset)
      await catalog().remove(asset.id)
    }
  })

  handle(CHANNELS.assetsDescribe, async (_event, assetIds) => {
    const ids = parseAssetIds(assetIds)
    const found = await Promise.all(ids.map(assetId => catalog().find(assetId)))

    return describeAssets(found.filter(asset => asset !== null))
  })

  // Parsed before the reduction, as every other channel in this file already does: what `quietly`
  // keeps out of the journal is an API that refused, and a malformed message is not that — it is
  // a bug on the other side of the boundary, and reducing it to `unexpected` would hide it.
  handle(CHANNELS.cloudSimilar, (_event, assetId) => {
    const reference = parseAssetId(assetId)
    return quietly(() => similar(remote(), reference))
  })

  handle(CHANNELS.cloudExplore, (_event, query) => {
    const parsed = parseExploreQuery(query)
    return quietly(() => explore(remote(), parsed))
  })

  handle(CHANNELS.cloudBrowse, (_event, query) => {
    const parsed = parseCloudQuery(query)
    return quietly(() => browse(remote(), parsed))
  })

  handle(CHANNELS.cloudPull, async (_event, remoteAssetIds) => {
    const ids = parseAssetIds(remoteAssetIds)
    const found = await reduced(() => remote().getBulk(ids))
    const outcomes: SyncOutcome[] = []

    // One at a time, and one outcome each — the same shape a push answers with. A download that
    // fails halfway has already written the ones before it to disk and added their rows; a
    // single rejection would throw that away as far as the caller can tell.
    const arrived: Asset[] = []

    for (const cloudAsset of found) {
      try {
        arrived.push(await cloud().pull(cloudAsset))
        outcomes.push({ assetId: cloudAsset.id, ok: true })
      } catch (error) {
        log.error('assets', describeFailure(error))
        journal().record({
          level: 'error',
          topic: 'library',
          messageKey: 'activity.pullFailed',
          params: { name: cloudAsset.name },
          // `describeFailure` and never `error.message`: an SDK message embeds the request that
          // produced it, so it carries the API key, and a journal is a file one may well send on.
          detail: persistableFailure(error),
        })
        outcomes.push({ assetId: cloudAsset.id, ok: false, error: failureOf(error) })
      }
    }

    const pulled = outcomes.filter(outcome => outcome.ok).length
    if (pulled > 0) {
      journal().record({
        level: 'info',
        topic: 'library',
        messageKey: 'activity.pulled',
        params: { count: pulled },
      })
    }

    // Named after the outcomes are settled, and never awaited: describing what arrived was not
    // what the user asked for, and a library that is slow to answer must not hold up the
    // window that is waiting to show the assets already on disk.
    void captionArrivals(arrived)

    return outcomes
  })

  handle(CHANNELS.cloudPush, async (_event, assetIds) => {
    const ids = parseAssetIds(assetIds)
    const outcomes: SyncOutcome[] = []

    // Failures travel beside successes rather than throwing: a push of forty where one is
    // refused is thirty-nine that went up, and one rejection would hide them all.
    for (const assetId of ids) {
      try {
        await cloud().push(assetId)
        outcomes.push({ assetId, ok: true })
      } catch (error) {
        log.error('assets', describeFailure(error))
        const failure = failureOf(error)
        outcomes.push({ assetId, ok: false, error: failure })

        const asset = await catalog().find(assetId)
        if (asset) await catalog().add({ ...asset, syncStatus: 'error', syncError: failure })

        journal().record({
          level: 'error',
          topic: 'library',
          messageKey: 'activity.pushFailed',
          params: { name: asset?.name ?? assetId },
          detail: persistableFailure(error),
          assetId,
        })
      }
    }

    const pushed = outcomes.filter(outcome => outcome.ok).length
    if (pushed > 0) {
      journal().record({
        level: 'info',
        topic: 'library',
        messageKey: 'activity.pushed',
        params: { count: pushed },
      })
    }

    return outcomes
  })

  handle(CHANNELS.cloudPlan, async (_event, assetIds, policy) => {
    const ids = parseAssetIds(assetIds)
    const found = await findMany(catalog, ids)

    return planSync(found.map(sideOf), parseSyncPolicy(policy), activeOwnerId())
  })
}
