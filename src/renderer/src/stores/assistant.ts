import { orElse } from '@shared/promises'
import { create } from 'zustand'
import {
  HISTORY_MAX,
  refused,
  type AssistantCall,
  type AssistantModel,
} from '@shared/domain/assistant'
import { assistantStepsWithin } from '@shared/domain/assistantSteps'
import { narrowTargets, type Target } from '@shared/domain/target'
import type { ConfirmRequest } from '@/assistant/confirm'
import {
  assistantHistory,
  repeatedRelative,
  repeatKeyOf,
  type AssistantStep,
  type AssistantTurn,
} from '@/assistant/conversation'
import { getBridge } from '@/services/bridge'
import { useSettings } from './settings'

/** A question on screen and the promise waiting on it — see `ask`. */
type AssistantQuestion = { request: ConfirmRequest; answer: (granted: boolean) => void }

type AssistantState = {
  open: boolean
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
  /** Asks the chain to stop after what is already running. Nothing in flight is undone. */
  stop: () => void
  asked: AssistantQuestion | null
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
   * How many surfaces have the thread on screen — the modal, the empty centre, or neither.
   *
   * 🛑 Not `open`, which means the MODAL alone. Everything that speaks only when nobody is
   * reading — the toast, the status line, marking a turn seen — asks this: with the centre
   * staging the same thread, `open` says "nobody is reading" over a full page of words.
   *
   * A count rather than a flag: the two hosts hand over in one commit, and a cleanup landing
   * after the newcomer's mount would leave it at zero with the thread on screen.
   */
  staged: number
  /** Declares the thread on screen. Returns the way to take it back down. */
  stage: () => () => void

  show: () => void
  hide: () => void
  toggle: () => void
  /**
   * The last turn the person has actually SEEN, by id.
   *
   * Because one now talks to the studio without its window up: the sentence goes, something
   * happens on screen, and nothing said it had been taken, was being worked on, or came back
   * empty. The status line reads this to know whether it still has something to report — and
   * showing the window is what marks it read, as dismissing a toast is.
   */
  seen: number
  markSeen: () => void
  /** Sends one sentence, then runs what came back, in order. */
  say: (utterance: string) => Promise<void>
  /** Asks the person, on screen. Registered as the studio's confirmer by the modal. */
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
  open: false,
  turns: [],
  busy: false,
  round: 0,
  stopping: false,
  asked: null,
  spent: 0,
  seen: 0,
  draft: '',
  staged: 0,

  setDraft: draft => set({ draft }),

  stage: () => {
    set(state => ({ staged: state.staged + 1 }))

    // The last surface going down with a question still waiting brings the modal up: `ask` decides
    // once, and the idle centre is taken down by opening a document, going Home, or losing the
    // model list. Left as it was, nothing could answer, and `busy` held for the session.
    return () =>
      set(state => ({
        staged: state.staged - 1,
        open: state.open || (state.staged === 1 && state.asked !== null),
      }))
  },

  /**
   * Showing IS reading — but only of what there is to read.
   *
   * The `busy` guard is the whole subtlety: a turn joins `turns` when it is SENT, not when it is
   * answered, so opening the window while a plan runs would mark an answer seen before it exists.
   * Close again before it lands and nothing would ever report it — the status line only speaks
   * while `busy`, and the toast would think it had been read. What marks a running turn seen is
   * the end of `say`, and only if the window is still up to show it.
   */
  show: () => set(state => ({ open: true, seen: state.busy ? state.seen : lastSeen(state) })),

  // Read off the turns rather than off `lastTurnId`, which counts what this module has ALLOCATED
  // rather than what the window holds: a state restored from anywhere else leaves the counter at
  // zero, so every turn stayed unread for ever and the reminder never went away.
  markSeen: () => set(state => ({ seen: lastSeen(state) })),

  hide: () => {
    // Closing IS declining. A question left unanswered would hold `busy` for the rest of the
    // session, and the promise behind it belongs to an action that is about to spend something.
    get().answer(false)
    set({ open: false })
  },

  toggle: () => (get().open ? get().hide() : get().show()),

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
      if (get().asked) {
        resolve(false)
        return
      }

      // The modal opens only where the thread is on screen NOWHERE. Unconditional, a question
      // raised from the idle centre threw the window over the very exchange one was reading, to
      // answer a line that was already there.
      set(state => ({
        open: state.staged > 0 ? state.open : true,
        seen: lastSeen(state),
        asked: { request, answer: resolve },
      }))
    }),

  answer: granted => {
    const asked = get().asked
    if (!asked) return

    set({ asked: null })
    asked.answer(granted)
  },

  stop: () => {
    // Only while there is something to stop: setting it idle would arm the next sentence with a
    // refusal it never asked for.
    if (get().busy) set({ stopping: true })
  },

  say: async utterance => {
    const said = utterance.trim()
    // A second sentence while the first is still running would interleave two plans against one
    // generator form, and the confirmation on screen belongs to the first of them.
    if (said === '' || get().busy) return

    const id = (lastTurnId += 1)
    const turn: AssistantTurn = { id, said, answered: '', steps: [], lost: false }
    set(state => ({ turns: [...state.turns, turn], busy: true, stopping: false, round: 0 }))

    // A turn without its targets is a turn that still answers: a chunk that fails to load must
    // not leave `busy` true for the session, which is what an unhandled rejection here would do.
    const targets = await orElse(targetsFor(said), [])

    try {
      await chainOn(set, get, id, said, targets)
    } finally {
      // Every way out, including a throw from an IPC channel that genuinely rejects: unguarded,
      // one such throw left `busy` true for the rest of the session — the field disabled, the
      // spinner turning, nothing on screen saying why.
      set({ busy: false, stopping: false, round: 0 })
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
    set({ round })

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
      // same request to the same door that just failed to answer it.
      patch(set, id, { lost: true })
      return
    }

    set(state => ({ spent: state.spent + answer.cost }))
    // Every round's sentence is kept, not just the last: "I am looking for it" then "here it is"
    // is the chain as the person read it happening.
    patch(set, id, { answered: alsoSaid(get(), id, answer.say) })

    if (answer.calls.length === 0) {
      // The one way a model says a request is done — and the way it asks a question, its `say`
      // being what the person then answers. Nothing was lost either way.
      patch(set, id, { lost: answer.say === '' && round === 1 })
      return
    }

    if (!(await ranAll(set, get, id, answer.calls))) return

    // Asked once the plan has run, never while a question is on screen: closing IS declining,
    // so a plan that asked for something and then asked to be dismissed would refuse itself.
    if (answer.calls.some(call => call.action === 'chat.close') && !get().asked) {
      set({ open: false })
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
