import { act, fireEvent, render, screen, within } from '@testing-library/react'
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
import { focusChat } from '../chatPanel'
import { mountedDictationTarget } from '@/dictation/destination'
import { AssistantConversation } from './AssistantConversation'

const say = vi.hoisted(() => vi.fn<(utterance: string) => Promise<void>>())
const stop = vi.hoisted(() => vi.fn())

/** Nothing chosen for the assistant role, which is what a fresh studio looks like. */
const unserved = () =>
  useAiModels.setState({
    overview: aiOverview({ roles: [roleRow({ role: ASSISTANT_ROLE, provider: null })] }),
  })

beforeEach(() => {
  say.mockReset()
  say.mockResolvedValue(undefined)
  stop.mockReset()
  useAssistant.setState({
    turns: [],
    busy: false,
    round: 0,
    stopping: false,
    asked: null,
    spent: 0,
    draft: '',
    say,
    stop,
  })
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useDictation.setState({ partial: '', state: 'idle' })
  // 🛑 `home` starts TRUE in the store, so a suite that only names the space still reads the
  // home surface — and the suggestions of a screen holding no document.
  useLayouts.setState({ activeWorkspace: 'image', home: false })
  useAiModels.setState({
    overview: aiOverview({
      roles: [
        roleRow({ role: ASSISTANT_ROLE, provider: { kind: 'cloud', providerId: 'scenario' } }),
      ],
    }),
  })
  installFakeBridge()
})

/**
 * What the live region spells of the tail, which is the only place it is written out in full: the
 * mirror behind the field is `aria-hidden`, so no role query reaches into it.
 */
