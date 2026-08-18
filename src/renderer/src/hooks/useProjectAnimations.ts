import { useCallback } from 'react'
import type { Asset } from '@shared/domain/asset'
import { getBridge } from '@/services/bridge'
import { NO_ASSETS, useCatalogueAssets } from './useCatalogueAssets'

/**
 * The motions a PROJECT files, never the ones the browser happens to be showing — `useAssets` is a
 * scope, paged and narrowed by the space in front, so a library built out of it listed whatever
 * had been browsed. Same reason as `useDerivedTextures` and `useProjectPictures`.
 */
export function useProjectAnimations(): readonly Asset[] {
  const ask = useCallback(
    () => getBridge()?.assets.search({ type: 'animation' }) ?? Promise.resolve(NO_ASSETS),
    [],
  )

  return useCatalogueAssets(ask)
}
