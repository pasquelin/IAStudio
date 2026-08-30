import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ActionName,
  ActionOutcome,
  AssistantAnswer,
  AssistantAsk,
  AssistantThought,
} from '@shared/domain/assistant'
import type { AssistantNote } from '@shared/domain/assistantNote'
import { installFakeBridge } from '@/services/fakeBridge'
import { useSettings } from './settings'
import { useAssistant } from './assistant'

/** One question, the ordinary shape — the questionnaire is `AssistantConversationChoice`'s case. */
const asking = (question: string, choices: readonly string[] = []): AssistantAsk => ({
  questions: [{ question, choices }],
})

/** The ceiling a case is about, without waiting for twelve rounds to reach it. */
function chainCeiling(steps: number): void {
  useSettings.setState(state => ({
    settings: { ...state.settings, assistant: { ...state.settings.assistant, steps } },
  }))
}

/** The identity of "the brain has not been called yet", so the wait has something to compare. */
const NOT_ASKED_YET = (): void => {}

/**
 * The executor stands in: what each action does to the studio is its own suite's business, and
 * this one is about the order they run in and what the modal is told afterwards.
 */
const runConfirmedAction = vi.hoisted(() =>
  vi.fn<(name: ActionName, input: Record<string, unknown>) => Promise<ActionOutcome>>(),
)
vi.mock('@/assistant/executor', () => ({ runConfirmedAction }))

const answer = (fields: Partial<AssistantAnswer> = {}): AssistantAnswer => ({
  say: 'J’ouvre un fichier 3D.',
  calls: [],
  cost: 0.75,
  ...fields,
})

/** The bridge, with the one channel this store speaks on. Returns what the main process saw. */
function brain(...replies: AssistantAnswer[]): { asked: AssistantThought[] } {
  const asked: AssistantThought[] = []
  let turn = 0

  installFakeBridge({
    assistant: {
      think: (request: AssistantThought) => {
        asked.push(request)
        return Promise.resolve(replies[turn++] ?? answer())
      },
    },
  })

  return { asked }
}

beforeEach(() => {
  runConfirmedAction.mockReset()
  runConfirmedAction.mockResolvedValue({ ok: true })
  chainCeiling(12)
  useAssistant.setState({
    turns: [],
    busy: false,
    round: 0,
    stopping: false,
    asked: null,
    spent: 0,
    draft: '',
    staged: 0,
    streamed: '',
    promptTokens: 0,
    replyTokens: 0,
    windowTokens: 0,
  })
})

/** The bridge's note channel, gathering what the chain wrote rather than dropping it. */
const collecting =
  (notes: AssistantNote[]) =>
  (one: AssistantNote): Promise<void> => {
    notes.push(one)
    return Promise.resolve()
  }

describe('what a turn writes down', () => {
  /**
   * 🛑 Both sides of a turn in ONE order: the brain composes and reads in the main process, the
   * calls run here, and a reader following a turn cannot piece it together from two places.
   */
  it('notes each call and what the studio answered it', async () => {
    const notes: AssistantNote[] = []
    installFakeBridge({
      assistant: {
        think: () => Promise.resolve(answer({ calls: [{ action: 'jobs.list', input: {} }] })),
        note: collecting(notes),
      },
    })
    runConfirmedAction.mockResolvedValue({ ok: false, refusal: 'noProject' })
    chainCeiling(1)

    await useAssistant.getState().say('où en sont mes générations')

    expect(notes).toContainEqual({
      kind: 'ran',
      action: 'jobs.list',
      input: '{}',
      answer: 'noProject',
      refused: true,
    })
  })

  it('notes the question and what was answered', async () => {
    const notes: AssistantNote[] = []
    // Two answers, never one repeated: a door that asks for ever parks the chain on every round.
    const replies = [answer({ ask: asking('Quel nom ?'), calls: [] }), answer()]
    installFakeBridge({
      assistant: {
        think: () => Promise.resolve(replies.shift() ?? answer()),
        note: collecting(notes),
      },
    })

    const said = useAssistant.getState().say('crée un projet')
    await vi.waitFor(() => expect(useAssistant.getState().choosing).not.toBeNull())
    useAssistant.getState().choose([{ answer: 'Bateaux' }])
    await said

    expect(notes).toContainEqual({ kind: 'asked', question: 'Quel nom ?', answer: 'Bateaux' })
  })
})

