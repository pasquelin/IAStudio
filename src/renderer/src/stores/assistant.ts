import { orElse } from '@shared/promises'
import { create } from 'zustand'
import {
  HISTORY_MAX,
  refused,
  type AssistantAsk,
  type AssistantCall,
  type AssistantModel,
  type AssistantProgress,
} from '@shared/domain/assistant'
import { assistantStepsWithin } from '@shared/domain/assistantSteps'
import { narrowTargets, type Target } from '@shared/domain/target'
import type { ConfirmRequest } from '@/assistant/confirm'
import {
  assistantHistory,
  repeatedRelative,
  repeatKeyOf,
  resultLine,
  type AssistantStep,
  type AssistantTurn,
} from '@/assistant/conversation'
import { revealChat } from '@/assistant/revealChat'
import { noteAssistant } from '@/assistant/noteAssistant'
import { closeTool } from '@/helpers/revealPanel'
import { traceFailure } from '@/services/diagnostics'
import { getBridge } from '@/services/bridge'
import { useSettings } from './settings'

/** What of a streamed answer is kept: only its tail is ever shown — see `noteProgress`. */
const STREAM_TAIL = 240

/** What a ROUND starts over — the counts are not in it: they outlive it, for the composer. */
const NOTHING_WRITTEN = { streamed: '' }

/** What a new SENTENCE starts over: the counts belong to the turn that just ran, not the next. */
const NOTHING_READ = { ...NOTHING_WRITTEN, promptTokens: 0, replyTokens: 0, windowTokens: 0 }

/** A question on screen and the promise waiting on it — see `ask`. */
type AssistantQuestion = { request: ConfirmRequest; answer: (granted: boolean) => void }

/** What the model asked the person, and the promise its answer settles — see `askChoice`. */
export type AssistantChoiceQuestion = {
  question: string
  choices: readonly string[]
  answer: (chosen: string | null) => void
}

type AssistantState = {
  turns: AssistantTurn[]
  /** From the moment a sentence is sent until its last action has run or been refused. */
  busy: boolean
  /**
   * Which round of the chain is running, from 1 — what the person watches while it works.
   *
   * `0` when nothing is. Read rather than derived from the steps: a round that is still THINKING
   * has run no action yet, and that is exactly the moment a screen saying nothing looks frozen.
   */
  round: number
  /** Asked to stop between two rounds. Cleared when the turn ends, whichever way it ended. */
  stopping: boolean
  /**
   * What the model is writing THIS round, its tail only — see `STREAM_TAIL`. Raw JSON, and that
   * is the point: what makes the wait readable is that it MOVES, not that it parses.
   */
  streamed: string
  /** What the last round read and wrote. Zero where the door says nothing, and kept once it ends. */
  promptTokens: number
  replyTokens: number
  /** What that door reads in one go, so the composer can show the prompt as a share of it. */
  windowTokens: number
  /** One frame of what the model is writing — see `connectThoughtStream`. */
  noteProgress: (progress: AssistantProgress) => void
  /** Asks the chain to stop after what is already running. Nothing in flight is undone. */
  stop: () => void
  asked: AssistantQuestion | null
  /**
   * The question the model asked, with the answers it offered. One at a time, like `asked`: two
   * sets of buttons on one thread answer each other's question.
   */
  choosing: AssistantChoiceQuestion | null
  /** Asks the person, and answers what they pressed — `null` where they dismissed it. */
  askChoice: (question: string, choices: readonly string[]) => Promise<string | null>
  /** What was pressed. Nothing where no question is up: a late click settles nothing twice. */
  choose: (chosen: string | null) => void
  /**
   * What this conversation has spent thinking, in creative units.
   *
   * Thinking alone: what a generation costs is the jobs bar's to report, and it is spent by the
   * studio rather than by the assistant. Shown all the same, and continuously — a five-turn
   * conversation costs about what one picture does, which is not something to discover on an
   * invoice.
   */
  spent: number
  /** Held here, not by the surface: two surfaces write it, and dictation sends without either. */
  draft: string
  setDraft: (draft: string) => void
  /**
   * How many surfaces have the thread on screen — the right column's panel, the empty centre,
   * or neither. Everything that speaks only when nobody is reading — the toast, the status line,
   * marking a turn seen — asks this.
   *
   * A count rather than a flag: the two hosts hand over in one commit, and a cleanup landing
   * after the newcomer's mount would leave it at zero with the thread on screen.
   */
  staged: number
  /**
   * Whether the conversation has claimed the spoken word — which a mounted host has NOT, `staged`
   * being true of an untouched right column. Only the status line reads it, to say where the
   * words are going.
   */
  hearing: boolean
  /** Declares the thread on screen. Returns the way to take it back down. */
  stage: () => () => void
  /**
   * The last turn the person has actually SEEN, by id.
   *
   * Because one now talks to the studio without its window up: the sentence goes, something
   * happens on screen, and nothing said it had been taken, was being worked on, or came back
   * empty. The status line reads this to know whether it still has something to report — and
   * bringing a host on screen is what marks it read, as dismissing a toast is.
   */
  seen: number
  markSeen: () => void
  /** Sends one sentence, then runs what came back, in order. */
  say: (utterance: string) => Promise<void>
  /** Asks the person, on screen. Registered as the studio's confirmer by the shell. */
  ask: (request: ConfirmRequest) => Promise<boolean>
  answer: (granted: boolean) => void
  setModel: (model: AssistantModel) => void
}

