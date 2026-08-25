import { useCallback, useMemo } from 'react'
import { isLocalPicture, type Asset, type AssetType } from '@shared/domain/asset'
import { getBridge } from '@/services/bridge'
import { askOnce, NO_ASSETS, useCatalogueAssets } from './useCatalogueAssets'

/**
 * The pictures a PROJECT holds, of the kinds a slot can take — never the ones the browser happens
 * to be showing, `useAssets.items` being the scope the browser is currently asking for.
 *
 * Asked with `location: 'local'` AND filtered by `isLocalPicture`: the query narrows in SQL, the
 * guard is the studio's one answer to "can this be decoded", and a cloud row offered here would be
 * chosen and then show nothing at all.
 */
export function useProjectPictureAssets(types: readonly AssetType[]): readonly Asset[] {
  const ask = useCallback(
    () =>
      askOnce(types.join(), () => {
        return (
          getBridge()?.assets.search({ types, location: 'local' }) ?? Promise.resolve(NO_ASSETS)
        )
      }),
    [types],
  )
  const found = useCatalogueAssets(ask)

  return useMemo(
    // The kinds asked for, held here as well as in SQL — measured on 2026-08-14 at `catalog.ts:611`
    // and `:617`, both clauses are built. Kept because the cost of the query silently widening is a
    // SKY slot offering every image of the project: the guard knows a picture from a mesh, not a
    // sky from a texture.
    () => found.filter(asset => types.includes(asset.type) && isLocalPicture(asset)),
    [found, types],
  )
}
