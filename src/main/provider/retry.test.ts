import { APIConnectionError, APIError } from '@scenario-labs/sdk'
import { describe, expect, it, vi } from 'vitest'
import { createRetry, isRetryable } from './retry'

// Headers are not decoration here: `generate` degrades to a connection error without them,
// which would make every status below look retryable for the wrong reason.
function apiError(status: number): unknown {
  return APIError.generate(status, undefined, undefined, new Headers())
}

describe('isRetryable', () => {
  it('retries what waiting can fix', () => {
    expect(isRetryable(apiError(429))).toBe(true)
    expect(isRetryable(apiError(500))).toBe(true)
    expect(isRetryable(new APIConnectionError({}))).toBe(true)
  })

  it('gives up on what will fail identically forever', () => {
    expect(isRetryable(apiError(401))).toBe(false)
    expect(isRetryable(apiError(403))).toBe(false)
    expect(isRetryable(apiError(404))).toBe(false)
    expect(isRetryable(new Error('boom'))).toBe(false)
  })
})

describe('createRetry', () => {
  it('returns the first success without sleeping', async () => {
    const sleep = vi.fn(async () => {})
    const retry = createRetry({ maxRetries: () => 3, sleep })

    await expect(retry(async () => 'done')).resolves.toBe('done')
    expect(sleep).not.toHaveBeenCalled()
  })

  it('doubles the wait between attempts', async () => {
    const sleep = vi.fn(async (_ms: number) => {})
    const retry = createRetry({ maxRetries: () => 3, sleep, backoffBaseMs: 10 })

    let attempts = 0
    const action = vi.fn(async () => {
      attempts++
      if (attempts < 3) throw apiError(429)
      return attempts
    })

    await expect(retry(action)).resolves.toBe(3)
    // Doubling, spread over ±20 %: an exact sequence would forbid the jitter, and without it
    // three jobs that take a 429 together come back together — the burst the backoff is for.
    const waits = sleep.mock.calls.map(([ms]) => ms)
    expect(waits).toHaveLength(2)
    expect(waits[0]).toBeGreaterThanOrEqual(8)
    expect(waits[0]).toBeLessThanOrEqual(12)
    expect(waits[1]).toBeGreaterThanOrEqual(16)
    expect(waits[1]).toBeLessThanOrEqual(24)
  })

  // Ten retries is what the preferences allow, and an uncapped doubling makes the last wait
  // alone eight and a half minutes — with the job holding a concurrency slot throughout.
  it('caps one wait however many attempts have failed', async () => {
    const sleep = vi.fn(async (_ms: number) => {})
    const retry = createRetry({ maxRetries: () => 10, sleep, backoffBaseMs: 1000 })

    const action = vi.fn(async () => {
      throw apiError(429)
    })

    await expect(retry(action)).rejects.toThrow()
    for (const [ms] of sleep.mock.calls) expect(ms).toBeLessThanOrEqual(36_000)
  })

  it('rethrows what no retry can fix, without waiting first', async () => {
    const sleep = vi.fn(async () => {})
    const retry = createRetry({ maxRetries: () => 5, sleep })
    const action = vi.fn(async () => {
      throw apiError(401)
    })

    await expect(retry(action)).rejects.toThrow()
    expect(action).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('gives up once the budget is spent', async () => {
    const sleep = vi.fn(async () => {})
    const retry = createRetry({ maxRetries: () => 2, sleep, backoffBaseMs: 1 })
    const action = vi.fn(async () => {
      throw apiError(500)
    })

    await expect(retry(action)).rejects.toThrow()
    expect(action).toHaveBeenCalledTimes(3)
  })

  // The budget comes from the preferences: work queued before the user lowered it must not keep
  // the old one for its lifetime.
  it('reads the budget again on every attempt', async () => {
    const sleep = vi.fn(async () => {})
    let budget = 5
    const retry = createRetry({ maxRetries: () => budget, sleep, backoffBaseMs: 1 })
    const action = vi.fn(async () => {
      budget = 0
      throw apiError(500)
    })

    await expect(retry(action)).rejects.toThrow()
    expect(action).toHaveBeenCalledTimes(1)
  })
})

describe('a service that names its own delay', () => {
  it('waits exactly as long as it was asked to, rather than doubling', async () => {
    const waits: number[] = []
    const retry = createRetry({
      maxRetries: () => 2,
      sleep: ms => {
        waits.push(ms)
        return Promise.resolve()
      },
      retryable: () => true,
      delayFor: () => 3000,
    })

    await retry(async () => {
      if (waits.length < 1) throw new Error('too many tasks')
      return 'done'
    })

    expect(waits).toEqual([3000])
  })

  /** A job holds its slot in the concurrency bound while it waits — an hour would block the queue. */
  it('comes back early rather than hold the queue for as long as it was asked', async () => {
    const waits: number[] = []
    const retry = createRetry({
      maxRetries: () => 1,
      sleep: ms => {
        waits.push(ms)
        return Promise.resolve()
      },
      retryable: () => true,
      delayFor: () => 3_600_000,
    })

    await retry(async () => (waits.length < 1 ? Promise.reject(new Error('wait')) : 'done'))

    expect(waits).toEqual([60_000])
  })

  it('falls back to the doubling where the service said nothing', async () => {
    const waits: number[] = []
    const retry = createRetry({
      maxRetries: () => 1,
      backoffBaseMs: 1000,
      sleep: ms => {
        waits.push(ms)
        return Promise.resolve()
      },
      retryable: () => true,
      delayFor: () => null,
    })

    await retry(async () => (waits.length < 1 ? Promise.reject(new Error('nope')) : 'done'))

    expect(waits[0]).toBeGreaterThan(0)
    expect(waits[0]).toBeLessThanOrEqual(1200)
  })
})
