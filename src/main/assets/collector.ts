import type { Asset, AssetGeneration } from '@shared/domain/asset'
import { assetTypeOfRemote, workspaceOfType } from '@shared/domain/assetKind'
import { generatedAssetName } from '@shared/domain/assetName'
import { channelFromProviderType } from '@shared/domain/texture'
import type { WorkspaceId } from '@shared/domain/workspace'
import type { AssetCollector } from '@main/provider/jobManager'
import type { LocalBackend } from './localBackend'

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
  /** The still the API renders for what cannot be shown directly — a mesh, a video, a sound. */
  thumbnailUrl?: string
  /** Read off the API asset: the job carries neither the model nor the prompt at its top level. */
  generation?: AssetGeneration
}

/**
 * A local row an API asset became, as the collector needs to see it.
 *
 * `jobId` is what put it there, and the collector reads it: a row alone does not say whose
 * output it is. `type` too, so a second pass over outputs already collected still names their
 * shelves. `onDisk` because a row is not a file — see the two readings below.
 */
type HeldAsset = Pick<Asset, 'id' | 'jobId' | 'type'> & { onDisk: boolean }

export type CollectorDeps = {
  retrieve: (remoteAssetId: string) => Promise<RemoteAsset>
  backend: LocalBackend
  newId: () => string
  /** The local asset an API one became, or `null` when it never entered the project. */
  heldFor: (remoteAssetId: string) => Promise<HeldAsset | null>
}

export function createAssetCollector({
  retrieve,
  backend,
  newId,
  heldFor,
}: CollectorDeps): AssetCollector {
  /**
   * What the API says about an output, or `null` when it will not say.
   *
   * Only forgiving for an output this job already holds: everywhere else a retrieve that fails is
   * a collection that failed, and swallowing it would report a job as succeeded with a shelf
   * missing.
   */
  const fetchRemote = async (
    remoteAssetId: string,
    mine: HeldAsset | null,
  ): Promise<RemoteAsset | null> => {
    if (!mine) return await retrieve(remoteAssetId)
    return await retrieve(remoteAssetId).catch(() => null)
  }

  return async (job, remoteAssetIds) => {
    const collected: string[] = []
    // A set, and read back as one: the seven channels of a PBR pack are one shelf, not seven.
    const shelves = new Set<WorkspaceId>()

    // Sequential on purpose: a single generation can return a dozen outputs, and downloading
    // them all at once would fight the very concurrency the JobManager bounds.
    for (const [index, remoteAssetId] of remoteAssetIds.entries()) {
      // This job's own output, already here: a second pass over a note that outlived a crash, or
      // a resumed job the studio had in fact collected. Downloading it again would duplicate
      // every output and pay for the transfer twice. Scoped to the job rather than to the remote
      // id alone, or a copy the user had pulled from the account library would be adopted as the
      // output — and it carries neither the prompt behind it, nor its group, nor its label.
      // `onDisk`, because what this branch decides is NOT to download: a row whose file the user
      // has since thrown away would otherwise put a dead id among the outputs of the job, and
      // nothing would ever come back for the bytes. The row is not the file.
      const held = await heldFor(remoteAssetId)
      const mine = held?.jobId === job.id ? held : null

      if (mine?.onDisk) {
        collected.push(mine.id)
        shelves.add(workspaceOfType(mine.type))
        continue
      }

      const remote = await fetchRemote(remoteAssetId, mine)

      // The API no longer answers for an output this job did collect: the row is all that is left
      // of it, and failing the whole job over one output — the other three having just been paid
      // for again — is worse than handing back a row whose file the user removed.
      if (!remote) {
        if (!mine) continue
        collected.push(mine.id)
        shelves.add(workspaceOfType(mine.type))
        continue
      }

      const source = channelFromProviderType(remote.metadataType)
      const type = assetTypeOfRemote(remote)
      if (!type) continue

      // What the channels of one texture hang from. Absent when the parent never entered the
      // project — an image uploaded straight to the API, or converted before it was imported.
      // `onDisk` is not read here: a lineage points at an id, and a row keeps its own whatever
      // became of its file.
      const parent = remote.parentId ? await heldFor(remote.parentId) : null

      const asset = await backend.importFromUrl({
        // The row this job already made for this output, when there is one: `write` finds it,
        // rewrites it in place and — `INSERT OR REPLACE` naming no `missing_at` — undates it. A
        // fresh id would leave the old row beside the new one, both claiming one remote asset and
        // one path, and `findByRemoteId` answers OLDEST first: every later pass would hand back
        // the dead one, and the browser would show the output twice.
        id: mine?.id ?? newId(),
        url: remote.url,
        // What was ASKED for, not which model answered: a shelf named after models is a shelf
        // where everything of one model reads the same. The label is the fallback, and an
        // honest one — an upscale takes a picture and no words.
        name: generatedAssetName({
          ...(remote.generation?.prompt ? { prompt: remote.generation.prompt } : {}),
          label: job.label,
          index,
          total: remoteAssetIds.length,
        }),
        type,
        jobId: job.id,
        remoteAssetId,
        // Provenance, not a twin: pushing is a later, explicit gesture.
        sync: false,
        // One job, one group. The API has no notion of a set, but the seven channels of a PBR
        // pack are exactly the outputs of one conversion — and a lone output is not a group.
        ...(remoteAssetIds.length > 1 ? { groupId: job.id, outputIndex: index } : {}),
        // The same still the library shows, kept for what cannot stand in for itself — a mesh
        // generated here is a tile in the browser a second later, and its own file is not a picture.
        ...(remote.thumbnailUrl ? { thumbnailUrl: remote.thumbnailUrl } : {}),
        ...(remote.ownerId ? { remoteOwnerId: remote.ownerId } : {}),
        ...(remote.updatedAt ? { remoteUpdatedAt: remote.updatedAt } : {}),
        ...(remote.generation ? { generation: remote.generation } : {}),
        ...(parent ? { derivedFrom: parent.id } : {}),
        // Absent rather than false: an ordinary map is not "a map that is not inverted".
        ...(source ? { map: source.channel } : {}),
        ...(source?.inverted ? { mapInverted: true } : {}),
      })

      collected.push(asset.id)
      shelves.add(workspaceOfType(type))
    }

    return { ids: collected, workspaces: [...shelves] }
  }
}
