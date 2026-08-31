import { CREDIT_UNIT, type CreditBalance } from '@shared/domain/credits'
import { formatDecimal, formatMoney } from './format'

export type CreditReading = {
  /** The amount to show, or `null` where there is none — which is most clouds. */
  figure: string | null
  /** The sentence that explains it, as a bundle key: the two ways of not knowing differ. */
  sentenceKey: string
}

/**
 * One amount, written the way its cloud quotes it.
 *
 * 🛑 `Intl.NumberFormat` throws `RangeError` on a currency it does not know, in the title bar's
 * own render — so a balance counted in credits is told apart BEFORE it is formatted.
 */
function amountOf(
  money: { amount: number; currency: string },
  locale: string,
  translate: (key: string, params: Record<string, string>) => string,
): string {
  return money.currency === CREDIT_UNIT
    ? translate('accounts.credits.unit', {
        units: formatDecimal(money.amount, locale, { digits: 0 }),
      })
    : formatMoney(money.amount, money.currency, locale)
}

/**
 * What a screen says about one key's remaining credit. A cloud that publishes no balance never
 * will; one that publishes one and refused today may answer tomorrow.
 */
export function describeCredit(
  balance: CreditBalance | undefined,
  locale: string,
  translate: (key: string, params: Record<string, string>) => string,
): CreditReading {
  if (balance === undefined) return { figure: null, sentenceKey: 'accounts.credits.unpublished' }
  if (balance.state === 'unreadable')
    return { figure: null, sentenceKey: 'accounts.credits.unreadable' }

  return {
    figure: balance.left.map(money => amountOf(money, locale, translate)).join(' · '),
    sentenceKey: 'accounts.credits.left',
  }
}
