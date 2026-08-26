/**
 * How a stack becomes a chain of DRAWS — the arithmetic that decides what the composition costs.
 *
 * A run of neighbouring per-pixel effects collapses into one pass; everything else keeps its own.
 * The rule that bounds a run is the one `fuseShader` explains: there is a single texture fetch in
 * a fused pass, so a coordinate chunk cannot follow a colour chunk. When one does, the run ends
 * and another begins — two draws where three would have been, rather than a wrong picture.
 *
 * Pure over plain data, so what a look actually costs is asserted under vitest.
 */
import { POST_EFFECTS, type PostCost, type PostEffect } from '@shared/domain/postProcessing'
import type { FusableKind } from './fuseShader'

export type PostStep =
  { kind: 'fused'; effects: readonly PostEffect[] } | { kind: 'own'; effect: PostEffect }

/** Answers which half of a fused pass an effect belongs to, or `null` when it cannot fuse. */
export type FusableLookup = (effect: PostEffect) => FusableKind | null

export function stepsOf(
  effects: readonly PostEffect[],
  fusableKind: FusableLookup,
): readonly PostStep[] {
  const steps: PostStep[] = []
  let run: PostEffect[] | null = null
  let fetched = false

  for (const effect of effects) {
    const kind = fusableKind(effect)
    if (kind === null) {
      run = null
      fetched = false
      steps.push({ kind: 'own', effect })
      continue
    }

    // A coordinate chunk arriving after a colour chunk needs a fetch the open run has spent.
    if (run !== null && kind === 'uv' && fetched) run = null

    if (run === null) {
      run = [effect]
      fetched = false
      steps.push({ kind: 'fused', effects: run })
    } else {
      run.push(effect)
    }

    if (kind === 'colour') fetched = true
  }

  return steps
}

const COST_RANK: Record<PostCost, number> = { low: 0, medium: 1, high: 2 }

/** The costliest effect a plan holds, or `null` for a plan that holds none. */
export function heaviestCost(effects: readonly PostEffect[]): PostCost | null {
  let found: PostCost | null = null
  for (const effect of effects) {
    const cost = POST_EFFECTS[effect.effect].cost
    if (found === null || COST_RANK[cost] > COST_RANK[found]) found = cost
  }
  return found
}

/**
 * Whether the chain has to carry high dynamic range.
 *
 * A half-float chain is twice the bandwidth of a byte one, on every buffer of every pass — it is
 * bought, never taken by default. It is bought when something in the chain works ABOVE white:
 * a bloom thresholds highlights, a defocus spreads them, and a grade that opens the exposure
 * pulls values back down from above one. On a byte chain all three read as flat clipping.
 */
export function wantsFloat(effects: readonly PostEffect[], toneMapped: boolean): boolean {
  if (toneMapped) return true
  return effects.some(
    effect =>
      effect.effect === 'bloom' ||
      effect.effect === 'dof' ||
      (effect.effect === 'colorGrading' && Number(effect.params.exposure ?? 0) !== 0),
  )
}
