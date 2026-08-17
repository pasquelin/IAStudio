import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { isBeyondPlan, type PlanAccess } from '@shared/domain/plan'

/**
 * Why a model is out of reach, or `undefined` when it is not.
 *
 * A sentence exactly when `isBeyondPlan` is true, which is what lets a caller read `!== undefined`
 * as the predicate itself — the model panel greys a cell on that answer and explains it with the
 * same one, so no cell can end up dimmed with nothing to say why. The three cases of
 * `usePlanRefusal.test.ts` are what keeps the two halves of that in step.
 *
 * The plan is passed in rather than read here because `usePlanAccess` is state per caller, not a
 * cache: a surface holding the plan for something else would end up with two copies of it, and
 * `ModelFamilySettings` — which greys its `<option>`s from one and would take its sentence from
 * the other — is that surface today.
 *
 * The sentence names the plan, not the model, so `useMemo` interpolates it once per plan instead
 * of once per render. Same bracket as `facetsFor` in the model panel, memoised for the same
 * reason: that panel re-renders on every keystroke and every scroll frame.
 */
export function usePlanRefusal(
  plan: PlanAccess | null,
): (requiredLevel: number | undefined) => string | undefined {
  const { t } = useTranslation()

  return useMemo(() => {
    const sentence = plan ? t('models.planLockedHint', { plan: plan.name }) : undefined
    return requiredLevel => (isBeyondPlan(requiredLevel, plan) ? sentence : undefined)
  }, [plan, t])
}
