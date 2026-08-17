import { APIError } from '@scenario-labs/sdk'
import { describe, expect, it, vi } from 'vitest'
import type { Credentials } from '@main/settings/accounts'
import type { KeyedAccount } from '@main/settings/store'
import { createAssistQueue, type AssistQueue } from './assistQueue'
import { createUsageReader, priceOf, type UsageClient, type UsageQuery } from './usage'
import type { UsageData } from './usageAggregate'

const NOW = new Date('2026-08-08T12:00:00Z')

/** The real queue, with retries disabled: what is under test is what it is asked, not backoff. */
function boundedQueue(concurrency = 4): AssistQueue {
  return createAssistQueue({
    concurrency: () => concurrency,
    maxRetries: () => 0,
    sleep: () => Promise.resolve(),
  })
}

const queue = boundedQueue()

function keyed(name: string): KeyedAccount {
  return { id: `acc-${name}`, name, credentials: { key: `key-${name}`, secret: 'secret' } }
}

const EMPTY_PRICES = { prices: [] }

type ClientOptions = {
  data?: UsageData
  fail?: () => never
  onQuery?: (query: UsageQuery) => void
  inFlight?: { current: number; peak: number }
}

function client({ data = {}, fail, onQuery, inFlight }: ClientOptions = {}): UsageClient {
  return {
    usages: {
      list: async query => {
        onQuery?.(query)
        if (fail) fail()

        if (inFlight) {
          inFlight.current += 1
          inFlight.peak = Math.max(inFlight.peak, inFlight.current)
          await Promise.resolve()
          inFlight.current -= 1
        }

        return data
      },
    },
    pricing: { oscu: { retrievePrices: async () => EMPTY_PRICES } },
  }
}

function reader(
  accounts: readonly KeyedAccount[],
  clientFor: (credentials: Credentials) => UsageClient,
) {
  return createUsageReader({
    accounts: () => accounts,
    clientFor,
    queue,
    now: () => NOW,
  })
}

describe('priceOf', () => {
  // The grid quotes the smallest currency unit; showing it raw would overstate by a hundred.
  it('reads a pack into a per-unit price', () => {
    const price = priceOf({ prices: [{ creativeUnits: 1000, unitAmount: 1000, currency: 'EUR' }] })

    expect(price).toEqual({ perUnit: 0.01, currency: 'EUR' })
  })

  it('skips a pack missing either side of the ratio', () => {
    const price = priceOf({
      prices: [{ creativeUnits: 0, unitAmount: 500, currency: 'EUR' }, { unitAmount: 200 }],
    })

    expect(price).toBeNull()
  })

  it('answers null rather than a figure when the grid is empty', () => {
    expect(priceOf(EMPTY_PRICES)).toBeNull()
  })
})

