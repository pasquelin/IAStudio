import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fakeBridge'
import { useDictation } from '@/stores/dictation'
import { useSettings } from '@/stores/settings'
import { DictationField } from './DictationField'

beforeEach(() => {
  installFakeBridge()
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useDictation.setState({ state: 'idle', partial: '', level: 0, failure: null, download: null })
})

describe('the microphone of a field', () => {
  it('shows the sentence being weighed while it listens', () => {
    render(<DictationField />)

    act(() => useDictation.setState({ state: 'listening', partial: 'un chat' }))

    expect(screen.getByText('un chat')).toBeInTheDocument()
  })

  it('says nothing at all between sessions', () => {
    render(<DictationField />)

    expect(screen.queryByText(/Je vous écoute/)).not.toBeInTheDocument()
  })

  it('draws nothing when dictation is off in the settings', () => {
    useSettings.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        dictation: { ...DEFAULT_SETTINGS.dictation, enabled: false },
      },
    })
    render(<DictationField />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
