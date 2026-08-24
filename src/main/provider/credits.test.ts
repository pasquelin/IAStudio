import { describe, expect, it, vi } from 'vitest'
import { BALANCE_CLOUDS, createCreditsReader, type CreditsFetch } from './credits'
import { CLOUD_IDS } from '@shared/domain/aiCloud'
import type { KeyedAccount } from '@main/settings/store'

const account = (id: string, providerId?: string): KeyedAccount => ({
  id,
  name: id,
  credentials: { key: `key-${id}`, secret: '' },
  ...(providerId ? { providerId } : {}),
})

const answers = (bodies: Record<string, unknown>): CreditsFetch =>
  vi.fn(async (url: string) => {
    const body = bodies[url]
    if (body === undefined) return new Response('', { status: 404 })
    return new Response(JSON.stringify(body), { status: 200 })
  })

const DEEPSEEK = 'https://api.deepseek.com/user/balance'
const OPENROUTER_CREDITS = 'https://openrouter.ai/api/v1/credits'
const OPENROUTER_KEY = 'https://openrouter.ai/api/v1/key'

const TTL = 1_000

const reader = (accounts: readonly KeyedAccount[], fetch: CreditsFetch, now = () => 0) =>
  createCreditsReader({ accounts: () => accounts, fetch, ttlMs: TTL, now })

describe('what each stored key has left', () => {
  // A key whose cloud says nothing is ABSENT, so no zero is drawn beside an account holding
  // hundreds — the screen has to be able to say it cannot know.
  it('answers for the clouds that publish a balance, and for no other', async () => {
    const fetch = answers({
      [DEEPSEEK]: {
        is_available: true,
        balance_infos: [{ currency: 'USD', total_balance: '12.50' }],
      },
    })

    const balances = await reader(
      [account('deep', 'deepseek'), account('scenario'), account('gpt', 'openai')],
      fetch,
    ).balances()

    expect(balances).toEqual({
      deep: { state: 'known', left: [{ amount: 12.5, currency: 'USD' }] },
    })
  })

  // DeepSeek quotes one figure per currency on the same key; picking one hides real money.
  it('keeps every currency a key holds', async () => {
    const fetch = answers({
      [DEEPSEEK]: {
        balance_infos: [
          { currency: 'CNY', total_balance: '110.00' },
          { currency: 'USD', total_balance: '4.00' },
        ],
      },
    })

    await expect(reader([account('deep', 'deepseek')], fetch).balances()).resolves.toEqual({
      deep: {
        state: 'known',
        left: [
          { amount: 110, currency: 'CNY' },
          { amount: 4, currency: 'USD' },
        ],
      },
    })
  })

  /**
   * `Number('')` and `Number(null)` are both 0, and a currency the API invented makes
   * `Intl.NumberFormat` throw inside the title bar's own render. Neither may reach a screen.
   */
  it('refuses an entry whose figure or currency is not one', async () => {
    const fetch = answers({
      [DEEPSEEK]: {
        balance_infos: [
          { currency: 'USD', total_balance: null },
          { currency: '', total_balance: '5.00' },
          { currency: 'EUR', total_balance: '' },
        ],
      },
    })

    await expect(reader([account('deep', 'deepseek')], fetch).balances()).resolves.toEqual({
      deep: { state: 'unreadable' },
    })
  })

  it('reads an OpenRouter account balance as what was bought less what was spent', async () => {
    const fetch = answers({ [OPENROUTER_CREDITS]: { data: { total_credits: 20, total_usage: 8 } } })

    await expect(reader([account('or', 'openrouter')], fetch).balances()).resolves.toEqual({
      or: { state: 'known', left: [{ amount: 12, currency: 'USD' }] },
    })
  })

  // `/credits` asks for a management key; without the second reading every inference key would
  // read as unreadable, which is the ordinary account.
  it('falls back to what the key itself has left when the account balance is refused', async () => {
    const fetch = answers({ [OPENROUTER_KEY]: { data: { limit_remaining: 3.25 } } })

    await expect(reader([account('or', 'openrouter')], fetch).balances()).resolves.toEqual({
      or: { state: 'known', left: [{ amount: 3.25, currency: 'USD' }] },
    })
  })

  /**
   * The two ways a cloud gives no figure — it refused, or it answered `null` because the key has
   * no limit — and neither may read as zero, nor stop the keys that did answer.
   */
  it('reports a key with no figure as unreadable without failing the whole reading', async () => {
    const fetch = answers({
      [DEEPSEEK]: { balance_infos: [{ currency: 'USD', total_balance: '1.00' }] },
      [OPENROUTER_KEY]: { data: { limit_remaining: null } },
    })

    await expect(
      reader(
        [account('deep', 'deepseek'), account('none', 'openrouter'), account('or', 'openrouter')],
        fetch,
      ).balances(),
    ).resolves.toEqual({
      deep: { state: 'known', left: [{ amount: 1, currency: 'USD' }] },
      none: { state: 'unreadable' },
      or: { state: 'unreadable' },
    })
  })

  // The menu opens on hover: without the cache, crossing the title bar spends a round trip.
  it('asks once for as long as the answer is worth keeping, and again after that', async () => {
    const fetch = answers({
      [DEEPSEEK]: { balance_infos: [{ currency: 'USD', total_balance: '1.00' }] },
    })
    let clock = 0
    const credits = reader([account('deep', 'deepseek')], fetch, () => clock)

    await credits.balances()
    await credits.balances()
    expect(fetch).toHaveBeenCalledTimes(1)

    clock = TTL + 1
    await credits.balances()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  // The menu opens on HOVER, so a cold cache takes several openings before the first answer
  // lands: without joining the reading in flight, each of them started a round of its own.
  it('joins the reading already in flight rather than starting another', async () => {
    const fetch = answers({
      [DEEPSEEK]: { balance_infos: [{ currency: 'USD', total_balance: '1.00' }] },
    })
    const credits = reader([account('deep', 'deepseek')], fetch)

    await Promise.all([credits.balances(), credits.balances(), credits.balances()])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  // A key added or removed changes the answer, and `WatchCredentials` never speaks for it: it
  // fires on the active SCENARIO key alone, which publishes no balance at all.
  it('forgets what it read, and does not let a reading in flight put it back', async () => {
    const fetch = answers({
      [DEEPSEEK]: { balance_infos: [{ currency: 'USD', total_balance: '1.00' }] },
    })
    const credits = reader([account('deep', 'deepseek')], fetch)

    const inFlight = credits.balances()
    credits.forget()
    await inFlight

    await credits.balances()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  // `CloudProviderId` is `string`, so a typo in the table — or a rename in the registry — makes
  // every balance vanish without a gate reddening.
  it('names only clouds the registry holds', () => {
    expect(BALANCE_CLOUDS.length).toBeGreaterThan(0)
    expect(BALANCE_CLOUDS.filter(id => !CLOUD_IDS.includes(id))).toEqual([])
  })
})
