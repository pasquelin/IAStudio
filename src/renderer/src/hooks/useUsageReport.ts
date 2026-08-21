import { useEffect, useState } from 'react'
import type { ApiFailure } from '@shared/domain/failure'
import type { UsagePeriod, UsageReport } from '@shared/domain/usage'
import { getBridge } from '@/services/bridge'
import { failureOf, type Answer } from '@/usage/answer'
import { useReloadKey } from './useReloadKey'

export type UsageState = {
  report: UsageReport | null
  loading: boolean
  failure: ApiFailure | null
  reload: () => void
}

export function useUsageReport(period: UsagePeriod): UsageState {
  const [attempt, reload] = useReloadKey()
  const [answer, setAnswer] = useState<Answer<UsageReport> | null>(null)

  useEffect(() => {
    const bridge = getBridge()
    if (!bridge) return

    let live = true

    bridge.provider
      .usageReport(period)
      .then(value => {
        if (live) setAnswer({ period, token: attempt, value, failure: null })
      })
      .catch((error: unknown) => {
        if (live) setAnswer({ period, token: attempt, value: null, failure: failureOf(error) })
      })

    return () => {
      live = false
    }
  }, [period, attempt])

  const fresh = answer?.period === period && answer.token === attempt ? answer : null

  return {
    report: fresh?.value ?? null,
    loading: fresh === null,
    failure: fresh?.failure ?? null,
    reload,
  }
}
