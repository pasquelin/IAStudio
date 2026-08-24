import type { CreditBalance } from '@shared/domain/credits'
import { formatMoney } from './format'

export type CreditReading = {
  /** The amount to show, or `null` where there is none — which is most clouds. */
  figure: string | null
  /** The sentence that explains it, as a bundle key: the two ways of not knowing differ. */
  sentenceKey: string
}

/**
 * What a screen says about one key's remaining credit. A cloud that publishes no balance never
 * will; one that publishes one and refused today may answer tomorrow.
 */
export function describeCredit(balance: CreditBalance | undefined, locale: string): CreditReading {
  if (balance === undefined) return { figure: null, sentenceKey: 'accounts.credits.unpublished' }
  if (balance.state === 'unreadable')
    return { figure: null, sentenceKey: 'accounts.credits.unreadable' }

  return {
    figure: balance.left
      .map(money => formatMoney(money.amount, money.currency, locale))
      .join(' · '),
    sentenceKey: 'accounts.credits.left',
  }
}
