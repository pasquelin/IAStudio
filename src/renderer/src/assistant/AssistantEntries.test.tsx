import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fake-bridge'
import { useAssistant } from '@/stores/assistant'
import { useDictation } from '@/stores/dictation'
import { useSettings } from '@/stores/settings'
import { AssistantEntries } from './AssistantEntries'

function withoutDictation() {
  useSettings.setState({
    settings: {
      ...DEFAULT_SETTINGS,
      dictation: { ...DEFAULT_SETTINGS.dictation, enabled: false },
    },
  })
}

beforeEach(() => {
  installFakeBridge()
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useAssistant.setState({ open: false, listening: false })
  useDictation.setState({ state: 'idle', partial: '', level: 0, failure: null, download: null })
})

describe('the assistant entries of the title bar', () => {
  it('opens the assistant to write to it', async () => {
    render(<AssistantEntries />)

    await userEvent.click(screen.getByRole('button', { name: /Écrire à l’assistant/ }))

    expect(useAssistant.getState().open).toBe(true)
  })

  /**
   * The whole point of the microphone being a separate entry: one talks to the studio in order to
   * watch it act, and a modal over the screen hides the very thing the sentence was about.
   */
  it('hands the spoken word to the assistant without opening its window', async () => {
    render(<AssistantEntries />)

    await userEvent.click(screen.getByRole('button', { name: /Parler à l’assistant/ }))

    expect(useAssistant.getState().listening).toBe(true)
    expect(useAssistant.getState().open).toBe(false)
  })

  it('gives the words back when pressed again', async () => {
    useAssistant.setState({ listening: true })
    useDictation.setState({ state: 'listening' })
    render(<AssistantEntries />)

    await userEvent.click(screen.getByRole('button', { name: /Cesser de parler/ }))

    expect(useAssistant.getState().listening).toBe(false)
  })

  /**
   * The same microphone dictates into a prompt. Reading as "you are talking to the assistant"
   * while the words are going to a field is the defect this batch exists to remove, and the
   * button says so by keeping its resting name.
   */
  it('says nothing about the assistant while the microphone serves a field', () => {
    useDictation.setState({ state: 'listening' })
    render(<AssistantEntries />)

    expect(screen.getByRole('button', { name: /Parler à l’assistant/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cesser de parler/ })).not.toBeInTheDocument()
  })

  // Rather than cut a person off mid-sentence: the session carries on, its words change address.
  it('takes over a session already running, instead of ending it', async () => {
    const stop = vi.fn(() => Promise.resolve())
    useDictation.setState({ state: 'listening', stop })
    render(<AssistantEntries />)

    await userEvent.click(screen.getByRole('button', { name: /Parler à l’assistant/ }))

    expect(useAssistant.getState().listening).toBe(true)
    expect(stop).not.toHaveBeenCalled()
  })

  /**
   * Hidden rather than greyed, as every microphone of the studio is. The way in by writing stays,
   * which is the whole reason these are two buttons rather than one that guesses.
   */
  it('drops the microphone when dictation is switched off, and keeps the way in by writing', () => {
    withoutDictation()
    render(<AssistantEntries />)

    expect(screen.queryByRole('button', { name: /Parler à l’assistant/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Écrire à l’assistant/ })).toBeInTheDocument()
  })
})