/**
 * Turns are keyed by this rather than by their index: the list only ever grows today, and a key
 * that is an index is the one that goes wrong the day it stops.
 */
let lastTurnId = 0

/**
 * Loaded on the turn, as the handler table is: it reaches the space modules, which
 * `eager-graph.test.ts` holds out of what a launch pays for. Narrowed against the sentence — a
 * stack of two hundred layers would spend the room the sentence itself needs.
 */
async function targetsFor(said: string): Promise<readonly Target[]> {
  const { frontTargets } = await import('@/assistant/documentTargets')
  return narrowTargets(frontTargets()?.targets() ?? [], said)
}

/**
 * The assistant as this window holds it: what was said, what it cost, and the one question that
 * may be waiting.
 *
 * A sentence is a CHAIN of rounds, not one pass — see `chainOn`. The case a single plan cannot
 * write turned out to be the ordinary one, not the rare one it was taken for: "open the green
 * sailboat" needs a path that only the search before it can give, and the model would announce
 * the search, run it, and stop there.
 *
 * What the single pass was right to fear is the cost — every round is billed — and that is now a
 * ceiling (`assistant.steps`) and a stop the person can press, rather than a chain of one.
 */
export const useAssistant = create<AssistantState>()((set, get) => ({
  turns: [],
  busy: false,
  round: 0,
  stopping: false,
  ...NOTHING_READ,
  asked: null,
  choosing: null,
  spent: 0,
  seen: 0,
  draft: '',
  staged: 0,
  hearing: false,

  setDraft: draft => set({ draft }),

  noteProgress: progress =>
    set(state => ({
      // 🛑 Cut HERE and not at the render: only the tail is ever shown, and slicing a rope that
      // has grown by one token flattens it — `[M]` 6,6 ms per frame at 8 000 tokens, 65,8 at
      // 32 000. A restart still keeps what follows it, both arriving in one coalesced frame.
      streamed: ((progress.restart === true ? '' : state.streamed) + progress.delta).slice(
        -STREAM_TAIL,
      ),
      // Zero on a restart: what the attempt just thrown away cost is not what this one costs.
      promptTokens: progress.promptTokens ?? (progress.restart === true ? 0 : state.promptTokens),
      replyTokens: progress.replyTokens ?? (progress.restart === true ? 0 : state.replyTokens),
      windowTokens: progress.windowTokens ?? state.windowTokens,
    })),

  /**
   * Coming on screen IS reading — but only of what there is to read.
   *
   * The `busy` guard is the whole subtlety: a turn joins `turns` when it is SENT, not when it is
   * answered, so mounting while a plan runs would mark an answer seen before it exists. Leave
   * before it lands and nothing would ever report it — the status line only speaks while `busy`,
   * and the toast would think it had been read. What marks a running turn seen is the end of
   * `say`, and only if a host is still up to show it.
   */
  stage: () => {
    set(state => ({ staged: state.staged + 1, seen: state.busy ? state.seen : lastSeen(state) }))

    // 🛑 A question is NOT declined by the last host going down: the two hosts hand over in one
    // commit, and a lazy panel takes frames to arrive — declining there refused questions nobody
    // had seen. It waits instead, and the next host to mount shows it.
    return () => set(state => ({ staged: state.staged - 1 }))
  },

  // Read off the turns rather than off `lastTurnId`, which counts what this module has ALLOCATED
  // rather than what the window holds: a state restored from anywhere else leaves the counter at
  // zero, so every turn stayed unread for ever and the reminder never went away.
  markSeen: () => set(state => ({ seen: lastSeen(state) })),

  ask: request =>
    new Promise<boolean>(resolve => {
      /**
       * One question at a time, and a second one is REFUSED rather than shown.
       *
       * The two callers are independent — the modal's own plan, and an MCP client on the other
       * side of the machine — so two questions can genuinely be in flight. Overwriting the first
       * cost twice: its promise never settled, which held `busy` for the rest of the session,
       * and the buttons on screen then answered the SECOND request while the person was reading
       * the first. Approving "this uploads an image, it is free" would have started a forty-unit
       * generation.
       *
       * Refusing the newcomer is the safe end of that: nothing is spent, and the caller hears why.
       */
      // 🛑 `choosing` as well as `asked`: two slots, each blind to the other, put two sets of
      // buttons on one thread — and the danger this guard exists for is between them too.
      if (get().asked || get().choosing) {
        resolve(false)
        return
      }

      set(state => ({ seen: lastSeen(state), asked: { request, answer: resolve } }))
    }),

  askChoice: (question, choices) =>
    new Promise<string | null>(resolve => {
      // Refused rather than shown, for the same reason `ask` refuses a second confirmation: the
      // buttons on screen would answer the newcomer while the person reads the first question.
      if (get().choosing || get().asked) {
        resolve(null)
        return
      }

      set(state => ({ seen: lastSeen(state), choosing: { question, choices, answer: resolve } }))
    }),

  choose: chosen => {
    const choosing = get().choosing
    if (!choosing) return

    set({ choosing: null })
    choosing.answer(chosen)
  },

  answer: granted => {
    const asked = get().asked
    if (!asked) return

    set({ asked: null })
    asked.answer(granted)
  },

  stop: () => {
    // Only while there is something to stop: setting it idle would arm the next sentence with a
    // refusal it never asked for.
    if (!get().busy) return

    set({ stopping: true })
    // 🛑 The question the chain is parked on: unsettled, the field stays disabled, Stop greys
    // itself out, and the only way out is answering the question one just asked to stop.
    get().choose(null)
    // 🛑 Both halves: the flag ends the CHAIN between two rounds, and this ends the round in
    // flight — a local model holds one for minutes at full tilt. Swallowed with a word, never
    // bare: a rejected channel is an unhandled rejection, and there is nothing to await here.
    void getBridge()
      ?.assistant.stop()
      .catch(reason => traceFailure('shell.dropped', 'assistant stop', reason))
  },

  say: async utterance => {
    const said = utterance.trim()
    if (said === '') return

    // 🛑 A standing question takes what is typed as its ANSWER — « quel nom ? » has nothing to
    // press. Before the `busy` guard, which would otherwise drop that answer on the floor.
    if (get().choosing) {
      get().choose(said)
      return
    }

    // A second sentence while the first is still running would interleave two plans against one
    // generator form, and the confirmation on screen belongs to the first of them.
    if (get().busy) return

    const id = (lastTurnId += 1)
    const turn: AssistantTurn = { id, said, answered: '', steps: [], asks: [], lost: false }
    set(state => ({
      turns: [...state.turns, turn],
      busy: true,
      stopping: false,
      round: 0,
      ...NOTHING_READ,
    }))

    // A turn without its targets is a turn that still answers: a chunk that fails to load must
    // not leave `busy` true for the session, which is what an unhandled rejection here would do.
    const targets = await orElse(targetsFor(said), [])

    try {
      await chainOn(set, get, id, said, targets)
    } finally {
      // Every way out, including a throw from an IPC channel that genuinely rejects: unguarded,
      // one such throw left `busy` true for the rest of the session — the field disabled, the
      // spinner turning, nothing on screen saying why.
      set({ busy: false, stopping: false, round: 0, ...NOTHING_WRITTEN })
    }

    // Read, if a surface was there to read it: the other half of the `busy` guard in `show`.
    if (get().staged > 0) set({ seen: id })
  },

  setModel: model => {
    void useSettings.getState().setValue('assistant.model', model)
  },
}))

