import type {
  UnitPrice,
  UsageCursors,
  UsageEventPage,
  UsagePeriod,
  UsageReport,
} from '@shared/domain/usage'
import type { Credentials } from '@main/settings/accounts'
import type { KeyedAccount } from '@main/settings/store'
import type { AssistQueue } from './assist-queue'
import { failureOf } from './client'
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
  events: (period: UsagePeriod, cursors: UsageCursors) => Promise<UsageEventPage>
}

export type UsageReaderDeps = {
  /** Every stored account, credentials included — see `SettingsStore.keyedAccounts`. */
  accounts: () => readonly KeyedAccount[]
  clientFor: (credentials: Credentials) => UsageClient
  /**
   * Bounds how many keys are queried at once, and retries what waiting can fix.
   *
   * Its own queue rather than the one background assistance uses: sharing would let a library
   * fetch of three hundred captions starve this, and it starve them back.
   */
  queue: AssistQueue
  now: () => Date
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
  queue,
  now,
}: UsageReaderDeps): UsageReader {
  /**
   * Asks every account, and lets a refused key answer with its reason.
   *
   * The rejection is caught per account rather than around the whole set: a revoked or expired
   * key is the ordinary case, and one of them must not cost the user the figures the other keys
   * did return.
   */
  const collect = (queryFor: (account: KeyedAccount) => UsageQuery): Promise<AccountUsage[]> =>
    Promise.all(
      accounts().map(account =>
        queue
          .run(() => clientFor(account.credentials).usages.list(queryFor(account)))
          .then(data => ({ accountId: account.id, name: account.name, data }))
          .catch((error: unknown) => ({
            accountId: account.id,
            name: account.name,
            data: null,
            failure: failureOf(error),
          })),
      ),
    )

  const priceList = async (): Promise<UnitPrice | null> => {
    const [first] = accounts()
    if (!first) return null

    try {
      return priceOf(
        await queue.run(() => clientFor(first.credentials).pricing.oscu.retrievePrices()),
      )
    } catch {
      // The grid is a convenience: without it the window shows units alone rather than nothing.
      return null
    }
  }

  return {
    report: async period => {
      const bounds = periodBounds(period, now())
      const [collected, price] = await Promise.all([
        collect(() => ({
          startDate: bounds.from,
          endDate: bounds.to,
          dropZeroPoints: true,
          type: ['usages', 'model-usages', 'asset-usages'],
        })),
        priceList(),
      ])

      return aggregate(collected, period, bounds, price)
    },

    events: async (period, cursors) => {
      const bounds = periodBounds(period, now())
      const collected = await collect(account => ({
        startDate: bounds.from,
        endDate: bounds.to,
        dropZeroPoints: true,
        type: ['activity'],
        activityOffset: cursors[account.id] ?? 0,
      }))

      // Advanced per account by what that account actually returned. A single offset over the
      // merged list would re-read one key's events while skipping another's.
      const advanced: UsageCursors = {}
      for (const account of collected) {
        const read = account.data?.activity?.length ?? 0
        advanced[account.accountId] = (cursors[account.accountId] ?? 0) + read
      }

      // No page size is published, so "more" cannot mean "the page was full": it means at least
      // one key still had something. The last request of a run comes back empty and ends it.
      const events = eventsOf(collected)
      return { events, cursors: advanced, more: events.length > 0 }
    },
  }
}