/** Answers whatever question is standing, as a person pressing a button or typing would. */
async function answering(chosen: string | null): Promise<void> {
  await vi.waitFor(() => expect(useAssistant.getState().choosing).not.toBeNull())
  useAssistant.getState().choose(chosen === null ? null : [{ answer: chosen }])
}

describe('a question the model asked', () => {
  /**
   * 🛑 The defect this whole key exists for: asked to ask, a model asked AND acted in the same
   * breath — measured on qwen3.8, « Crée un nouveau projet » came back with the question in `say`
   * and `command.run` beside it, and both calls were run against a name nobody had given.
   */
  it('runs nothing of the round that asked', async () => {
    brain(answer({ say: '', ask: asking('Quel nom ?'), calls: [] }), answer({ calls: [] }))

    const said = useAssistant.getState().say('crée un projet')
    await answering('Bateaux')
    await said

    expect(runConfirmedAction).not.toHaveBeenCalled()
    expect(useAssistant.getState().turns[0]?.asks).toEqual([
      { question: 'Quel nom ?', answer: 'Bateaux' },
    ])
  })

  /** What the wait is worth: the answer reaches the round that asked for it, or it asks again. */
  it('carries the answer into the next round', async () => {
    const { asked } = brain(
      answer({ say: '', ask: asking('Quel nom ?'), calls: [] }),
      answer({ calls: [] }),
    )

    const said = useAssistant.getState().say('crée un projet')
    await answering('Bateaux')
    await said

    expect(asked).toHaveLength(2)
    expect(asked[1]?.history.join('\n')).toContain('the person answered: Bateaux')
  })

  /** The composer is the only way to answer a question with no choices — see `say`. */
  it('takes what is typed as the answer rather than as a new sentence', async () => {
    const { asked } = brain(
      answer({ say: '', ask: asking('Quel nom ?'), calls: [] }),
      answer({ calls: [] }),
    )

    const said = useAssistant.getState().say('crée un projet')
    await vi.waitFor(() => expect(useAssistant.getState().choosing).not.toBeNull())
    await useAssistant.getState().say('Bateaux')
    await said

    expect(useAssistant.getState().turns).toHaveLength(1)
    expect(asked[1]?.history.join('\n')).toContain('the person answered: Bateaux')
  })

  /**
   * 🛑 « Laisser tomber » ENDS the chain, which is what the button promises. Read as an ordinary
   * answer, the model was handed nothing and asked again on the next BILLED round.
   */
  it('ends the chain when the person lets the question go', async () => {
    const { asked } = brain(
      answer({ say: 'Où ?', ask: asking('Où ?', ['Image']), calls: [] }),
      answer(),
    )

    const said = useAssistant.getState().say('crée un projet')
    await answering(null)
    await said

    expect(useAssistant.getState().turns[0]).toMatchObject({ ending: 'stopped' })
    expect(asked).toHaveLength(1)
  })

  /**
   * 🛑 The chain parks inside the action while the card stands: unsettled by the stop, the field
   * stays disabled and Stop greys itself out — the only way out was answering the question one
   * had just asked to stop.
   */
  it('settles the question the stop is stopping', async () => {
    installFakeBridge({ assistant: { stop: () => Promise.resolve() } })
    useAssistant.setState({ busy: true })
    const answered = useAssistant.getState().askChoice([{ question: 'Où ?', choices: ['Image'] }])

    useAssistant.getState().stop()

    await expect(answered).resolves.toBeNull()
    expect(useAssistant.getState().choosing).toBeNull()
  })

  /** 🛑 The queued ones too: one left standing keeps its own chain waiting on a person who has
   * just asked everything to stop. */
  it('settles the question that was waiting behind it as well', async () => {
    installFakeBridge({ assistant: { stop: () => Promise.resolve() } })
    useAssistant.setState({ busy: true })
    const first = useAssistant.getState().askChoice([{ question: 'Où ?', choices: ['Image'] }])
    const waited = useAssistant.getState().askChoice([{ question: 'Et ensuite ?', choices: [] }])

    useAssistant.getState().stop()

    await expect(first).resolves.toBeNull()
    await expect(waited).resolves.toBeNull()
    expect(useAssistant.getState().choosing).toBeNull()
  })

  /** 🛑 The queue fills behind a CONFIRMATION too, which `choose` cannot see: draining through
   * the question on screen alone left those chains waiting on a person who had just stopped. */
  it('settles a question queued behind a confirmation', async () => {
    installFakeBridge({ assistant: { stop: () => Promise.resolve() } })
    useAssistant.setState({ busy: true })
    const granted = useAssistant
      .getState()
      .ask({ action: 'project.create', input: {}, commitment: 'studio' })
    const waited = useAssistant.getState().askChoice([{ question: 'Où ?', choices: [] }])

    useAssistant.getState().stop()

    await expect(waited).resolves.toBeNull()
    useAssistant.getState().answer(false)
    await granted
  })

  /**
   * 🛑 A line typed below says nothing about WHICH question it answers, so a questionnaire is
   * answered in its own card — and every answer reaches the round that asked for it.
   */
  it('does not take what is typed as the answer to a questionnaire', async () => {
    const { asked } = brain(
      answer({
        say: '',
        ask: {
          questions: [
            { question: 'Lequel ?', choices: [] },
            { question: 'Pourquoi ?', choices: [] },
          ],
        },
        calls: [],
      }),
      answer({ calls: [] }),
    )

    const said = useAssistant.getState().say('crée un projet')
    await vi.waitFor(() => expect(useAssistant.getState().choosing).not.toBeNull())
    await useAssistant.getState().say('Bateaux')

    expect(useAssistant.getState().choosing).not.toBeNull()
    useAssistant.getState().choose([{ answer: 'un bateau' }, { answer: 'pour voir' }])
    await said

    expect(asked[1]?.history.join('\n')).toContain(
      'You asked: Pourquoi ? — the person answered: pour voir',
    )
  })
})

