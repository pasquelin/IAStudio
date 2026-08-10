import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SttState } from '@shared/domain/dictation'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDictation } from '@/stores/dictation'
import { useSettings } from '@/stores/settings'
import { DictationButton } from './DictationButton'

function show(state: SttState = 'idle', level = 0) {
  useDictation.setState({ state, partial: '', level, failure: null, download: null })
  render(<DictationButton tooltip={TIP_BOTTOM} />)
}

beforeEach(() => {
  installFakeBridge()
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useDictation.setState({ state: 'idle', partial: '', level: 0, failure: null, download: null })
})

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

  it('waits rather than takes a click while the engine loads', () => {
    show('loadingEngine')

    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByText('Chargement du modèle…')).toBeInTheDocument()
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

  // What the model needs and what the system refused belong to the whole application, not to
  // one field: a form with two long text fields would offer the same 640 MB twice.
  it('never carries what belongs to the status line', () => {
    for (const state of ['modelMissing', 'downloadingModel', 'permissionRequired'] as SttState[]) {
      const { unmount } = render(<DictationButton tooltip={TIP_BOTTOM} />)
      useDictation.setState({ state })

      expect(screen.queryByText(/Télécharger|réglages du système/)).not.toBeInTheDocument()
      unmount()
    }
  })
})

describe('the level meter', () => {
  // Five bars, and a level that wobbles without lighting another one renders nothing: the
  // level changes ten times a second, and it must not re-render the field it sits under.
  it('lights bars in proportion to the voice', () => {
    show('listening', 1)
    const lit = document.querySelectorAll('[role="img"] .bg-accent')

    expect(lit).toHaveLength(5)
  })

  it('lights none of them in silence', () => {
    show('listening', 0)

    expect(document.querySelectorAll('[role="img"] .bg-accent')).toHaveLength(0)
  })
})
