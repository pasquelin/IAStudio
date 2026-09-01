import { describe, expect, it, vi } from 'vitest'
import {
  createRateLimiter,
  createRateLimiters,
  asUrgent,
  limitedTransport,
  MAX_WAIT_MS,
  RATE_MARGIN,
  RATE_WINDOW_MS,
  REQUESTS_PER_WINDOW,
  type RateAdmission,
  type RateLimiter,
  type RateLimiterOptions,
} from './rateLimiter'

/**
 * A clock the test moves by hand, and a delay that moves it. Never the real one: a window of a
 * minute would make the suite take a minute, and a limiter tested against a real clock fails on
 * whichever machine is slowest that day.
 */
function clock() {
  let at = 0
  const waited: number[] = []

  const deps: RateLimiterOptions = {
    now: () => at,
    delay: ms => {
      waited.push(ms)
      at += ms
      return Promise.resolve()
    },
    // Nothing held back by default, so a test about the window is about the window alone. The
    // reserve has its own describe, where it is asked for explicitly.
    urgentReserve: 0,
  }

  return { deps, waited, advance: (ms: number) => void (at += ms) }
}

const EFFECTIVE_LIMIT = REQUESTS_PER_WINDOW - RATE_MARGIN

const fill = async (limiter: RateLimiter, count = EFFECTIVE_LIMIT): Promise<void> => {
  for (let call = 0; call < count; call++) await limiter.acquire()
}

describe('rate limiter', () => {
  // The window slides, it does not reset: a full one goes through, and so does the next.
  it('lets a window through, then the one after it', async () => {
    const { deps, waited, advance } = clock()
    const limiter = createRateLimiter(deps)

    await fill(limiter)
    advance(RATE_WINDOW_MS)
    await fill(limiter)

    expect(waited).toEqual([])
  })

  // The studio counts a request when it lets it go, the API when it arrives: the margin is what
  // absorbs the difference rather than spending the last slot of every minute on a 429.
  it('keeps a margin under the limit the API publishes', async () => {
    const { deps } = clock()
    const limiter = createRateLimiter(deps)

    await fill(limiter, EFFECTIVE_LIMIT)

    expect(await limiter.acquire()).toMatchObject({ admitted: false })
    expect(EFFECTIVE_LIMIT).toBeLessThan(REQUESTS_PER_WINDOW)
  })

  it('holds the one over the limit until the oldest leaves the window', async () => {
    const { deps, waited, advance } = clock()
    const limiter = createRateLimiter(deps)

    await fill(limiter)
    advance(RATE_WINDOW_MS - 5_000)
    await limiter.acquire()

    expect(waited).toEqual([5_000])
  })

  it('spends no slot on a caller that gave up, even when a slot was free', async () => {
    const { deps, waited } = clock()
    const limiter = createRateLimiter({ ...deps, limit: 2, windowMs: 1000 })
    const abandoned = new AbortController()
    abandoned.abort()

    await limiter.acquire()
    await expect(limiter.acquire(abandoned.signal)).rejects.toThrow()
    await fill(limiter, 2)

    // Two slots, three admissions: the refused one took none, so exactly one had to wait.
    expect(waited).toEqual([1000])
  })

  /**
   * The refusal `wait` still owes. Every caller abandoned BEFORE asking is now turned away by
   * `acquire`, so a signal that dies once the window is being waited out is the only one left
   * that reaches the check inside the loop — and that check is what keeps it off the free slot.
   */
  it('spends no slot on a caller that gave up while it waited for one', async () => {
    const { deps, waited } = clock()
    const giving = new AbortController()
    const limiter = createRateLimiter({
      ...deps,
      limit: 1,
      windowMs: 1000,
      onSaturated: () => giving.abort(),
    })

    await limiter.acquire()
    await expect(limiter.acquire(giving.signal)).rejects.toThrow()
    await fill(limiter, 1)

    // One window waited, by the abandoned caller. Had it taken the slot its wait freed, the one
    // behind it would have had to wait a second.
    expect(waited).toEqual([1000])
  })

  // One refusal used to leave the chain rejected, and every later caller waited on it for ever.
  it('serves the callers behind an abandoned one', async () => {
    const { deps } = clock()
    const limiter = createRateLimiter({ ...deps, limit: 1, windowMs: 1000 })
    const abandoned = new AbortController()
    abandoned.abort()

    await limiter.acquire()
    const refused = limiter.acquire(abandoned.signal)
    const behind = limiter.acquire()

    await expect(refused).rejects.toThrow()
    await expect(behind).resolves.toMatchObject({ admitted: true })
  })

  /**
   * The slot is safe either way — the signal is checked before one is taken — but without this
   * the caller learns nothing until its turn comes, and the SDK call behind it never settles.
   */
  it('lets go of a caller that gives up while still queued, without waiting for its turn', async () => {
    const { deps } = clock()
    // A delay that never resolves, and a window short enough to be waited on rather than
    // refused outright: without both, the caller ahead lets go and the queue drains at once.
    const limiter = createRateLimiter({
      ...deps,
      limit: 1,
      windowMs: 1000,
      delay: () => new Promise(() => {}),
    })
    const giving = new AbortController()

    await limiter.acquire()
    void limiter.acquire()
    const queued = limiter.acquire(giving.signal)
    giving.abort()

    await expect(queued).rejects.toThrow()
  })

  // The same caller, one step earlier: an `abort` already delivered calls no listener, so the
  // one above cannot catch it and the queue is what the caller would have waited on.
  it('lets go of a caller that had already given up before it asked', async () => {
    const { deps } = clock()
    const limiter = createRateLimiter({
      ...deps,
      limit: 1,
      windowMs: 1000,
      delay: () => new Promise(() => {}),
    })
    const abandoned = new AbortController()
    abandoned.abort()

    await limiter.acquire()
    void limiter.acquire()

    await expect(limiter.acquire(abandoned.signal)).rejects.toThrow()
  })

  it('serves waiting callers in the order they asked', async () => {
    const { deps } = clock()
    const limiter = createRateLimiter({ ...deps, limit: 1 })
    const served: string[] = []

    await limiter.acquire()
    const first = limiter.acquire().then(() => void served.push('first'))
    const second = limiter.acquire().then(() => void served.push('second'))
    await Promise.all([first, second])

    expect(served).toEqual(['first', 'second'])
  })
})

