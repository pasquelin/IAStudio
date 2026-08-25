import { useCallback, useEffect, useMemo, useRef } from 'react'

export type ForgettableTimeout = {
  /** Schedules `run`, dropping whatever was already waiting. */
  after: (delayMs: number, run: () => void) => void
  forget: () => void
}

/**
 * One waiting thing, cancellable, and gone when the component is — the four lines a dozen
 * surfaces of the renderer had each written for themselves.
 *
 * Both members are stable, so they belong in a dependency list rather than being left out of one.
 */
export function useForgettableTimeout(): ForgettableTimeout {
  const waiting = useRef<number | null>(null)

  const forget = useCallback(() => {
    if (waiting.current !== null) window.clearTimeout(waiting.current)
    waiting.current = null
  }, [])

  const after = useCallback(
    (delayMs: number, run: () => void) => {
      forget()
      waiting.current = window.setTimeout(run, delayMs)
    },
    [forget],
  )

  useEffect(() => forget, [forget])

  return useMemo(() => ({ after, forget }), [after, forget])
}
