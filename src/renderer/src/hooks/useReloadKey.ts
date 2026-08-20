import { useCallback, useState } from 'react'

/**
 * A key that changes every time it is asked to, and the ask.
 *
 * Five surfaces had written the same counter to re-run a read nothing else can invalidate — a
 * folder walk after a batch of file gestures, a shelf's "try again", a usage report, a plan
 * re-read after an account switch. What they need is a value to put in a dependency list, not a
 * count of anything: the number is never read for itself.
 *
 * A tuple, so the caller names the ask what its own surface calls it — `retry` on a band that
 * failed, `reload` on a list that moved underneath.
 */
export function useReloadKey(): [number, () => void] {
  const [key, setKey] = useState(0)

  return [key, useCallback(() => setKey(count => count + 1), [])]
}
