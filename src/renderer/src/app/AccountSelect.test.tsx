import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountsResult, AccountSummary } from '@shared/domain/account'
import { installFakeBridge } from '@/services/fake-bridge'
import { useAccounts } from '@/stores/accounts'
import { useSettings } from '@/stores/settings'
import { AccountSelect } from './AccountSelect'

const studio: AccountSummary = { id: 'a', name: 'Studio', active: true }
const client: AccountSummary = { id: 'b', name: 'Client X', active: false }

const given = (accounts: AccountSummary[], authenticated = true): void => {
  useAccounts.setState({ accounts })
  useSettings.setState({
    auth: authenticated ? { authenticated: true } : { authenticated: false, reason: 'missing' },
  })
}

const openMenu = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: 'Compte Scenario' }))
}

describe('AccountSelect', () => {
  beforeEach(() => {
    given([])
    installFakeBridge()
  })

  it('shows the name of the account in use', () => {
    given([studio, client])
    render(<AccountSelect />)

    expect(screen.getByRole('button', { name: 'Compte Scenario' })).toHaveTextContent('Studio')
  })

  it('says it is not connected while nothing is stored', () => {
    render(<AccountSelect />)
    expect(screen.getByRole('button', { name: 'Compte Scenario' })).toHaveTextContent(
      'Non connecté',
    )
  })

  it('lists every account, ticking the one in use', async () => {
    given([studio, client])
    render(<AccountSelect />)
    await openMenu()

    const rows = screen.getAllByRole('menuitem')
    expect(rows.map(row => row.textContent)).toEqual(['Studio', 'Client X', 'Gérer les comptes…'])
  })

  it('switches to the account that was picked', async () => {
    const activate = vi.fn((): Promise<AccountsResult> => Promise.resolve({ accounts: [] }))
    installFakeBridge({ accounts: { activate } })
    given([studio, client])

    render(<AccountSelect />)
    await openMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Client X' }))

    expect(activate).toHaveBeenCalledWith('b')
  })

  // Switching to the account already in use would drop the cached client and re-probe the API
  // for no change at all.
  it('does not switch to the account already in use', async () => {
    const activate = vi.fn((): Promise<AccountsResult> => Promise.resolve({ accounts: [] }))
    installFakeBridge({ accounts: { activate } })
    given([studio, client])

    render(<AccountSelect />)
    await openMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Studio' }))

    expect(activate).not.toHaveBeenCalled()
  })

  // Keys are typed in the settings alone: the header only ever switches between saved ones.
  it('leads to the settings rather than asking for a key', async () => {
    const open = vi.fn(() => Promise.resolve())
    installFakeBridge({ settings: { open } })
    given([studio])

    render(<AccountSelect />)
    await openMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Gérer les comptes…' }))

    expect(open).toHaveBeenCalledWith('account')
    expect(screen.queryByLabelText(/Clé API/)).not.toBeInTheDocument()
  })

  // With nothing stored there is only one thing to do, and a menu of one row is not a menu.
  it('goes straight to the settings when nothing is stored', async () => {
    const open = vi.fn(() => Promise.resolve())
    installFakeBridge({ settings: { open } })

    render(<AccountSelect />)
    await openMenu()

    expect(open).toHaveBeenCalledWith('account')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
