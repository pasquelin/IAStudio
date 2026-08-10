import { useEffect, useState } from 'react'
import type { PlanAccess } from '@shared/domain/plan'
import { getBridge } from '@/services/bridge'

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
export function usePlanAccess(enabled = true): PlanAccess | null {
  const [access, setAccess] = useState<PlanAccess | null>(null)

  useEffect(() => {
    if (!enabled) return

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
  }, [enabled])

  return access
}
