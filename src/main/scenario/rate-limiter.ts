import { AsyncLocalStorage } from 'node:async_hooks'
import type { ClientOptions } from '@scenario-labs/sdk'
import { accountFingerprint, type Credentials } from '@main/settings/accounts'

/**
 * What the API accepts per minute and per project, as its reference documents it.
 * A different quantity from the batch sizes of `limits.ts` and from the job concurrency of the
 * `JobManager`: ten concurrent jobs polling every two seconds spend three hundred of these on
 * their own, before the catalogue, the previews and the assist queue ask for any.
 */
export const REQUESTS_PER_WINDOW = 100

export const RATE_WINDOW_MS = 60_000

/**
 * Slots held back from the published limit.
 *
 * The studio counts a request when it lets it go; the API counts it when it arrives. A hundred
 * admitted just under the wire can reach the server bunched behind a slow uplink and land in the
 * same server-side minute as the next window's first — a 429 for a client that did everything
 * right. The margin is what absorbs that drift.
 */
export const RATE_MARGIN = 5

/**
 * How long a request may be held inside the transport before the limiter answers instead.
 *
 * Short on purpose: the SDK arms its request timeout *before* calling the transport (`client.js`,
 * `fetchWithTimeout`), so every millisecond spent queueing is taken from the round trip's own
 * budget. Past this, waiting is the SDK's business, not ours — see `heldResponse`. What keeps a
 * cancellation out of the queue is `URGENT_RESERVE`, not this.
 */
export const MAX_WAIT_MS = 10_000

/**
 * Slots of the window that only an urgent request may take.
 *
 * Going first in the queue is not enough on its own: a saturated window makes everyone wait for
 * the same expiry, whatever order they wait in. What a cancellation needs is a slot that the
 * hundred thumbnails ahead of it could not have taken in the first place.
 */
const URGENT_RESERVE = 5

/**
 * What ordinary traffic may spend in a window: the published limit, less the drift margin, less
 * the slots a cancellation keeps for itself. Exported because a caller sizing its own continuous
 * demand has to measure it against something — see `POLL_REQUESTS_PER_MINUTE`.
 */
export const ORDINARY_REQUESTS_PER_WINDOW = REQUESTS_PER_WINDOW - RATE_MARGIN - URGENT_RESERVE

/**
 * What a request is worth against the others waiting.
 *
 * `urgent` is for cancelling: it is the one call whose whole purpose is to stop spending, so
 * queueing it behind two minutes of polls bills the user for the wait. Everything else is
 * ordinary, and nothing else should become urgent without the same argument.
 */
type Priority = 'ordinary' | 'urgent'

/** Resolves after `ms`, or rejects if the signal aborts first. */
type Delay = (ms: number, signal?: AbortSignal) => Promise<void>

export type RateLimiterOptions = {
  /** Monotonic. A wall clock stepping backwards would strand the window in the future. */
  now: () => number
  delay: Delay
  /** Told once when the window closes, and not again until the queue has drained. */
  onSaturated?: () => void
  limit?: number
  windowMs?: number
  maxWaitMs?: number
  urgentReserve?: number
}

/** Admitted, or held with the wait that would have been needed. */
export type Admission = { admitted: true } | { admitted: false; retryAfterMs: number }

export type RateLimiter = {
  /** Resolves once a request may go out, or says how long it would have taken. */
  acquire: (signal?: AbortSignal, priority?: Priority) => Promise<Admission>
}

const ADMITTED: Admission = { admitted: true }

/**
 * A sliding window over the instants requests were admitted at.
 *
 * A window rather than a token bucket refilling one slot every 600 ms: the API counts requests
 * per minute, so a studio that has been idle may legitimately spend a hundred at once — which is
 * what opening a project does — and a bucket would spread that burst over a minute for nothing.
 */
export function createRateLimiter({
  now,
  delay,
  onSaturated,
  limit = REQUESTS_PER_WINDOW - RATE_MARGIN,
  windowMs = RATE_WINDOW_MS,
  maxWaitMs = MAX_WAIT_MS,
  urgentReserve = URGENT_RESERVE,
}: RateLimiterOptions): RateLimiter {
  const admitted: number[] = []
  let saturated = false

  const forget = (at: number): void => {
    const live = admitted.findIndex(instant => instant + windowMs > at)
    admitted.splice(0, live === -1 ? admitted.length : live)
  }

  /** Ordinary traffic stops short of the ceiling; what it leaves behind belongs to a cancel. */
  const ordinaryCeiling = limit - urgentReserve

  const wait = async (
    deadline: number,
    priority: Priority,
    signal?: AbortSignal,
  ): Promise<Admission> => {
    const ceiling = priority === 'urgent' ? limit : ordinaryCeiling

    for (;;) {
      // Before the slot is taken, not only before the wait: a caller that gave up while queued
      // behind others must not spend a request the API counts against everyone else.
      signal?.throwIfAborted()

      const at = now()
      forget(at)

      const oldest = admitted[0]
      if (oldest === undefined || admitted.length < ceiling) {
        admitted.push(at)
        return ADMITTED
      }

      const until = oldest + windowMs
      if (until > deadline) return { admitted: false, retryAfterMs: until - at }

      if (!saturated) {
        saturated = true
        onSaturated?.()
      }

      await delay(until - at, signal)
    }
  }

  // Acquisitions are served one at a time, first-come within a priority. Serializing rules out
  // the race where everyone woken by the same expiry fights for the one slot it freed and the
  // caller who has waited longest can lose indefinitely; the two lanes rule out the other half,
  // where a project opening puts its hundred catalogue reads ahead of a cancellation.
  const waiting: Record<Priority, (() => void)[]> = { urgent: [], ordinary: [] }
  let serving = false

  const takeTurn = (priority: Priority): Promise<void> => {
    if (!serving) {
      serving = true
      return Promise.resolve()
    }

    return new Promise(resolve => waiting[priority].push(resolve))
  }

  const passTurn = (): void => {
    const next = waiting.urgent.shift() ?? waiting.ordinary.shift()
    serving = next !== undefined
    next?.()
  }

  return {
    acquire: (signal, priority = 'ordinary') => {
      // Stamped on arrival, not when the turn comes round: measured from the turn, each waiter
      // would get a fresh budget as the one before it was served, and the ceiling would bound
      // the last hop of the wait instead of the wait.
      const deadline = now() + maxWaitMs

      const served = takeTurn(priority)
        .then(() => wait(deadline, priority, signal))
        // Whatever the outcome, or one aborted wait deadlocks every later caller.
        .finally(() => {
          passTurn()
          // Saturation lasts as long as anyone is queued, not until the next admission: measured
          // per admission, a window that stays full would say so once per request.
          if (!serving) saturated = false
        })

      return abortable(served, signal)
    },
  }
}

