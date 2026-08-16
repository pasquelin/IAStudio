import { useEffect } from 'react'

/**
 * A frame loop that runs while something is running, and not one frame longer.
 *
 * The two surfaces that draw what is being heard — the output meter and the spectrum — spelt the
 * same eight lines: the guard, the recursive `requestAnimationFrame`, the cancel on cleanup. A
 * loop left animating over a stopped montage is sixty wake-ups a second to paint the same
 * picture, and that is the mistake this exists to make hard to repeat.
 *
 * `step` is handed the stamp in SECONDS, which is what the arithmetic behind both of them reads:
 * `meterFrom` falls in decibels per second, and milliseconds would empty its bar a thousand times
 * too fast. It must be stable — a `useCallback` — or the loop is torn down and started again on
 * every render of the host, which the playhead causes on every frame.
 */
export function useFrameLoop(running: boolean, step: (seconds: number) => void) {
  useEffect(() => {
    if (!running) return

    let frame = requestAnimationFrame(function tick(stamp: number) {
      step(stamp / 1000)
      frame = requestAnimationFrame(tick)
    })

    return () => cancelAnimationFrame(frame)
  }, [running, step])
}
