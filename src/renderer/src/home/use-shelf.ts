import { useEffect, useState, type DependencyList } from 'react'

/**
 * What a shelf holds, read once when it appears and again when what it depends on changes.
 *
 * Three shelves had written the same eight lines — the cancel flag included — and the policy on
 * failure with them. There is one policy, and it is here: a refusal leaves the initial value, so
 * a shelf with nothing to show takes itself off the page rather than reporting an error nobody
 * asked about. No project open is the ordinary case, not an incident.
 *
 * Deliberately not the query cache the panels use: the home is unmounted the moment a workspace
 * takes over, so coming back IS the refresh, and a cached page would be the last project's.
 */
export function useShelf<T>(
  initial: T,
  read: () => Promise<T> | undefined,
  deps: DependencyList,
): T {
  const [held, setHeld] = useState<T>(initial)

  useEffect(() => {
    let live = true

    void read()
      ?.then(found => {
        if (live) setHeld(found)
      })
      .catch(() => {})

    return () => {
      live = false
    }
    // The caller names what the read depends on; the closure is rebuilt every render, so listing
    // it would run the read on every one of them.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, deps)

  return held
}
