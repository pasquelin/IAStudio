import { useCallback, useEffect, useState } from 'react'
import type { ApiFailure } from '@shared/domain/failure'
import type { UsageCursors, UsageEventPage, UsagePeriod } from '@shared/domain/usage'
import { getBridge } from '@/services/bridge'
import { failureOf, type Answer } from '@/features/usage/answer'

export type EventsState = {
  page: UsageEventPage | null
  loading: boolean
  failure: ApiFailure | null
  more: () => void
}

/** Names one request: the cursors are opaque, so the count of pages read stands in for them. */
type EventRequest = {
  period: UsagePeriod
  cursors: UsageCursors
  page: number
}

/**
 * The activity log, loaded only once its section is mounted and appended page by page.
 *
 * Kept out of `useUsageReport` deliberately: over 120 days this is the one call heavy enough to
 * make opening the window feel slow, and nobody reads it first.
 */
export function useUsageEvents(period: UsagePeriod): EventsState {
  const [requested, setRequested] = useState<EventRequest>({ period, cursors: {}, page: 0 })
  const [answer, setAnswer] = useState<Answer<UsageEventPage> | null>(null)

  // A period change restarts the paging without an effect: cursors read against another period
  // point into a log the user is no longer looking at.
  const request: EventRequest =
    requested.period === period ? requested : { period, cursors: {}, page: 0 }
  const { cursors, page } = request

  useEffect(() => {
    const bridge = getBridge()
    if (!bridge) return

    let live = true

    bridge.provider
      .usageEvents(period, cursors)
      .then(answered => {
        if (!live) return

        setAnswer(held => {
          const kept = held?.period === period ? held.value : null
          const value =
            kept && page > 0
              ? { ...answered, events: [...kept.events, ...answered.events] }
              : answered

          return { period, token: page, value, failure: null }
        })
      })
      .catch((error: unknown) => {
        if (live) setAnswer({ period, token: page, value: null, failure: failureOf(error) })
      })

    return () => {
      live = false
    }
  }, [period, cursors, page])

  const held = answer?.period === period ? answer : null
  // The pages already read stay on screen while the next one loads: emptying the table to show
  // a spinner would throw away what the reader is in the middle of.
  const settled = held !== null && held.token === page
  const next = held?.value?.cursors

  return {
    page: held?.value ?? null,
    loading: !settled,
    failure: settled ? (held.failure ?? null) : null,
    more: useCallback(
      () => next && setRequested({ period, cursors: next, page: page + 1 }),
      [period, next, page],
    ),
  }
}
