import { useCallback } from 'react'
import { ASSET_SEARCH_LIMIT_MAX, type Asset } from '@shared/domain/asset'
import { getBridge } from '@/services/bridge'
import { NO_ASSETS, useCatalogueAssets } from './useCatalogueAssets'

/**
 * The motions a PROJECT files, never the ones the browser happens to be showing — `useAssets` is a
 * scope, paged and narrowed by the space in front, so a library built out of it listed whatever
 * had been browsed. Same reason as `useDerivedTextures` and `useProjectPictures`.
 */
export function useProjectAnimations(): readonly Asset[] {
  // Spelt out because leaving it off is not "no bound": the main answers `DEFAULT_LIMIT`, which is
  // 200 — the very page size of the shelf this hook exists to stop reading.
  const ask = useCallback(
    () =>
      getBridge()?.assets.search({ type: 'animation', limit: ASSET_SEARCH_LIMIT_MAX }) ??
      Promise.resolve(NO_ASSETS),
    [],
  )

  return useCatalogueAssets(ask)
}
