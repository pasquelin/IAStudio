/** What drives the frames. Injected so a test can step them rather than wait for a browser. */
export type FrameDriver = {
  start: (frame: (nowMs: number) => void) => void
  stop: () => void
}

/**
 * The browser's own frames.
 *
 * 🛑 Its own module, not `playSession`'s: an exported game needs a rAF driver and nothing else of
 * the studio's play loop, and importing it from there dragged the whole session — and the bridge.
 */
export function animationFrames(): FrameDriver {
  let handle: number | null = null

  return {
    start: frame => {
      const tick = (nowMs: number): void => {
        handle = requestAnimationFrame(tick)
        frame(nowMs)
      }
      handle = requestAnimationFrame(tick)
    },
    stop: () => {
      if (handle !== null) cancelAnimationFrame(handle)
      handle = null
    },
  }
}
