import { CHANNELS } from '@shared/ipc'
import { withoutSourcePath, type Asset } from '@shared/domain/asset'
import { defined } from '@shared/guards'
import type { CloudPage, CloudQuery } from '@shared/domain/cloud-asset'
import type { SyncOutcome } from '@shared/domain/sync'
import { handle } from '@main/ipc/handle'
import { log } from '@main/log'
import { describeFailure, failureOf, reducedBy } from '@main/scenario/client'
import type { RemoteAssetCatalog } from '@main/scenario/asset-catalog'
import { filterExpression } from '@main/scenario/filter-expression'
import { remoteTypesFor } from '@main/scenario/remote-types'
import { PAGE_SIZE_MAX } from '@main/scenario/limits'
import type { AsyncCatalog } from '@main/project/catalog-client'
import type { ActivityLog } from '@main/project/activity-log'
import type { CloudBackend } from './cloud-backend'
import { planSync, type SyncSide } from './sync-plan'
import {
  parseActivityQuery,
  parseAlsoRemote,
  parseAssetChanges,
  parseAssetIds,
  parseCloudQuery,
  parseSyncPolicy,
} from './validation'

const DEFAULT_PAGE_SIZE = 50

export type AssetHandlerDeps = {
  catalog: () => AsyncCatalog
  remote: () => RemoteAssetCatalog
  cloud: () => CloudBackend
  /** Removes the file an asset owns, when it owns one. A linked rush is only unlinked. */
  removeFile: (asset: Asset) => Promise<void>
  /** The project the active key opens onto, or null while nothing is authenticated. */
  activeOwnerId: () => string | null
  /** Where a failure goes now that it has somewhere to go. */
  journal: () => ActivityLog
}

const reduced = reducedBy('assets')

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

function offsetFrom(cursor: string | undefined): number {
  if (cursor === undefined || !cursor.startsWith(OFFSET_CURSOR)) return 0

  const offset = Number(cursor.slice(OFFSET_CURSOR.length))
  return Number.isFinite(offset) && offset > 0 ? offset : 0
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
  activeOwnerId,
  journal,
}: AssetHandlerDeps): void {
  handle(CHANNELS.activityRead, (_event, query) => journal().read(parseActivityQuery(query)))
  handle(CHANNELS.assetsUpdate, async (_event, assetId, changes) => {
    const parsed = parseAssetChanges(changes)
    const asset = await catalog().find(assetId)
    if (!asset) throw new Error('asset-not-found')

    const updated: Asset = {
      ...asset,
      ...(parsed.name === undefined ? {} : { name: parsed.name }),
      ...(parsed.tags === undefined ? {} : { tags: [...parsed.tags] }),
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
          detail: describeFailure(error),
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

  handle(CHANNELS.cloudBrowse, (_event, query) =>
    reduced(() => browse(remote(), parseCloudQuery(query))),
  )

  handle(CHANNELS.cloudPull, async (_event, remoteAssetIds) => {
    const ids = parseAssetIds(remoteAssetIds)
    const found = await reduced(() => remote().getBulk(ids))
    const outcomes: SyncOutcome[] = []

    // One at a time, and one outcome each — the same shape a push answers with. A download that
    // fails halfway has already written the ones before it to disk and added their rows; a
    // single rejection would throw that away as far as the caller can tell.
    for (const cloudAsset of found) {
      try {
        await cloud().pull(cloudAsset)
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
          detail: describeFailure(error),
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
          detail: describeFailure(error),
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
