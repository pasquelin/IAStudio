import { useEffect, useState } from 'react'
import { ASSET_PATHS_MAX, type Asset } from '@shared/domain/asset'
import { chunk } from '@shared/collections'
import { orElse } from '@shared/promises'
import { getBridge } from '@/services/bridge'
import { useAssets } from '@/stores/assets'

/** A stable empty answer, so a panel drawing nothing hands the same identity to every memo. */
const NONE: ReadonlyMap<string, Asset> = new Map()

/**
 * Which of these library assets the project already holds, by the library's own id.
 *
 * 🛑 Asked OF the catalogue and not answered from the rows a store happens to be holding. That
 * store pages the catalogue two hundred at a time, and nothing scrolls it any more now that the
 * remote browser lists no local row: a project past two hundred assets would have offered a
 * download of a file already on this disk, and said « not here » under a picture that is.
 *
 * One round trip per page drawn, bounded by `ASSET_PATHS_MAX` and indexed on the column the
 * single-id lookup already uses. Asked again whenever the catalogue moves — a download IS what
 * changes this answer, and the panel would otherwise keep offering what it just fetched.
 */
export function useRemoteTwins(remoteIds: readonly string[]): ReadonlyMap<string, Asset> {
  const [held, setHeld] = useState<ReadonlyMap<string, Asset>>(NONE)
  // The catalogue's own identity: it takes a fresh one on every read, which is exactly when this
  // answer can have changed. Subscribed to rather than polled — nothing else says a pull landed.
  const items = useAssets(state => state.items)
  // Joined rather than passed as the array: `remoteIds` is a fresh list on every render of the
  // panel, and an effect keyed on it would ask again on every frame of a scroll.
  const asking = remoteIds.join(' ')

  useEffect(() => {
    if (asking === '') return

    let live = true
    const ids = asking.split(' ')

    void Promise.all(
      chunk(ids, ASSET_PATHS_MAX).map(
        async batch =>
          await orElse(
            getBridge()?.assets.search({ remoteAssetIds: batch, limit: batch.length }),
            [],
          ),
      ),
    ).then(answers => {
      if (!live) return
      setHeld(
        new Map(
          answers
            .flat()
            .flatMap(asset => (asset.remoteAssetId ? [[asset.remoteAssetId, asset]] : [])),
        ),
      )
    })

    // A page landing while a read is in flight makes that read stale: without this the older
    // answer, arriving second, would take the newer one's place.
    return () => {
      live = false
    }
  }, [asking, items])

  // Derived rather than written back: a panel drawing nothing has nothing to look up, and a
  // `setState` from inside the effect would cascade a render for an answer nobody reads.
  return asking === '' ? NONE : held
}