describe('stopping a sentence', () => {
  /**
   * 🛑 Both halves: the flag ends the chain BETWEEN two rounds, and a local model holds one round
   * for minutes at full tilt — the flag alone left "stopping…" on screen with the fans up.
   */
  it('cuts the round in flight, not only the chain', () => {
    const stop = vi.fn(() => Promise.resolve())
    installFakeBridge({ assistant: { stop } })
    useAssistant.setState({ busy: true })

    useAssistant.getState().stop()

    expect(useAssistant.getState().stopping).toBe(true)
    expect(stop).toHaveBeenCalled()
  })

  it('reaches for nothing while nothing runs', () => {
    const stop = vi.fn(() => Promise.resolve())
    installFakeBridge({ assistant: { stop } })

    useAssistant.getState().stop()

    expect(stop).not.toHaveBeenCalled()
  })

  // Cut on purpose is not LOST: the person is the one who cut it, and "lost" reads as a failure.
  it('reads a cut round as stopped rather than as lost', async () => {
    installFakeBridge({
      assistant: {
        think: () => {
          useAssistant.getState().stop()
          return Promise.reject(new Error('aborted'))
        },
      },
    })

    await useAssistant.getState().say('hello')

    expect(useAssistant.getState().turns[0]).toMatchObject({ ending: 'stopped', lost: false })
  })
})

describe('watching the model write', () => {
  it('appends what arrives and keeps the counts the door reported', () => {
    const { noteProgress } = useAssistant.getState()
    noteProgress({ delta: '{"say":' })
    noteProgress({ delta: '"hi"}', promptTokens: 2366, replyTokens: 18 })

    expect(useAssistant.getState()).toMatchObject({
      streamed: '{"say":"hi"}',
      promptTokens: 2366,
      replyTokens: 18,
    })
  })

  /**
   * One sentence may cost four round trips, and a rejected answer is thrown away whole: appended
   * to the next, it reads as one long answer contradicting itself.
   */
  it('drops what a thrown-away attempt had written', () => {
    const { noteProgress } = useAssistant.getState()
    noteProgress({ delta: 'half an answ' })
    noteProgress({ delta: '', restart: true })
    noteProgress({ delta: 'the real one' })

    expect(useAssistant.getState().streamed).toBe('the real one')
  })

  /**
   * 🛑 The counts OUTLIVE the round: cleared with the streamed text they blinked to zero between
   * two rounds, and were gone the moment the composer had a reader for them.
   */
  it('keeps what the last round read once the turn is over', async () => {
    brain(answer({ say: 'done', calls: [] }))
    await useAssistant.getState().say('hello')
    useAssistant.getState().noteProgress({ delta: '', promptTokens: 2116, windowTokens: 8192 })

    expect(useAssistant.getState()).toMatchObject({ promptTokens: 2116, windowTokens: 8192 })
  })

  // A new SENTENCE starts them over: what the last turn read is not what this one will read.
  it('starts a new sentence from nothing read', async () => {
    brain(answer({ say: 'done', calls: [] }))
    useAssistant.setState({ promptTokens: 2116, windowTokens: 8192 })

    await useAssistant.getState().say('hello')

    expect(useAssistant.getState().promptTokens).toBe(0)
  })

  it('starts each round from nothing, so one round never reads as the next', async () => {
    brain(answer({ say: 'done', calls: [] }))
    useAssistant.setState({ streamed: 'left over', promptTokens: 99 })

    await useAssistant.getState().say('hello')

    expect(useAssistant.getState()).toMatchObject({ streamed: '', promptTokens: 0 })
  })
})

