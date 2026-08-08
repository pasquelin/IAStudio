import type { UnitPrice, UsageEventPage, UsagePeriod, UsageReport } from '@shared/domain/usage'
import { USAGE_EVENT_PAGE_SIZE } from '@shared/domain/usage'
import type { Credentials } from '@main/settings/accounts'
import type { KeyedAccount } from '@main/settings/store'
import { failureOf } from './client'
import type { Retry } from './retry'
import {
  aggregate,
  eventsOf,
  periodBounds,
  type AccountUsage,
  type UsageData,
} from './usage-aggregate'

/** The listing parameters this reader sends, named as the SDK names them. */
export type UsageQuery = {
  startDate: string
  endDate: string
  dropZeroPoints: boolean
  type: Array<'usages' | 'activity' | 'consumption' | 'model-usages' | 'asset-usages'>
  activityOffset?: number
}

export type PriceList = {
  prices: Array<{ creativeUnits?: number; unitAmount?: number; currency?: string }>
}

/** Narrower than the SDK client on purpose: this is what a test has to answer. */
export type UsageClient = {
  usages: { list: (query: UsageQuery) => Promise<UsageData> }
  pricing: { oscu: { retrievePrices: () => Promise<PriceList> } }
}

export type UsageReader = {
  report: (period: UsagePeriod) => Promise<UsageReport>
  events: (period: UsagePeriod, offset: number) => Promise<UsageEventPage>
}

export type UsageReaderDeps = {
  /** Every stored account, credentials included — see `SettingsStore.keyedAccounts`. */
  accounts: () => readonly KeyedAccount[]
  clientFor: (credentials: Credentials) => UsageClient
  retry: Retry
  now: () => Date
  /**
   * How many accounts are queried at once. Low on purpose: no rate limit is published, and a
   * burst of keys hitting the same endpoint is exactly what earns a 429.
   */
  concurrency?: number
}

const DEFAULT_CONCURRENCY = 4

/** Runs tasks with at most `limit` in flight, preserving input order in the result. */
async function mapBounded<In, Out>(
  items: readonly In[],
  limit: number,
  run: (item: In) => Promise<Out>,
): Promise<Out[]> {
  const results: Out[] = []
  // One iterator shared by every worker: draining it is how the work is handed out, and it
  // keeps each result at its input index without indexing back into `items`.
  const queue = items.entries()

  const worker = async (): Promise<void> => {
    for (const [index, item] of queue) results[index] = await run(item)
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/**
 * The euro value of one Compute Unit, derived from the cheapest pack that quotes both figures.
 *
 * `unitAmount` is read as the currency's smallest unit — the convention the field name follows
 * everywhere it appears in billing APIs. It could not be checked against a live response: the
 * endpoint needs a real key, which lives encrypted in this process and is never read back out.
 * Any screen using this must call the figure indicative, which is true regardless of the unit:
 * the grid prices prepaid packs in tiers and says nothing about a subscription's own rate.
 */
export function priceOf(list: PriceList): UnitPrice | null {
  for (const price of list.prices) {
    const { creativeUnits, unitAmount, currency } = price
    if (!creativeUnits || unitAmount === undefined || !currency) continue
    return { perUnit: unitAmount / 100 / creativeUnits, currency }
  }

  return null
}

export function createUsageReader({
  accounts,
  clientFor,
  retry,
  now,
  concurrency = DEFAULT_CONCURRENCY,
}: UsageReaderDeps): UsageReader {
  /**
   * Asks every account at once, and lets a refused key answer with its reason.
   *
   * A rejected `Promise.all` would be wrong here: a revoked or expired key is the ordinary
   * case, and one of them must not cost the user the figures the other keys did return.
   */
  const collect = async (query: UsageQuery): Promise<AccountUsage[]> =>
    mapBounded(accounts(), concurrency, async account => {
      try {
        const client = clientFor(account.credentials)
        const data = await retry(() => client.usages.list(query))
        return { accountId: account.id, name: account.name, data }
      } catch (error) {
        return {
          accountId: account.id,
          name: account.name,
          data: null,
          failure: failureOf(error),
        }
      }
    })

  const priceList = async (): Promise<UnitPrice | null> => {
    const [first] = accounts()
    if (!first) return null

    try {
      return priceOf(await retry(() => clientFor(first.credentials).pricing.oscu.retrievePrices()))
    } catch {
      // The grid is a convenience: without it the window shows units alone rather than nothing.
      return null
    }
  }

  return {
    report: async period => {
      const bounds = periodBounds(period, now())
      const [collected, price] = await Promise.all([
        collect({
          startDate: bounds.from,
          endDate: bounds.to,
          dropZeroPoints: true,
          type: ['usages', 'model-usages', 'asset-usages'],
        }),
        priceList(),
      ])

      return aggregate(collected, period, bounds, price)
    },

    events: async (period, offset) => {
      const bounds = periodBounds(period, now())
      const collected = await collect({
        startDate: bounds.from,
        endDate: bounds.to,
        dropZeroPoints: true,
        type: ['activity'],
        activityOffset: offset,
      })

      const events = eventsOf(collected)

      return {
        events: events.slice(0, USAGE_EVENT_PAGE_SIZE),
        offset,
        more: events.length > USAGE_EVENT_PAGE_SIZE,
      }
    },
  }
}