/**
 * The SDK arms its request timeout BEFORE calling the transport, so every millisecond spent
 * queueing is taken from the round trip's own budget. Past a short ceiling the limiter answers
 * instead of holding, and the waiting becomes the SDK's business — which knows how to do it.
 */
describe('what the limiter answers rather than hold', () => {
  it('holds a caller it can serve inside the ceiling', async () => {
    const { deps, waited, advance } = clock()
    const limiter = createRateLimiter({ ...deps, limit: 1 })

    await limiter.acquire()
    advance(RATE_WINDOW_MS - MAX_WAIT_MS)

    expect(await limiter.acquire()).toMatchObject({ admitted: true })
    expect(waited).toEqual([MAX_WAIT_MS])
  })

  it('answers with the wait rather than serve one past the ceiling', async () => {
    const { deps, waited, advance } = clock()
    const limiter = createRateLimiter({ ...deps, limit: 1 })

    await limiter.acquire()
    advance(RATE_WINDOW_MS - MAX_WAIT_MS - 1)

    expect(await limiter.acquire()).toEqual({ admitted: false, retryAfterMs: MAX_WAIT_MS + 1 })
    expect(waited).toEqual([])
  })

  /**
   * The ceiling is stamped on arrival, not when the turn comes round. Measured from the turn,
   * each waiter would get a fresh budget as the one before it was served, and a queue of any
   * depth would be held for as long as it took — the wait the ceiling exists to bound.
   */
  it('bounds the whole queue wait, not the last hop of it', async () => {
    const { deps } = clock()
    const limiter = createRateLimiter({ ...deps, limit: 1, windowMs: 4_000, maxWaitMs: 10_000 })

    await limiter.acquire()
    const admissions = await Promise.all([limiter.acquire(), limiter.acquire(), limiter.acquire()])

    // Served at 4 s and 8 s; the third would land at 12 s, past the 10 s it was promised. Timed
    // from each turn instead, it would have been given a fresh ten seconds and gone through.
    expect(admissions.map(admission => admission.admitted)).toEqual([true, true, false])
  })

  it('says the window closed once, not once per caller queued behind', async () => {
    const { deps } = clock()
    const onSaturated = vi.fn()
    const limiter = createRateLimiter({ ...deps, limit: 1, windowMs: 1000, onSaturated })

    await limiter.acquire()
    await Promise.all([limiter.acquire(), limiter.acquire()])

    expect(onSaturated).toHaveBeenCalledOnce()
  })

  it('says it again once the queue has drained and the window closes anew', async () => {
    const { deps } = clock()
    const onSaturated = vi.fn()
    const limiter = createRateLimiter({ ...deps, limit: 1, windowMs: 1000, onSaturated })

    await limiter.acquire()
    await limiter.acquire()
    await limiter.acquire()

    expect(onSaturated).toHaveBeenCalledTimes(2)
  })
})

/**
 * Cancelling is the one call whose purpose is to stop spending. Held behind two minutes of polls
 * and thumbnails, the request that stops the bill is itself billed for the wait.
 */
