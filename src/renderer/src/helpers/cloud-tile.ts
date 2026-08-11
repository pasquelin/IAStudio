import { assetCaption } from '@shared/domain/asset'
import { cloudPreviewUrl, type CloudAsset } from '@shared/domain/cloud-asset'
import { assetIcon } from '@/helpers/workspaces'

/**
 * What an asset of the account shows on a tile, wherever the tile is drawn — the library panel,
 * the similar band, the explore band.
 *
 * The thumbnail, never the asset's own URL: that one is signed, and a parameter appended to it
 * invalidates the signature — the CDN answers 403. The width stays with the caller because it is
 * the only thing that really differs: a band of large tiles asks for more pixels than a column
 * two tiles wide, and asking for a 4K to draw a small one is the waste this resizing avoids.
 */
export function cloudTileFace(
  asset: CloudAsset,
  width: number,
): { url: string | undefined; caption: string; fallbackIcon: string } {
  return {
    url: cloudPreviewUrl(asset, { width }) ?? undefined,
    caption: assetCaption(asset),
    fallbackIcon: assetIcon(asset.type),
  }
}
