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
 * Answers whether it landed. A cloud asset has no file to decode yet, and saying so lets the
 * caller offer to fetch it instead of silently doing nothing.
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
