import Scenario, { APIConnectionError, APIError } from '@scenario-labs/sdk'
import type { ApiFailure } from '@shared/domain/failure'
import type { AuthState } from '@shared/domain/settings'
import type { Credentials } from '@main/settings/validation'

/** Thrown when a channel needing the API is reached without usable credentials. */
export class NotAuthenticatedError extends Error {
  constructor() {
    super('not-authenticated')
    this.name = 'NotAuthenticatedError'
  }
}

/**
 * Reduces an SDK error to a code the renderer can translate.
 *
 * The reduction is the point, not a simplification: an `APIError` message embeds the request
 * that produced it, so returning it would walk the API key across the IPC boundary.
 */
export function failureOf(error: unknown): ApiFailure {
  if (error instanceof NotAuthenticatedError) return 'missing'
  if (error instanceof APIConnectionError) return 'network'

  if (error instanceof APIError) {
    const { status } = error
    if (status === 401) return 'invalid-credentials'
    if (status === 403) return 'forbidden'
    if (status === 404) return 'not-found'
    if (status === 429) return 'rate-limited'
    if (status !== undefined && status >= 500) return 'server'
  }

  return 'unexpected'
}

/**
 * What the main process may write to its own console about a failure. The status and the
 * parsed response body are safe — the credentials travel in a request header, never in either
 * — whereas `error.message` embeds the whole request and would put the API key in a log file.
 *
 * Without this, a rejected parameter reaches the user as "an unexpected error occurred" and
 * nothing anywhere says which call the API refused.
 */
export function describeFailure(error: unknown): string {
  if (error instanceof APIError) {
    const body = error.error === undefined ? '' : ` ${JSON.stringify(error.error)}`
    return `HTTP ${error.status ?? '?'}${body}`
  }

  // Not an API error, so nothing in it came from a request: the message is ours and safe, and
  // it is the only thing that says what actually broke.
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ''}`
  }

  return `non-error thrown: ${String(error)}`
}

/**
 * The only thing an authentication probe needs. Narrower than `Scenario` on purpose: it says
 * what the check costs, and it is what makes the failure mapping testable without a network.
 */
export type AuthProbe = {
  models: { list: (params: { pageSize: number }) => Promise<unknown> }
}

/** Cheapest authenticated call the API offers — one model is enough to prove the key works. */
export async function testAuthentication(client: AuthProbe): Promise<AuthState> {
  try {
    await client.models.list({ pageSize: 1 })
    return { authenticated: true }
  } catch (error) {
    return { authenticated: false, reason: failureOf(error) }
  }
}

export type ClientProvider = {
  /** `null` when no credentials are available, from the settings or from `secrets/.env`. */
  get: () => Scenario | null
  /** Same, but throws — every `scenario:*` handler needs a client to do anything at all. */
  require: () => Scenario
  invalidate: () => void
  authState: () => Promise<AuthState>
}

/**
 * Holds the SDK client. Building one is cheap, but it caches nothing useful across
 * credentials, so it is rebuilt lazily and dropped whenever they change.
 */
export function createClientProvider(resolve: () => Credentials | null): ClientProvider {
  let client: Scenario | null = null

  const get = (): Scenario | null => {
    if (client) return client
    const credentials = resolve()
    if (!credentials) return null
    client = new Scenario({ apiKey: credentials.key, apiSecret: credentials.secret })
    return client
  }

  return {
    get,

    require: () => {
      const resolved = get()
      if (!resolved) throw new NotAuthenticatedError()
      return resolved
    },

    invalidate: () => {
      client = null
    },

    authState: async () => {
      const resolved = get()
      return resolved
        ? await testAuthentication(resolved)
        : { authenticated: false, reason: 'missing' }
    },
  }
}
