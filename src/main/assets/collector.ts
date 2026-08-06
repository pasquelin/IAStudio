import type { AssetType } from '@shared/domain/asset'
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

export type RemoteAsset = { url: string; kind: string }

export type CollectorDeps = {
  retrieve: (remoteAssetId: string) => Promise<RemoteAsset>
  backend: LocalBackend
  newId: () => string
}

export function createAssetCollector({ retrieve, backend, newId }: CollectorDeps): AssetCollector {
  return async (job, remoteAssetIds) => {
    const collected: string[] = []

    // Sequential on purpose: a single generation can return a dozen outputs, and downloading
    // them all at once would fight the very concurrency the JobManager bounds.
    for (const [index, remoteAssetId] of remoteAssetIds.entries()) {
      const remote = await retrieve(remoteAssetId)
      const type = assetTypeOf(remote.kind)
      if (!type) continue

      const asset = await backend.importFromUrl({
        id: newId(),
        url: remote.url,
        name: remoteAssetIds.length > 1 ? `${job.label} ${index + 1}` : job.label,
        type,
        jobId: job.id,
        remoteAssetId,
      })

      collected.push(asset.id)
    }

    return collected
  }
}
