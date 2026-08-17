import { isLocalPicture, type Asset } from '@shared/domain/asset'
import type { PbrChannel } from '@shared/domain/texture'
import { openDocument } from '@/app/dockviewApi'
import { readyForWriting } from '@/helpers/assetIntents'
import { reportFailure } from '@/services/diagnostics'
import { documentForAsset, useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { placeTextureChannel } from './placeChannel'

/** A picture the extraction gave a channel to — the only kind a material can be built out of. */
export type ChannelTexture = Asset & { map: PbrChannel }

/** Whether this picture says WHICH channel it is. A guard, so the caller keeps the narrowing. */
export function hasChannel(asset: Asset): asset is ChannelTexture {
  return asset.map !== undefined
}

/**
 * Opens a model's own maps as ONE material, in the space that edits materials.
 *
 * Assembled here, at the moment it is asked for, and never written at import: extraction runs on
 * every `.glb` that lands in the project, so a document per imported model would be a folder full
 * of files nobody opened — plus a migration for every project that already holds one.
 *
 * The channels are placed through `placeTextureChannel`, the same command a drop and the shelf
 * menu use: what a channel written from here holds must not differ from one written by hand.
 *
 * A second call comes back to the tab rather than reassembling it — two tabs onto one material
 * are two histories of it, and re-placing the channels would undo whatever was picked since.
 *
 * **Not an `AssetIntent`**, though the table of destinations is where a reader would look for it:
 * `ready` and `takes` are synchronous, and what this needs to answer them — which pictures were
 * derived from the mesh — comes from a catalogue query. Offering it in the shelf menu means a
 * synchronous store of derived textures first.
 */
export async function openModelMaterial(
  model: { id: string; name: string },
  channels: readonly ChannelTexture[],
): Promise<void> {
  /**
   * Asked BEFORE a tab is made, the way `openAsset` asks it: a picture the cloud still holds has
   * no file to decode, and `placeTextureChannel` refuses it one by one. Left to it, the gesture
   * would open a document, fill nothing, and leave an empty tab where a refusal belonged.
   */
  const placeable = channels.filter(isLocalPicture)
  if (placeable.length === 0) {
    return reportFailure('assets.open', model.name, new Error('no channel to assemble'))
  }

  const already = documentForAsset(useDocuments.getState(), model.id, 'texture')
  if (already) return openDocument(already)

  // A document is a file in a project folder, so without one there is nowhere to write it.
  if (!useProject.getState().project) {
    return reportFailure('assets.open', model.name, new Error('no project'))
  }

  const created = await useDocuments
    .getState()
    // The source of this document is a MESH, not a picture — as a scene's is. Nothing reads it
    // that way today: `IO_BY_KIND.texture` has no `writeAsset`, so neither ⌘S nor ⌘⇧S touches the
    // asset. This is the line to read again the day it gains one.
    .create('textures', { title: model.name, sourceAssetId: model.id })

  if (!created) return reportFailure('assets.open', model.name, new Error('no document'))
  if (!(await readyForWriting(created.id))) return

  // One command per channel, so one undo step per channel: a material of five maps takes five ⌘Z
  // to unwind. Stated rather than hidden — folding them into one is a command the texture engine
  // does not have, and `runCoalescing` cannot merge these: each carries the id of ITS channel.
  for (const texture of placeable) placeTextureChannel(created.id, texture, texture.map)
}
