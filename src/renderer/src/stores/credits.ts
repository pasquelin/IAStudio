import { create } from 'zustand'
import type { CreditBalances } from '@shared/domain/credits'
import { orElse } from '@shared/promises'
import { getBridge } from '@/services/bridge'

type CreditsState = {
  /**
   * Account id to what that key has left, or `null` while none has ever been read — which is not
   * the same answer as "read, and nobody publishes one".
   */
  balances: CreditBalances | null
  /** Asked on each opening of the account menu and of the settings. The main process caches. */
  refresh: () => Promise<void>
}

/**
 * What each stored key has LEFT to spend, replicated from the main process. A store rather than a
 * hook per screen: the menu and the settings must not hold two answers.
 */
export const useCredits = create<CreditsState>()(set => ({
  balances: null,

  refresh: async () => {
    const balances = await orElse(getBridge()?.accounts.credits(), null)
    // A refused reading leaves the figures where they were: they were true a minute ago.
    if (balances) set({ balances })
  },
}))
