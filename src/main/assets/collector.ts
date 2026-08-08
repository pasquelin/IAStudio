import type { AssetGeneration } from '@shared/domain/asset'
import { assetTypeOfRemote } from '@shared/domain/asset-kind'
import { channelFromScenarioType } from '@shared/domain/texture'
import type { AssetCollector } from '@main/scenario/job-manager'
import type { LocalBackend } from './local-backend'

/**
 * `metadataType` is `metadata.type` on the API side — where a PBR channel announces itself —
 * and `parentId` the API asset this one was made from.
 */
export type RemoteAsset = {
  url: string
  kind: string
  metadataType?: string
  mimeType?: string
  parentId?: string
  ownerId?: string
  updatedAt?: string
  outputIndex?: number
  /** Read off the API asset: the job carries neither the model nor the prompt at its top level. */
  generation?: AssetGeneration
}

export type CollectorDeps = {
  retrieve: (remoteAssetId: string) => Promise<RemoteAsset>
  backend: LocalBackend
  newId: () => string
  /** The local asset an API one became, or `null` when the parent never entered the project. */
  localIdOf: (remoteAssetId: string) => Promise<string | null>
}

export function createAssetCollector({
  retrieve,
  backend,
  newId,
  localIdOf,
}: CollectorDeps): AssetCollector {
  return async (job, remoteAssetIds) => {
    const collected: string[] = []

    // Sequential on purpose: a single generation can return a dozen outputs, and downloading
    // them all at once would fight the very concurrency the JobManager bounds.
    for (const [index, remoteAssetId] of remoteAssetIds.entries()) {
      // Already here, so this is a second pass over the same job — a note that outlived a crash,
      // or a resumed job the studio had in fact already collected. Downloading it again would
      // give the library a duplicate of every output and pay for the transfer twice.
      const held = await localIdOf(remoteAssetId)
      if (held) {
        collected.push(held)
        continue
      }

      const remote = await retrieve(remoteAssetId)
      const source = channelFromScenarioType(remote.metadataType)
      const type = assetTypeOfRemote(remote)
      if (!type) continue

      // What the channels of one texture hang from. Absent when the parent never entered the
      // project — an image uploaded straight to the API, or converted before it was imported.
      const derivedFrom = remote.parentId ? await localIdOf(remote.parentId) : null

      const asset = await backend.importFromUrl({
        id: newId(),
        url: remote.url,
        name: remoteAssetIds.length > 1 ? `${job.label} ${index + 1}` : job.label,
        type,
        jobId: job.id,
        remoteAssetId,
        // One job, one group. The API has no notion of a set, but the seven channels of a PBR
        // pack are exactly the outputs of one conversion — and a lone output is not a group.
        ...(remoteAssetIds.length > 1 ? { groupId: job.id, outputIndex: index } : {}),
        ...(remote.ownerId ? { remoteOwnerId: remote.ownerId } : {}),
        ...(remote.updatedAt ? { remoteUpdatedAt: remote.updatedAt } : {}),
        ...(remote.generation ? { generation: remote.generation } : {}),
        ...(derivedFrom ? { derivedFrom } : {}),
        // Absent rather than false: an ordinary map is not "a map that is not inverted".
        ...(source ? { map: source.channel } : {}),
        ...(source?.inverted ? { mapInverted: true } : {}),
      })

      collected.push(asset.id)
    }

    return collected
  }
}
