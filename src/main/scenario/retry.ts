import { failureOf } from './client'

/** Only what a retry can fix. A 401 or a malformed body will fail identically forever. */
export function isRetryable(error: unknown): boolean {
  const failure = failureOf(error)
  return failure === 'rate-limited' || failure === 'server' || failure === 'network'
}

export type RetryOptions = {
  maxRetries: () => number
  sleep: (ms: number) => Promise<void>
  backoffBaseMs?: number
}

/** Doubles per attempt, from this. */
export const DEFAULT_BACKOFF_BASE_MS = 1000

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
}: RetryOptions): Retry {
  return async action => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await action()
      } catch (error) {
        if (attempt >= maxRetries() || !isRetryable(error)) throw error
        await sleep(backoffBaseMs * 2 ** attempt)
      }
    }
  }
}
