import { useEffect } from 'react'
import { scenarioAccount } from '@shared/domain/account'
import { useAccounts } from '@/stores/accounts'
import { useLatest } from './useLatest'

/**
 * Runs `purge` whenever the active account changes. The window's counterpart to the main
 * process's `credentialsWatch`: a cache added later subscribes here rather than being added
 * to a list somewhere else.
 */
export function useAccountChange(purge: () => void): void {
  // Read at event time and never subscribed to: a caller passing a fresh closure would otherwise
  // re-subscribe below, which resets the baseline and swallows the very switch this exists to
  // catch.
  const latest = useLatest(purge)

  useEffect(() => {
    /*
     * Watched on the store, not on the event: the first list arrives through `list()` and
     * never through `onChange`. A watcher on the event alone would therefore still hold `null`
     * once the window is up, and would sit out the switch it exists to catch.
     */
    let active = scenarioAccount(useAccounts.getState().accounts)?.id ?? null

    return useAccounts.subscribe(state => {
      const next = scenarioAccount(state.accounts)?.id ?? null
      if (next === active) return

      // Nothing was fetched under "no account", so arriving at one has nothing to drop.
      const switched = active !== null
      active = next
      if (switched) latest.current()
    })
  }, [latest])
}
