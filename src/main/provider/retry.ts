import { apiFailureOf } from './client'

/** Only what a retry can fix. A 401 or a malformed body will fail identically forever. */
export function isRetryable(error: unknown): boolean {
  const failure = apiFailureOf(error)
  return failure === 'rate-limited' || failure === 'server' || failure === 'network'
}

export type RetryOptions = {
  maxRetries: () => number
  sleep: (ms: number) => Promise<void>
  backoffBaseMs?: number
  /** What a retry can fix here. Defaults to the Scenario SDK's own reading of a failure. */
  retryable?: (error: unknown) => boolean
  /**
   * How long the SERVICE asked to be left alone for, in milliseconds — a `Retry-After` header.
   * `null` where it said nothing, which is when the doubling below decides instead.
   *
   * Honoured rather than averaged with the backoff: a service that names a delay knows when its
   * window reopens, and coming back earlier is a second refusal with certainty.
   */
  delayFor?: (error: unknown) => number | null
}

/** Doubles per attempt, from this. */
export const DEFAULT_BACKOFF_BASE_MS = 1000

/**
 * The ceiling one wait may reach. `maxRetries` goes up to ten in the preferences, where an
 * uncapped doubling makes the last wait alone eight and a half minutes — and the job holds its
 * slot in the concurrency bound for all of it, blocking the queue behind it.
 */
const BACKOFF_CEILING_MS = 30_000

/**
 * The longest a service may ask to be left alone for.
 *
 * A job holds its place in the concurrency bound while it waits, so an hour asked for by a
 * header would block the queue behind it for an hour. Past this the studio comes back early and
 * takes the refusal, which is the outcome that at least keeps the queue moving.
 */
const ASKED_CEILING_MS = 60_000

/** How far a wait may be pulled either side of its nominal length. */
const JITTER = 0.2

/**
 * Capped, and spread. Without the spread, three jobs that take a 429 together come back together
 * — the very burst the backoff exists to break up.
 */
function backoffDelay(baseMs: number, attempt: number): number {
  const nominal = Math.min(baseMs * 2 ** attempt, BACKOFF_CEILING_MS)
  return Math.round(nominal * (1 - JITTER + 2 * JITTER * Math.random()))
}

export type Retry = <T>(action: () => Promise<T>) => Promise<T>

/**
 * Retries what a retry can fix, backing off exponentially.
 *
 * `maxRetries` is read per attempt rather than captured: it comes from the preferences, and a
 * job queued before the user lowered it would otherwise keep the old budget for its lifetime.
 */
export function createRetry({
  maxRetries,
  sleep,
  backoffBaseMs = DEFAULT_BACKOFF_BASE_MS,
  retryable = isRetryable,
  delayFor,
}: RetryOptions): Retry {
  return async action => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await action()
      } catch (error) {
        if (attempt >= maxRetries() || !retryable(error)) throw error

        const asked = delayFor?.(error) ?? null
        await sleep(
          asked === null ? backoffDelay(backoffBaseMs, attempt) : Math.min(asked, ASKED_CEILING_MS),
        )
      }
    }
  }
}
