/** A splash shown for 200 ms flickers, and reads as the opposite of a finished product. */
export const SPLASH_MINIMUM_MS = 700

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
  finish: () => void
}

export function createSplashController(timing: SplashTiming, close: () => void): Splash {
  const startedAt = timing.now()
  let closed = false

  const closeOnce = (): void => {
    if (closed) return
    closed = true
    cancelSafety()
    close()
  }

  const cancelSafety = timing.schedule(closeOnce, SPLASH_TIMEOUT_MS)

  return {
    finish: () => {
      const remaining = SPLASH_MINIMUM_MS - (timing.now() - startedAt)
      if (remaining <= 0) closeOnce()
      else timing.schedule(closeOnce, remaining)
    },
  }
}
