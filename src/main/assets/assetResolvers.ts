import type { Asset } from '@shared/domain/asset'
import { ASSET_HOST, POSTER_HOST, THUMB_HOST } from '@shared/domain/asset'
import { FAVORITE_HOST } from '@shared/domain/favorite'
import { isCatalogueGone } from '@main/project/store'
import { posterFileOf, servedFileOf, type AssetResolvers } from './protocol'

/** What the four hosts read, each behind the narrowest port that answers for it. */
export type AssetResolverDeps = {
  /** The open project's folder, or nothing — every path a host serves is relative to it. */
  projectPath: () => string | null
  /** Rejects rather than answering while a project is being left; that is absorbed here. */
  findAsset: (assetId: string) => Promise<Asset | null>
  favouriteThumbnail: (favoriteId: string) => string | null
  thumbnailOf: (relative: string) => Promise<string | null>
}

// A refusal to answer a LEAVING project is « nothing », not a failure: `projectPath()` is read a
// tick before the catalogue replies, and a project can be left in between. Told apart here
// because only this side can — past it, a rejection is read as a defect.
async function rowOrNothing(read: () => Promise<Asset | null>): Promise<Asset | null> {
  try {
    return await read()
  } catch (error: unknown) {
    if (isCatalogueGone(error)) return null
    throw error
  }
}

/**
 * One resolver per host of the asset scheme, apart from the wiring so that the contract
 * `servedPath` now relies on — a rejection is a defect — is held by something other than reading.
 */
export function createAssetResolvers(deps: AssetResolverDeps): AssetResolvers {
  const fileOf = async (
    assetId: string,
    pick: (projectPath: string, asset: Asset) => string | null,
  ): Promise<string | null> => {
    const root = deps.projectPath()
    if (!root) return null

    const asset = await rowOrNothing(() => deps.findAsset(assetId))
    return asset ? pick(root, asset) : null
  }

  return {
    [ASSET_HOST]: assetId => fileOf(assetId, servedFileOf),
    [POSTER_HOST]: assetId => fileOf(assetId, posterFileOf),
    [FAVORITE_HOST]: favoriteId => Promise.resolve(deps.favouriteThumbnail(favoriteId)),
    // Named by a PATH rather than by an id, alone among the four: the explorer draws files, and
    // most of what it draws the catalogue has never heard of. `assetFilePath` refuses whatever
    // walks out of the project, exactly as it does for a row.
    [THUMB_HOST]: relative => deps.thumbnailOf(relative),
  }
}
