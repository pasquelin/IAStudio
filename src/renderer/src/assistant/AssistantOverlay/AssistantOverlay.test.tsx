import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { mountedDictationTarget } from '@/dictation/destination'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAssistant } from '@/stores/assistant'
import { useDictation } from '@/stores/dictation'
import { useSettings } from '@/stores/settings'
import { AssistantOverlay } from './AssistantOverlay'
import { mountedConfirmer } from '../confirm'

const say = vi.hoisted(() => vi.fn<(utterance: string) => Promise<void>>())

beforeEach(() => {
  say.mockReset()
  say.mockResolvedValue(undefined)
  useAssistant.setState({
    open: true,
    turns: [],
    busy: false,
    asked: null,
    spent: 0,
    draft: '',
    say,
  })
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useDictation.setState({ partial: '', state: 'idle' })
  installFakeBridge()
})

afterEach(() => {
  useAssistant.setState({ open: false, asked: null })
})

describe('the assistant modal', () => {
  it('shows nothing until it is opened', () => {
    useAssistant.setState({ open: false })
    const { container } = render(<AssistantOverlay />)

    expect(container).toBeEmptyDOMElement()
  })

  // The conversation itself is `AssistantConversation`'s, and the empty centre stages the same one. What
  // is checked here is that this window stages it at all.
  it('stages the conversation', () => {
    render(<AssistantOverlay />)

    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  /**
   * Being OPEN is the test, and not a caret inside the field: one dictates with the hands off
   * the keyboard, so asking for a focused field would make the voice path unreachable by voice.
   * Closed, the words go back to the caret, which is where they have always gone.
   */
  it('claims the spoken word while it is up, and gives it back when it closes', () => {
    const { rerender } = render(<AssistantOverlay />)
    mountedDictationTarget()?.('ouvre un fichier 3D')
    expect(say).toHaveBeenCalledWith('ouvre un fichier 3D')

    useAssistant.setState({ open: false })
    rerender(<AssistantOverlay />)

    expect(mountedDictationTarget()).toBeNull()
  })

  /**
   * A sentence spoken while a plan is running used to vanish whole: not sent (`say` returns on
   * `busy`), not inserted at the caret (the claim above short-circuits that), and shown nowhere.
   * Typed text is protected by the disabled field; the voice had no equivalent.
   */
  it('keeps a sentence spoken while it is busy, in the field', async () => {
    useAssistant.setState({ busy: true })
    render(<AssistantOverlay />)

    mountedDictationTarget()?.('et maintenant génère')

    expect(say).not.toHaveBeenCalled()
    expect(await screen.findByDisplayValue('et maintenant génère')).toBeInTheDocument()
  })

  /** The decision this modal exists to hold: what a conversation has cost, as it costs it. */
  it('shows the running total', () => {
    useAssistant.setState({ spent: 2.5 })
    render(<AssistantOverlay />)

    // A plain space in the expectation: the bundle binds the unit with a no-break space, which
    // the matchers here normalise away before comparing.
    expect(screen.getByRole('status')).toHaveTextContent('2,5 UC')
  })

  /**
   * Closing the door stops the talking: the next sentence would otherwise pour into whatever
   * field the caret sits in, with nothing on screen saying the address had changed.
   *
   * Measured on screen rather than deduced — a first version of this guarded on a flag the
   * window's own microphone never sets, so it was green while the microphone stayed running and
   * the status line quietly changed to "dictating to the field".
   */
  it('closes the microphone when it is dismissed mid-sentence', async () => {
    const stop = vi.fn(() => Promise.resolve())
    useDictation.setState({ stop, state: 'listening' })
    render(<AssistantOverlay />)

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(stop).toHaveBeenCalled()
  })

  // Nothing to close, so nothing crosses to the main process: every dismissal would otherwise
  // spend a round trip ending a session that was never running.
  it('says nothing to the microphone when none was open', async () => {
    const stop = vi.fn(() => Promise.resolve())
    useDictation.setState({ stop, state: 'idle' })
    render(<AssistantOverlay />)

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(stop).not.toHaveBeenCalled()
  })

  // Nothing else in the studio may answer for the person, and only a mounted modal may at all.
  // 🛑 The centre stages the same conversation and claims NONE of this: `createMountedHost` keeps
  // one holder, and the centre goes away with the first document opened.
  it('is the one place a question can be asked, and only while it is up', () => {
    const { unmount } = render(<AssistantOverlay />)
    expect(mountedConfirmer()).toBe(useAssistant.getState().ask)

    unmount()
    expect(mountedConfirmer()).toBeNull()
  })
})
