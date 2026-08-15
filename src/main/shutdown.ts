import { log } from '@main/log'

export type ShutdownDeps = {
  /** What is awaited before the process may go. */
  settle: () => Promise<unknown>
  quit: () => void
  /**
   * The tests' way in, and nothing else: production takes the default below. It must reach a
   * TURN of the event loop and never a microtask — a settle with nothing to write resolves in a
   * microtask of the very tick that called `preventDefault`, and Electron drops a quit issued
   * there, so the process outlives the signal that asked it to go.
   */
  yieldTo?: (run: () => void) => void
}

type QuitEvent = { preventDefault: () => void }

/**
 * Holds the quit open until what is still in memory has reached the disk, then lets it through.
 *
 * Electron only waits if it is told to. Without the `preventDefault`, the process is torn down
 * while the round trip to the catalogue thread is still out, and the line this exists to save is
 * the one that goes.
 *
 * `will-quit` rather than `before-quit`, and the difference is the whole point: `before-quit`
 * fires before the windows are asked, so a window that refuses to close — one holding unsaved
 * work — left the journal already flushed and the dictation already disposed for a quit that
 * never happened, and the flag below never let a later quit flush again.
 */
export function createShutdown(deps: ShutdownDeps): (event: QuitEvent) => void {
  const yieldTo = deps.yieldTo ?? setImmediate
  let leaving = false

  return event => {
    if (leaving) return

    event.preventDefault()
    leaving = true
    // Called from inside the chain, not before it: `settle` does synchronous work first — the
    // dictation is disposed there — and a throw from that would escape a `catch` attached to its
    // result, leaving the quit prevented with nothing left to lift it. The studio would then
    // refuse to close for good.
    void Promise.resolve()
      .then(() => deps.settle())
      .catch((error: unknown) =>
        log.error('shutdown', `settling before quit failed: ${String(error)}`),
      )
      .then(() => yieldTo(deps.quit))
  }
}
