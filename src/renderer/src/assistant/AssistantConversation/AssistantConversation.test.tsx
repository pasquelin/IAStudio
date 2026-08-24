import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { aiOverview, roleRow } from '@shared/domain/aiOverview-fixtures'
import { ASSISTANT_ROLE } from '@shared/domain/aiRole'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAiModels } from '@/stores/aiModels'
import { useAssistant } from '@/stores/assistant'
import { useDictation } from '@/stores/dictation'
import { useLayouts } from '@/stores/layouts'
import { useSettings } from '@/stores/settings'
import { AssistantConversation } from './AssistantConversation'

const say = vi.hoisted(() => vi.fn<(utterance: string) => Promise<void>>())

/** Nothing chosen for the assistant role, which is what a fresh studio looks like. */
const unserved = () =>
  useAiModels.setState({
    overview: aiOverview({ roles: [roleRow({ role: ASSISTANT_ROLE, provider: null })] }),
  })

beforeEach(() => {
  say.mockReset()
  say.mockResolvedValue(undefined)
  useAssistant.setState({ turns: [], busy: false, asked: null, spent: 0, draft: '', say })
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useDictation.setState({ partial: '', state: 'idle' })
  useLayouts.setState({ activeWorkspace: 'image' })
  useAiModels.setState({
    overview: aiOverview({
      roles: [
        roleRow({ role: ASSISTANT_ROLE, provider: { kind: 'cloud', providerId: 'scenario' } }),
      ],
    }),
  })
  installFakeBridge()
})

describe('the assistant conversation', () => {
  it('sends what was typed, and clears the field', async () => {
    render(<AssistantConversation />)

    await userEvent.type(screen.getByRole('textbox'), 'ouvre un fichier 3D')
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }))

    expect(say).toHaveBeenCalledWith('ouvre un fichier 3D')
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  /**
   * The field sends on Enter, so a message typed through an input method would leave halfway
   * through its last character — Enter picks the candidate, it does not end the sentence.
   */
  it('leaves Enter to the input method while it is composing a character', async () => {
    render(<AssistantConversation />)

    await userEvent.type(screen.getByRole('textbox'), 'ouvre un')
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', isComposing: true })

    expect(say).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toHaveValue('ouvre un')
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
    render(<AssistantConversation />)

    expect(screen.getByText('génère un casque')).toBeInTheDocument()
    expect(screen.getByText(/Vous avez refusé cette action/)).toBeInTheDocument()
  })

  // Shown as the fields show it — a hypothesis, never something to mistake for what was sent.
  // While it LISTENS, since that is the only time one exists: what is left in the store between
  // two sessions is a leftover, not a sentence anybody is speaking.
  it('shows the sentence still being spoken', () => {
    useDictation.setState({ partial: 'ouvre un fichier', state: 'listening' })
    render(<AssistantConversation voice />)

    expect(screen.getByText('ouvre un fichier')).toBeInTheDocument()
  })

  it('quotes what an action will cost before asking, and answers with the buttons', async () => {
    const answered = vi.fn()
    useAssistant.setState({
      asked: {
        request: { action: 'generator.submit', commitment: 'credits', estimate: 12 },
        answer: answered,
      },
    })
    render(<AssistantConversation />)

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
    render(<AssistantConversation />)

    expect(screen.getByText(/n’a pas pu en estimer le montant/)).toBeInTheDocument()
  })

  /**
   * 🛑 It WRITES the sentence. An action of this studio can spend, and a suggestion that sent on
   * its own would start the spending on the person's behalf.
   */
  it('writes a starter into the field rather than sending it', async () => {
    render(<AssistantConversation />)

    await userEvent.click(screen.getByRole('button', { name: 'Génère une image' }))

    expect(screen.getByRole('textbox')).toHaveValue('Génère une image')
    expect(say).not.toHaveBeenCalled()
  })

  // A suggestion about pictures, in a timeline, is noise: what is offered is what the space at
  // hand can actually be asked for.
  it('offers the starters of the space one is in', () => {
    useLayouts.setState({ activeWorkspace: 'audio' })
    render(<AssistantConversation />)

    expect(screen.getByRole('button', { name: 'Génère un son' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Génère une image' })).not.toBeInTheDocument()
  })

  /**
   * The gate belongs to the conversation, not to one of its hosts: ⌘K used to open a field that
   * could only produce a lost turn. A choice, never a fill-in — a key held and a model installed
   * still leave the role unserved until the person ticks one.
   */
  it('asks for a model instead of a field when nothing answers', async () => {
    const openSection = vi.fn()
    unserved()
    useSettings.setState({ openSection })
    render(<AssistantConversation />)

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Choisir un modèle' }))

    expect(openSection).toHaveBeenCalledWith('ai')
  })

  /**
   * 🛑 The composer alone. `registerConfirmer` answers for MCP actions too, which need no
   * assistant model: swallowing the whole conversation left a question on screen that could not
   * be read, granted, or priced — the only way out being the close button, which declines.
   */
  it('still shows a question, and the thread, when nothing answers', () => {
    unserved()
    useAssistant.setState({
      turns: [{ id: 1, said: 'génère un casque', answered: '', steps: [], lost: false }],
      asked: {
        request: { action: 'generator.submit', commitment: 'credits', estimate: 12 },
        answer: vi.fn(),
      },
    })
    render(<AssistantConversation />)

    expect(screen.getByText('génère un casque')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Autoriser' })).toBeInTheDocument()
  })

  /**
   * The microphone goes where the claim is — only the overlay registers a dictation target.
   * Offered without one, a settled sentence falls to the caret, which the button itself just
   * took, and the words are dropped with nothing on screen.
   */
  it('offers the microphone only to a host that claimed the spoken word', () => {
    const { rerender } = render(<AssistantConversation />)
    expect(screen.queryByRole('button', { name: /Dicter/ })).not.toBeInTheDocument()

    rerender(<AssistantConversation voice />)
    expect(screen.getByRole('button', { name: /Dicter/ })).toBeInTheDocument()
  })

  // Beside an exchange they are an interruption: the blank page is the only thing they answer.
  it('drops the starters once the conversation has begun', () => {
    useAssistant.setState({
      turns: [{ id: 1, said: 'bonjour', answered: 'Bonjour.', steps: [], lost: false }],
    })
    render(<AssistantConversation />)

    expect(screen.queryByRole('button', { name: 'Génère une image' })).not.toBeInTheDocument()
  })
})
