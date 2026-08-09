import { nativeImage } from 'electron'

/** Twice a tile of the home's shelf, which is what a dense display asks for and no more. */
const WIDTH = 264

/**
 * A still cut down to what a tile draws.
 *
 * Copied rather than referenced: a favourite outlives the project it was taken in, and the
 * picture it stands for is a file in a folder that may be moved, renamed or deleted. Cut down
 * because the original can be a 4K frame, and forty-eight of those in `userData` would be a
 * folder nobody asked for.
 *
 * A kind `nativeImage` cannot read — a mesh, a sound — comes back null, and the shelf draws its
 * glyph instead.
 */
export function readFavoriteThumbnail(file: string): Promise<Uint8Array | null> {
  const image = nativeImage.createFromPath(file)
  if (image.isEmpty()) return Promise.resolve(null)

  const { width } = image.getSize()
  const resized = width > WIDTH ? image.resize({ width: WIDTH, quality: 'good' }) : image
  return Promise.resolve(resized.toPNG())
}