describe('saying something to the assistant', () => {
  it('keeps what was said and what came back', async () => {
    brain()
    await useAssistant.getState().say('  ouvre un fichier 3D  ')

    const [turn] = useAssistant.getState().turns
    expect(turn?.said).toBe('ouvre un fichier 3D')
    expect(turn?.answered).toBe('J’ouvre un fichier 3D.')
    expect(useAssistant.getState().busy).toBe(false)
  })

  /**
   * 🛑 Dictation sends the SPOKEN words, not the field. Emptying it here destroyed whatever was
   * half-typed beside them — the composer clears its own, which is the only path that knows the
   * two are the same text.
   */
  it('leaves the field alone, so a spoken sentence does not eat a typed one', async () => {
    brain()
    useAssistant.setState({ draft: 'génère une image de ' })

    await useAssistant.getState().say('un casque')

    expect(useAssistant.getState().draft).toBe('génère une image de ')
  })

  it('carries the turns before it, and never the one being said', async () => {
    const { asked } = brain()
    await useAssistant.getState().say('ouvre un fichier 3D')
    await useAssistant.getState().say('et maintenant génère')

    expect(asked[0]?.history).toEqual([])
    expect(asked[1]?.history).toHaveLength(1)
    expect(asked[1]?.history[0]).toContain('ouvre un fichier 3D')
  })

  /** The whole reason the total is on screen: five turns cost about what one picture does. */
  it('adds up what the thinking cost', async () => {
    brain(answer({ cost: 0.75 }), answer({ cost: 1 }))
    await useAssistant.getState().say('une')
    await useAssistant.getState().say('deux')

    expect(useAssistant.getState().spent).toBe(1.75)
  })

  /**
   * In order, and this is the one that matters: `generator.prepare` fills the form that
   * `generator.submit` then sends, so a plan run at once would send an empty one.
   */
  it('runs the actions one after another, and records what each one did', async () => {
    const order: ActionName[] = []
    runConfirmedAction.mockImplementation(name => {
      order.push(name)
      return Promise.resolve(
        name === 'generator.submit' ? { ok: false, refusal: 'declined' } : { ok: true },
      )
    })

    brain(
      answer({
        calls: [
          { action: 'generator.prepare', input: {} },
          { action: 'generator.submit', input: {} },
        ],
      }),
    )
    await useAssistant.getState().say('génère un casque')

    expect(order).toEqual(['generator.prepare', 'generator.submit'])
    expect(useAssistant.getState().turns[0]?.steps).toEqual([
      { action: 'generator.prepare', refusal: null },
      { action: 'generator.submit', refusal: 'declined' },
    ])
  })

  // Two plans over one generator form, and a question on screen belonging to neither.
  it('ignores a second sentence while the first is still running', async () => {
    let release = NOT_ASKED_YET
    installFakeBridge({
      assistant: {
        think: () =>
          new Promise<AssistantAnswer>(resolve => {
            release = () => resolve(answer())
          }),
      },
    })

    const first = useAssistant.getState().say('une')
    await useAssistant.getState().say('deux')
    expect(useAssistant.getState().turns).toHaveLength(1)

    // Awaited rather than called straight away: the turn reaches `think` a few microtasks in —
    // it loads the target table first — and releasing before that leaves the promise hanging.
    await vi.waitFor(() => expect(release).not.toBe(NOT_ASKED_YET))
    release()
    await first
  })

  it('marks a turn that came to nothing, rather than showing an empty answer', async () => {
    brain(answer({ say: '', calls: [], cost: 1.5 }))
    await useAssistant.getState().say('fais quelque chose d’impossible')

    expect(useAssistant.getState().turns[0]?.lost).toBe(true)
    // Spent all the same: the model was asked twice and both attempts were billed.
    expect(useAssistant.getState().spent).toBe(1.5)
  })

  /**
   * Every branch of the executor reaches an IPC channel that genuinely rejects — the API client
   * turns a 429, a missing key or a dropped network into a thrown error. Unguarded, one such
   * throw left `busy` true for the rest of the session: field disabled, spinner turning, nothing
   * on screen saying why.
   */
  it('does not seize up when an action throws', async () => {
    runConfirmedAction.mockRejectedValue(new Error('the network is gone'))
    brain(answer({ calls: [{ action: 'models.search', input: { query: 'casque' } }] }))

    await useAssistant.getState().say('cherche un casque')

    expect(useAssistant.getState().busy).toBe(false)
    expect(useAssistant.getState().turns[0]?.lost).toBe(true)
  })

  it('says so rather than hanging when the studio does not answer at all', async () => {
    installFakeBridge({ assistant: { think: () => Promise.reject(new Error('closed')) } })
    await useAssistant.getState().say('ouvre un fichier 3D')

    expect(useAssistant.getState().turns[0]?.lost).toBe(true)
    expect(useAssistant.getState().busy).toBe(false)
  })
})

