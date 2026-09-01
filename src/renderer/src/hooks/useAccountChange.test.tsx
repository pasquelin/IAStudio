import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AccountSummary } from '@shared/domain/account'
import { useAccounts } from '@/stores/accounts'
import { useAccountChange } from './useAccountChange'

const STUDIO: AccountSummary = { id: 'a', name: 'Studio', active: false }
const CLIENT: AccountSummary = { id: 'b', name: 'Client X', active: false }

function activate(id: string): void {
  useAccounts.setState({
    accounts: [STUDIO, CLIENT].map(account => ({ ...account, active: account.id === id })),
    // What `connect` sets alongside the list; without it every case here would read as the very
    // first arrival, which is exactly the state this hook has to tell apart.
    accountsLoaded: true,
  })
}

afterEach(() => {
  useAccounts.setState({ accounts: [], accountsLoaded: false })
})

describe('useAccountChange', () => {
  it('purges when the active account moves', () => {
    activate('a')
    const purge = vi.fn()
    renderHook(() => useAccountChange(purge))

    activate('b')

    expect(purge).toHaveBeenCalledOnce()
  })

  // A rename or a second key added republishes the list without moving the active account.
  it('leaves the caches alone when the list changes but the active account does not', () => {
    activate('a')
    const purge = vi.fn()
    renderHook(() => useAccountChange(purge))

    useAccounts.setState({
      accounts: [
        { ...STUDIO, active: true },
        { ...CLIENT, name: 'Renamed' },
      ],
    })

    expect(purge).not.toHaveBeenCalled()
  })

  /**
   * 🛑 Measured on screen: a key added mid-session showed no cloud model until restart — the
   * window HAD cached a listing, the local-only one the registry answers with no account.
   */
  it('drops what was cached under no account when a key is added mid-session', () => {
    useAccounts.setState({ accounts: [], accountsLoaded: true })
    const purge = vi.fn()
    renderHook(() => useAccountChange(purge))

    activate('a')

    expect(purge).toHaveBeenCalledTimes(1)
  })

  // 🛑 The list lands a moment AFTER the window is up, so a watcher reading its baseline at
  // mount calls that arrival a switch — and threw the whole cache away at every launch.
  it('takes the first list as its baseline rather than as a switch', () => {
    const purge = vi.fn()
    renderHook(() => useAccountChange(purge))

    activate('a')

    expect(purge).not.toHaveBeenCalled()
  })

  it('stops watching once the window is gone', () => {
    activate('a')
    const purge = vi.fn()
    const { unmount } = renderHook(() => useAccountChange(purge))

    unmount()
    activate('b')

    expect(purge).not.toHaveBeenCalled()
  })
})
