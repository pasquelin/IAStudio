import { SCENARIO_CLOUD, type CloudProviderId } from '@shared/domain/aiCloud'
import { TRIPO_BASE_URL, TRIPO_CLOUD } from '@shared/domain/tripo'
import {
  CREDIT_UNIT,
  type CreditBalance,
  type CreditBalances,
  type Money,
} from '@shared/domain/credits'
import { isRecord } from '@shared/guards'
import { orElse } from '@shared/promises'
import { log } from '@main/log'
import type { KeyedAccount } from '@main/settings/store'

/** Narrower than `fetch` on purpose: this is what a test has to answer. */
export type CreditsFetch = (input: string, init?: RequestInit) => Promise<Response>

export type CreditsReader = {
  /** One entry per stored key whose cloud publishes a balance. Every other key is absent. */
  balances: () => Promise<CreditBalances>
  /**
   * Drops what was read, for the ONE event that changes the answer: the stored keys moving.
   * `WatchCredentials` cannot serve here — it fires on the ACTIVE SCENARIO key alone, and
   * Scenario publishes no balance, so adding a DeepSeek key would never have purged anything.
   */
  forget: () => void
}

export type CreditsOptions = {
  /** Every stored account, credentials included — see `SettingsStore.keyedAccounts`. */
  accounts: () => readonly KeyedAccount[]
  fetch?: CreditsFetch
  ttlMs?: number
  now?: () => number
}

/** A top-up shows on the next opening, and a hover-opened menu pays no round trip per pass. */
const DEFAULT_TTL_MS = 60_000

/** A pending host would otherwise never fill the cache, and every opening would ask again. */
const TIMEOUT_MS = 8_000

