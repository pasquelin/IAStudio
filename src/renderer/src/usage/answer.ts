import type { ApiFailure } from '@shared/domain/failure'
import type { UsagePeriod } from '@shared/domain/usage'

/** An IPC rejection carries the reduced code as its message — see `reducedBy`. */
export function failureOf(error: unknown): ApiFailure {
  const message = error instanceof Error ? error.message : ''
  return message.includes('missing') ? 'missing' : 'unexpected'
}

/**
 * What one answer was for. Kept beside the answer rather than reset on the way out: an answer
 * for a period the user has since left is stale, and stamping it is what lets `loading` be
 * derived instead of raised and lowered around the call.
 *
 * Here rather than in either hook: `useUsageReport` and `useUsageEvents` both stamp their answer
 * this way, and a type both halves share belongs to neither of them.
 */
export type Answer<T> = {
  period: UsagePeriod
  /** What was asked for beyond the period — the reload count, or the page offset. */
  token: number
  value: T | null
  failure: ApiFailure | null
}
