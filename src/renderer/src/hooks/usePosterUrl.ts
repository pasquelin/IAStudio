import { assetUrl, posterUrl } from '@shared/domain/asset'
import { assetsById, useAssets } from '@/stores/assets'

/**
 * The still of an asset a slot names by id alone — stamped, so a ⌘S that overwrote it repaints.
 *
 * `posterUrl` is the one that knows how to stamp, and it needs the asset. A channel, a form
 * field or an inspected map holds a reference and nothing more, so the row is looked up here
 * rather than threaded through every caller.
 *
 * Falls back to the plain URL when the catalogue has no row for the id: the shelf is scoped by
 * type, so a slot can perfectly well name an asset this store is not holding — and a tile that
 * dropped to its icon there would be a picture lost to buy a stamp.
 */
export function usePosterUrl(assetId: string | null | undefined): string | undefined {
  const asset = useAssets(state => (assetId ? assetsById(state).get(assetId) : undefined))
  if (!assetId) return undefined
  return (asset && posterUrl(asset)) ?? assetUrl(assetId)
}
