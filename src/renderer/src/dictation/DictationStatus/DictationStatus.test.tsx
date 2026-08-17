import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SttFailure, SttState } from '@shared/domain/dictation'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fake-bridge'
import { useAssistant } from '@/stores/assistant'
import { useDictation } from '@/stores/dictation'
import { useSettings } from '@/stores/settings'
import { DictationStatus } from './DictationStatus'

function show(
  state: SttState,
  extra: { failure?: SttFailure; download?: { received: number; total: number } } = {},
) {
  useDictation.setState({
    state,
    failure: extra.failure ?? null,
    download: extra.download ?? null,
  })
  render(<DictationStatus />)
}

beforeEach(() => {
  installFakeBridge()
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useAssistant.setState({ open: false })
  useDictation.setState({ state: 'idle', partial: '', failure: null, download: null })
})

describe('what dictation says to the whole application', () => {
  /**
   * An application that records has to show it, and the button that started the session may be
   * behind a panel or in another workspace by then.
   *
   * Saying WHERE the words are going rather than only that the microphone is on: the same
   * microphone types into a prompt and talks to the assistant, and nothing else on screen tells
   * the two apart — the assistant claims the spoken word without necessarily showing its window.
   */
  it('says the words are going to the field it is dictating into', () => {
    show('listening')

    expect(screen.getByRole('status')).toHaveTextContent('Dictée vers le champ')
  })

  it('says the words are going to the assistant when the assistant has claimed them', () => {
    useAssistant.setState({ open: true })
    show('listening')

    expect(screen.getByRole('status')).toHaveTextContent('L’assistant vous écoute')
  })

  // The proof that it is hearing, which no indicator can give. It is also the only place the
  // hypothesis shows at all once the assistant's window is closed.
  it('shows the sentence as it is still being weighed', () => {
    useDictation.setState({ partial: 'ouvre un nouveau fichier 3D' })
    show('listening')

    expect(screen.getByText('ouvre un nouveau fichier 3D')).toBeInTheDocument()
  })

  it('says nothing when there is nothing to say', () => {
    for (const state of ['idle', 'ready', 'loadingEngine'] as SttState[]) {
      const { unmount } = render(<DictationStatus />)
      useDictation.setState({ state })

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      unmount()
    }
  })

  // Here rather than beside a field: a form with two long text fields would otherwise offer two
  // buttons to fetch the same 640 MB.
  it('offers the model once, with its size', async () => {
    const downloadModel = vi.fn(() => Promise.resolve())
    useDictation.setState({ downloadModel })
    show('modelMissing')

    await userEvent.click(screen.getByRole('button', { name: /Télécharger le modèle/ }))

    expect(downloadModel).toHaveBeenCalled()
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

  it('leads to the system settings after a refusal', async () => {
    const openPrivacySettings = vi.fn(() => Promise.resolve())
    useDictation.setState({ openPrivacySettings })
    show('permissionRequired')

    // By its button role, not `status`: it is the only way out of a refused microphone, and a
    // `role="status"` would take that role away from it for anyone browsing by button.
    await userEvent.click(screen.getByRole('button'))

    expect(openPrivacySettings).toHaveBeenCalled()
  })

  it('names the failure in the language of the person reading it', () => {
    show('error', { failure: { code: 'engineCrashed', message: 'exited with code 139' } })

    expect(screen.getByRole('status')).toHaveTextContent('La reconnaissance vocale s’est arrêtée.')
  })

  // The detail names a file path or an ONNX symbol: it belongs in the journal, not on screen.
  it('never shows the detail of a failure', () => {
    show('error', { failure: { code: 'engineCrashed', message: 'exited with code 139' } })

    expect(screen.queryByText(/139/)).not.toBeInTheDocument()
  })

  it('shows nothing at all when dictation is switched off', () => {
    useSettings.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        dictation: { ...DEFAULT_SETTINGS.dictation, enabled: false },
      },
    })
    show('modelMissing')

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