type Setter = (
  patched: Partial<AssistantState> | ((state: AssistantState) => Partial<AssistantState>),
) => void
type Getter = () => AssistantState

/**
 * The rounds one sentence takes, until the model answers with nothing left to do.
 *
 * Each round is a BILLED round trip, so three things end it and each says so differently: the
 * model answering with no calls (done), the person pressing stop, and the ceiling. The last two
 * are written on the turn rather than left to look like a plan that finished.
 */
async function chainOn(
  set: Setter,
  get: Getter,
  id: number,
  said: string,
  targets: readonly Target[],
): Promise<void> {
  const bridge = getBridge()
  const ceiling = assistantStepsWithin(useSettings.getState().settings.assistant.steps)

  for (let round = 1; round <= ceiling; round += 1) {
    // Emptied here and not when the answer lands: what a round wrote belongs to that round, and
    // the actions it decided on run after it — with the words that decided them still on screen.
    set({ round, ...NOTHING_WRITTEN })

    // The turn itself is in `turns`, so a round after the first reads what it has just done and
    // what each action answered. Left out of the FIRST, where it would only repeat the sentence
    // the request already carries — a turn does not precede itself.
    const told = get().turns
    const history = assistantHistory((round === 1 ? told.slice(0, -1) : told).slice(-HISTORY_MAX))

    // No model in the request: the main process reads the setting on each turn, so the one this
    // window would send could only be a copy going stale between two windows.
    const answer = await orElse(
      bridge?.assistant.think({ utterance: said, history, targets, continuing: round > 1 }),
      null,
    )

    if (!answer) {
      // A round that came back with nothing is the end of the chain: asking again would send the
      // same request to the same door that just failed to answer it. Cut on purpose it is not
      // LOST — the person is the one who cut it, and reading "lost" back is reading a failure.
      patch(set, id, get().stopping ? { ending: 'stopped' } : { lost: true })
      return
    }

    set(state => ({ spent: state.spent + answer.cost }))
    // Every round's sentence is kept, not just the last: "I am looking for it" then "here it is"
    // is the chain as the person read it happening.
    patch(set, id, { answered: alsoSaid(get(), id, answer.say) })

    // 🛑 Before the "no calls" ending below, and that ORDER is the rule: an asking answer carries
    // none, so read the other way round a question would end the turn as done.
    if (answer.ask) {
      if (!(await parkedOn(set, get, id, answer.ask))) return
      continue
    }

    if (answer.calls.length === 0) {
      // The one way a model says a request is done. Nothing was lost.
      patch(set, id, { lost: answer.say === '' && round === 1 })
      return
    }

    if (!(await ranAll(set, get, id, answer.calls))) return

    // Asked once the plan has run, never while a question is on screen: closing IS declining,
    // so a plan that asked for something and then asked to be dismissed would refuse itself.
    // Nothing to close where the empty centre holds the thread — that surface IS the centre.
    if (answer.calls.some(call => call.action === 'chat.close') && !get().asked) {
      closeTool('assistant')
    }

    if (get().stopping) {
      patch(set, id, { ending: 'stopped' })
      return
    }
  }

  // Reached rather than chosen: the model still had calls to make and the budget ran out. Said
  // on the turn, because a chain cut here looks exactly like one that finished.
  patch(set, id, { ending: 'halted' })
}

