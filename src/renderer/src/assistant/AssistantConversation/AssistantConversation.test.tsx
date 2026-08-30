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
    door: undefined,
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
const completing = (): string => screen.queryByText(/Tab ou →/)?.textContent ?? ''

/**
 * 🛑 Scoped to the listbox: the model picker below is a `<select>`, so its own `<option>`s answer
 * `getAllByRole('option')` too — a query over the screen reads the last brain, not the last row.
 */
const rowsOf = (): Element[] => within(screen.getByRole('listbox')).getAllByRole('option')

/** The row against the field, which is the one held: the list opens upward. */
const nearest = (): Element | undefined => rowsOf().at(-1)

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
          asks: [],
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

  /**
   * 🛑 The half that was missing: « Créer un dossier de projet » over « change ce qu'est le
   * studio » named an action and a category, and nothing said WHICH project — approving that is
   * approving a category.
   */
  it('says what the action was called with, field by field', () => {
    useAssistant.setState({
      asked: {
        id: 1,
        request: { action: 'project.create', input: { path: 'Bateaux' }, commitment: 'studio' },
        answer: vi.fn(),
      },
    })
    render(<AssistantConversation />)

    expect(screen.getByText(/Bateaux/)).toBeInTheDocument()
  })

  it('quotes what an action will cost before asking, and answers with the buttons', async () => {
    const answered = vi.fn()
    useAssistant.setState({
      asked: {
        id: 1,
        request: {
          action: 'generator.submit',
          input: {},
          commitment: 'credits',
          estimate: 12,
        },
        answer: answered,
      },
    })
    render(<AssistantConversation />)

    expect(screen.getByText(/~12 UC/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Autoriser' }))

    expect(answered).toHaveBeenCalledWith({ granted: true, input: {} })
  })

  /**
   * 🛑 A folder is a place only the PERSON knows: « Nouveau projet » is a name the model guessed,
   * and the card was a yes-or-no on it. What leaves with the yes is what they pointed at.
   */
  it('lets the person point at a folder, and sends that one', async () => {
    const answered = vi.fn()
    installFakeBridge({ dialog: { pickPath: () => Promise.resolve('/Projets/Bateaux') } })
    useAssistant.setState({
      asked: {
        id: 1,
        request: {
          action: 'project.create',
          input: { path: 'Nouveau projet' },
          commitment: 'studio',
        },
        answer: answered,
      },
    })
    render(<AssistantConversation />)

    await userEvent.click(screen.getByRole('button', { name: /Choisir/ }))
    expect(screen.getByText(/\/Projets\/Bateaux/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Autoriser' }))

    expect(answered).toHaveBeenCalledWith({
      granted: true,
      input: { path: '/Projets/Bateaux' },
    })
  })

  /** Inventing a figure to fill the sentence would be worse than admitting there is none. */
  it('says the cost is unknown rather than making one up', () => {
    useAssistant.setState({
      asked: {
        id: 1,
        request: {
          action: 'generator.submit',
          input: {},
          commitment: 'credits',
          estimate: null,
        },
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
   * Shift+Tab means « go back », and it took the tail instead — the draft rewritten by a keystroke
   * that asked to leave, with no way out of the composer while a tail was painted.
   */
  it('leaves a Tab held with Shift to the focus it walks', async () => {
    render(<AssistantConversation />)
    const field = screen.getByRole('textbox')

    await userEvent.type(field, 'genere une im')
    await userEvent.tab({ shift: true })

    expect(field).toHaveValue('genere une im')
    expect(field).not.toHaveFocus()
  })

  /**
   * 🛑 A focus given by ⌘K fires neither `change` nor `select`, so the state saying where the
   * caret is answered for the last hand that typed. The tail was painted over a draft the caret
   * sat at the START of, and the right arrow could not move at all.
   */
  it('reads where the caret is from the key itself, not from the last thing typed', () => {
    useAssistant.setState({ draft: 'genere une im' })
    render(<AssistantConversation />)
    const field = screen.getByRole<HTMLTextAreaElement>('textbox')

    field.setSelectionRange(0, 0)
    act(() => focusChat())
    expect(field.selectionStart).toBe(0)

    fireEvent.keyDown(field, { key: 'ArrowRight' })

    expect(field).toHaveValue('genere une im')
  })

  /**
   * The tail advertises a key that only takes it while one writes HERE. 🛑 Left by the pointer and
   * not by Tab, which the tail takes for itself and would end this test by accepting.
   */
  it('takes the tail off the screen once the caret leaves the field', async () => {
    render(<AssistantConversation />)
    const field = screen.getByRole('textbox')

    await userEvent.type(field, 'genere une im')
    expect(completing()).toContain('Génère une image')

    fireEvent.blur(field)

    expect(completing()).toBe('')
  })

  // A field nothing answers announces no completion either: a reader was told of one that was not.
  it('announces no inline completion when nothing completes', async () => {
    render(<AssistantConversation />)
    const field = screen.getByRole('textbox')

    await userEvent.type(field, 'zzzzzz')

    expect(field).not.toHaveAttribute('aria-autocomplete')
  })

  it('opens above the field, so nothing under the fingers moves', async () => {
    render(<AssistantConversation />)
    const field = screen.getByRole('textbox')

    await userEvent.type(field, 'genere une')

    expect(field.compareDocumentPosition(screen.getByRole('listbox'))).toBe(
      Node.DOCUMENT_POSITION_PRECEDING,
    )
  })

  /**
   * 🛑 `cn` is tailwind-merge: a `bg-transparent` written after `rowSkin` cancelled the very fill
   * it paints, and the walk was invisible while `aria-activedescendant` moved correctly.
   */
  it('paints the row it holds, so the walk can be seen and not only heard', async () => {
    render(<AssistantConversation />)

    await userEvent.type(screen.getByRole('textbox'), 'genere une')

    expect(nearest()).toHaveClass('bg-accent-soft')
    expect(rowsOf()[0]).not.toHaveClass('bg-accent-soft')
  })

  /**
   * The list grows upward, so the best match — the one the tail spells out — is the row AGAINST
   * the field. Held at the top it would be the row furthest from the caret, and the first one
   * `max-h-40` pushes out of sight.
   */
  it('holds the row nearest the field, and spells that one ahead of the caret', async () => {
    render(<AssistantConversation />)

    await userEvent.type(screen.getByRole('textbox'), 'genere une im')

    expect(nearest()).toHaveTextContent('Génère une image')
    expect(completing()).toContain('Génère une image')
  })

  // The list said what the caret was doing: leaving the field opened one under the hand that left.
  it('opens no list because the caret left the field', async () => {
    useLayouts.setState({ activeWorkspace: 'audio' })
    render(<AssistantConversation />)
    const field = screen.getByRole('textbox')

    // The one match of this space, spelled by the tail — so no rows, before or after.
    await userEvent.type(field, 'genere un')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    fireEvent.blur(field)

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  // ArrowUp with something selected means « collapse and move », not « walk the list ».
  it('leaves the arrows to a selection the hand is holding', async () => {
    render(<AssistantConversation />)
    const field = screen.getByRole<HTMLTextAreaElement>('textbox')

    await userEvent.type(field, 'genere une')
    const held = field.getAttribute('aria-activedescendant')

    field.setSelectionRange(0, 6)
    fireEvent.keyDown(field, { key: 'ArrowUp' })

    expect(field.getAttribute('aria-activedescendant')).toBe(held)
  })

  /**
   * The other half of Tab. 🛑 Typed with matches ON SCREEN, since a field matching nothing leaves
   * `steer` at its first guard and never reaches the branch this is about.
   */
  it('leaves Tab alone when no match spells forward', async () => {
    render(<AssistantConversation />)
    const field = screen.getByRole('textbox')

    await userEvent.type(field, 'variante{Tab}')

    expect(screen.getByRole('option', { name: /variante/ })).toBeInTheDocument()
    expect(field).toHaveValue('variante')
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
      turns: [{ id: 1, said: 'génère un casque', answered: '', steps: [], asks: [], lost: false }],
      asked: {
        id: 1,
        request: {
          action: 'generator.submit',
          input: {},
          commitment: 'credits',
          estimate: 12,
        },
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
      turns: [{ id: 1, said: 'bonjour', answered: 'Bonjour.', steps: [], asks: [], lost: false }],
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
          asks: [],
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
      streamed: '',
      promptTokens: 0,
      replyTokens: 0,
      windowTokens: 0,
      turns: [
        { id: 1, said: 'ouvre le voilier vert', answered: '', steps: [], asks: [], lost: false },
      ],
    })

  /**
   * 🛑 A local door answers in minutes and the thread showed a spinner alone: nothing said the
   * model was writing rather than dead, and the only way to know was to watch the machine's fans.
   */
  it('shows what the model is writing, and its tail rather than its head', () => {
    working(1)
    useAssistant.setState({ streamed: `${'x'.repeat(400)}the last words` })
    render(<AssistantConversation />)

    expect(screen.getByText(/the last words/)).toBeInTheDocument()
  })

  // Grouped as the language groups them: a five-figure count read as one run of digits.
  it('says what the round has cost, in the reader’s own digits', () => {
    working(1)
    useAssistant.setState({ promptTokens: 12_366, replyTokens: 18 })
    render(<AssistantConversation />)

    // 🛑 `\s` and not the separator itself: French groups with a narrow no-break space, which
    // testing-library folds to an ordinary one before it compares.
    const grouped = new Intl.NumberFormat('fr').format(12_366).replace(/\s/g, '\\s')
    expect(screen.getByText(new RegExp(`${grouped}.*18`))).toBeInTheDocument()
  })

  /**
   * 🛑 It OUTLIVES the turn, unlike the working line: what one wants to know before typing is how
   * much room the last exchange left, and cleared per round the figure was gone the moment there
   * was time to read it.
   */
  it('shows what the last exchange read, once it is over', () => {
    useAssistant.setState({
      busy: false,
      promptTokens: 2116,
      windowTokens: 8192,
      door: { size: 8192, unit: 'tokens', assumed: false },
    })
    render(<AssistantConversation />)

    const grouped = (value: number): string =>
      new Intl.NumberFormat('fr').format(value).replace(/\s/g, '\\s')
    expect(screen.getByText(new RegExp(`${grouped(2116)}.*${grouped(8192)}`))).toBeInTheDocument()
  })

  /**
   * 🛑 A door that names no window shows the count alone AND says the window is unknown: a ratio
   * against a guess is the `2 067 / 4 096` once shown for DeepSeek, whose window is far wider.
   */
  it('says the window is unknown where the door named none', () => {
    useAssistant.setState({ busy: false, promptTokens: 2116, windowTokens: 0, door: null })
    render(<AssistantConversation />)

    expect(screen.getByText(/2\s?116 jetons lus/)).toBeInTheDocument()
    expect(screen.getByText(/fenêtre inconnue/)).toBeInTheDocument()
  })

  /**
   * 🛑 A door that answered `null` names NO window, and the count a PREVIOUS door left must not
   * become its denominator — that is `2 067 / 4 096` all over again.
   */
  it('drops the window of the door before it when the new one names none', () => {
    useAssistant.setState({
      busy: false,
      promptTokens: 2116,
      windowTokens: 8192,
      door: null,
    })
    render(<AssistantConversation />)

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByText(/fenêtre inconnue/)).toBeInTheDocument()
  })

  /** 🛑 A declared fallback is not a window: no gauge is painted against a made-up denominator. */
  it('shows no ratio for a bound the door could not read', () => {
    useAssistant.setState({
      busy: false,
      promptTokens: 0,
      promptChars: 4200,
      windowTokens: 0,
      door: { size: 10_000, unit: 'characters', assumed: true },
    })
    render(<AssistantConversation />)

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByText(/Fenêtre inconnue/)).toBeInTheDocument()
  })

  /**
   * 🛑 What Alban asked for: the bound is what one wants to know while deciding how much to
   * paste, and before this the zone was empty until a turn had already been paid for.
   */
  it('shows the bound of the door before a single turn has run', () => {
    useAssistant.setState({
      busy: false,
      promptTokens: 0,
      promptChars: 0,
      windowTokens: 0,
      door: { size: 100_000, unit: 'characters', assumed: false },
    })
    render(<AssistantConversation />)

    const grouped = new Intl.NumberFormat('fr').format(100_000).replace(/\s/g, '\\s')
    expect(screen.getByText(new RegExp(`0.*${grouped} caractères`))).toBeInTheDocument()
  })

  // Characters against characters: the door is bounded by a LENGTH, and tokens here would be an
  // estimate shown beside a measurement.
  it('counts against a character bound in characters, never in tokens', () => {
    useAssistant.setState({
      busy: false,
      promptTokens: 2116,
      promptChars: 7400,
      door: { size: 100_000, unit: 'characters', assumed: false },
    })
    render(<AssistantConversation />)

    const grouped = (value: number): string =>
      new Intl.NumberFormat('fr').format(value).replace(/\s/g, '\\s')
    expect(
      screen.getByText(new RegExp(`${grouped(7400)}.*${grouped(100_000)} caractères`)),
    ).toBeInTheDocument()
  })

  // 🛑 The one exception to "a plan is running, the field is shut": a question with nothing to
  // press can only be answered by typing, and a shut field left the chain parked.
  it('keeps the field open under a question, and offers Send rather than Stop', () => {
    working(1)
    void useAssistant.getState().askChoice([{ question: 'Quel nom ?', choices: [] }])
    render(<AssistantConversation />)

    expect(screen.getByRole('textbox')).toBeEnabled()
    expect(screen.queryByRole('button', { name: /Arrêter/ })).not.toBeInTheDocument()
    useAssistant.getState().choose(null)
  })

  /** 🛑 And NOT under a questionnaire, which is answered in its own card: an open field there
   * takes a line that answers no question in particular, and drops it without a word. */
  it('shuts the field again under a questionnaire, and offers Stop', () => {
    working(1)
    void useAssistant.getState().askChoice([
      { question: 'Lequel ?', choices: ['Bateau'] },
      { question: 'Pourquoi ?', choices: ['Pour voir'] },
    ])
    render(<AssistantConversation />)

    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: /Arrêter/ })).toBeInTheDocument()
    useAssistant.getState().choose(null)
  })

  /**
   * 🛑 The card is KEYED on the ask it draws: unkeyed, the queue rotating reused the instance and
   * the next questionnaire opened on the answers of the one before it.
   */
  it('opens a queued questionnaire blank rather than on the one before it', async () => {
    working(1)
    const first = useAssistant.getState().askChoice([
      { question: 'Lequel ?', choices: ['Bateau', 'Avion'] },
      { question: 'Pourquoi ?', choices: ['Pour voir'] },
    ])
    void useAssistant.getState().askChoice([
      { question: 'Et après ?', choices: ['Avion', 'Autre'] },
      { question: 'Sûr ?', choices: ['Oui'] },
    ])
    render(<AssistantConversation />)

    await userEvent.click(screen.getByRole('button', { name: 'Avion' }))
    expect(screen.getByRole('button', { name: 'Avion' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(screen.getByRole('button', { name: /Envoyer les réponses/ }))
    await first

    // Same word offered by the question that waited, and nothing pressed on it.
    expect(screen.getByRole('button', { name: 'Avion' })).toHaveAttribute('aria-pressed', 'false')
    useAssistant.getState().choose(null)
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

    await userEvent.type(field, 'une{ArrowUp}')
    expect(field.getAttribute('aria-activedescendant')).not.toBe(nearest()?.getAttribute('id'))

    // A space keeps every match — `searchWords` drops it — so only the RANK can have changed.
    await userEvent.type(field, ' ')

    expect(field.getAttribute('aria-activedescendant')).toBe(nearest()?.getAttribute('id'))
  })

  /**
   * The field takes three lines and exists for dictated paragraphs: confiscating the arrows the
   * moment a suggestion matches would leave one with no way to move the caret between them.
   */
  it('leaves the arrows to the field once the draft has more than one line', async () => {
    render(<AssistantConversation />)
    const field = screen.getByRole('textbox')

    await userEvent.type(field, 'genere{Shift>}{Enter}{/Shift}une image{ArrowUp}')

    // The caret has a line above it to reach, so the rank stands where it was rather than walking.
    expect(field.getAttribute('aria-activedescendant')).toBe(nearest()?.getAttribute('id'))
  })

  // Up is INTO the list, which is above: the keys mean what the eye sees.
  it('walks up into the list, and keeps the caret in the field', async () => {
    render(<AssistantConversation />)
    const field = screen.getByRole('textbox')

    await userEvent.type(field, 'genere{ArrowUp}')

    expect(field).toHaveFocus()
    expect(field.getAttribute('aria-activedescendant')).toBe(rowsOf().at(-2)?.getAttribute('id'))
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