async function readJson(get: CreditsFetch, url: string, key: string): Promise<unknown> {
  const response = await get(url, {
    headers: { authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return await response.json()
}

/** `total_balance` arrives as a STRING — "110.00". `Number('')` and `Number(null)` are 0, and a
 *  zero drawn beside a key holding hundreds is the one outcome this feature must not produce. */
function figureOf(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || value.trim() === '') return null

  return Number.isFinite(Number(value)) ? Number(value) : null
}

/** `Intl.NumberFormat` throws `RangeError` on anything else, in the title bar's own render. */
const CURRENCY = /^[A-Za-z]{3}$/

/** One entry per currency held on the key. */
function deepseekLeft(body: unknown): readonly Money[] | null {
  if (!isRecord(body) || !Array.isArray(body['balance_infos'])) return null

  const left = body['balance_infos'].flatMap((one: unknown): Money[] => {
    if (!isRecord(one)) return []
    const amount = figureOf(one['total_balance'])
    const currency = one['currency']
    return amount !== null && typeof currency === 'string' && CURRENCY.test(currency)
      ? [{ amount, currency }]
      : []
  })

  return left.length > 0 ? left : null
}

/** Credits are quoted in dollars and neither endpoint names a currency, so the studio names it. */
const OPENROUTER_CURRENCY = 'USD'

function dollars(amount: unknown): readonly Money[] | null {
  return typeof amount === 'number' ? [{ amount, currency: OPENROUTER_CURRENCY }] : null
}

function openrouterData(body: unknown): Record<string, unknown> | null {
  return isRecord(body) && isRecord(body['data']) ? body['data'] : null
}

/** The account's own balance, which only a management key may read. */
function openrouterSpread(body: unknown): readonly Money[] | null {
  const data = openrouterData(body)
  if (!data) return null
  const bought = data['total_credits']
  const spent = data['total_usage']

  return typeof bought === 'number' && typeof spent === 'number' ? dollars(bought - spent) : null
}

/** What THIS key has left of it, quoted only where the key was given a limit. */
function openrouterKeyLimit(body: unknown): readonly Money[] | null {
  return dollars(openrouterData(body)?.['limit_remaining'])
}

/**
 * What Tripo has left, in CREDITS — their answer names no currency at all, and `frozen` is what
 * their running tasks are holding rather than anything left to spend.
 *
 * 🛑 NOT MEASURED against a spending account: read on a key with 5 000 credits and nothing
 * running, so whether `balance` already excludes `frozen` is unknown. Shown as it comes.
 */
function tripoLeft(body: unknown): readonly Money[] | null {
  const data = isRecord(body) && isRecord(body['data']) ? body['data'] : null
  const amount = data ? figureOf(data['balance']) : null

  return amount === null ? null : [{ amount, currency: CREDIT_UNIT }]
}

type BalanceRead = (get: CreditsFetch, key: string) => Promise<readonly Money[] | null>

/**
 * The clouds that publish a balance an inference key may read, and the ONE place they are named.
 * Measured against each API on 24 August 2026: the six absent ones expose spending already made,
 * a plan, or nothing — never what remains.
 */
const READ: Partial<Record<CloudProviderId, BalanceRead>> = {
  deepseek: async (get, key) =>
    deepseekLeft(await readJson(get, 'https://api.deepseek.com/user/balance', key)),

  [TRIPO_CLOUD]: async (get, key) =>
    tripoLeft(await readJson(get, `${TRIPO_BASE_URL}/account/balance`, key)),

  // Both at once, and it takes both: `/credits` asks for a management key while `/key` answers an
  // inference one but quotes a figure only where the key was given a limit.
  openrouter: async (get, key) => {
    const [spread, limit] = await Promise.all([
      orElse(readJson(get, 'https://openrouter.ai/api/v1/credits', key), null),
      orElse(readJson(get, 'https://openrouter.ai/api/v1/key', key), null),
    ])
    return openrouterSpread(spread) ?? openrouterKeyLimit(limit)
  },
}

/** Exported for the guard alone: `CloudProviderId` is `string`, so a typo above compiles clean. */
export const BALANCE_CLOUDS: readonly CloudProviderId[] = Object.keys(READ)

/**
 * What each stored key has left to spend. Cached like the plan is: the account menu opens on
 * hover, and a balance does not move between two of them.
 */
export function createCreditsReader({
  accounts,
  fetch: get = fetch,
  ttlMs = DEFAULT_TTL_MS,
  now = Date.now,
}: CreditsOptions): CreditsReader {
  let cached: { at: number; value: CreditBalances } | null = null
  let reading: Promise<CreditBalances> | null = null
  // Stamped on the read in flight: a purge landing under it must not be undone by the answer
  // that read was already computing.
  let generation = 0

  const readOne = async (account: KeyedAccount, read: BalanceRead): Promise<CreditBalance> => {
    try {
      const left = await read(get, account.credentials.key)
      return left ? { state: 'known', left } : { state: 'unreadable' }
    } catch {
      // Never the error itself: a refusal carries the request that produced it, so writing it
      // out would put the API key in the log file.
      log.warn('provider', `no balance for "${account.name}"`)
      return { state: 'unreadable' }
    }
  }

  const readAll = async (): Promise<CreditBalances> => {
    const asked = accounts().flatMap(account => {
      const read = READ[account.providerId ?? SCENARIO_CLOUD]
      return read ? [{ account, read }] : []
    })

    // One call per key at once: a studio holds a handful, and they go to different hosts.
    const entries = await Promise.all(
      asked.map(async (one): Promise<[string, CreditBalance]> => [
        one.account.id,
        await readOne(one.account, one.read),
      ]),
    )

    return Object.fromEntries(entries)
  }

  return {
    forget: () => {
      cached = null
      generation += 1
    },

    balances: async () => {
      if (cached && now() - cached.at < ttlMs) return cached.value
      // Joined rather than started again: the menu opens on hover, so a cold cache takes several
      // openings before the first answer lands — measured at ten fetches where two were due.
      if (reading) return await reading

      const asOf = generation
      reading = readAll()
      try {
        const value = await reading
        if (asOf === generation) cached = { at: now(), value }
        return value
      } finally {
        reading = null
      }
    },
  }
}
