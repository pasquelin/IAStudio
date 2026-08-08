import { CHANNELS } from '@shared/ipc'
import { withoutSourcePath, type Asset } from '@shared/domain/asset'
import type { CloudPage, CloudQuery } from '@shared/domain/cloud-asset'
import type { SyncOutcome } from '@shared/domain/sync'
import { handle } from '@main/ipc/handle'
import { log } from '@main/log'
import { describeFailure, failureOf } from '@main/scenario/client'
import type { RemoteAssetCatalog } from '@main/scenario/asset-catalog'
import { filterExpression } from '@main/scenario/filter-expression'
import { remoteTypesFor } from '@main/scenario/remote-types'
import { PAGE_SIZE_MAX } from '@main/scenario/limits'
import type { AsyncCatalog } from '@main/project/catalog-client'
import type { CloudBackend } from './cloud-backend'
import { planSync, type SyncSide } from './sync-plan'
import {
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
}

/**
 * A rejection crossing the boundary carries its message to the renderer, and an SDK message
 * embeds the request that produced it — hence the key. Reduced to a code, exactly as the
 * scenario handlers and the job manager already do.
 */
async function reduced<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  } catch (error) {
    log.error('assets', describeFailure(error))
    throw new Error(failureOf(error), { cause: error })
  }
}

/**
 * Whether this query has to go through the search index rather than the plain listing.
 *
 * Free text and tags are the two things `GET /assets` cannot answer for one's own assets, and
 * search costs a separate quota — so it is taken only when it is the only thing that works.
 */
function needsSearch(query: CloudQuery): boolean {
  return Boolean(query.text) || Boolean(query.tags?.length)
}

async function browse(remote: RemoteAssetCatalog, query: CloudQuery): Promise<CloudPage> {
  const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, PAGE_SIZE_MAX)

  if (needsSearch(query)) {
    const filter = filterExpression(query)
    // The search index paginates by offset where the listing uses an opaque cursor. Both travel
    // back as the same string: the caller hands us whatever the last page gave it.
    const offset = Number(query.cursor ?? '0')
    const page = await remote.search({
      ...(query.text ? { query: query.text } : {}),
      ...(filter ? { filter } : {}),
      limit: pageSize,
      offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    })
    return { assets: page.assets, cursor: page.token }
  }

  const types = remoteTypesFor(query.types)
  const page = await remote.list({
    pageSize,
    ...(query.cursor ? { token: query.cursor } : {}),
    ...(types ? { types } : {}),
    ...(query.collectionId ? { collectionId: query.collectionId } : {}),
  })

  // What the API could not narrow, narrowed here. Asking for pictures sends no `types` filter
  // at all, so a page may hold meshes; a short page is the price, and the cursor still walks.
  const wanted = query.types
  const assets = wanted?.length
    ? page.assets.filter(asset => wanted.includes(asset.type))
    : page.assets

  return { assets, cursor: page.token }
}

function sideOf(asset: Asset): SyncSide {
  return {
    assetId: asset.id,
    hasLocalFile: Boolean(asset.path ?? asset.sourcePath),
    ...(asset.remoteAssetId ? { remoteAssetId: asset.remoteAssetId } : {}),
    ...(asset.remoteOwnerId ? { remoteOwnerId: asset.remoteOwnerId } : {}),
    ...(asset.remoteUpdatedAt ? { remoteUpdatedAt: asset.remoteUpdatedAt } : {}),
    ...(asset.remoteSyncedAt ? { remoteSyncedAt: asset.remoteSyncedAt } : {}),
    ...(asset.localChangedAt ? { localChangedAt: asset.localChangedAt } : {}),
  }
}

export function registerAssetHandlers({
  catalog,
  remote,
  cloud,
  removeFile,
  activeOwnerId,
}: AssetHandlerDeps): void {
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
      }
    }

    return withoutSourcePath(saved)
  })

  handle(CHANNELS.assetsRemove, async (_event, assetIds, alsoRemote) => {
    const ids = parseAssetIds(assetIds)
    const wipeRemote = parseAlsoRemote(alsoRemote)

    const found = (await Promise.all(ids.map(id => catalog().find(id)))).filter(
      asset => asset !== null,
    )

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
    return await reduced(async () => {
      const found = await remote().getBulk(ids)
      const pulled: Asset[] = []
      // One at a time: a pull of forty assets is forty downloads, and firing them together
      // would fight the very concurrency the job manager exists to bound.
      for (const cloudAsset of found) pulled.push(await cloud().pull(cloudAsset))
      return pulled.map(withoutSourcePath)
    })
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
      }
    }

    return outcomes
  })

  handle(CHANNELS.cloudPlan, async (_event, assetIds, policy) => {
    const ids = parseAssetIds(assetIds)
    const found = (await Promise.all(ids.map(id => catalog().find(id)))).filter(
      asset => asset !== null,
    )

    return planSync(found.map(sideOf), parseSyncPolicy(policy), activeOwnerId())
  })
}
