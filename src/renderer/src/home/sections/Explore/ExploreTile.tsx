import type { CloudAsset } from '@shared/domain/cloud-asset'
import { MediaTile } from '@/design/MediaTile'
import { cloudTileFace } from '@/helpers/cloudTile'

/**
 * What one column aims for. Wider than a shelf tile: this is the band people browse.
 *
 * Also what a tile asks the CDN to resize to, once the display's density is applied — hence one
 * constant here where there used to be two, the second holding a doubling `cloudTileFace` now
 * works out from the screen it is actually drawn on.
 */
export const COLUMN_WIDTH = 220

/**
 * One published asset. Inert on purpose: it belongs to somebody else, and the studio has no
 * measured way to bring one in — `cloud.pull` is the library's errand, over assets this key
 * owns. Showing a fetch button that may refuse is worse than showing none.
 */
export function ExploreTile({ asset }: { asset: CloudAsset }) {
  return <MediaTile fill {...cloudTileFace(asset, COLUMN_WIDTH)} />
}
