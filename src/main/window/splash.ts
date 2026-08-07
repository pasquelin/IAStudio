/**
 * How long the splash is guaranteed to stay up. A splash shown for 200 ms flickers and reads
 * as the opposite of a finished product; this holds it long enough to be read.
 *
 * It is what the main window waits for, not something that runs beside it — the two are never
 * on screen together. On a slow start it costs nothing, the window not being ready anyway; on
 * a fast one it is the price of showing the mark at every launch.
 */
export const SPLASH_MINIMUM_MS = 1200

/** Without it, a startup that never completes leaves a frameless window nothing can close. */
export const SPLASH_TIMEOUT_MS = 20000

/**
 * Injected so the sequencing is testable without a clock or a window. `schedule` returns its
 * own canceller: the safety timer must be disarmed on a normal close, or it holds the window
 * — and the whole enclosing scope — alive for the twenty seconds the renderer needs the CPU.
 */
export type SplashTiming = {
  now: () => number
  schedule: (callback: () => void, delay: number) => () => void
}

export type Splash = {
  /**
   * Closes the splash once it has had its minimum time, and resolves after it is gone. The
   * caller shows the main window from there, so one never appears over the other.
   */
  finish: () => Promise<void>
}

export function createSplashController(timing: SplashTiming, close: () => void): Splash {
  const startedAt = timing.now()
  let closed = false

  // Assigned below, but declared first: a `schedule` that fired synchronously would reach
  // `closeOnce` before the binding existed, and the ReferenceError would surface inside a
  // timer callback — unattributable, and the splash never closes.
  let cancelSafety = (): void => {}
  let cancelFloor = (): void => {}

  // The safety timeout resolves these too, so a startup that never reports still hands the
  // screen back rather than leaving the caller waiting on a promise that never settles.
  const waiting: Array<() => void> = []

  const closeOnce = (): void => {
    if (closed) return
    closed = true
    cancelSafety()
    cancelFloor()
    close()
    waiting.splice(0).forEach(resolve => resolve())
  }

  cancelSafety = timing.schedule(closeOnce, SPLASH_TIMEOUT_MS)

  return {
    finish: () =>
      new Promise<void>(resolve => {
        if (closed) {
          resolve()
          return
        }

        waiting.push(resolve)

        const remaining = SPLASH_MINIMUM_MS - (timing.now() - startedAt)
        if (remaining <= 0) {
          closeOnce()
          return
        }

        // Replaces any previous floor timer rather than stacking one per call.
        cancelFloor()
        cancelFloor = timing.schedule(closeOnce, remaining)
      }),
  }
}
