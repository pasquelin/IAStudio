import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountsResult, AccountSummary } from '@shared/domain/account'
import { NO_BREAK_SPACE } from '@shared/i18n/typography'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAccounts } from '@/stores/accounts'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { AccountSelect } from './AccountSelect'

const studio: AccountSummary = { id: 'a', name: 'Studio', active: true }
const client: AccountSummary = { id: 'b', name: 'Client X', active: false }

const given = (accounts: AccountSummary[], authenticated = true): void => {
  useAccounts.setState({ accounts })
  useProject.setState({ project: null })
  useSettings.setState({
    auth: authenticated ? { authenticated: true } : { authenticated: false, reason: 'missing' },
  })
}

const withProject = (name: string): void =>
  useProject.setState({
    project: {
      path: `/projects/${name}`,
      manifest: { version: 1, name, createdAt: '2026-08-21', updatedAt: '2026-08-21' },
    },
  })

const buttonFor = (name: string): HTMLElement =>
  screen.getByRole('button', { name: `Compte${NO_BREAK_SPACE}: ${name}` })

const openMenu = async (name: string): Promise<void> => {
  await userEvent.click(buttonFor(name))
}

describe('AccountSelect', () => {
  beforeEach(() => {
    given([])
    installFakeBridge()
  })

  it('shows the name of the account in use', () => {
    given([studio, client])
    render(<AccountSelect />)

    expect(buttonFor('Studio')).toHaveTextContent('Studio')
  })

  it('says it is not connected while nothing is stored and nothing answers', () => {
    given([], false)
    render(<AccountSelect />)

    expect(buttonFor('Non connecté')).toHaveTextContent('Non connecté')
  })

  it('lists every account, ticking the one in use', async () => {
    given([studio, client])
    render(<AccountSelect />)
    await openMenu('Studio')

    // The accounts are alternatives and the row that manages them is not, so they no longer
    // share a role — which is the point: only one of the three can be ticked.
    const accounts = screen.getAllByRole('menuitemradio')
    expect(accounts.map(row => row.textContent)).toEqual(['Studio', 'Client X'])
    expect(accounts[0]).toHaveAttribute('aria-checked', 'true')
    expect(accounts[1]).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('menuitem', { name: 'Gérer les comptes…' })).toBeInTheDocument()
  })

  it('explains each row instead of repeating the name it already shows', async () => {
    given([studio])
    render(<AccountSelect />)
    await openMenu('Studio')

    const account = screen.getByRole('menuitemradio', { name: 'Studio' })
    expect(account).toHaveAttribute('data-tooltip-content', 'Cette clé sera celle de ce service')
    // A visible label answers for itself: an `aria-label` here would replace it (WCAG 2.5.3).
    expect(account).not.toHaveAttribute('aria-label')
    expect(screen.getByRole('menuitem', { name: 'Gérer les comptes…' })).toHaveAttribute(
      'data-tooltip-content',
      'Ouvre les réglages pour ajouter, renommer ou retirer un compte',
    )
  })

  // The same mounting as the toolbar's menus, so the same manners: they come with the props
  // `useHoverFlyout` hands the surface, not from three lines rewritten per caller.
  it('walks its rows with the arrows, and closes on Escape', async () => {
    given([studio, client])
    render(<AccountSelect />)
    await openMenu('Studio')

    expect(screen.getByRole('menuitemradio', { name: /Studio/ })).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitemradio', { name: /Client X/ })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('switches to the account that was picked', async () => {
    const activate = vi.fn((): Promise<AccountsResult> => Promise.resolve({ accounts: [] }))
    installFakeBridge({ accounts: { activate } })
    given([studio, client])

    render(<AccountSelect />)
    await openMenu('Studio')
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Client X' }))

    expect(activate).toHaveBeenCalledWith('b')
  })

  // Switching to the account already in use would drop the cached client and re-probe the API
  // for no change at all.
  it('does not switch to the account already in use', async () => {
    const activate = vi.fn((): Promise<AccountsResult> => Promise.resolve({ accounts: [] }))
    installFakeBridge({ accounts: { activate } })
    given([studio, client])

    render(<AccountSelect />)
    await openMenu('Studio')
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Studio' }))

    expect(activate).not.toHaveBeenCalled()
  })

  // Keys are typed in the settings alone: the header only ever switches between saved ones.
  it('leads to the settings rather than asking for a key', async () => {
    const open = vi.fn(() => Promise.resolve())
    installFakeBridge({ settings: { open } })
    given([studio])

    render(<AccountSelect />)
    await openMenu('Studio')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Gérer les comptes…' }))

    expect(open).toHaveBeenCalledWith('account')
    expect(screen.queryByLabelText(/Clé API/)).not.toBeInTheDocument()
  })

  // With nothing stored there is only one thing to do, and a menu of one row is not a menu.
  it('goes straight to the settings when nothing is stored', async () => {
    const open = vi.fn(() => Promise.resolve())
    installFakeBridge({ settings: { open } })

    render(<AccountSelect />)
    await openMenu('Non connecté')

    expect(open).toHaveBeenCalledWith('account')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  /**
   * Switching with a project open records the key against that folder, so reopening it lands on
   * the same library — ADR-21 § D. The button that does that says so rather than leaving it to be
   * discovered on the next opening.
   */
  it('names the project a switch would be remembered for', async () => {
    given([studio, client])
    withProject('Affiche')
    render(<AccountSelect />)
    await openMenu('Studio')

    expect(screen.getByText('Retenu pour le projet Affiche')).toBeInTheDocument()
  })

  it('says the choice is the studio’s own while no project is open', async () => {
    given([studio, client])
    render(<AccountSelect />)
    await openMenu('Studio')

    expect(
      screen.getByText('Aucun projet ouvert — ce choix vaut pour le studio'),
    ).toBeInTheDocument()
  })

  it('lights up in the half-opaque shade this bar answers with', () => {
    given([studio])
    render(<AccountSelect />)

    expect(buttonFor('Studio')).toHaveClass('hover:bg-elevated/60', 'hover:text-text')
  })
})
