export type FrameCoalesce = {
  schedule: <T>(value: T, apply: (value: T) => void) => void
  /** Runs the pending callback now, so an unmount does not drop the last scrub. */
  flush: () => void
  cancel: () => void
}

/**
 * Collapses bursts (scrubbing, a clock) into one callback per animation frame, with the latest
 * value. A pointermove is faster than a GOP decode; asking for every one paints none of them.
 */
export function createFrameCoalesce(
  raf: typeof requestAnimationFrame = requestAnimationFrame,
  caf: typeof cancelAnimationFrame = cancelAnimationFrame,
): FrameCoalesce {
  let handle = 0
  let pending: (() => void) | null = null

  return {
    schedule: (value, apply) => {
      pending = () => apply(value)
      if (handle) return
      handle = raf(() => {
        handle = 0
        const run = pending
        pending = null
        run?.()
      })
    },
    flush: () => {
      if (!handle) return
      caf(handle)
      handle = 0
      const run = pending
      pending = null
      run?.()
    },
    cancel: () => {
      if (!handle) return
      caf(handle)
      handle = 0
      pending = null
    },
  }
}
