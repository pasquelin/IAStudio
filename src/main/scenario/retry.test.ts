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
    const sleep = vi.fn(async () => {})
    const retry = createRetry({ maxRetries: () => 3, sleep, backoffBaseMs: 10 })

    let attempts = 0
    const action = vi.fn(async () => {
      attempts++
      if (attempts < 3) throw apiError(429)
      return attempts
    })

    await expect(retry(action)).resolves.toBe(3)
    expect(sleep.mock.calls).toEqual([[10], [20]])
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
