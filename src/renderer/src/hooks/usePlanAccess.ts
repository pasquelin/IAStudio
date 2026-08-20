import { useCallback, useEffect, useState } from 'react'
import type { PlanAccess } from '@shared/domain/plan'
import { getBridge } from '@/services/bridge'
import { useSettings } from '@/stores/settings'
import { useAccountChange } from './useAccountChange'
import { useReloadKey } from './useReloadKey'

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
  const [attempt, again] = useReloadKey()
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
      again()
    }, [again]),
  )

  useEffect(() => {
    if (!authenticated) return

    let live = true
    void getBridge()
      ?.provider.plan()
      .then(plan => {
        if (live) setAccess(plan)
      })
      .catch(() => {
        // An unreadable plan refuses nothing. The main process already logged why.
        if (live) setAccess(null)
      })

    return () => {
      live = false
    }
  }, [authenticated, attempt])

  return access
}
