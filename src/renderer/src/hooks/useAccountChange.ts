import { useEffect, useRef } from 'react'
import { activeAccount, useAccounts } from '@/stores/accounts'

/**
 * Runs `purge` whenever the active account changes. The window's counterpart to the main
 * process's `credentials-watch`: a cache added later subscribes here rather than being added
 * to a list somewhere else.
 */
export function useAccountChange(purge: () => void): void {
  const latest = useRef(purge)

  // Kept in an effect rather than assigned while rendering, as `useShortcuts` does: a caller
  // passing a fresh closure would otherwise re-subscribe below, which resets the baseline and
  // swallows the very switch this exists to catch.
  useEffect(() => {
    latest.current = purge
  }, [purge])

  useEffect(() => {
    /*
     * Watched on the store, not on the event: the first list arrives through `list()` and
     * never through `onChange`. A watcher on the event alone would therefore still hold `null`
     * once the window is up, and would sit out the switch it exists to catch.
     */
    let active = activeAccount(useAccounts.getState().accounts)?.id ?? null

    return useAccounts.subscribe(state => {
      const next = activeAccount(state.accounts)?.id ?? null
      if (next === active) return

      // Nothing was fetched under "no account", so arriving at one has nothing to drop.
      const switched = active !== null
      active = next
      if (switched) latest.current()
    })
  }, [])
}
