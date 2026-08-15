import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { mountedDictationTarget } from '@/dictation/destination'
import { installFakeBridge } from '@/services/fake-bridge'
import { useAssistant } from '@/stores/assistant'
import { useDictation } from '@/stores/dictation'
import { useSettings } from '@/stores/settings'
import { AssistantOverlay } from './AssistantOverlay'
import { mountedConfirmer } from './confirm'

const say = vi.hoisted(() => vi.fn<(utterance: string) => Promise<void>>())

beforeEach(() => {
  say.mockReset()
  say.mockResolvedValue(undefined)
  useAssistant.setState({
    open: true,
    listening: false,
    turns: [],
    busy: false,
    asked: null,
    spent: 0,
    say,
  })
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useDictation.setState({ partial: '', state: 'idle' })
  installFakeBridge()
})

afterEach(() => {
  useAssistant.setState({ open: false, listening: false, asked: null })
})

describe('the assistant modal', () => {
  it('shows nothing until it is opened', () => {
    useAssistant.setState({ open: false })
    const { container } = render(<AssistantOverlay />)

    expect(container).toBeEmptyDOMElement()
  })

  it('sends what was typed, and clears the field', async () => {
    render(<AssistantOverlay />)

    await userEvent.type(screen.getByRole('textbox'), 'ouvre un fichier 3D')
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }))

    expect(say).toHaveBeenCalledWith('ouvre un fichier 3D')
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('draws the thread, refusal and all', () => {
    useAssistant.setState({
      turns: [
        {
          id: 1,
          said: 'génère un casque',
          answered: 'Je prépare la génération.',
          steps: [{ action: 'generator.submit', refusal: 'declined' }],
          lost: false,
        },
      ],
    })
    render(<AssistantOverlay />)

    expect(screen.getByText('génère un casque')).toBeInTheDocument()
    expect(screen.getByText(/Vous avez refusé cette action/)).toBeInTheDocument()
  })

  // Shown as the fields show it — a hypothesis, never something to mistake for what was sent.
  // While it LISTENS, since that is the only time one exists: what is left in the store between
  // two sessions is a leftover, not a sentence anybody is speaking.
  it('shows the sentence still being spoken', () => {
    useDictation.setState({ partial: 'ouvre un fichier', state: 'listening' })
    render(<AssistantOverlay />)

    expect(screen.getByText('ouvre un fichier')).toBeInTheDocument()
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
   * Typed text is protected by the disabled field; the voice had no equivalent, on the very path
   * this batch opened.
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

  it('quotes what an action will cost before asking, and answers with the buttons', async () => {
    const answered = vi.fn()
    useAssistant.setState({
      asked: {
        request: { action: 'generator.submit', commitment: 'credits', estimate: 12 },
        answer: answered,
      },
    })
    render(<AssistantOverlay />)

    expect(screen.getByText(/~12 UC/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Autoriser' }))

    expect(answered).toHaveBeenCalledWith(true)
  })

  /** Inventing a figure to fill the sentence would be worse than admitting there is none. */
  it('says the cost is unknown rather than making one up', () => {
    useAssistant.setState({
      asked: {
        request: { action: 'generator.submit', commitment: 'credits', estimate: null },
        answer: vi.fn(),
      },
    })
    render(<AssistantOverlay />)

    expect(screen.getByText(/n’a pas pu en estimer le montant/)).toBeInTheDocument()
  })

  // The setting lives here rather than in the preferences: one wants a better model mid-sentence.
  it('writes the model straight to the settings', async () => {
    const write = vi.fn(() => Promise.resolve())
    useSettings.setState({ write })
    render(<AssistantOverlay />)

    await userEvent.selectOptions(screen.getByRole('combobox'), 'claude-opus-4-8')

    expect(write).toHaveBeenCalledWith({ assistant: { model: 'claude-opus-4-8' } })
  })

  /**
   * The ordering the whole arrangement rests on, and it is held by the mount rather than by a
   * race: `start` crosses to the main process before any stream opens, so a sentence settling in
   * that window with no target claimed would go to the caret — into whatever field it sits in.
   */
  it('claims the spoken word before it opens the microphone', () => {
    const claimed: boolean[] = []
    const start = vi.fn(() => {
      claimed.push(mountedDictationTarget() !== null)
      return Promise.resolve()
    })
    useAssistant.setState({ open: false })
    useDictation.setState({ start })
    const { rerender } = render(<AssistantOverlay />)

    useAssistant.setState({ listening: true })
    rerender(<AssistantOverlay />)

    expect(claimed).toEqual([true])
  })

  // Closing the door stops the talking: the next sentence would otherwise pour into whatever
  // field the caret sits in, with nothing on screen saying the address had changed.
  it('closes the microphone when it is dismissed mid-sentence', async () => {
    const stop = vi.fn(() => Promise.resolve())
    useAssistant.setState({ listening: true })
    useDictation.setState({ stop, state: 'listening' })
    render(<AssistantOverlay />)

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(stop).toHaveBeenCalled()
    expect(useAssistant.getState().listening).toBe(false)
  })

  /**
   * A microphone that never opened — the model still to fetch, a refused device — must not leave
   * the claim standing: every later sentence dictated into a field would come here instead, and
   * nothing on screen would explain why.
   */
  it('gives the words back when the microphone would not open', async () => {
    useAssistant.setState({ open: false })
    useDictation.setState({ start: () => Promise.resolve(), state: 'modelMissing' })
    const { rerender } = render(<AssistantOverlay />)

    useAssistant.setState({ listening: true })
    rerender(<AssistantOverlay />)
    await vi.waitFor(() => expect(useAssistant.getState().listening).toBe(false))

    expect(mountedDictationTarget()).toBeNull()
  })

  // Nothing else in the studio may answer for the person, and only a mounted modal may at all.
  it('is the one place a question can be asked, and only while it is up', () => {
    const { unmount } = render(<AssistantOverlay />)
    expect(mountedConfirmer()).toBe(useAssistant.getState().ask)

    unmount()
    expect(mountedConfirmer()).toBeNull()
  })
})
