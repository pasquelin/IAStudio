import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiFailure } from '@shared/domain/failure'
import type { AuthState } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fake-bridge'
import { useSettings } from '@/stores/settings'
import { AccountSettings } from './AccountSettings'

const KEY = 'api_key_visible'
const SECRET = 's3cr3t_visible'

async function signIn(): Promise<void> {
  await userEvent.type(screen.getByLabelText(/Clé API/), KEY)
  await userEvent.type(screen.getByLabelText(/Secret API/), SECRET)
  await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
}

describe('AccountSettings', () => {
  beforeEach(() => {
    useSettings.setState({ auth: { authenticated: false, reason: 'missing' } })
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

  it('sends the credentials and reports success without echoing them back', async () => {
    const setCredentials = vi.fn((): Promise<AuthState> => Promise.resolve({ authenticated: true }))
    installFakeBridge({ settings: { setCredentials } })

    render(<AccountSettings />)
    await signIn()

    expect(setCredentials).toHaveBeenCalledWith(KEY, SECRET)
    await screen.findByText('Connecté')

    // Nothing typed may survive in the rendered tree, input values included.
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

    render(<AccountSettings />)
    await signIn()

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('says nothing before an attempt has been made', () => {
    installFakeBridge()
    render(<AccountSettings />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('re-asks the main process after signing out, rather than assuming the answer', async () => {
    const authState = vi.fn((): Promise<AuthState> => Promise.resolve({ authenticated: true }))
    const forgetCredentials = vi.fn(() => Promise.resolve())
    installFakeBridge({ settings: { authState, forgetCredentials } })

    useSettings.setState({ auth: { authenticated: true } })
    render(<AccountSettings />)

    await userEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))

    expect(forgetCredentials).toHaveBeenCalledOnce()
    // A development `secrets/.env` may still answer: only the main process knows.
    await waitFor(() => expect(authState).toHaveBeenCalled())
  })
})
