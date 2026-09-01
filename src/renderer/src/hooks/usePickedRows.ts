import { useEffect, useState } from 'react'
import type { Asset } from '@shared/domain/asset'
import { assetsAt } from '@/helpers/assetAt'

/** Stable, so a panel with nothing picked is not handed a fresh map per render. */
const NONE: ReadonlyMap<string, Asset> = new Map()

/**
 * The catalogue rows a list of picked project paths names, keyed by path.
 *
 * 🛑 What it holds STAYS while the next question is in flight. Emptied on the way — which is what
 * a list panel wants, and what `useCatalogueAssets` does — every pick in the explorer left the
 * generator with no source for a frame: the operation fell back to text-to-image, the model
 * swapped, and the form cleared the picture it was working from.
 */
export function usePickedRows(paths: readonly string[]): ReadonlyMap<string, Asset> {
  const [held, setHeld] = useState(NONE)

  useEffect(() => {
    let live = true
    // `assetsAt` answers keyed by path and swallows its own refusals: nothing to catch here.
    void assetsAt(paths).then(found => {
      if (live) setHeld(found)
    })

    return () => {
      live = false
    }
  }, [paths])

  return held
}
