import { createHash } from 'node:crypto'
import type { ClientOptions } from '@scenario-labs/sdk'
import type { Credentials } from '@main/settings/accounts'

/**
 * What the API accepts per minute and per project, from `workflows-and-apps.md` § Rate Limits.
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
 * Short on purpose. The SDK arms its request timeout *before* calling the transport
 * (`client.js`, `fetchWithTimeout`), so every millisecond spent queueing is taken from the round
 * trip's own budget; and a cancel is an API call too, which nobody wants stuck behind a hundred
 * thumbnails. Past this, waiting is the SDK's business, not ours — see `heldResponse`.
 */
export const MAX_WAIT_MS = 10_000

/** Resolves after `ms`, or rejects if the signal aborts first. */
export type Delay = (ms: number, signal?: AbortSignal) => Promise<void>

export type RateLimiterOptions = {
  /** Monotonic. A wall clock stepping backwards would strand the window in the future. */
  now: () => number
  delay: Delay
  /** Told once when the window closes, and not again until the queue has drained. */
  onSaturated?: () => void
  limit?: number
  windowMs?: number
  maxWaitMs?: number
}

/** Admitted, or held with the wait that would have been needed. */
export type Admission = { admitted: true } | { admitted: false; retryAfterMs: number }

export type RateLimiter = {
  /** Resolves once a request may go out, or says how long it would have taken. */
  acquire: (signal?: AbortSignal) => Promise<Admission>
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
}: RateLimiterOptions): RateLimiter {
  const admitted: number[] = []
  let saturated = false

  const forget = (at: number): void => {
    const live = admitted.findIndex(instant => instant + windowMs > at)
    admitted.splice(0, live === -1 ? admitted.length : live)
  }

  const wait = async (deadline: number, signal?: AbortSignal): Promise<Admission> => {
    for (;;) {
      // Before the slot is taken, not only before the wait: a caller that gave up while queued
      // behind others must not spend a request the API counts against everyone else.
      signal?.throwIfAborted()

      const at = now()
      forget(at)

      const oldest = admitted[0]
      if (oldest === undefined || admitted.length < limit) {
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

  // Acquisitions are chained so the wait is served first-come. It buys order, not priority: a
  // project opening still puts its hundred catalogue reads ahead of the generation asked for
  // next. What it rules out is the opposite — everyone woken by the same expiry racing for the
  // one slot it freed, where the caller who has waited longest can lose indefinitely.
  let turn: Promise<void> = Promise.resolve()
  let queued = 0

  return {
    acquire: signal => {
      // Stamped on arrival, not when the turn comes round: measured from the turn, each waiter
      // would get a fresh budget as the one before it was served, and the ceiling would bound
      // the last hop of the wait instead of the wait.
      const deadline = now() + maxWaitMs

      queued++
      const served = turn.then(() => wait(deadline, signal)).finally(releaseQueued)
      // The chain has to survive a refusal, or one aborted wait deadlocks every later caller.
      turn = served.then(
        () => {},
        () => {},
      )

      return abortable(served, signal)
    },
  }

  function releaseQueued(): void {
    queued--
    // Saturation lasts as long as anyone is queued, not until the next admission: measured per
    // admission, a window that stays full would say so once per request.
    if (queued === 0) saturated = false
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
    const limiter = limiters.of(windowNameOf(credentials))

    return async (input, init) => {
      const admission = await limiter.acquire(init?.signal ?? undefined)
      if (!admission.admitted) return heldResponse(admission.retryAfterMs)

      return await send(input, init)
    }
  }
}

/**
 * Names a window after the account without holding its key, so nothing that could end up in a
 * dump has to. Not the local account id, which a remove-and-re-add renews — the same project
 * would get a second window and twice the quota — and not `owner-scope`, which answers `null`
 * until a listing has come back, exactly when a cold start is bursting.
 */
function windowNameOf(credentials: Credentials): string {
  return createHash('sha256').update(credentials.key).digest('hex')
}
