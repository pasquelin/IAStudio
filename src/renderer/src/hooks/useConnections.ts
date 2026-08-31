import { useEffect } from 'react'
import { useLatest } from './useLatest'

/** What every replicated store hands back: a promise of the way to stop listening. */
type Connect = () => Promise<() => void>

/**
 * Opens a batch of store subscriptions for the life of a window, and closes every one of them.
 *
 * All at once rather than one after another: one of them reads the project off the disk, and made
 * to wait its turn it would hold the eleven others behind it for the whole of a start-up.
 *
 * The `gone` flag is what the two windows that copied `.then(stop => stop())` into their cleanup
 * were missing: unmounted before a connection lands, that one stayed open until it resolved.
 */
export function useConnections(connects: readonly Connect[]): void {
  // Read through a ref: the list is a literal at every call site, and reading it as a dependency
  // would tear every subscription down and hang it again on each paint of the window.
  const latest = useLatest(connects)

  useEffect(() => {
    let gone = false
    const open: (() => void)[] = []

    const hold = async (connect: Connect): Promise<void> => {
      const stop = await connect()
      if (gone) stop()
      else open.push(stop)
    }
    for (const connect of latest.current) void hold(connect)

    return () => {
      gone = true
      for (const stop of open) stop()
    }
  }, [latest])
}
