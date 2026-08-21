import { useCallback, useEffect, useRef, useState } from 'react'
import { MODEL_IDS_BATCH_LIMIT } from '@shared/domain/model'
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
    },
    [],
  )

  const resolve = useCallback((assetIds: readonly string[]) => {
    for (const id of assetIds) {
      if (!asked.current.has(id)) {
        asked.current.add(id)
        pending.current.add(id)
      }
    }

    if (!pending.current.size || timer.current) return

    timer.current = setTimeout(() => {
      timer.current = null
      // Capped to what the channel accepts; the rest stays pending for the next window.
      const batch = [...pending.current].slice(0, MODEL_IDS_BATCH_LIMIT)
      for (const id of batch) pending.current.delete(id)

      void getBridge()
        ?.provider.modelPreviews(batch)
        .then(found => setUrls(current => ({ ...current, ...found })))
        .catch(() => {
          // Forgotten, not remembered as done: a batch lost to a dropped connection would
          // otherwise leave those cards on their placeholder until the panel is closed.
          for (const id of batch) asked.current.delete(id)
        })
    }, THUMBNAIL_GATHER_MS)
  }, [])

  return { urls, resolve }
}
