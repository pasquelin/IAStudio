import { isLocalPicture, type Asset } from '@shared/domain/asset'
import type { PbrChannel } from '@shared/domain/texture'
import { setChannel } from '@/engines/texture/commands'
import { useTextures } from '@/stores/textures'

/**
 * Puts a picture into one channel of a material.
 *
 * Shared by the drop on the viewport and by "send to Textures" in the shelf menu: both mean the
 * same thing, and writing the command twice is how the two would come to disagree about which
 * channel a bare drop fills.
 *
 * Answers whether it landed: a cloud asset has no file to decode yet. What spares the user the
 * silence is `ASSET_INTENTS`, whose `ready` asks the same question before offering the
 * destination at all — this guard is the one that holds when it is called from anywhere else.
 */
export function placeTextureChannel(
  documentId: string,
  asset: Asset,
  channel: PbrChannel = 'baseColor',
): boolean {
  if (!isLocalPicture(asset)) return false

  useTextures.getState().runCommand(
    documentId,
    setChannel(channel, {
      assetId: asset.id,
      origin: 'imported',
      width: asset.width ?? 0,
      height: asset.height ?? 0,
    }),
  )
  return true
}
