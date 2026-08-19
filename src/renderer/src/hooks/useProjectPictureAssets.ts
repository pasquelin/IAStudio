import { useCallback, useMemo } from 'react'
import {
  isLocalPicture,
  type Asset,
  type AssetLocation,
  type AssetType,
} from '@shared/domain/asset'
import { getBridge } from '@/services/bridge'
import { NO_ASSETS, useCatalogueAssets } from './useCatalogueAssets'

/**
 * Reads in flight, per question. A mesh's material stacks five slots and the model overrides five
 * more: without this, one selection opened eleven identical queries, and every write to the
 * catalogue replayed all eleven — `better-sqlite3` is synchronous in the main process, so each one
 * is a pause every window pays for (invariant 6).
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
 * to be showing, `useAssets.items` being the scope the browser is currently asking for.
 *
 * Asked with `location: 'local'` AND filtered by `isLocalPicture`: the query narrows in SQL, the
 * guard is the studio's one answer to "can this be decoded", and a cloud row offered here would be
 * chosen and then show nothing at all.
 */
export function useProjectPictureAssets(
  types: readonly AssetType[],
  /**
   * Whether a CLOUD row may be offered. `false` for a slot's own list, whose id has to resolve to
   * a file on disk; `true` for the browse window, where choosing one is what fetches it.
   */
  remote = false,
): readonly Asset[] {
  const ask = useCallback(
    () =>
      askOnce(`${types.join()}|${remote}`, () => {
        const location: AssetLocation | undefined = remote ? undefined : 'local'
        return getBridge()?.assets.search({ types, location }) ?? Promise.resolve(NO_ASSETS)
      }),
    [types, remote],
  )
  const found = useCatalogueAssets(ask)

  return useMemo(
    // The kinds asked for, held here as well as in SQL — measured on 2026-08-14 at `catalog.ts:611`
    // and `:617`, both clauses are built. Kept because the cost of the query silently widening is a
    // SKY slot offering every image of the project: the guard knows a picture from a mesh, not a
    // sky from a texture.
    //
    // `isLocalPicture` only where the answer must resolve: it is the studio's one answer to "can
    // this be decoded", and it reads a path a cloud row has not got yet.
    () => found.filter(asset => types.includes(asset.type) && (remote || isLocalPicture(asset))),
    [found, types, remote],
  )
}