describe('what goes ahead of the queue', () => {
  it('serves an urgent caller before the ordinary ones already waiting', async () => {
    const { deps } = clock()
    const limiter = createRateLimiter({ ...deps, limit: 1 })
    const served: string[] = []

    await limiter.acquire()
    const first = limiter.acquire().then(() => void served.push('ordinary first'))
    const second = limiter.acquire().then(() => void served.push('ordinary second'))
    const cancel = limiter.acquire(undefined, 'urgent').then(() => void served.push('urgent'))

    await Promise.all([first, second, cancel])

    // Behind whoever was already being served, ahead of everyone merely waiting.
    expect(served).toEqual(['ordinary first', 'urgent', 'ordinary second'])
  })

  /**
   * Going first is not enough on its own: a full window makes everyone wait for the same expiry,
   * whatever order they wait in. The reserve is the half that makes the priority worth having.
   */
  it('lets an urgent caller take a slot a full window would have refused', async () => {
    const { deps } = clock()
    const limiter = createRateLimiter({ ...deps, limit: 3, urgentReserve: 1 })

    await limiter.acquire()
    await limiter.acquire()

    // Ordinary traffic stops two short of three; the slot left is not for it.
    expect(await limiter.acquire()).toMatchObject({ admitted: false })
    expect(await limiter.acquire(undefined, 'urgent')).toMatchObject({ admitted: true })
  })

  // Reserved is not unlimited: past the ceiling itself, an urgent caller waits like anyone else.
  it('holds an urgent caller once even its reserve is spent', async () => {
    const { deps } = clock()
    const limiter = createRateLimiter({ ...deps, limit: 2, urgentReserve: 1 })

    await limiter.acquire()
    await limiter.acquire(undefined, 'urgent')

    expect(await limiter.acquire(undefined, 'urgent')).toMatchObject({ admitted: false })
  })

  // A reserve wider than the window would otherwise leave ordinary traffic nothing at all.
  it('never reserves away the last slot', async () => {
    const { deps, advance } = clock()
    const limiter = createRateLimiter({ ...deps, limit: 1, urgentReserve: 5 })

    expect(await limiter.acquire()).toMatchObject({ admitted: true })
    advance(RATE_WINDOW_MS)
    expect(await limiter.acquire()).toMatchObject({ admitted: true })
  })
})

describe('one window per account', () => {
  // Rebuilt on every switch, going back and forth would spend two windows on the same project.
  it('gives each account its own, and the same account the same one twice', async () => {
    const { deps, waited, advance } = clock()
    const limiters = createRateLimiters({ ...deps, limit: 1 })

    await limiters.of('account_a').acquire()
    await limiters.of('account_b').acquire()
    advance(RATE_WINDOW_MS - 1000)
    await limiters.of('account_a').acquire()

    expect(waited).toEqual([1000])
  })
})

describe('the transport a client is built on', () => {
  const credentials = { key: 'api_k', secret: 's3cr3t' }
  const answer = (): Promise<Response> => Promise.resolve(new Response('{}'))

  it('takes a slot before the request goes out', async () => {
    const { deps } = clock()
    const sent: string[] = []
    const send = vi.fn((input: string | URL | Request) => {
      sent.push(String(input))
      return answer()
    })

    const transport = limitedTransport(createRateLimiters(deps), send)(credentials)
    await transport('https://api.scenario.com/models')

    expect(sent).toEqual(['https://api.scenario.com/models'])
  })

  /**
   * Through the real limiter, because this is what a stub cannot show: thrown from a transport,
   * a refusal is caught by the SDK, retried and rewrapped as a connection error — a rate limit
   * reaching the user as a network failure. A 429 is a thing the SDK already knows how to wait
   * on, and `retry-after-ms` tells it exactly how long.
   */
  it('answers a held request the way the SDK understands, without sending it', async () => {
    const { deps } = clock()
    const send = vi.fn(answer)

    const transport = limitedTransport(createRateLimiters({ ...deps, limit: 1 }), send)(credentials)
    await transport('https://api.scenario.com/models')
    const held = await transport('https://api.scenario.com/models')

    expect(held.status).toBe(429)
    expect(held.headers.get('retry-after-ms')).toBe(String(RATE_WINDOW_MS))
    // One admission, two calls: the held one never reached the network.
    expect(send).toHaveBeenCalledOnce()
  })

  /**
   * The whole point of `asUrgent`: the transport is the only thing that reads the priority, and
   * everything between it and the caller is the SDK, which offers no way to pass one through.
   * Async context is what survives that crossing — an argument could not.
   */
  it('carries urgency across the SDK, which has no argument for it', async () => {
    const { deps } = clock()
    const send = vi.fn(answer)
    // Two slots, one reserved: ordinary traffic may take exactly one.
    const limiters = createRateLimiters({ ...deps, limit: 2, urgentReserve: 1 })
    const transport = limitedTransport(limiters, send)(credentials)

    await transport('https://api.scenario.com/models')
    expect((await transport('https://api.scenario.com/models')).status).toBe(429)

    // As the SDK calls it: a function that awaits deeper down, not the transport itself.
    const cancel = await asUrgent(async () => await transport('https://api.scenario.com/jobs/j_1'))

    expect(cancel.status).toBe(200)
  })

  // Nothing that could end up in a dump has to hold the key to say which account it belongs to.
  it('names the window without putting the key in it', () => {
    const named: string[] = []
    const admit = (): Promise<RateAdmission> => Promise.resolve({ admitted: true })
    const limiters = {
      of: (account: string) => {
        named.push(account)
        return { acquire: admit }
      },
    }

    limitedTransport(limiters, answer)(credentials)

    expect(named[0]).toHaveLength(64)
    expect(named[0]).not.toContain(credentials.key)
  })
})