/**
 * Puts the question on screen and waits on it. Answers whether the chain may go on — the answer
 * written on the TURN, which is the history the next round reads.
 */
async function parkedOn(set: Setter, get: Getter, id: number, ask: AssistantAsk): Promise<boolean> {
  /**
   * 🛑 For effect, never for its answer — a review asked for the opposite and it is wrong here:
   * `revealChat` says false wherever no shell is mounted, which is the BENCH, and refusing there
   * would end every asking turn of `pnpm banc` as stopped. What the deleted `chat.ask` guarded by
   * `noConfirmer` is guarded by reachability instead: `say` is only called from a surface that
   * has a shell, or from the bench, which answers through the store.
   */
  revealChat()

  const answer = await get().askChoice(ask.question, ask.choices)
  noteAssistant({ kind: 'asked', question: ask.question, answer })
  set(state => ({
    turns: state.turns.map(turn =>
      turn.id === id ? { ...turn, asks: [...turn.asks, { question: ask.question, answer }] } : turn,
    ),
  }))

  // 🛑 Dismissing ENDS the turn, which is what the button promises: read as an ordinary answer,
  // the model was handed nothing and asked again on the next BILLED round. A stop pressed while
  // the question stood arrives the same way, `stop` settling it with nothing.
  if (answer !== null && !get().stopping) return true

  patch(set, id, { ending: 'stopped' })
  return false
}

