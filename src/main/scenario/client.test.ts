import { APIConnectionError, APIError } from '@scenario-labs/sdk'
import { describe, expect, it, vi } from 'vitest'
import type { Credentials } from '@main/settings/accounts'
import {
  clientFor,
  createClientProvider,
  describeFailure,
  failureOf,
  NotAuthenticatedError,
  testAuthentication,
  type AuthProbe,
  type ClientProviderDeps,
} from './client'
import { createCredentialsWatch } from './credentials-watch'

// Headers are not decoration here: `generate` degrades to a connection error without them,
// which is exactly what a real response never does when it carries a status.
function apiError(status: number, message?: string): unknown {
  return APIError.generate(status, undefined, message, new Headers())
}

function probe(answer: () => Promise<unknown>): AuthProbe {
  return { models: { list: answer } }
}

describe('failure mapping', () => {
  it('maps each status the API can answer to a code the renderer can translate', () => {
    expect(failureOf(apiError(401))).toBe('invalid-credentials')
    expect(failureOf(apiError(403))).toBe('forbidden')
    expect(failureOf(apiError(429))).toBe('rate-limited')
    expect(failureOf(apiError(500))).toBe('server')
    expect(failureOf(apiError(503))).toBe('server')
  })

  it('maps an unreachable API to a network failure', () => {
    expect(failureOf(new APIConnectionError({}))).toBe('network')
  })

  it('falls back to unexpected on anything it does not recognise', () => {
    expect(failureOf(apiError(418))).toBe('unexpected')
    expect(failureOf(new Error('boom'))).toBe('unexpected')
    expect(failureOf('boom')).toBe('unexpected')
  })

  it('never carries the SDK message across the boundary', () => {
    const leaky = apiError(401, 'Authorization: Basic YXBpX2tleTpzM2NyM3Q=')
    expect(JSON.stringify(failureOf(leaky))).not.toContain('YXBpX2tleQ')
  })
})

/**
 * What the main process may write to its own log, and now mirror to a renderer. It is the only
 * thing standing between an SDK message — which embeds the whole request, Authorization header
 * included — and a log file.
 */
describe('failure description', () => {
  it('never carries the SDK message, whatever the status', () => {
    const leaky = apiError(429, 'Authorization: Basic YXBpX2tleTpzM2NyM3Q=')

    expect(describeFailure(leaky)).not.toContain('YXBpX2tleQ')
    expect(describeFailure(leaky)).toContain('429')
  })

  it('keeps the parsed response body, which the credentials never travel in', () => {
    const refused = APIError.generate(
      400,
      { reason: 'sortDirection needs sortBy' },
      '',
      new Headers(),
    )

    expect(describeFailure(refused)).toContain('sortDirection needs sortBy')
  })

  // Not an API error: nothing in it came from a request, so the message is ours to read.
  it('describes a plain error by name and message', () => {
    expect(describeFailure(new TypeError('client.search is undefined'))).toContain(
      'client.search is undefined',
    )
  })

  it('survives something thrown that is not an error at all', () => {
    expect(describeFailure('boom')).toContain('boom')
  })
})

describe('authentication probe', () => {
  it('reports success when the API answers', async () => {
    await expect(testAuthentication(probe(() => Promise.resolve([])))).resolves.toEqual({
      authenticated: true,
    })
  })

  it('turns a rejection into a state rather than an exception', async () => {
    await expect(testAuthentication(probe(() => Promise.reject(apiError(401))))).resolves.toEqual({
      authenticated: false,
      reason: 'invalid-credentials',
    })
  })
})

describe('client provider', () => {
  const credentials: Credentials = { key: 'api_k', secret: 's3cr3t' }
  const jsonHeaders = { 'content-type': 'application/json' }

  /** Nothing is ever sent: the SDK is given a transport that answers without a network. */
  function setup(resolve: () => Credentials | null, overrides: Partial<ClientProviderDeps> = {}) {
    const sent: string[] = []

    const provider = createClientProvider({
      resolve,
      watch: createCredentialsWatch().watch,
      transport: () => input => {
        sent.push(String(input))
        return Promise.resolve(new Response('{"models":[]}', { headers: jsonHeaders }))
      },
      ...overrides,
    })

    return { provider, sent }
  }

  it('has no client when no credentials can be resolved', async () => {
    const { provider } = setup(() => null)

    expect(provider.get()).toBeNull()
    expect(() => provider.require()).toThrow(NotAuthenticatedError)
    await expect(provider.authState()).resolves.toEqual({
      authenticated: false,
      reason: 'missing',
    })
  })

  it('builds the client once and keeps it', () => {
    const resolve = vi.fn(() => credentials)
    const { provider } = setup(resolve)

    expect(provider.get()).toBe(provider.get())
    expect(resolve).toHaveBeenCalledOnce()
  })

  /**
   * Subscribed where it is built, and reachable no other way: a public `invalidate` would let a
   * later caller drop this cache by hand and leave every other one holding the old account's
   * contents — which is the failure the watch exists to make impossible.
   */
  it('rebuilds on an account switch, without being told', () => {
    const watch = createCredentialsWatch()
    const resolve = vi.fn(() => credentials)
    const { provider } = setup(resolve, { watch: watch.watch })

    const first = provider.get()
    watch.changed()

    expect(provider.get()).not.toBe(first)
    expect(resolve).toHaveBeenCalledTimes(2)
  })

  it('builds the transport for the account it resolved, and sends through it', async () => {
    const named: Credentials[] = []
    const sent: string[] = []
    const { provider } = setup(() => credentials, {
      transport: account => {
        named.push(account)
        return input => {
          sent.push(String(input))
          return Promise.resolve(new Response('{"models":[]}', { headers: jsonHeaders }))
        }
      },
    })

    await provider.require().models.list({ pageSize: 1 })

    expect(named).toEqual([credentials])
    expect(sent).toHaveLength(1)
  })

  // Reading usage asks every stored key at once; borrowing the cache would swap the active one.
  it('builds a client for another account without disturbing the cached one', () => {
    const { provider } = setup(() => credentials)
    const active = provider.get()

    const other = clientFor({ key: 'api_other', secret: 'other' }, () => () =>
      Promise.resolve(new Response('{}')),
    )

    expect(other).not.toBe(active)
    expect(provider.get()).toBe(active)
  })
})