describe('the question asked before anything is engaged', () => {
  // Whoever is staging the thread shows it: the shell brings a host up before asking, so the
  // store's job is to hold the one question and the promise waiting on it.
  it('waits on the surface staging the thread', async () => {
    const unstage = useAssistant.getState().stage()
    const asked = useAssistant
      .getState()
      .ask({ action: 'generator.submit', input: {}, commitment: 'credits' })

    expect(useAssistant.getState().asked?.request.action).toBe('generator.submit')

    useAssistant.getState().answer(true)
    await expect(asked).resolves.toMatchObject({ granted: true })
    unstage()
  })

  /**
   * 🛑 It WAITS rather than being declined: the two hosts hand over in one commit — opening a
   * document, going Home — and the panel arrives a few frames later, so declining on the way
   * refused questions nobody had been shown.
   */
  it('outlives the surface showing it, for the next one to show', async () => {
    const unstage = useAssistant.getState().stage()
    const asked = useAssistant
      .getState()
      .ask({ action: 'generator.submit', input: {}, commitment: 'credits' })
    unstage()

    expect(useAssistant.getState().asked?.request.action).toBe('generator.submit')

    useAssistant.getState().stage()
    useAssistant.getState().answer(true)
    await expect(asked).resolves.toMatchObject({ granted: true })
  })

  /**
   * The two callers of the gate are independent — the modal's own plan, and an MCP client on the
   * other side of the machine — so two questions can genuinely be in flight. Overwriting the
   * first cost twice: its promise never settled, holding `busy` for the session, and the buttons
   * on screen then answered the SECOND request while the person was reading the first. A yes
   * meant for "this uploads an image, it is free" would have started a paid generation.
   */
  it('refuses a second question rather than replacing the one on screen', async () => {
    const first = useAssistant
      .getState()
      .ask({ action: 'command.run', input: {}, commitment: 'asset' })
    const second = useAssistant
      .getState()
      .ask({ action: 'generator.submit', input: {}, commitment: 'credits' })

    await expect(second).resolves.toMatchObject({ granted: false })
    expect(useAssistant.getState().asked?.request.action).toBe('command.run')

    useAssistant.getState().answer(true)
    await expect(first).resolves.toMatchObject({ granted: true })
  })
})

/**
 * The chain, which is what turns one sentence into work: an action's INPUT is often only known
 * once the one before it has answered — search a name, open what came back — and a single plan
 * written in advance cannot say it. Every round is a billed round trip, so what ends one is as
 * much the point as what continues it.
 */
