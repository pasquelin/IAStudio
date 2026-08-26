/**
 * How a stack becomes a chain of DRAWS. A run of neighbouring per-pixel effects collapses into
 * one pass; a coordinate chunk cannot follow a colour chunk, there being a single fetch in a
 * fused pass, so the run ends there and another begins.
 */
import {
  POST_COSTS,
  POST_EFFECTS,
  type PostCost,
  type PostEffect,
} from '@shared/domain/postProcessing'
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

/** The costliest effect a plan holds, or `null` for a plan that holds none. */
export function heaviestCost(effects: readonly PostEffect[]): PostCost | null {
  let found: PostCost | null = null
  for (const effect of effects) {
    const cost = POST_EFFECTS[effect.effect].cost
    // `POST_COSTS` is ordered lightest first, and is the only place that order is written.
    if (found === null || POST_COSTS.indexOf(cost) > POST_COSTS.indexOf(found)) found = cost
  }
  return found
}

/**
 * Twice the bandwidth on every buffer of every pass, so it is bought rather than taken: only
 * where something works ABOVE white — a bloom thresholds highlights, a defocus spreads them, an
 * opened exposure pulls values back down from above one. On bytes, all three read as clipping.
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
