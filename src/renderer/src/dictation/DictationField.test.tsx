import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fakeBridge'
import { useDictation } from '@/stores/dictation'
import { useSettings } from '@/stores/settings'
import { mountedDictationTarget } from './destination'
import { DictationField } from './DictationField'

const dictate = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: /Dicter/ }))
}

beforeEach(() => {
  installFakeBridge()
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useDictation.setState({ state: 'idle', partial: '', level: 0, failure: null, download: null })
})

describe('the microphone of a field', () => {
  /**
   * The defect this component exists for: pressing the button takes the focus off the field, so
   * the caret path found a `<button>` and wrote nothing — without saying so.
   */
  it('takes the sentences into its own field, wherever the focus went', async () => {
    const append = vi.fn()
    render(<DictationField append={append} />)

    await dictate()
    mountedDictationTarget()?.('un chat roux')

    expect(append).toHaveBeenCalledWith('un chat roux')
  })

  it('claims nothing until its own button is pressed', () => {
    render(<DictationField append={vi.fn()} />)

    expect(mountedDictationTarget()).toBeNull()
  })

  // Or the key would open the next session over another field and the words would land here.
  it('gives the sentences back when the session ends', async () => {
    render(<DictationField append={vi.fn()} />)

    await dictate()
    act(() => useDictation.setState({ state: 'listening' }))
    act(() => useDictation.setState({ state: 'idle' }))

    expect(mountedDictationTarget()).toBeNull()
  })

  // A refused microphone or a missing model ends the session without ever listening, and the
  // claim taken on the press would otherwise be held for the rest of the panel's life.
  it('gives them back when the session never opened', async () => {
    render(<DictationField append={vi.fn()} />)

    await dictate()
    act(() => useDictation.setState({ state: 'modelMissing' }))

    expect(mountedDictationTarget()).toBeNull()
  })

  it('shows the sentence being weighed while it listens', async () => {
    render(<DictationField append={vi.fn()} />)

    await dictate()
    act(() => useDictation.setState({ state: 'listening', partial: 'un chat' }))

    expect(screen.getByText('un chat')).toBeInTheDocument()
  })

  it('draws nothing at all when dictation is off in the settings', () => {
    useSettings.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        dictation: { ...DEFAULT_SETTINGS.dictation, enabled: false },
      },
    })
    render(<DictationField append={vi.fn()} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
