import { useCallback } from 'react'
import type { Asset } from '@shared/domain/asset'
import { getBridge } from '@/services/bridge'
import { NO_ASSETS, useCatalogueAssets } from './useCatalogueAssets'

/**
 * The pictures taken OUT of one asset — a model's own maps, above all.
 *
 * Asked of the catalogue rather than filtered out of `useAssets`, like every list this panel
 * draws: that shelf is scoped by the space in front, so a model's own pictures would be there in
 * 3D and gone the moment someone narrowed the browser to meshes. `derivedFrom` is indexed; this
 * is one query per reader, NOT shared through `askOnce`: a refresh landing mid-read would join
 * the promise from BEFORE the write, and this list feeds a button that would then sit on the
 * empty answer — extraction writes its rows during exactly that first read. `useCatalogueAssets`
 * holds the rest — when it is re-read, what makes the
 * panel fill itself after an import, and why a slower answer cannot land on the wrong model.
 */
export function useDerivedTextures(sourceId: string): readonly Asset[] {
  const ask = useCallback(
    () =>
      getBridge()?.assets.search({ derivedFrom: sourceId, type: 'texture' }) ??
      Promise.resolve(NO_ASSETS),
    [sourceId],
  )

  return useCatalogueAssets(ask)
}
