/**
 * What a composition is allowed to spend, by the quality the viewport is set to.
 *
 * Pure arithmetic over two words, and it is the only place the trade is decided — an effect that
 * chose its own resolution would make the setting unpredictable, which § 18 forbids more firmly
 * than it asks for speed.
 *
 * **The final render never comes through the cheap end**: `renderFilm` and `captureStill` pass
 * `high`, so what is written out is what the quality setting means at its top.
 */
import type { PostCost } from '@shared/domain/postProcessing'
import type { ViewportQuality } from '@shared/domain/scene'

export type PostBudget = {
  /**
   * How many device pixels one pass pixel covers. `1` draws the chain at the size of the surface;
   * `2` draws it at half and lets the blit scale it back — which halves the SCENE render too,
   * since the scene is drawn into the head of the chain.
   */
  divisor: number
  /** What share of the samples a sampling effect asks for it actually takes. */
  samples: number
}

const FULL: PostBudget = Object.freeze({ divisor: 1, samples: 1 })

/**
 * The budget a plan gets. `heaviest` is the costliest effect it contains — a stack of cheap
 * effects is never downscaled, whatever the setting, because there would be nothing to save.
 */
export function budgetFor(heaviest: PostCost | null, quality: ViewportQuality): PostBudget {
  if (quality === 'high' || heaviest === null) return FULL
  if (quality === 'balanced') return heaviest === 'high' ? { divisor: 1, samples: 0.6 } : FULL
  return heaviest === 'high' ? { divisor: 2, samples: 0.4 } : { divisor: 1, samples: 0.6 }
}

/** A count asked for by a parameter, brought down to what the budget allows. Never below one. */
export function samplesOf(asked: number, budget: PostBudget): number {
  return Math.max(1, Math.round(asked * budget.samples))
}

/** The size a pass chain is built at for a surface of this size. Never zero. */
export function chainSize(
  width: number,
  height: number,
  budget: PostBudget,
): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(width / budget.divisor)),
    height: Math.max(1, Math.round(height / budget.divisor)),
  }
}
