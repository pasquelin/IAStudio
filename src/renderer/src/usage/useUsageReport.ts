import { useCallback, useEffect, useState } from 'react'
import type { ApiFailure } from '@shared/domain/failure'
import type { UsageCursors, UsageEventPage, UsagePeriod, UsageReport } from '@shared/domain/usage'
import { getBridge } from '@/services/bridge'

export type UsageState = {
  report: UsageReport | null
  loading: boolean
  failure: ApiFailure | null
  reload: () => void
}

/** An IPC rejection carries the reduced code as its message — see `reducedBy`. */
function failureOf(error: unknown): ApiFailure {
  const message = error instanceof Error ? error.message : ''
  return message.includes('missing') ? 'missing' : 'unexpected'
}

/**
 * What one answer was for. Kept beside the answer rather than reset on the way out: an answer
 * for a period the user has since left is stale, and stamping it is what lets `loading` be
 * derived instead of raised and lowered around the call.
 */
type Answer<T> = {
  period: UsagePeriod
  /** What was asked for beyond the period — the reload count, or the page offset. */
  token: number
  value: T | null
  failure: ApiFailure | null
}

export function useUsageReport(period: UsagePeriod): UsageState {
  const [attempt, setAttempt] = useState(0)
  const [answer, setAnswer] = useState<Answer<UsageReport> | null>(null)

  useEffect(() => {
    const bridge = getBridge()
    if (!bridge) return

    let current = true

    bridge.scenario
      .usageReport(period)
      .then(value => {
        if (current) setAnswer({ period, token: attempt, value, failure: null })
      })
      .catch((error: unknown) => {
        if (current) setAnswer({ period, token: attempt, value: null, failure: failureOf(error) })
      })

    return () => {
      current = false
    }
  }, [period, attempt])

  const fresh = answer?.period === period && answer.token === attempt ? answer : null

  return {
    report: fresh?.value ?? null,
    loading: fresh === null,
    failure: fresh?.failure ?? null,
    reload: useCallback(() => setAttempt(count => count + 1), []),
  }
}

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

    let current = true

    bridge.scenario
      .usageEvents(period, cursors)
      .then(answered => {
        if (!current) return

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
        if (current) setAnswer({ period, token: page, value: null, failure: failureOf(error) })
      })

    return () => {
      current = false
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
