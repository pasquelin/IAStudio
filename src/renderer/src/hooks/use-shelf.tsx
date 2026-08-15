import { useCallback, useEffect, useState } from 'react'

/**
 * Where a shelf's read has got to.
 *
 * `ready` covers "nothing to show" as much as "here it is": no project open, no bridge, an
 * account holding nothing — all ordinary, and none of them worth offering to try again. Only
 * `refused` is, which is the whole reason this type exists.
 */
export type ShelfState = 'reading' | 'refused' | 'ready'

export type Shelf<T> = {
  value: T
  state: ShelfState
  /** Reads again. Safe to hand straight to a button: a second press restarts, never stacks. */
  retry: () => void
}

/**
 * What a shelf holds, read once when it appears and again when what it depends on changes.
 *
 * Three shelves had written the same eight lines — the cancel flag included — and the policy on
 * failure with them. There is one policy, and it is here.
 *
 * It reports the state rather than only the value, because the value cannot carry it: a refusal
 * and an empty answer both arrive as the initial value, and five bands took themselves off the
 * page on either. A band that is refused stays, says so, and offers to try again.
 *
 * Deliberately not the query cache the panels use: the home is unmounted the moment a workspace
 * takes over, so coming back IS the refresh, and a cached page would be the last project's.
 */
export function useShelf<T>(
  initial: T,
  read: () => Promise<T> | undefined,
  source: string,
): Shelf<T> {
  // Part of what the read runs under, so pressing "try again" is a new read rather than a second
  // copy of the one this hook already owns — which is what a band doing it itself had to build.
  const [attempt, setAttempt] = useState(0)
  const key = `${source}/${attempt}`

  const [readKey, setReadKey] = useState(key)
  const [held, setHeld] = useState<{ value: T; state: ShelfState }>({
    value: initial,
    state: 'reading',
  })

  // Emptied as the source changes, during the render rather than after it. What a shelf held
  // belonged to the project or the key it was read under: kept on screen, six counters and a row
  // of tiles go on describing what one has just left — and the tiles stay clickable.
  if (readKey !== key) {
    setReadKey(key)
    setHeld({ value: initial, state: 'reading' })
  }

  useEffect(() => {
    let live = true

    // Wrapped rather than branched on: a read with nothing to ask answers `undefined`, and
    // settling that in the effect body would be the cascading render the linter refuses.
    void Promise.resolve(read())
      .then(found => {
        // `undefined` is no bridge and no project — the ordinary case, and an answer in itself.
        // Left as `reading` it would draw a wait that never ends on every band without a project.
        if (live) setHeld({ value: found ?? initial, state: 'ready' })
      })
      // Emptied here too: a refusal must not leave the previous source's rows behind.
      .catch(() => {
        if (live) setHeld({ value: initial, state: 'refused' })
      })

    return () => {
      live = false
    }
    // `key` says what the read depends on; the closure is rebuilt every render, so listing it
    // would run the read on every one of them. `initial` is the caller's constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [key])

  const retry = useCallback(() => setAttempt(count => count + 1), [])

  return { ...held, retry }
}
