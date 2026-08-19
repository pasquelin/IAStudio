import { useCallback, useMemo } from 'react'
import type { Asset, AssetType } from '@shared/domain/asset'
import { getBridge } from '@/services/bridge'
import { NO_ASSETS, useCatalogueAssets } from './useCatalogueAssets'

/**
 * Everything the CATALOGUE holds of the kinds asked for — local and remote alike, which is the
 * one difference with `useProjectPictureAssets` and the whole reason both exist.
 *
 * A slot's own list is the fast answer and stays local: an id that resolves to nothing shows an
 * empty picture in the inspector. This one answers the long question, where a library asset is a
 * legitimate choice because whoever chooses it is about to have it fetched.
 */
export function useProjectAssets(types: readonly AssetType[]): readonly Asset[] {
  const ask = useCallback(
    () => getBridge()?.assets.search({ types }) ?? Promise.resolve(NO_ASSETS),
    [types],
  )
  const found = useCatalogueAssets(ask)

  // Held here as well as in SQL, for the reason `useProjectPictureAssets` gives: the cost of the
  // query silently widening is a slot offering a kind it cannot load.
  return useMemo(() => found.filter(asset => types.includes(asset.type)), [found, types])
}
