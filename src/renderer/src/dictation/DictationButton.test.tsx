import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import type { SttFailure, SttState } from '@shared/domain/dictation'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDictation } from '@/stores/dictation'
import { useSettings } from '@/stores/settings'
import { DictationButton } from './DictationButton'

function show(
  state: SttState = 'idle',
  extra: { failure?: SttFailure; download?: { received: number; total: number } } = {},
) {
  useDictation.setState({
    state,
    partial: '',
    level: 0,
    failure: extra.failure ?? null,
    download: extra.download ?? null,
  })
  render(<DictationButton />)
}

beforeEach(() => {
  installFakeBridge()
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useDictation.setState({ state: 'idle', partial: '', level: 0, failure: null, download: null })
})

afterEach(() => vi.unstubAllGlobals())

describe('the microphone button', () => {
  it('offers to dictate when nothing is running', () => {
    show('idle')

    expect(screen.getByRole('button', { name: /Dicter/ })).toBeInTheDocument()
  })

  it('offers to stop while it listens, and shows the level', () => {
    show('listening')

    expect(screen.getByRole('button', { name: /Arrêter la dictée/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Je vous écoute…' })).toBeInTheDocument()
  })

  it('starts a session on a click', async () => {
    const start = vi.fn(() => Promise.resolve())
    useDictation.setState({ start })
    show('idle')

    await userEvent.click(screen.getByRole('button', { name: /Dicter/ }))

    expect(start).toHaveBeenCalled()
  })

  // Hidden rather than greyed: a control switched off in the settings has nothing to say, and a
  // dead microphone beside every prompt would be a permanent question.
  it('shows nothing at all when dictation is switched off', () => {
    useSettings.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        dictation: { ...DEFAULT_SETTINGS.dictation, enabled: false },
      },
    })
    show('idle')

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('the model it needs', () => {
  it('says what is missing, and how big it is', () => {
    show('modelMissing')

    expect(screen.getByText(/besoin d’un modèle/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Télécharger le modèle/ })).toBeInTheDocument()
  })

  it('shows how far the download has got, and offers to stop it', () => {
    show('downloadingModel', { download: { received: 335_239_386, total: 670_478_772 } })

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    expect(screen.getByRole('button', { name: /Interrompre/ })).toBeInTheDocument()
  })

  // A window opened mid-download learns where it is from the state it read, not from an event
  // it was not there for.
  it('draws nothing rather than a full bar when the size is not known yet', () => {
    show('downloadingModel', { download: { received: 0, total: 0 } })

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
})

describe('when it cannot listen', () => {
  it('leads to the system settings after a refusal', async () => {
    const openPrivacySettings = vi.fn(() => Promise.resolve())
    useDictation.setState({ openPrivacySettings })
    show('permissionRequired')

    expect(screen.getByRole('status')).toHaveTextContent(/accès au micro a été refusé/)
    await userEvent.click(screen.getByRole('button', { name: /réglages du système/ }))

    expect(openPrivacySettings).toHaveBeenCalled()
  })

  it('names the failure in the language of the person reading it', () => {
    show('error', { failure: { code: 'engineCrashed', message: 'exited with code 139' } })

    expect(screen.getByRole('status')).toHaveTextContent('La reconnaissance vocale s’est arrêtée.')
  })

  // The detail names a file path or an ONNX symbol: it belongs in the log, not on screen.
  it('never shows the detail of a failure', () => {
    show('error', { failure: { code: 'engineCrashed', message: 'exited with code 139' } })

    expect(screen.queryByText(/139/)).not.toBeInTheDocument()
  })
})
