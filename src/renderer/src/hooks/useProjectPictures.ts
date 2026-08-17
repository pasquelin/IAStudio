import { useCallback, useMemo } from 'react'
import { isLocalPicture, posterUrl, type Asset, type AssetType } from '@shared/domain/asset'
import type { TextureOption } from '@/design/TextureField/TextureField'
import { getBridge } from '@/services/bridge'
import { NO_ASSETS, useCatalogueAssets } from './useCatalogueAssets'

/**
 * Reads in flight, per question. A mesh's material stacks five slots and the model overrides five
 * more: without this, one selection opened eleven identical queries, and every write to the
 * catalogue replayed all eleven — `better-sqlite3` is synchronous in the main process, so each one
 * is a pause every window pays for (invariant 6). The shelf they replace only ever made one.
 *
 * The same shape `createTextureExtraction` uses on the other side of the wall, and for the same
 * reason: what is already running is shared rather than started again.
 */
const inFlight = new Map<string, Promise<readonly Asset[]>>()

function askOnce(key: string, run: () => Promise<readonly Asset[]>): Promise<readonly Asset[]> {
  const already = inFlight.get(key)
  if (already) return already

  const running = run().finally(() => inFlight.delete(key))
  inFlight.set(key, running)
  return running
}

/**
 * The pictures a PROJECT holds, of the kinds a slot can take — never the ones the browser happens
 * to be showing.
 *
 * That distinction is the whole reason this exists. The slots used to build their list out of
 * `useAssets.items`, which is the shelf's scope: in the 3D space it is narrowed to meshes, so
 * every texture slot of the inspector offered nothing, refused every click, and said nothing
 * about why. « Remplacer un canal » could not be used at all in the space it belongs to.
 *
 * Asked with `location: 'local'` AND filtered by `isLocalPicture`: the query narrows in SQL, the
 * guard is the studio's one answer to "can this be decoded", and nine surfaces answer it the same
 * way. A cloud row offered here would be chosen and then show nothing at all.
 */
export function useProjectPictures(types: readonly AssetType[]): readonly TextureOption[] {
  const ask = useCallback(
    () =>
      askOnce(
        types.join(),
        () =>
          getBridge()?.assets.search({ types, location: 'local' }) ?? Promise.resolve(NO_ASSETS),
      ),
    [types],
  )
  const pictures = useCatalogueAssets(ask)

  return useMemo(
    () =>
      pictures
        // The kinds asked for, held here as well as in SQL — measured on 2026-08-14 at
        // `catalog.ts:611` and `:617`, both clauses are built. It is kept because the cost of
        // the query silently widening is a SKY slot offering every image of the project: the
        // guard below only knows a picture from a mesh, not a sky from a texture.
        .filter(asset => types.includes(asset.type) && isLocalPicture(asset))
        .map(asset => ({ id: asset.id, name: asset.name, url: posterUrl(asset) ?? undefined })),
    [pictures, types],
  )
}
