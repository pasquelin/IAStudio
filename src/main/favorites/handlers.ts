import { CHANNELS } from '@shared/ipc'
import type { Asset } from '@shared/domain/asset'
import { handle } from '@main/ipc/handle'
import { servedFileOf } from '@main/assets/protocol'
import type { ProjectStore } from '@main/project/store'
import type { FavoritesStore } from './store'
import { parseAssetId } from '@main/project/validation'
import { parseFavoriteId } from './validation'

/** Reads a still down to what a tile draws. Injected: it needs a live app to reach `nativeImage`. */
type ThumbnailReader = (file: string) => Promise<Uint8Array | null>

export type FavoriteHandlerDeps = {
  favorites: FavoritesStore
  /** Only what pinning reads: the open project's catalogue, and where its files sit. */
  project: Pick<ProjectStore, 'path' | 'catalog'>
  readThumbnail: ThumbnailReader
  newFavoriteId: () => string
  now: () => string
}

/**
 * Pinning takes an asset id and nothing else: the recipe is read from the catalogue here rather
 * than sent from the window. One less shape to validate at the boundary, and one less way for
 * the shelf to hold a recipe that never produced anything.
 */
export function registerFavoriteHandlers({
  favorites,
  project,
  readThumbnail,
  newFavoriteId,
  now,
}: FavoriteHandlerDeps): void {
  handle(CHANNELS.favoritesList, () => favorites.list())

  handle(CHANNELS.favoritesPin, async (_event, assetId) => {
    const asset = await assetOf(project, parseAssetId(assetId))
    // An import has no recipe to keep, and neither has an asset from a build that recorded none.
    if (!asset?.generation) return favorites.list()

    return favorites.pin({
      id: newFavoriteId(),
      label: asset.generation.modelLabel || asset.name,
      type: asset.type,
      generation: asset.generation,
      pinnedAt: now(),
      thumbnail: await stillOf(project, asset, readThumbnail),
    })
  })

  handle(CHANNELS.favoritesUnpin, (_event, id) => favorites.unpin(parseFavoriteId(id)))
}

async function assetOf(
  project: FavoriteHandlerDeps['project'],
  assetId: string,
): Promise<Asset | null> {
  try {
    return await project.catalog().find(assetId)
  } catch {
    // No project open: nothing to pin, and the shelf is answered with what it already had.
    return null
  }
}

/**
 * A copy of the asset's own picture, sized for a tile. Null for a kind that has none — a sound
 * has no still, and the shelf draws its glyph instead.
 */
async function stillOf(
  project: FavoriteHandlerDeps['project'],
  asset: Asset,
  readThumbnail: ThumbnailReader,
): Promise<Uint8Array | null> {
  try {
    const file = servedFileOf(project.path(), asset)
    return file ? await readThumbnail(file) : null
  } catch {
    return null
  }
}
