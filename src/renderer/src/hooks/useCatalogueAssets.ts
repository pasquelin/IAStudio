import { useCallback, useEffect, useState } from 'react'
import type { Asset } from '@shared/domain/asset'
import { useShelfRefresh } from './useShelfRefresh'

/**
 * What an ask answers when there is nothing to ask — no bridge, no project. One frozen array for
 * the three hooks that need it: a fresh `[]` per read is a fresh identity, which re-renders every
 * list through a whole import.
 */
export const NO_ASSETS: readonly Asset[] = []

/**
 * One question put to the catalogue. **Must be stable** — a `useCallback` at the call site, whose
 * dependencies are what the question is made of: this hook takes its identity as the question's
 * own, and a fresh arrow per render would re-read the catalogue on every frame of a gizmo drag.
 */
export type CatalogueAsk = () => Promise<readonly Asset[]>

/**
 * The stamp as much as the id: an id does not move when ⌘S rewrites the picture behind it, and a
 * tile draws its URL off `localChangedAt` (`posterUrl`) precisely so an edit repaints. Keying on
 * the id alone left the inspector showing the picture from before it was painted.
 */
const sameRows = (held: readonly Asset[], found: readonly Asset[]): boolean =>
  held.length === found.length &&
  held.every(
    (asset, index) =>
      asset.id === found[index]?.id && asset.localChangedAt === found[index]?.localChangedAt,
  )

/**
 * What the CATALOGUE holds, for a panel that must not read the shelf.
 *
 * `useAssets.items` is a SCOPE — the kinds the browser is currently asking for, set by whichever
 * space is in front — and its own store says the rule out loud: a way of browsing is not a
 * statement about what a project holds. A panel that built a list of pictures out of it offered
 * none at all in the 3D space, where the shelf is narrowed to meshes.
 *
 * Read again on every catalogue read, which is what makes such a list fill itself: an import
 * writes with nobody waiting on it. Not `useShelf`, whose `retry` empties what it holds and
 * starts over: every write to the catalogue would blink the rows, and an import is twenty of them.
 *
 * What is held is keyed by the question it answers, so a slower read cannot dress a panel with
 * the answer to the question before it — two are out at once on the read after a selection moves.
 */
export function useCatalogueAssets(ask: CatalogueAsk): readonly Asset[] {
  const [held, setHeld] = useState<{ ask: CatalogueAsk; assets: readonly Asset[] }>({
    ask,
    assets: NO_ASSETS,
  })

  // Emptied during the render rather than after it, as `useShelf` does: left on screen, the rows
  // of the previous question stay clickable, and they act on ITS assets.
  if (held.ask !== ask) setHeld({ ask, assets: NO_ASSETS })

  const read = useCallback((): void => {
    void ask()
      .then(found =>
        setHeld(current =>
          // Same rows, same object: the shelf is re-read on every write to the catalogue, and a
          // fresh array each time would re-render the list through a whole import.
          current.ask !== ask || sameRows(current.assets, found) ? current : { ask, assets: found },
        ),
      )
      // No project open: the catalogue throws, and no asset is the honest answer.
      .catch(() => undefined)
  }, [ask])

  useEffect(read, [read])
  // The shelf is what says the catalogue moved — its `refresh` writes a fresh `items` on every
  // read, whatever its scope holds, so this fires for a picture imported while the browser is
  // narrowed to meshes. What is scoped is what that store SHOWS, not when it is re-read.
  useShelfRefresh(read)

  return held.assets
}

/**
 * Reads in flight, per question. A mesh's material stacks five slots and the model overrides five
 * more: without this, one selection opened eleven identical queries, and every write to the
 * catalogue replayed all eleven — `better-sqlite3` is synchronous in the main process, so each one
 * is a pause every window pays for (invariant 6).
 */
const inFlight = new Map<string, Promise<readonly Asset[]>>()

export function askOnce(
  key: string,
  run: () => Promise<readonly Asset[]>,
): Promise<readonly Asset[]> {
  const already = inFlight.get(key)
  if (already) return already

  const running = run().finally(() => inFlight.delete(key))
  inFlight.set(key, running)
  return running
}
