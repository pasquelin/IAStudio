import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PlanAccess } from '@shared/domain/plan'
import { isBeyondPlan } from '@shared/domain/plan'
import { getBridge } from '@/services/bridge'
import { useAccountChange } from '@/hooks/useAccountChange'
import { useSettings } from '@/stores/settings'

/**
 * The account's plan, or `null` while it is unknown — unread, unauthenticated, or refused.
 *
 * `null` is the permissive answer wherever it is read: nothing is greyed out, and a picker
 * behaves exactly as it did before it asked. That is deliberate — see `isBeyondPlan`.
 *
 * Plain state rather than react-query, like `useFamilyModels` beside it: only the main window
 * mounts a `QueryClientProvider`, and this is read from the preferences window too. The caching
 * that matters is the main process's ten minutes; what this avoids is a second replica of it.
 */
export function usePlanAccess(): PlanAccess | null {
  const [access, setAccess] = useState<PlanAccess | null>(null)
  const [attempt, setAttempt] = useState(0)
  const authenticated = useSettings(state => state.auth.authenticated)

  /**
   * The account switch, which `authenticated` cannot report: swapping one key for another leaves
   * that boolean true from end to end, so an effect watching it never re-runs and the window
   * would keep the previous account's plan — greying out models the new one pays for.
   *
   * NOT `activeOwnerId`, which looks like the obvious key and is not: it is learned from the
   * first assets that come back, so it is absent for the whole opening of a session, and gating
   * on it would mean never reading the plan at all. This is the same signal the main process
   * purges its own cache on.
   */
  useAccountChange(
    useCallback(() => {
      setAccess(null)
      setAttempt(count => count + 1)
    }, []),
  )

  useEffect(() => {
    if (!authenticated) return

    let current = true
    void getBridge()
      ?.scenario.plan()
      .then(plan => {
        if (current) setAccess(plan)
      })
      .catch(() => {
        // An unreadable plan refuses nothing. The main process already logged why.
        if (current) setAccess(null)
      })

    return () => {
      current = false
    }
  }, [authenticated, attempt])

  return access
}

/**
 * Why a model is out of reach, or `undefined` when it is not.
 *
 * A sentence exactly when `isBeyondPlan` is true, which is what lets a caller read `!== undefined`
 * as the predicate itself — the model panel greys a cell on that answer and explains it with the
 * same one, so no cell can end up dimmed with nothing to say why. The three cases of
 * `planAccess.test.ts` are what keeps the two halves of that in step.
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
