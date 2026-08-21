import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ENVIRONMENT_ACCOUNT_ID,
  type AccountsResult,
  type AccountSummary,
} from '@shared/domain/account'
import type { ApiFailure } from '@shared/domain/failure'
import type { AuthState } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAccounts } from '@/stores/accounts'
import { useSettings } from '@/stores/settings'
import { AccountSettings } from './AccountSettings'

const KEY = 'api_key_visible'
const SECRET = 's3cr3t_visible'

const studio: AccountSummary = { id: 'a', name: 'Studio', active: true }

async function fillAndAdd(name = 'Studio'): Promise<void> {
  await userEvent.type(screen.getByLabelText(/Nom/), name)
  await userEvent.type(screen.getByLabelText(/Clé API/), KEY)
  await userEvent.type(screen.getByLabelText(/Secret API/), SECRET)
  await userEvent.click(screen.getByRole('button', { name: 'Ajouter un compte' }))
}

describe('AccountSettings', () => {
  beforeEach(() => {
    useSettings.setState({ auth: { authenticated: false, reason: 'missing' } })
    useAccounts.setState({ accounts: [] })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks the main process for the current state as soon as it is shown', async () => {
    const authState = vi.fn((): Promise<AuthState> => Promise.resolve({ authenticated: true }))
    installFakeBridge({ settings: { authState } })

    render(<AccountSettings />)
    await waitFor(() => expect(authState).toHaveBeenCalled())
  })

  // The subscription lives in `SettingsWindow`: a leaf that opened one would tear it down and
  // rebuild it every time the user walks the section tree.
  it('shows the accounts the store holds', () => {
    installFakeBridge()
    useAccounts.setState({ accounts: [studio] })

    render(<AccountSettings />)
    expect(screen.getByText('Studio')).toBeInTheDocument()
  })

  it('says so when nothing is stored yet', async () => {
    installFakeBridge()
    render(<AccountSettings />)

    expect(await screen.findByText(/Aucun compte pour l’instant/)).toBeInTheDocument()
  })

  it('sends the account and clears the fields, without echoing the credentials back', async () => {
    const add = vi.fn((): Promise<AccountsResult> => Promise.resolve({ accounts: [studio] }))
    installFakeBridge({ accounts: { add } })

    render(<AccountSettings />)
    await fillAndAdd()

    expect(add).toHaveBeenCalledWith('Studio', KEY, SECRET)
    await screen.findByText('Studio')

    // Nothing typed may survive in the rendered tree, input values included.
    expect(document.body.innerHTML).not.toContain(SECRET)
    expect(document.body.innerHTML).not.toContain(KEY)
  })

  it('keeps what was typed when the name is refused', async () => {
    installFakeBridge({
      accounts: { add: () => Promise.resolve({ accounts: [], failure: 'duplicate' }) },
    })

    render(<AccountSettings />)
    await fillAndAdd()

    expect(await screen.findByRole('alert')).toHaveTextContent('Un autre compte porte déjà ce nom.')
    // Retyping a key because a name clashed would be its own small punishment.
    expect(screen.getByLabelText(/Clé API/)).toHaveValue(KEY)
  })

  it('refuses to submit a name the list already holds, before asking the main process', async () => {
    const add = vi.fn((): Promise<AccountsResult> => Promise.resolve({ accounts: [] }))
    installFakeBridge({ accounts: { add } })
    useAccounts.setState({ accounts: [studio] })

    render(<AccountSettings />)
    await userEvent.type(screen.getByLabelText(/Nom/), 'studio')
    await userEvent.type(screen.getByLabelText(/Clé API/), KEY)
    await userEvent.type(screen.getByLabelText(/Secret API/), SECRET)

    expect(screen.getByRole('button', { name: 'Ajouter un compte' })).toBeDisabled()
    expect(add).not.toHaveBeenCalled()
  })

  it('reports a refusal from the main process rather than clearing the fields', async () => {
    installFakeBridge({ accounts: { add: () => Promise.reject(new Error('no keychain')) } })

    render(<AccountSettings />)
    await fillAndAdd()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le compte n’a pas pu être enregistré.',
    )
  })

  it.each<[ApiFailure, string]>([
    ['invalid-credentials', 'Clé ou secret API invalide.'],
    ['forbidden', 'Cette clé API n’a pas les droits requis.'],
    ['rate-limited', 'Trop de requêtes. Nouvelle tentative en cours…'],
    ['server', 'Le service de génération est momentanément indisponible.'],
    ['network', 'Impossible de joindre le service de génération. Vérifiez votre connexion.'],
    ['unexpected', 'Une erreur inattendue est survenue.'],
  ])('translates the %s failure into its own message', async (reason, message) => {
    installFakeBridge({
      settings: { authState: () => Promise.resolve({ authenticated: false, reason }) },
    })
    useAccounts.setState({ accounts: [studio] })

    render(<AccountSettings />)

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('says nothing about authentication while no account is stored', async () => {
    installFakeBridge()
    render(<AccountSettings />)

    await screen.findByText(/Aucun compte/)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('switches to another account on demand', async () => {
    const activate = vi.fn((): Promise<AccountsResult> => Promise.resolve({ accounts: [] }))
    installFakeBridge({ accounts: { activate } })
    useAccounts.setState({ accounts: [studio, { id: 'b', name: 'Client X', active: false }] })

    render(<AccountSettings />)
    await userEvent.click(screen.getByRole('button', { name: 'Utiliser ce compte' }))
    expect(activate).toHaveBeenCalledWith('b')
  })

  it('renames an account in place', async () => {
    const rename = vi.fn((): Promise<AccountsResult> => Promise.resolve({ accounts: [studio] }))
    installFakeBridge({ accounts: { rename } })
    useAccounts.setState({ accounts: [studio] })

    render(<AccountSettings />)
    await userEvent.click(screen.getByRole('button', { name: 'Renommer' }))
    // Scoped to the row: the add form carries a name field of its own.
    const field = within(screen.getByRole('listitem')).getByLabelText('Nom')
    await userEvent.clear(field)
    await userEvent.type(field, 'Client X')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(rename).toHaveBeenCalledWith('a', 'Client X')
  })

  /**
   * Three words, three consequences one cannot tell apart from them: what "Supprimer" leaves
   * behind is the whole question, and the row says none of it.
   */
  it('says what removing a key does not touch', () => {
    useAccounts.setState({ accounts: [studio] })
    render(<AccountSettings />)

    expect(screen.getByRole('button', { name: 'Supprimer' })).toHaveAttribute(
      'data-tooltip-content',
      'Oublie la clé sur cette machine ; le compte distant n’est pas touché',
    )
  })

  it('removes an account on demand', async () => {
    const remove = vi.fn((): Promise<AccountsResult> => Promise.resolve({ accounts: [] }))
    installFakeBridge({ accounts: { remove } })
    useAccounts.setState({ accounts: [studio] })

    render(<AccountSettings />)
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(remove).toHaveBeenCalledWith('a')
  })

  describe('the development account', () => {
    const environment: AccountSummary = {
      id: ENVIRONMENT_ACCOUNT_ID,
      name: 'Développement',
      active: true,
      readOnly: true,
    }

    beforeEach(() => {
      installFakeBridge()
      useAccounts.setState({ accounts: [environment, { ...studio, active: false }] })
    })

    // It is edited in `secrets/.env`. Buttons the main process could only refuse are worse than
    // no buttons at all — and the stored account beside it must keep its own.
    it('offers neither rename nor remove, and leaves the accounts beside it alone', () => {
      render(<AccountSettings />)
      const row = screen.getByText('Développement').closest('li')

      expect(within(row ?? document.body).queryByRole('button', { name: 'Renommer' })).toBeNull()
      expect(within(row ?? document.body).queryByRole('button', { name: 'Supprimer' })).toBeNull()
      expect(screen.getAllByRole('button', { name: 'Renommer' })).toHaveLength(1)
    })

    it('says where it comes from', () => {
      render(<AccountSettings />)

      expect(screen.getByText('Développement').closest('li')).toHaveTextContent('secrets/.env')
    })
  })
})
