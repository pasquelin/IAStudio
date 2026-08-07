import type { AssetType } from '@shared/domain/asset'
import { channelFromScenarioType } from '@shared/domain/texture'
import type { AssetCollector } from '@main/scenario/job-manager'
import type { LocalBackend } from './local-backend'

/**
 * The API describes an asset by its `kind`. Only media belongs in a project: a `json` or
 * `text` output of a captioning job is data about an asset, not an asset.
 */
export function assetTypeOf(kind: string): AssetType | null {
  switch (kind) {
    case 'image':
      return 'image'
    // HDR images are what the skybox space consumes, and nothing else produces them.
    case 'image-hdr':
      return 'skybox'
    case 'video':
      return 'video'
    case 'audio':
      return 'audio'
    case '3d':
      return 'mesh'
    default:
      return null
  }
}

/**
 * `metadataType` is `metadata.type` on the API side — where a PBR channel announces itself —
 * and `parentId` the API asset this one was made from.
 */
export type RemoteAsset = {
  url: string
  kind: string
  metadataType?: string
  parentId?: string
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
      const remote = await retrieve(remoteAssetId)
      const source = channelFromScenarioType(remote.metadataType)
      // A PBR channel lands as a texture whatever its `kind` says: one converter job answers
      // with several pictures, and filing them as plain images would lose the whole material.
      const type = source ? 'texture' : assetTypeOf(remote.kind)
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
