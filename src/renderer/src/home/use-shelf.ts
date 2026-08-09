import { useEffect, useState } from 'react'
import { useOnScreen } from '@/hooks/useOnScreen'

/**
 * What a shelf holds, read once when it appears and again when what it depends on changes.
 *
 * Three shelves had written the same eight lines — the cancel flag included — and the policy on
 * failure with them. There is one policy, and it is here: nothing to show leaves the initial
 * value, so a shelf takes itself off the page rather than reporting an error nobody asked about.
 * No project open is the ordinary case, not an incident.
 *
 * Deliberately not the query cache the panels use: the home is unmounted the moment a workspace
 * takes over, so coming back IS the refresh, and a cached page would be the last project's.
 */
export function useShelf<T>(initial: T, read: () => Promise<T> | undefined, source: string): T {
  const [read_, setRead] = useState(source)
  const [held, setHeld] = useState(initial)

  // Emptied as the source changes, during the render rather than after it. What a shelf held
  // belonged to the project or the key it was read under: kept on screen, six counters and a row
  // of tiles go on describing what one has just left — and the tiles stay clickable.
  if (read_ !== source) {
    setRead(source)
    setHeld(initial)
  }

  useEffect(() => {
    let live = true

    void read()
      ?.then(found => {
        if (live) setHeld(found)
      })
      // Emptied here too: a refusal must not leave the previous source's rows behind.
      .catch(() => {
        if (live) setHeld(initial)
      })

    return () => {
      live = false
    }
    // `source` says what the read depends on; the closure is rebuilt every render, so listing it
    // would run the read on every one of them.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [source])

  return held
}

export type DeferredShelf<T> = {
  value: T
  /**
   * Goes on whatever the band draws INSTEAD of its content while it holds nothing — a marker
   * that stays mounted. A band that renders `null` here is a band nothing can ever scroll to,
   * so its read never happens.
   */
  ref: (node: HTMLElement | null) => void
}

/**
 * A shelf that reads nothing until it has been scrolled to.
 *
 * Three things have to line up for that, and they are subtle enough that both bands using it had
 * copied them: the read must answer `undefined` while unseen, `seen` must be part of what the
 * shelf reads under (or the first read is the only one), and a marker must stay on screen in
 * place of the content. Forgetting either of the last two gives a band that never loads — and
 * says nothing about why.
 */
export function useDeferredShelf<T>(
  initial: T,
  read: () => Promise<T> | undefined,
  source: string,
): DeferredShelf<T> {
  const { ref, seen } = useOnScreen()
  const value = useShelf(initial, () => (seen ? read() : undefined), `${source}/${seen}`)

  return { value, ref }
}
