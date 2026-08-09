import { nativeImage } from 'electron'
import { FAVORITE_THUMBNAIL_WIDTH } from '@shared/domain/favorite'

/**
 * A still cut down to what a tile draws, copied rather than referenced: a favourite outlives the
 * project it was taken in, and the picture it stands for is a file that may be moved or deleted.
 *
 * `createThumbnailFromPath` rather than `createFromPath().resize()`: the second decodes, scales
 * and re-encodes on the calling thread — a 4K source is a tenth of a second with every window
 * frozen behind it (CLAUDE.md, invariant 6). This one hands the work to the OS and answers a
 * promise. A kind it cannot read — a mesh, a sound — comes back null, and the shelf draws the
 * glyph of its kind instead.
 */
export async function readFavoriteThumbnail(file: string): Promise<Uint8Array | null> {
  try {
    const image = await nativeImage.createThumbnailFromPath(file, {
      width: FAVORITE_THUMBNAIL_WIDTH,
      height: FAVORITE_THUMBNAIL_WIDTH,
    })

    return image.isEmpty() ? null : image.toPNG()
  } catch {
    return null
  }
}
