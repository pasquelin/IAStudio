import { nativeImage } from 'electron'
import { probePng } from './png'

/**
 * The longest side a `Thumbnails/thumbnail.png` may have. The OpenRaster spec says at most
 * 256 × 256, and a container that writes its flatten there instead weighs twice its own picture.
 */
const ORA_THUMBNAIL_SIDE = 256

/**
 * A picture reduced to what the container's thumbnail may hold, or `undefined` when there is
 * nothing to reduce.
 *
 * Here rather than in `openRasterFile`, which stays pure so it can be tested without an app:
 * `nativeImage` needs a live Electron, and this is the one step of writing a container that does.
 *
 * `undefined` rather than the picture itself on failure — the entry is optional, and a thumbnail
 * bigger than the spec allows is worse than none.
 */
export function oraThumbnailOf(png: Uint8Array): Uint8Array | undefined {
  const probe = probePng(png)
  const width = probe?.width
  const height = probe?.height
  if (width === undefined || height === undefined) return undefined

  // Already small enough: the bytes are the thumbnail, and re-encoding them would only lose.
  if (width <= ORA_THUMBNAIL_SIDE && height <= ORA_THUMBNAIL_SIDE) return png

  const image = nativeImage.createFromBuffer(Buffer.from(png))
  if (image.isEmpty()) return undefined

  // One side, so the other follows the ratio: a thumbnail stretched to a square says the picture
  // is one.
  const side = width >= height ? { width: ORA_THUMBNAIL_SIDE } : { height: ORA_THUMBNAIL_SIDE }
  const reduced = image.resize({ ...side, quality: 'good' }).toPNG()

  return reduced.byteLength > 0 ? new Uint8Array(reduced) : undefined
}
