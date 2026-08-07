import { create } from 'zustand'
import type { AccountFailure, AccountsResult, AccountSummary } from '@shared/domain/account'
import type { StudioBridge } from '@shared/ipc'
import { getBridge } from '@/services/bridge'
import { useSettings } from './settings'

/** Why an account could not be saved, including a refusal that never reached the main process. */
export type AccountSaveFailure = AccountFailure | 'unexpected'

type AccountsState = {
  accounts: AccountSummary[]

  /** Loads the accounts and follows the switches other windows make. Returns the unsubscribe. */
  connect: () => Promise<() => void>
  /** Every mutation answers `null` on success, or why it was refused. */
  add: (name: string, key: string, secret: string) => Promise<AccountSaveFailure | null>
  rename: (id: string, name: string) => Promise<AccountSaveFailure | null>
  remove: (id: string) => Promise<AccountSaveFailure | null>
  activate: (id: string) => Promise<AccountSaveFailure | null>
}

export function activeAccount(accounts: readonly AccountSummary[]): AccountSummary | null {
  return accounts.find(account => account.active) ?? null
}

/**
 * The stored API keys, replicated from the main process. The credentials themselves never
 * reach this side: a window learns which accounts exist and which one is in use, never what
 * they hold — see CLAUDE.md, invariant 1.
 */
export const useAccounts = create<AccountsState>()((set, get) => {
  /**
   * Runs a mutation and republishes the list. The authentication is re-probed only when the
   * active account actually moved — adding a second key or dropping an idle one leaves it
   * where it was, and probing costs a network round trip the user waits on.
   */
  const mutate = async (
    change: (accounts: StudioBridge['accounts']) => Promise<AccountsResult>,
  ): Promise<AccountSaveFailure | null> => {
    const bridge = getBridge()
    if (!bridge) return null

    const before = activeAccount(get().accounts)?.id ?? null

    let result: AccountsResult
    try {
      result = await change(bridge.accounts)
    } catch {
      // Keychain unavailable, or a credential the main process refused. Nothing was stored,
      // and every caller must be able to say so rather than fail silently.
      return 'unexpected'
    }

    set({ accounts: result.accounts })
    if (result.failure) return result.failure

    if ((activeAccount(result.accounts)?.id ?? null) !== before) {
      await useSettings.getState().refreshAuth()
    }

    return null
  }

  return {
    accounts: [],

    connect: async () => {
      const bridge = getBridge()
      if (!bridge) return () => {}

      let pushed = false
      const stop = bridge.accounts.onChange(accounts => {
        pushed = true
        set({ accounts })
      })

      try {
        const accounts = await bridge.accounts.list()
        // A switch landing while the read was in flight is newer than what the read answered.
        if (!pushed) set({ accounts })
      } catch {
        // The subscription still stands: throwing here would strand the listener with nobody
        // holding the way to remove it.
      }

      return stop
    },

    add: (name, key, secret) => mutate(accounts => accounts.add(name, key, secret)),

    rename: (id, name) => mutate(accounts => accounts.rename(id, name)),

    remove: id => mutate(accounts => accounts.remove(id)),

    activate: async id => {
      if (activeAccount(get().accounts)?.id === id) return null
      return await mutate(accounts => accounts.activate(id))
    },
  }
})
