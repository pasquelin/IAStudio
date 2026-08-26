// SPDX-License-Identifier: MIT

import type { World } from './world'

/** Sixty steps a second, constant. A gameplay figure tuned at one rate is wrong at another. */
export const STEP_SECONDS = 1 / 60

/**
 * 🛑 How much of a late frame is simulated at all.
 *
 * A tab in the background, a window dragged, a machine that stalls: the elapsed time comes back as
 * seconds, and an unbounded accumulator then asks for hundreds of steps in one frame — which takes
 * longer than a frame, which makes the next one later still. That is the spiral, and this clamp is
 * the whole of the defence: at most fifteen steps a frame, and the game runs slow rather than
 * freezing.
 */
export const MAX_FRAME_SECONDS = 0.25

export type GameLoop = {
  /**
   * Advances to `nowSeconds` and answers how many steps ran. The first call sets the origin and
   * runs none — there is no elapsed time to catch up on yet.
   */
  advance: (nowSeconds: number) => number
  /** Where the frame sits between two steps, in `[0, 1)`. What interpolation draws from. */
  alpha: () => number
}

export function createGameLoop(world: World, step: number = world.time.step): GameLoop {
  let accumulator = 0
  let last: number | null = null

  return {
    advance: nowSeconds => {
      if (last === null) {
        last = nowSeconds
        return 0
      }

      // Clamped at BOTH ends. A clock that goes backwards — an NTP correction, a replay fed out
      // of order — would otherwise drive the accumulator negative: the world stops stepping until
      // the deficit is repaid, and `alpha` answers behind the last step instead of between two.
      accumulator += Math.max(0, Math.min(nowSeconds - last, MAX_FRAME_SECONDS))
      last = nowSeconds

      let ran = 0
      while (accumulator >= step) {
        world.step(step)
        accumulator -= step
        ran += 1
      }

      world.lateUpdate(accumulator / step)
      return ran
    },

    alpha: () => accumulator / step,
  }
}
