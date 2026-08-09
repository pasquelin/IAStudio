import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { SttState } from '@shared/domain/dictation'
import { useDictation } from '@/stores/dictation'
import { DictationStatus } from './DictationStatus'

beforeEach(() => {
  useDictation.setState({ state: 'idle' })
})

describe('the microphone indicator', () => {
  // An application that records has to show it, and the button that started the session may be
  // behind a panel or in another workspace by then.
  it('says the microphone is on while it listens', () => {
    useDictation.setState({ state: 'listening' })
    render(<DictationStatus />)

    expect(screen.getByRole('status')).toHaveTextContent('Micro actif')
  })

  it('says nothing the rest of the time', () => {
    const quiet: SttState[] = ['idle', 'ready', 'loadingEngine', 'modelMissing', 'error']

    for (const state of quiet) {
      useDictation.setState({ state })
      const { unmount } = render(<DictationStatus />)

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      unmount()
    }
  })
})