describe('chaining rounds on one sentence', () => {
  const searched = answer({ say: 'Je cherche.', calls: [{ action: 'files.search', input: {} }] })
  const done = answer({ say: 'Voici le voilier vert.', calls: [] })

  it('asks again with what the action answered, so the next call can use it', async () => {
    runConfirmedAction.mockResolvedValue({ ok: true, data: ['Images/Voilier vert.png'] })
    const { asked } = brain(searched, done)

    await useAssistant.getState().say('ouvre le voilier vert')

    expect(asked).toHaveLength(2)
    expect(asked[1]?.continuing).toBe(true)
    // The path is IN what the second round reads: without it the model asks for the same search.
    expect(asked[1]?.history.join('\n')).toContain('Images/Voilier vert.png')
  })

  /**
   * 🛑 THREE rounds, not two, and that is the whole point of the case: `patch` replaces what a
   * turn holds, so a round that started its list at zero wiped the round before it. The search
   * result left the history and the model ran the search it had already run — the one failure
   * the chain exists to remove — while two rounds stayed green throughout.
   */
  it('keeps what earlier rounds did, so a third round still reads the first', async () => {
    runConfirmedAction.mockResolvedValue({ ok: true, data: ['Images/Voilier vert.png'] })
    const opened = answer({ say: 'Je l’ouvre.', calls: [{ action: 'file.open', input: {} }] })
    const { asked } = brain(searched, opened, done)

    await useAssistant.getState().say('ouvre le voilier vert')

    expect(useAssistant.getState().turns[0]?.steps.map(step => step.action)).toEqual([
      'files.search',
      'file.open',
    ])
    expect(asked[2]?.history.join('\n')).toContain('files.search')
  })

  // The same wipe seen from the person's side: several actions ran and were not undone, and the
  // turn reported none of them.
  it('keeps the steps that ran when the chain is stopped', async () => {
    const opened = answer({ say: 'Je l’ouvre.', calls: [{ action: 'file.open', input: {} }] })
    brain(searched, opened, done)
    runConfirmedAction.mockImplementation(async () => {
      if (useAssistant.getState().round === 2) useAssistant.getState().stop()
      return { ok: true }
    })

    await useAssistant.getState().say('ouvre le voilier vert')

    expect(useAssistant.getState().turns[0]?.steps).toHaveLength(2)
    expect(useAssistant.getState().turns[0]?.ending).toBe('stopped')
  })

  // The only way a model says a request is done — and the way it asks a question, its `say`
  // being what the person answers next.
  it('stops as soon as the model answers with no calls', async () => {
    const { asked } = brain(searched, done, searched)

    await useAssistant.getState().say('ouvre le voilier vert')

    expect(asked).toHaveLength(2)
    expect(useAssistant.getState().turns[0]?.ending).toBeUndefined()
  })

  // Every round's sentence, not just the last: "I am looking" then "here it is" is the chain as
  // the person watched it happen.
  it('keeps what was said at each round', async () => {
    brain(searched, done)

    await useAssistant.getState().say('ouvre le voilier vert')

    expect(useAssistant.getState().turns[0]?.answered).toBe('Je cherche.\nVoici le voilier vert.')
  })

  /**
   * 🛑 The one thing between a chain and a bill: a model that keeps asking for the same action
   * would run until somebody noticed. Cut here, a chain reads exactly like one that finished —
   * so the turn SAYS it was cut.
   */
  it('stops at the ceiling, and says it was cut rather than finished', async () => {
    chainCeiling(2)
    const { asked } = brain(searched, searched, searched, searched)

    await useAssistant.getState().say('ouvre le voilier vert')

    expect(asked).toHaveLength(2)
    expect(useAssistant.getState().turns[0]?.ending).toBe('halted')
  })

  it('stops between two actions when asked to, leaving what ran alone', async () => {
    const twice = answer({
      calls: [
        { action: 'files.search', input: {} },
        { action: 'file.open', input: {} },
      ],
    })
    runConfirmedAction.mockImplementation(async () => {
      useAssistant.getState().stop()
      return { ok: true }
    })
    brain(twice, done)

    await useAssistant.getState().say('ouvre le voilier vert')

    const turn = useAssistant.getState().turns[0]
    // The first ran and is kept; the second never started.
    expect(turn?.steps.map(step => step.action)).toEqual(['files.search'])
    expect(turn?.ending).toBe('stopped')
    expect(useAssistant.getState().stopping).toBe(false)
  })

  // Nothing to stop is nothing to arm: a flag left set would refuse the NEXT sentence a round.
  it('ignores a stop asked for while idle', () => {
    useAssistant.getState().stop()

    expect(useAssistant.getState().stopping).toBe(false)
  })
})
