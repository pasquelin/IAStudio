import { bench, describe } from 'vitest'
import { useTools } from './tools'

/**
 * What re-clamping the tool zones costs the thread that draws them.
 *
 * `useWindowFit` calls `fit` on EVERY resize event, unthrottled, so a window being dragged pays
 * this at the rate the platform fires — against the 16 ms of a frame, shared with the layout and
 * paint that follow. CLAUDE.md, invariant 6.
 *
 * 🛑 **`.tsx`, so it runs under jsdom, and the extension IS the measurement.** Under `node` this
 * read 0.051 ms both ways: with no `localStorage`, `persist` warns on every `set` and the console
 * interception, not the clamp, was what got timed. It also hid the real cost — zustand's `setItem`
 * runs after EVERY `set`, unconditionally, so a resize serialises the layout whether or not
 * anything moved. Measured 2026-08-28 (macOS, M2 Pro), that write included: **0.0012 ms
 * undragged, 0.0019 ms with every length stored**, on a 329-byte payload. Moving this back to a
 * `.ts` would silently restore a number 30× too large.
 */
describe('re-clamping every zone after the window changed size', () => {
  /**
   * `reset` on BOTH, and it is not ceremony: `useTools` is one persisted store, the second bench
   * stores lengths that stay, and `vitest bench` honours no `beforeEach`. Without it the first
   * bench is undragged only because it happens to be declared first.
   */
  bench(
    'a layout nobody has dragged',
    () => {
      useTools.getState().fit(1_600, 1_000)
    },
    { setup: () => useTools.getState().reset() },
  )

  bench(
    'a layout with every length stored',
    () => {
      useTools.getState().fit(1_600, 1_000)
    },
    {
      // Stored OUTSIDE the timing: four `resize` calls inside it measured the dragging, not the
      // clamp, and read four times slower for it.
      setup: () => {
        const tools = useTools.getState()
        tools.reset()
        tools.resize('left', 300, 1_600)
        tools.resize('right', 300, 1_600)
        tools.resize('top', 200, 1_000)
        tools.resize('bottomRight', 240, 1_000)
      },
    },
  )
})
