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
  // The list itself, which the caller memoises: joining it would have to pick a separator no id
  // can hold, and an id carrying one refuses the whole batch — every badge silently reverting to
  // « not on this disk ».
  const wanted = useLatest(remoteIds)

  const read = useCallback((): void => {
    if (remoteIds.length === 0) return

    void assetsByRemoteId(remoteIds).then(twins => {
      // A page landing while a read is in flight leaves two out at once, and the older would
      // take the newer one's place — what is kept is the answer to the question still being asked.
      if (wanted.current === remoteIds) setHeld(twins)
    })
  }, [remoteIds, wanted])

  useEffect(read, [read])
  // The shelf is what says the catalogue moved — its `refresh` writes on every read, whatever
  // scope it holds, so this fires for an asset pulled while the panel is narrowed to meshes.
  useShelfRefresh(read)

  // Derived rather than written back: a panel drawing nothing has nothing to look up, and a
  // `setState` from inside the effect would cascade a render for an answer nobody reads.
  return remoteIds.length === 0 ? NONE : held
}
