import { nativeImage } from 'electron'
import { FAVORITE_THUMBNAIL_WIDTH } from '@shared/domain/favorite'

const SIZE = { width: FAVORITE_THUMBNAIL_WIDTH, height: FAVORITE_THUMBNAIL_WIDTH }

/**
 * A still cut down to what a tile draws, copied rather than referenced: a favourite outlives the
 * project it was taken in, and the picture it stands for is a file that may be moved or deleted.
 *
 * `createThumbnailFromPath` hands the work to the OS and answers a promise, which is what keeps
 * a 4K source from freezing every window for a tenth of a second (CLAUDE.md, invariant 6). It is
 * declared for macOS and Windows alone, so Linux falls back to decoding here — a pin is one
 * deliberate gesture, and the alternative is a whole platform where recipes have no picture.
 *
 * A kind neither can read — a mesh, a sound — comes back null, and the shelf draws its glyph.
 */
export async function readFavoriteThumbnail(file: string): Promise<Uint8Array | null> {
  try {
    const image = await nativeImage.createThumbnailFromPath(file, SIZE)
    if (!image.isEmpty()) return image.toPNG()
  } catch {
    // Absent on this platform, or a file it declines to read. Both are worth one attempt below.
  }

  return decoded(file)
}

function decoded(file: string): Uint8Array | null {
  const image = nativeImage.createFromPath(file)
  if (image.isEmpty()) return null

  const { width } = image.getSize()
  const resized = width > SIZE.width ? image.resize({ width: SIZE.width, quality: 'good' }) : image
  return resized.toPNG()
}
