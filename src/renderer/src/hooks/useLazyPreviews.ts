import { useCallback, useEffect, useRef, useState } from 'react'
import { chunk } from '@shared/collections'
import { MODEL_IDS_BATCH_LIMIT, type ModelSummary } from '@shared/domain/model'
import { getBridge } from '@/services/bridge'

/** Long enough to gather a flick of the scrollbar, short enough to feel immediate. */
const THUMBNAIL_GATHER_MS = 120

/**
 * Pictures resolved only for the cards that reached the screen. 482 of the 642 public models
 * carry no `thumbnail` and are pictured by one of their example assets instead, whose URL is
 * signed and short-lived — so it is fetched when seen, never with the listing.
 *
 * The ids are gathered before being asked for: scrolling crosses one row at a time, and
 * requesting per row would fire a burst of tiny calls at a single endpoint — the rate-limit
 * trap. One request per pause, and never twice for the same asset.
 */
export function useLazyPreviews() {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const asked = useRef(new Set<string>())
  const pending = useRef(new Set<string>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      // 🛑 Cleared, never merely stopped: a stale handle reads as "a window is already armed", so
      // an instance that outlives its teardown — StrictMode and HMR do that — asks for nothing
      // ever again. What is still gathered stays gathered; the next `resolve` arms a new window.
      timer.current = null
    },
    [],
  )

  const resolve = useCallback((assetIds: readonly string[]) => {
    for (const id of assetIds) if (!asked.current.has(id)) pending.current.add(id)

    if (!pending.current.size || timer.current) return

    timer.current = setTimeout(() => {
      timer.current = null
      // 🛑 Cut into what the channel accepts, and ALL of it sent. Keeping the remainder back for
      // "the next window" armed no such window: past the cap those ids stayed asked-for and
      // unasked, and their cards kept an empty plate for the life of the panel.
      const wanted = [...pending.current]
      pending.current.clear()
      // Marked HERE, where the request actually leaves — one meaning for `asked`, so nothing has
      // to reconcile "gathered" against "sent" on the way out.
      for (const id of wanted) asked.current.add(id)

      for (const batch of chunk(wanted, MODEL_IDS_BATCH_LIMIT)) {
        void getBridge()
          ?.provider.modelPreviews(batch)
          .then(found => setUrls(current => ({ ...current, ...found })))
          .catch(() => {
            // Forgotten, not remembered as done: a batch lost to a dropped connection would
            // otherwise leave those cards on their placeholder until the panel is closed.
            for (const id of batch) asked.current.delete(id)
          })
      }
    }, THUMBNAIL_GATHER_MS)
  }, [])

  // What a model's picture IS, written once: two panels drew it and had already drifted apart.
  const pictureOf = useCallback(
    (model: ModelSummary): string | undefined =>
      model.thumbnail ?? (model.previewAssetId ? urls[model.previewAssetId] : undefined),
    [urls],
  )

  const resolveFor = useCallback(
    (models: readonly ModelSummary[]) =>
      resolve(
        models.flatMap(one => (!one.thumbnail && one.previewAssetId ? [one.previewAssetId] : [])),
      ),
    [resolve],
  )

  return { pictureOf, resolveFor }
}
