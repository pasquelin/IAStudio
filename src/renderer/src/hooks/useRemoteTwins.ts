import { useCallback, useEffect, useState } from 'react'
import type { Asset } from '@shared/domain/asset'
import { assetsByRemoteId } from '@/helpers/assetAt'
import { useLatest } from './useLatest'
import { useShelfRefresh } from './useShelfRefresh'

/** A stable empty answer, so a panel drawing nothing hands the same identity to every memo. */
const NONE: ReadonlyMap<string, Asset> = new Map()

/**
 * Which of these library assets the project already holds, by the library's own id.
 *
 * 🛑 Asked OF the catalogue, never from `useAssets.items`: that store pages two hundred at a time
 * and nothing scrolls it now, and a selector on it re-renders two hundred tiles per catalogue read.
 */
export function useRemoteTwins(remoteIds: readonly string[]): ReadonlyMap<string, Asset> {
  const [held, setHeld] = useState<ReadonlyMap<string, Asset>>(NONE)
  // Joined rather than the array: it is a fresh list on every render of the panel, and an effect
  // keyed on it would ask again on every frame of a scroll.
  const asking = remoteIds.join(' ')
  const wanted = useLatest(asking)

  const read = useCallback((): void => {
    if (asking === '') return

    void assetsByRemoteId(asking.split(' ')).then(twins => {
      // A page landing while a read is in flight leaves two out at once, and the older would
      // take the newer one's place — what is kept is the answer to the question still being asked.
      if (wanted.current === asking) setHeld(twins)
    })
  }, [asking, wanted])

  useEffect(read, [read])
  // The shelf is what says the catalogue moved — its `refresh` writes on every read, whatever
  // scope it holds, so this fires for an asset pulled while the panel is narrowed to meshes.
  useShelfRefresh(read)

  return held
}
