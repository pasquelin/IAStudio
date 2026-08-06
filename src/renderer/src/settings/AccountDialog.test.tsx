import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiFailure } from '@shared/domain/failure'
import type { AuthState } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fake-bridge'
import { useSettings } from '@/stores/settings'
import { AccountDialog } from './AccountDialog'

const KEY = 'api_key_visible'
const SECRET = 's3cr3t_visible'

function openDialog(): void {
  useSettings.setState({
    accountDialogOpen: true,
    auth: { authenticated: false, reason: 'missing' },
  })
}

async function signIn(): Promise<void> {
  await userEvent.type(screen.getByLabelText(/Clé API/), KEY)
  await userEvent.type(screen.getByLabelText(/Secret API/), SECRET)
  await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
}

describe('AccountDialog', () => {
  beforeEach(() => {
    useSettings.setState({
      accountDialogOpen: false,
      auth: { authenticated: false, reason: 'missing' },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stays closed until it is asked to open', () => {
    installFakeBridge()
    render(<AccountDialog />)
    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open')
  })

  it('sends the credentials and reports success without echoing them back', async () => {
    const setCredentials = vi.fn((): Promise<AuthState> => Promise.resolve({ authenticated: true }))
    installFakeBridge({ settings: { setCredentials } })

    render(<AccountDialog />)
    openDialog()
    await signIn()

    expect(setCredentials).toHaveBeenCalledWith(KEY, SECRET)
    await screen.findByText('Connecté')

    // The secret must not survive anywhere in the rendered tree, input values included.
    expect(document.body.innerHTML).not.toContain(SECRET)
    expect(document.body.innerHTML).not.toContain(KEY)
  })

  it.each<[ApiFailure, string]>([
    ['invalid-credentials', 'Clé ou secret API invalide.'],
    ['forbidden', 'Cette clé API n’a pas les droits requis.'],
    ['rate-limited', 'Trop de requêtes. Nouvelle tentative en cours…'],
    ['server', 'Le service Scenario est momentanément indisponible.'],
    ['network', 'Impossible de joindre Scenario. Vérifiez votre connexion.'],
    ['unexpected', 'Une erreur inattendue est survenue.'],
  ])('translates the %s failure into its own message', async (reason, message) => {
    installFakeBridge({
      settings: { setCredentials: () => Promise.resolve({ authenticated: false, reason }) },
    })

    render(<AccountDialog />)
    openDialog()
    await signIn()

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('says nothing before an attempt has been made', () => {
    installFakeBridge()
    render(<AccountDialog />)
    openDialog()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('re-asks the main process after signing out, rather than assuming the answer', async () => {
    const authState = vi.fn((): Promise<AuthState> => Promise.resolve({ authenticated: true }))
    const forgetCredentials = vi.fn(() => Promise.resolve())
    installFakeBridge({ settings: { authState, forgetCredentials } })

    useSettings.setState({ accountDialogOpen: true, auth: { authenticated: true } })
    render(<AccountDialog />)

    await userEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))

    expect(forgetCredentials).toHaveBeenCalledOnce()
    // A development `secrets/.env` may still answer: only the main process knows.
    await waitFor(() => expect(authState).toHaveBeenCalled())
  })
})