/**
 * The same promise, but refusing as soon as the caller gives up rather than when its turn comes.
 *
 * The slot is safe either way — `wait` checks the signal before taking one — but the caller is
 * not: without this, an abandoned request stays pending until the queue reaches it, and the SDK
 * call behind it never settles. Invariant 6 asks a long task to be cancellable, not eventually
 * cancellable.
 */
function abortable(served: Promise<Admission>, signal?: AbortSignal): Promise<Admission> {
  if (!signal) return served

  return new Promise((resolve, reject) => {
    const giveUp = (): void => reject(signal.reason)
    signal.addEventListener('abort', giveUp, { once: true })
    served.then(resolve, reject).finally(() => signal.removeEventListener('abort', giveUp))
  })
}

export type RateLimiters = {
  /** The limiter of one account, kept: the window outlives the client that is rebuilt over it. */
  of: (account: string) => RateLimiter
}

/**
 * One window per account, because the quota is per project and a key carries its own project
 * (`owner-scope.ts`). Shared, they would halve what each account may spend; reset on every
 * switch, going back and forth would spend two hundred a minute on one of them.
 *
 * The converse is not enforced, and cannot be here: two keys of the *same* project would get a
 * window each. Only `owner-scope` knows they are one, and it knows it too late — it answers
 * `null` until a listing has come back, which is exactly when a cold start is bursting.
 */
export function createRateLimiters(options: RateLimiterOptions): RateLimiters {
  const limiters = new Map<string, RateLimiter>()

  return {
    of: account => {
      const limiter = limiters.get(account) ?? createRateLimiter(options)
      limiters.set(account, limiter)
      return limiter
    },
  }
}

type Fetch = NonNullable<ClientOptions['fetch']>

// Free only because Electron 43 runs Node 24, whose `AsyncContextFrame` replaced the process-wide
// promise hook: measured at 10 ns a read, and no cost at all to the awaits it does not touch. On
// Node 23 and below, merely constructing this tripled the cost of every await in the main process.
const scope = new AsyncLocalStorage<Priority>()

/**
 * Runs an API call as urgent: it goes ahead of ordinary traffic and may take a slot ordinary
 * traffic cannot.
 *
 * Carried in async context rather than passed as an argument, because the only thing that reads
 * it is the transport, and everything between here and there is the SDK — which offers no way
 * through. Reserved for cancelling, whose whole point is to stop spending: made to wait behind
 * two minutes of polls, the request that stops the bill is itself billed for the wait.
 */
export async function asUrgent<T>(action: () => Promise<T>): Promise<T> {
  return await scope.run('urgent', action)
}

/**
 * What a held request answers, in the only language the SDK listens to.
 *
 * Throwing from the transport does not work: the SDK catches whatever comes out, retries it, and
 * rewraps it as `APIConnectionError` — so a rate limit would reach the user as a network failure
 * on a healthy connection. A 429 is retried too, but knowingly: `retry-after-ms` is honoured to
 * the millisecond, so the wait happens outside the request's own timeout, and what surfaces if
 * it persists is an `APIError` that `failureOf` reads as `rate-limited`.
 */
function heldResponse(retryAfterMs: number): Response {
  return new Response(JSON.stringify({ message: "held by the studio's own rate limit" }), {
    status: 429,
    headers: { 'content-type': 'application/json', 'retry-after-ms': String(retryAfterMs) },
  })
}

/**
 * The transport a client is built on: every API request waits its turn before going out.
 *
 * On the transport rather than on `reducedBy`, which wraps two families of IPC handlers and
 * misses the largest consumer of all — the `JobManager` polls straight through its runner, and
 * the SDK paginates and retries inside a single call. The SDK's own multipart uploads go
 * straight to S3 with the global `fetch` and are not counted, which is correct: they are not
 * API requests.
 */
export function limitedTransport(limiters: RateLimiters, send: Fetch) {
  return (credentials: Credentials): Fetch => {
    const limiter = limiters.of(accountFingerprint(credentials))

    return async (input, init) => {
      const admission = await limiter.acquire(init?.signal ?? undefined, scope.getStore())
      if (!admission.admitted) return heldResponse(admission.retryAfterMs)

      return await send(input, init)
    }
  }
}
