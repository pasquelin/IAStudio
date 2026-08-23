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
  })
}

afterEach(() => {
  useAccounts.setState({ accounts: [] })
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
   * 🛑 Measured on screen: a key added mid-session showed no cloud model until the app was
   * restarted. The registry answers the local catalogue with no account, so the window HAD
   * cached a listing — one holding what this machine runs and nothing else.
   */
  it('drops what was cached under no account when the first one arrives', () => {
    const purge = vi.fn()
    renderHook(() => useAccountChange(purge))

    activate('a')

    expect(purge).toHaveBeenCalledTimes(1)
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