describe('createUsageReader', () => {
  it('asks for explicit bounds and drops the zero points', async () => {
    const seen: UsageQuery[] = []
    const usage = reader([keyed('one')], () => client({ onQuery: query => seen.push(query) }))

    await usage.report(120)

    expect(seen[0]).toMatchObject({
      startDate: '2026-04-11',
      endDate: '2026-08-08',
      // Without this a wide window fills with zeros and the response passes the 6 MB gateway cap.
      dropZeroPoints: true,
    })
  })

  it('leaves the activity log out of the report and asks for it alone', async () => {
    const seen: UsageQuery[] = []
    const usage = reader([keyed('one')], () => client({ onQuery: query => seen.push(query) }))

    await usage.report(7)
    await usage.events(7, {})

    expect(seen[0]?.type).not.toContain('activity')
    expect(seen[1]?.type).toEqual(['activity'])
    expect(seen[1]?.activityOffset).toBe(0)
  })

  it('queries every stored account, not just the active one', async () => {
    const keys: string[] = []
    const usage = reader([keyed('one'), keyed('two'), keyed('three')], credentials => {
      keys.push(credentials.key)
      return client()
    })

    await usage.report(31)

    expect(keys).toContain('key-one')
    expect(keys).toContain('key-two')
    expect(keys).toContain('key-three')
  })

  // No rate limit is published, and a burst of keys on one endpoint is what earns a 429.
  it('bounds how many accounts are in flight at once', async () => {
    const inFlight = { current: 0, peak: 0 }
    const accounts = Array.from({ length: 12 }, (_unused, index) => keyed(`a${index}`))

    const usage = createUsageReader({
      accounts: () => accounts,
      clientFor: () => client({ inFlight }),
      queue: boundedQueue(3),
      now: () => NOW,
    })

    await usage.report(31)

    expect(inFlight.peak).toBeLessThanOrEqual(3)
  })

  it('reports the refused key and keeps what the others answered', async () => {
    const working = {
      usages: [{ usageName: 'upscale', points: [{ time: '2026-08-01', value: '1', cost: 9 }] }],
    }

    const usage = reader([keyed('good'), keyed('dead')], credentials =>
      credentials.key === 'key-dead'
        ? client({
            fail: () => {
              throw APIError.generate(401, undefined, undefined, new Headers())
            },
          })
        : client({ data: working }),
    )

    const report = await usage.report(31)

    expect(report.units).toBe(9)
    expect(report.silent).toEqual([
      { accountId: 'acc-dead', name: 'dead', failure: 'invalid-credentials' },
    ])
  })

  // The window shows units alone rather than failing over a convenience.
  it('survives a price grid that refuses to answer', async () => {
    const usage = reader([keyed('one')], () => ({
      usages: { list: async () => ({}) },
      pricing: {
        oscu: {
          retrievePrices: async () => {
            throw new Error('nope')
          },
        },
      },
    }))

    await expect(usage.report(31)).resolves.toMatchObject({ price: null })
  })

  it('answers an empty report when no account is stored', async () => {
    const clientFor = vi.fn()
    const usage = reader([], clientFor)

    const report = await usage.report(31)

    expect(report.units).toBe(0)
    expect(report.accounts).toEqual([])
    expect(clientFor).not.toHaveBeenCalled()
  })

  it('reads the price grid through the first stored key', async () => {
    const usage = reader([keyed('one')], () => ({
      usages: { list: async () => ({}) },
      pricing: {
        oscu: {
          retrievePrices: async () => ({
            prices: [{ creativeUnits: 500, unitAmount: 1000, currency: 'EUR' }],
          }),
        },
      },
    }))

    await expect(usage.report(31)).resolves.toMatchObject({
      price: { perUnit: 0.02, currency: 'EUR' },
    })
  })

  it('ends the paging on the round that brings nothing back', async () => {
    const empty = reader([keyed('one')], () => client())

    await expect(empty.events(31, {})).resolves.toMatchObject({ more: false })
  })

  /**
   * `activityOffset` counts within one account's own log. A single offset over the merged list
   * would re-read what one key already returned and skip what another had not reached — so each
   * account carries its own cursor, advanced by what that account itself returned.
   */
  it('advances each account by what that account returned, not by the merged total', async () => {
    const asked: Record<string, number | undefined> = {}
    const entry = (index: number) => ({
      action: 'txt2img',
      time: `2026-08-01T10:00:${String(index).padStart(2, '0')}Z`,
      data: {},
    })

    const usage = reader([keyed('busy'), keyed('quiet')], credentials =>
      client({
        data: {
          activity: credentials.key === 'key-busy' ? [entry(0), entry(1), entry(2)] : [entry(3)],
        },
        onQuery: query => {
          asked[credentials.key] = query.activityOffset
        },
      }),
    )

    const first = await usage.events(31, {})

    expect(first.events).toHaveLength(4)
    expect(first.cursors).toEqual({ 'acc-busy': 3, 'acc-quiet': 1 })

    await usage.events(31, first.cursors)

    expect(asked['key-busy']).toBe(3)
    expect(asked['key-quiet']).toBe(1)
  })

  it('starts a key that has no cursor yet at the beginning of its log', async () => {
    const asked: number[] = []
    const usage = reader([keyed('fresh')], () =>
      client({
        onQuery: query => {
          if (query.activityOffset !== undefined) asked.push(query.activityOffset)
        },
      }),
    )

    await usage.events(31, { 'acc-other': 40 })

    expect(asked).toEqual([0])
  })
})
