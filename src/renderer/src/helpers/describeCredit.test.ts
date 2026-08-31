import { describe, expect, it } from 'vitest'
import { CREDIT_UNIT } from '@shared/domain/credits'
import { describeCredit } from './describeCredit'

const said = (key: string, params: Record<string, string>): string =>
  `${key}(${Object.values(params).join(',')})`

describe('describeCredit', () => {
  it('writes money the way the reader writes money', () => {
    const reading = describeCredit(
      { state: 'known', left: [{ amount: 12.5, currency: 'USD' }] },
      'en',
      said,
    )

    expect(reading).toEqual({ figure: '$12.50', sentenceKey: 'accounts.credits.left' })
  })

  // 🛑 `Intl.NumberFormat` throws `RangeError` on a currency it does not know, in a render.
  it('names the unit of a balance that is not money, without asking Intl for a currency', () => {
    const reading = describeCredit(
      { state: 'known', left: [{ amount: 5000, currency: CREDIT_UNIT }] },
      'en',
      said,
    )

    expect(reading.figure).toBe('accounts.credits.unit(5,000)')
  })

  it('keeps every amount a key holds, whichever unit each is in', () => {
    const reading = describeCredit(
      {
        state: 'known',
        left: [
          { amount: 4, currency: 'USD' },
          { amount: 100, currency: CREDIT_UNIT },
        ],
      },
      'en',
      said,
    )

    expect(reading.figure).toBe('$4.00 · accounts.credits.unit(100)')
  })

  // The two ways of not knowing, which a screen has to be able to tell apart.
  it('separates a cloud that publishes nothing from one that would not answer today', () => {
    expect(describeCredit(undefined, 'en', said)).toEqual({
      figure: null,
      sentenceKey: 'accounts.credits.unpublished',
    })
    expect(describeCredit({ state: 'unreadable' }, 'en', said)).toEqual({
      figure: null,
      sentenceKey: 'accounts.credits.unreadable',
    })
  })
})