/** What the turn says once this round has spoken too — blank rounds add no empty lines. */
function alsoSaid(state: AssistantState, id: number, say: string): string {
  const before = state.turns.find(turn => turn.id === id)?.answered ?? ''
  if (say.trim() === '') return before

  return before === '' ? say : `${before}\n${say}`
}

/**
 * One plan, one action at a time — never at once: `generator.prepare` fills the form that
 * `generator.submit` then sends, and a plan run in parallel would send an empty one.
 *
 * Answers whether the chain may go on. A throw is not a refusal: the action did not run, and a
 * turn showing only the steps that worked would read as a plan that finished.
 */
async function ranAll(
  set: Setter,
  get: Getter,
  id: number,
  calls: readonly AssistantCall[],
): Promise<boolean> {
  /**
   * 🛑 Seeded from the turn, never from empty: `patch` REPLACES what a turn holds, so a round
   * starting at zero wipes the rounds before it — the search result leaves the history and the
   * model runs the search it has already run, which is the one thing the chain exists to stop.
   */
  const steps: AssistantStep[] = [...(get().turns.find(turn => turn.id === id)?.steps ?? [])]

  try {
    // On the turn rather than at launch, as `remoteActions.ts` loads it: the table reaches all
    // fourteen families, and a studio nobody speaks to has no use for any of them.
    const { runConfirmedAction } = await import('@/assistant/executor')

    for (const call of calls) {
      // Between two actions, not inside one: what is already running is left to finish, which is
      // the only stop that cannot leave a half-written document behind.
      if (get().stopping) {
        patch(set, id, { steps: [...steps], ending: 'stopped' })
        return false
      }

      /**
       * 🛑 A relative call run twice in one turn ADDS twice — the one repeat an absolute value
       * survives. Refused rather than run, and the refusal says so: a model that repeats is
       * what this whole field was measured against.
       */
      const key = repeatKeyOf(call.action, call.input)
      const outcome = repeatedRelative(steps, key)
        ? refused('badInput', ALREADY_APPLIED)
        : await runConfirmedAction(call.action, call.input)

      noteAssistant({
        kind: 'ran',
        action: call.action,
        input: JSON.stringify(call.input),
        // `resultLine` rather than a second stringify: a listing of a whole project is thousands
        // of entries, and it is what already bounds them by whole items for the model.
        answer: outcome.ok ? resultLine(outcome.data) : outcome.refusal,
        refused: !outcome.ok,
      })
      steps.push({
        action: call.action,
        refusal: outcome.ok ? null : outcome.refusal,
        ...(!outcome.ok && outcome.detail !== undefined ? { detail: outcome.detail } : {}),
        ...(outcome.ok && key !== null ? { repeatKey: key } : {}),
        ...(outcome.ok && outcome.data !== undefined ? { data: outcome.data } : {}),
      })
      patch(set, id, { steps: [...steps] })
    }
  } catch {
    patch(set, id, { lost: true })
    return false
  }

  return true
}

/** The turn a reader would have taken in by looking — the last one there is. */
function lastSeen(state: Pick<AssistantState, 'turns'>): number {
  return state.turns.at(-1)?.id ?? 0
}

/** What a repeated relative call is told — it names the fix, since the value itself was right. */
const ALREADY_APPLIED =
  'that exact relative change already ran in this turn, and running it again would apply it ' +
  'twice. Read the value that stands before asking for another change.'

/** Rewrites one turn in place, leaving the others as they were. */
function patch(
  set: (updater: (state: AssistantState) => Partial<AssistantState>) => void,
  id: number,
  fields: Partial<AssistantTurn>,
): void {
  set(state => ({
    turns: state.turns.map(turn => (turn.id === id ? { ...turn, ...fields } : turn)),
  }))
}
