import { useCallback } from 'react'
import type { Asset } from '@shared/domain/asset'
import { useCatalogueAssets } from '@/hooks/useCatalogueAssets'
import { getBridge } from '@/services/bridge'

const NOTHING: readonly Asset[] = []

/**
 * The pictures taken OUT of one asset — a model's own maps, above all.
 *
 * Asked of the catalogue rather than filtered out of `useAssets`, like every list this panel
 * draws: that shelf is scoped by the space in front, so a model's own pictures would be there in
 * 3D and gone the moment someone narrowed the browser to meshes. `derivedFrom` is indexed; this
 * is one query, and `useCatalogueAssets` holds the rest — when it is re-read, what makes the
 * panel fill itself after an import, and why a slower answer cannot land on the wrong model.
 */
export function useDerivedTextures(sourceId: string): readonly Asset[] {
  const ask = useCallback(
    () =>
      getBridge()?.assets.search({ derivedFrom: sourceId, type: 'texture' }) ??
      Promise.resolve(NOTHING),
    [sourceId],
  )

  return useCatalogueAssets(ask)
}