const completing = (): string => screen.queryByText(/Tab ou flèche droite/)?.textContent ?? ''

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
    render(<AssistantConversation />)

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
  it('writes a suggestion into the field rather than sending it', async () => {
    render(<AssistantConversation />)

    await userEvent.type(screen.getByRole('textbox'), 'genere')
    await userEvent.click(screen.getByRole('option', { name: 'Génère une image' }))

    expect(screen.getByRole('textbox')).toHaveValue('Génère une image')
    expect(say).not.toHaveBeenCalled()
  })

  /**
   * An ANSWER to typing, never an offer standing there: two rows of chips over a blank thread
   * were three sentences one could not add to and could not get rid of.
   */
  it('offers nothing until something is being written', async () => {
    render(<AssistantConversation />)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox'), 'image')

    expect(within(screen.getByRole('listbox')).getAllByRole('option').length).toBeGreaterThan(0)
  })

  // Accents and case are how one SPELLS, not what one is looking for — `foldForSearch` is the
  // studio's own answer to that, and this is the reason it is reused rather than a `includes`.
  it('finds a sentence typed without its accents', async () => {
    render(<AssistantConversation />)

    await userEvent.type(screen.getByRole('textbox'), 'genere une im')

    expect(screen.getByRole('option', { name: 'Génère une image' })).toBeInTheDocument()
  })

  /**
   * Folded on both sides: compared raw, a sentence typed the way the rest of the feature invites
   * — without its accents — stayed offered underneath itself, over a sentence already finished.
   */
  it('stops offering a sentence once it is written, accents or not', async () => {
    render(<AssistantConversation />)

    await userEvent.type(screen.getByRole('textbox'), 'genere une image')

    // The others still answer those words — only the one already written stops being offered.
    expect(screen.queryByRole('option', { name: 'Génère une image' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: /variante/ })).toBeInTheDocument()
  })

  // A suggestion about pictures, in a timeline, is noise: what is offered is what the space at
  // hand can actually be asked for.
  it('offers the sentences of the space one is in', async () => {
    useLayouts.setState({ activeWorkspace: 'audio' })
    render(<AssistantConversation />)

    await userEvent.type(screen.getByRole('textbox'), 'genere un')

    // The only match here completes what is typed, so it is spelled by the tail and by no row.
    expect(completing()).toContain('Génère un son')
    expect(screen.queryByRole('option', { name: 'Génère une image' })).not.toBeInTheDocument()
  })

  /**
   * 🛑 The home has no space of its own, so it used to read `activeWorkspace` and offer whatever
   * space one had last been in — three sentences about pictures, on a screen holding no document.
   */
  it('offers the project’s own sentences on the home, not the last space visited', async () => {
    useLayouts.setState({ activeWorkspace: 'image', home: true })
    render(<AssistantConversation />)

    await userEvent.type(screen.getByRole('textbox'), 'projet')

    expect(screen.getByRole('option', { name: /Crée un nouveau projet/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Génère une image' })).not.toBeInTheDocument()
  })

  /**
   * 🛑 The whole reason Enter was taken off the tail: a match is held from the first keystroke
   * now, so an Enter that took it would send a sentence the hand never finished writing. Enter
   * sends WHAT IS TYPED, always — and Tab is what turns the grey into one's own words.
   */
  it('takes the tail on Tab, and sends what is typed on Enter', async () => {
    render(<AssistantConversation />)
    const field = screen.getByRole('textbox')

    await userEvent.type(field, 'genere une im{Enter}')
    expect(say).toHaveBeenCalledWith('genere une im')

    say.mockClear()
    await userEvent.type(field, 'genere une im{Tab}')
    expect(field).toHaveValue('Génère une image')
    expect(say).not.toHaveBeenCalled()
  })

  /**
   * The tail is painted BEHIND the field, never written into it: put in the value it would be
   * what the store holds and what Enter sends, and the assistant would answer its own suggestion.
   */
  it('never lets the tail into the value it sends', async () => {
    render(<AssistantConversation />)
    const field = screen.getByRole('textbox')

    await userEvent.type(field, 'genere une im')

    expect(completing()).toContain('Génère une image')
    expect(field).toHaveValue('genere une im')
  })

  // The other half of Tab: it must still walk out of the field when there is nothing to take.
  it('leaves Tab alone when nothing completes what is typed', async () => {
    render(<AssistantConversation />)
    const field = screen.getByRole('textbox')

    await userEvent.type(field, 'projet{Tab}')

    expect(field).toHaveValue('projet')
    expect(field).not.toHaveFocus()
  })

  /**
   * A sentence matched by a word of its middle cannot be spelled ahead of the caret — there is no
   * tail to paint. It keeps the row it always had, which is why both mechanics stay.
   */
  it('keeps a row for a match no tail can spell', async () => {
    render(<AssistantConversation />)

    await userEvent.type(screen.getByRole('textbox'), 'variante')

    expect(completing()).toBe('')
    expect(screen.getByRole('option', { name: /variante/ })).toBeInTheDocument()
  })

  // The tail belongs where the caret is: offered from the middle of a sentence, Tab would write
  // the rest of a phrase onto words the hand had gone back to fix.
  it('offers no tail once the caret has gone back into the sentence', async () => {
    render(<AssistantConversation />)
    const field = screen.getByRole('textbox')

    await userEvent.type(field, 'genere une im')
    expect(completing()).toContain('Génère une image')

    fireEvent.select(field, { target: { selectionStart: 2, selectionEnd: 2 } })

    expect(completing()).toBe('')
  })

  it('changes which sentence the tail spells as the arrows walk', async () => {
    useLayouts.setState({ activeWorkspace: 'video' })
    render(<AssistantConversation />)

    await userEvent.type(screen.getByRole('textbox'), 'a')
    const first = completing()

    await userEvent.type(screen.getByRole('textbox'), '{ArrowDown}')

    expect(completing()).not.toBe(first)
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
  it('offers the microphone, having claimed the spoken word by being on screen', () => {
    render(<AssistantConversation />)

    expect(screen.getByRole('button', { name: /Dicter/ })).toBeInTheDocument()
  })

  // Beside an exchange they are an interruption: the blank page is the only thing they answer.
  /**
   * They used to be withheld once a thread had begun — beside an exchange, three chips standing
   * there were an interruption. An answer to typing is not: the second sentence of a conversation
   * is written in the same field as the first, and it deserves the same help.
   */
  it('still answers a sentence begun in the middle of a conversation', async () => {
    useAssistant.setState({
      turns: [{ id: 1, said: 'bonjour', answered: 'Bonjour.', steps: [], lost: false }],
    })
    render(<AssistantConversation />)

    await userEvent.type(screen.getByRole('textbox'), 'genere une')

    expect(screen.getByRole('option', { name: 'Génère une image' })).toBeInTheDocument()
  })
})

/**
 * What was missing while it worked: that it IS working, and that one may call it off. A chain
 * runs for as long as it takes, and a screen saying nothing for four rounds is one the person
 * sits in front of, wondering whether to type the sentence again.
 */
describe('what a step shows of what it did', () => {
  const ran = (data: unknown): void =>
    useAssistant.setState({
      turns: [
        {
          id: 1,
          said: 'ouvre l’image du bateau',
          answered: '',
          steps: [{ action: 'files.search', refusal: null, data }],
          lost: false,
        },
      ],
    })

  it('counts what a list answered', () => {
    ran(['Images/a.png', 'Images/b.png'])
    render(<AssistantConversation />)

    expect(screen.getByText(/2 résultats/)).toBeInTheDocument()
  })

  // « 1 résultat » under an opening says nothing about a file that just opened: what a list
  // answers is how many there were, and what everything else answers is its own business.
  it('counts nothing where counting means nothing', () => {
    ran({ opened: 'asset' })
    render(<AssistantConversation />)

    expect(screen.queryByText(/résultat/)).not.toBeInTheDocument()
  })
})

describe('while the assistant is working', () => {
  /** What `say` posts before it thinks: the turn exists from the moment the sentence leaves. */
  const working = (round: number, stopping = false): void =>
    useAssistant.setState({
      busy: true,
      round,
      stopping,
      turns: [{ id: 1, said: 'ouvre le voilier vert', answered: '', steps: [], lost: false }],
    })

  // In the thread and last of it, where the answer itself will appear: what one watches while
  // waiting is the place the words are going to land, never a line down by the field.
  it('says which round it is on, at the end of the thread', () => {
    working(3)
    render(<AssistantConversation />)

    const waiting = screen.getByText(/3/)
    expect(waiting).toBeInTheDocument()
    expect(screen.getByRole('list')).toContainElement(waiting)
  })

  // Where Send was, and never beside it: a chain one cannot call off is one nobody dares start.
  it('offers to stop instead of to send, and cannot send meanwhile', async () => {
    working(1)
    render(<AssistantConversation />)

    await userEvent.click(screen.getByRole('button', { name: /arrêter/i }))

    expect(stop).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /envoyer/i })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  // Pressed twice, the second press asks nothing more: what is running is what it waits for.
  it('says it is stopping, and takes no second press', () => {
    working(2, true)
    render(<AssistantConversation />)

    expect(screen.getByRole('button', { name: /arrêter/i })).toBeDisabled()
  })
})

/**
 * What the conversation claims WHILE it is on screen, which is not the same as while it is
 * mounted: the right column draws it untouched in every space, so a claim made on mounting would
 * take the caret and the spoken word of the whole studio with it.
 */
describe('what it claims of the studio', () => {
  it('stages the thread, so nothing else speaks for it', () => {
    render(<AssistantConversation />)

    expect(useAssistant.getState().staged).toBe(1)
  })

  /**
   * The caret follows the GESTURE, never the layout: ⌘K asks for it and the host takes it on the
   * frame it mounts. Focused on mount either way, it would swallow every studio shortcut from the
   * first frame of a launch.
   */
  it('leaves the caret alone when it is merely what a column draws', () => {
    render(<AssistantConversation />)

    expect(screen.getByRole('textbox')).not.toHaveFocus()
  })

  it('takes the caret when a gesture asked for the conversation first', () => {
    focusChat()
    render(<AssistantConversation />)

    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  // 🛑 Claimed unconditionally, every dictation of the studio landed here — a generation prompt
  // included, since the panel is up in every space.
  it('leaves the spoken word to the caret until the reader is inside it', async () => {
    render(<AssistantConversation />)
    expect(mountedDictationTarget()).toBeNull()

    await userEvent.click(screen.getByRole('textbox'))

    expect(mountedDictationTarget()).not.toBeNull()
  })

  /**
   * A session begun here outlives the caret: one dictates with the hands off the keyboard, so
   * looking at the canvas mid-sentence must not hand the rest of the sentence to whatever is
   * under the pointer — nor stop the microphone.
   */
  it('keeps the spoken word once a session has begun, caret or not', async () => {
    render(<AssistantConversation />)
    await userEvent.click(screen.getByRole('textbox'))
    act(() => useDictation.setState({ state: 'listening' }))

    act(() => screen.getByRole('textbox').blur())

    expect(mountedDictationTarget()).not.toBeNull()
    expect(useDictation.getState().state).toBe('listening')
  })

  it('gives the spoken word back once the reader has left and the microphone is shut', async () => {
    render(<AssistantConversation />)
    await userEvent.click(screen.getByRole('textbox'))

    act(() => screen.getByRole('textbox').blur())

    expect(mountedDictationTarget()).toBeNull()
  })
})

/**
 * The list is walked with the caret still in the field — `aria-activedescendant`, never a focus
 * that moves. Three things went wrong there and none of them reddened: the rank kept an index
 * the list no longer had, the arrows were confiscated from a paragraph, and every suggestion was
 * a tab stop between the field and the send button.
 */
describe('walking the suggestions', () => {
  beforeEach(() => {
    useLayouts.setState({ activeWorkspace: 'image', home: false })
  })

  /**
   * Typing gives the line back. The rank would otherwise survive a list rebuilt under it — held
   * on a sentence one has since walked away from, and Enter would take that one instead of the
   * words on screen.
   */
  it('lets go of the line it held as soon as one types again', async () => {
    render(<AssistantConversation />)
    const field = screen.getByRole('textbox')

    await userEvent.type(field, 'une{ArrowDown}')
    expect(field.getAttribute('aria-activedescendant')) //
      .not.toBe(screen.getAllByRole('option')[0]?.getAttribute('id'))

    // A space keeps every match — `searchWords` drops it — so only the RANK can have changed.
    await userEvent.type(field, ' ')

    expect(field.getAttribute('aria-activedescendant')).toBe(
      screen.getAllByRole('option')[0]?.getAttribute('id'),
    )
  })

  /**
   * The field takes three lines and exists for dictated paragraphs: confiscating the arrows the
   * moment a suggestion matches would leave one with no way to move the caret between them.
   */
  it('leaves the arrows to the field once the draft has more than one line', async () => {
    render(<AssistantConversation />)
    const field = screen.getByRole('textbox')

    await userEvent.type(field, 'genere{Shift>}{Enter}{/Shift}une image{ArrowUp}')

    // The caret has a line above it to reach, so the rank stands where it was rather than wrapping.
    expect(field.getAttribute('aria-activedescendant')).toBe(
      screen.getAllByRole('option')[0]?.getAttribute('id'),
    )
  })

  it('keeps the caret in the field, so what follows it stays reachable', async () => {
    render(<AssistantConversation />)
    const field = screen.getByRole('textbox')

    await userEvent.type(field, 'genere')

    expect(field).toHaveFocus()
    expect(field.getAttribute('aria-activedescendant')).toBe(
      screen.getAllByRole('option')[0]?.getAttribute('id'),
    )
  })
})

/**
 * Three ways a list could outlive what asked for it, none of which a keystroke closes.
 */
describe('giving the suggestions back', () => {
  beforeEach(() => {
    useLayouts.setState({ activeWorkspace: 'image', home: false })
  })

  // Escape reclaimed the highlight and left the list standing: there was no gesture short of
  // emptying the field to get the room back.
  it('takes Escape for the list itself, not only for the line held', async () => {
    render(<AssistantConversation />)

    await userEvent.type(screen.getByRole('textbox'), 'image{Escape}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  /**
   * 🛑 While a plan runs the field is disabled but dictation keeps appending to the draft: the
   * list stood over a running plan with clickable options, and choosing one replaced the spoken
   * words while `focus()` went nowhere.
   */
  it('stands down while a plan is running', () => {
    useAssistant.setState({ busy: true, draft: 'genere une im' })
    render(<AssistantConversation />)

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  /**
   * 🛑 The rank outlived the list when something OTHER than a keystroke rebuilt it — a change of
   * space, of language, a dictated word. Rank 3 named one sentence and then another, highlighted
   * and silently different, and Enter took the second.
   */
  it('gives the rank back when the space changes under it', async () => {
    const { rerender } = render(<AssistantConversation />)
    const field = screen.getByRole('textbox')

    await userEvent.type(field, 'genere{ArrowDown}')
    expect(field).toHaveAttribute('aria-activedescendant')

    act(() => useLayouts.setState({ activeWorkspace: 'audio' }))
    rerender(<AssistantConversation />)

    expect(field).not.toHaveAttribute('aria-activedescendant')
  })
})
