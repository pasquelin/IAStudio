import { isLocalPicture, type Asset } from '@shared/domain/asset'
import { hasChannel } from '@shared/domain/channelTexture'
import { openDocument } from '@/app/dockviewApi'
import { readyForWriting } from '@/helpers/assetIntents'
import { reportFailure } from '@/services/diagnostics'
import { documentForAsset, useDocuments } from '@/stores/documents'
import { useAssets } from '@/stores/assets'
import { materialStore, useMaterials } from '@/stores/materials'
import { useProject } from '@/stores/project'
import { placeMaterialChannel } from './placeChannel'
import type { UnpackPort } from '@/engines/material/derive/unpackPort'
import { unpackMaterialChannels } from './unpackChannels'

/** Said of a picture no channel claims and nothing knows how to split. */
const UNCLAIMED = new Error('this picture fits in no single channel')

/**
 * Assembles a model's own pictures into ONE material, opens it, and answers its document id — the
 * caller puts that id on the slot the gesture came from. A second call comes back to the tab
 * rather than reassembling it.
 *
 * **Not an `AssetIntent`**: `ready` and `takes` are synchronous, and which pictures came out of
 * the mesh takes a catalogue query. Offering it in the shelf menu means a synchronous store first.
 */
export async function openModelMaterial(
  model: { id: string; name: string },
  pictures: readonly Asset[],
  /** The GPU pass that splits a packed picture. A port for the reason `UnpackPort` is one. */
  unpack?: UnpackPort,
): Promise<string | null> {
  /**
   * Asked BEFORE a tab is made, the way `openAsset` asks it: a picture the cloud still holds has
   * no file to decode, and `placeMaterialChannel` refuses it one by one. Left to it, the gesture
   * would open a document, fill nothing, and leave an empty tab where a refusal belonged.
   */
  const local = pictures.filter(isLocalPicture)
  if (local.length === 0) {
    reportFailure('assets.open', model.name, new Error('no channel to assemble'))
    return null
  }

  const already = documentForAsset(useDocuments.getState(), model.id, 'material')
  if (already) {
    openDocument(already)
    return already.id
  }

  // A document is a file in a project folder, so without one there is nowhere to write it.
  if (!useProject.getState().project) {
    reportFailure('assets.open', model.name, new Error('no project'))
    return null
  }

  const created = await useDocuments
    .getState()
    // The source of this document is a MESH, not a picture — as a scene's is. Nothing reads it
    // that way today: `IO_BY_KIND.material` has no `writeAsset`, so neither ⌘S nor ⌘⇧S touches the
    // asset. This is the line to read again the day it gains one.
    .create('materials', { title: model.name, sourceAssetId: model.id })

  if (!created) {
    reportFailure('assets.open', model.name, new Error('no document'))
    return null
  }
  if (!(await readyForWriting(created.id))) return null

  // One command per channel, so one undo step per channel: a material of five maps takes five ⌘Z
  // to unwind. Stated rather than hidden — folding them into one is a command the texture engine
  // does not have, and `runCoalescing` cannot merge these: each carries the id of ITS channel.
  for (const picture of local) {
    if (hasChannel(picture)) placeMaterialChannel(created.id, picture, picture.map)
  }

  // The packed ones after the plain ones, and one file at a time: each unpacking is a GPU pass
  // and a write, and what it yields already names the channel it belongs in.
  let split = 0
  for (const picture of local.filter(one => !hasChannel(one))) {
    const pieces = await unpackMaterialChannels(picture, unpack)
    // Nothing came out, and the picture is lost to the material in silence otherwise: a project
    // indexed before `packedSlot` existed says only in its NAME what its glTF slot was, and a
    // `clearcoatTexture` names something the studio has no channel for at all.
    if (pieces.length === 0) reportFailure('material.channel', picture.name, UNCLAIMED)

    split += pieces.length
    for (const piece of pieces) {
      if (hasChannel(piece)) placeMaterialChannel(created.id, piece, piece.map)
    }
  }

  // Once, after the whole set — see `unpackMaterialChannels`.
  if (split > 0) await useAssets.getState().refresh()

  // The tab can be closed while the GPU splits a packed picture, and `runCommand` is a no-op on a
  // document the store no longer holds: answering its id anyway would put an EMPTY material on
  // the slot the gesture came from.
  if (!materialStore.hasState(useMaterials.getState(), created.id)) {
    reportFailure('assets.open', model.name, new Error('the material was closed while it filled'))
    return null
  }

  return created.id
}
