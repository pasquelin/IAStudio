import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
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
    turns: [],
    busy: false,
    asked: null,
    spent: 0,
    say,
  })
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useDictation.setState({ partial: '' })
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
  it('shows the sentence still being spoken', () => {
    useDictation.setState({ partial: 'ouvre un fichier' })
    render(<AssistantOverlay />)

    expect(screen.getByText('ouvre un fichier')).toBeInTheDocument()
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

  // Nothing else in the studio may answer for the person, and only a mounted modal may at all.
  it('is the one place a question can be asked, and only while it is up', () => {
    const { unmount } = render(<AssistantOverlay />)
    expect(mountedConfirmer()).toBe(useAssistant.getState().ask)

    unmount()
    expect(mountedConfirmer()).toBeNull()
  })
})
