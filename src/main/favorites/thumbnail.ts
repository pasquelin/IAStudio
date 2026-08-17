import { FAVORITE_THUMBNAIL_WIDTH } from '@shared/domain/favorite'
import { renderThumbnail } from '@main/media/renderThumbnail'

/**
 * A still cut down to what a tile draws, copied rather than referenced: a favourite outlives the
 * project it was taken in, and the picture it stands for is a file that may be moved or deleted.
 */
export async function readFavoriteThumbnail(file: string): Promise<Uint8Array | null> {
  return renderThumbnail(file, FAVORITE_THUMBNAIL_WIDTH)
}
