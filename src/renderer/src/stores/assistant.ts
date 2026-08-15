import { create } from 'zustand'
import { HISTORY_MAX, type AssistantModel } from '@shared/domain/assistant'
import type { ConfirmRequest } from '@/assistant/confirm'
import { assistantHistory, type AssistantStep, type AssistantTurn } from '@/assistant/conversation'
import { runConfirmedAction } from '@/assistant/executor'
import { getBridge } from '@/services/bridge'
import { useSettings } from './settings'

/** A question on screen and the promise waiting on it — see `ask`. */
type AssistantQuestion = { request: ConfirmRequest; answer: (granted: boolean) => void }

type AssistantState = {
  open: boolean
  /**
   * Whether the spoken word belongs to the assistant while the window is CLOSED.
   *
   * The point of the whole arrangement: one talks to the studio to watch it act, and a modal over
   * the screen hides the very thing the sentence is about. Open, the window claims the words on
   * its own — see `assistantHearsSpeech`, which is the pair of them.
   */
  listening: boolean
  turns: AssistantTurn[]
  /** From the moment a sentence is sent until its last action has run or been refused. */
  busy: boolean
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

  show: () => void
  hide: () => void
  toggle: () => void
  /**
   * Claims the spoken word, and nothing else — not the window, and not the microphone.
   *
   * The microphone is opened by the modal once it has claimed the words, so the ORDER is held by
   * the mount rather than by a race: `start()` crosses to the main process before a stream opens,
   * and a sentence settling in that window with no target goes to the caret instead.
   */
  listen: () => void
  stopListening: () => void
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
 * The assistant as this window holds it: what was said, what it cost, and the one question that
 * may be waiting.
 *
 * One pass of thinking per sentence — no loop. The model already answers several `calls` at
 * once, so a loop would buy the rare case where an action's result changes the plan, and pay for
 * it on every sentence: five round trips instead of one, with the history growing at each. What
 * a second pass would have done, the next sentence does, with the first one's outcome already in
 * the history.
 */
export const useAssistant = create<AssistantState>()((set, get) => ({
  open: false,
  listening: false,
  turns: [],
  busy: false,
  asked: null,
  spent: 0,
  seen: 0,

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
    // And closing the door stops the talking. The window is what claims the spoken word while it
    // is up, so leaving the microphone open would pour the next sentence into whatever field the
    // caret happens to sit in — a prompt, a layer name — with nothing on screen saying so.
    set({ open: false, listening: false })
  },

  toggle: () => (get().open ? get().hide() : get().show()),

  listen: () => set({ listening: true }),

  stopListening: () => set({ listening: false }),

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
       * Refusing the newcomer is the safe end of that: nothing is spent, and the caller hears
       * why. Opened, not queued, for the first one — a question nobody can see is not a question.
       */
      if (get().asked) {
        resolve(false)
        return
      }

      set(state => ({ open: true, seen: lastSeen(state), asked: { request, answer: resolve } }))
    }),

  answer: granted => {
    const asked = get().asked
    if (!asked) return

    set({ asked: null })
    asked.answer(granted)
  },

  say: async utterance => {
    const said = utterance.trim()
    // A second sentence while the first is still running would interleave two plans against one
    // generator form, and the confirmation on screen belongs to the first of them.
    if (said === '' || get().busy) return

    const bridge = getBridge()
    const id = (lastTurnId += 1)
    /**
     * The history is read before the new turn joins it — a turn does not precede itself — and
     * trimmed HERE rather than left to the main process.
     *
     * Not an optimisation: the channel VALIDATES the length before the brain trims it, so an
     * eleventh turn made `parseThought` throw, the catch below swallowed it, and every sentence
     * from then on was marked lost. A conversation quietly stopped working at its eleventh turn.
     */
    const history = assistantHistory(get().turns.slice(-HISTORY_MAX))
    const turn: AssistantTurn = { id, said, answered: '', steps: [], lost: false }
    set(state => ({ turns: [...state.turns, turn], busy: true }))

    // No model in the request: the main process reads the setting on each turn, so the one this
    // window would send could only be a copy going stale between two windows.
    const answer = await bridge?.assistant.think({ utterance: said, history }).catch(() => null)

    if (!answer) {
      patch(set, id, { lost: true })
      set({ busy: false })
      return
    }

    set(state => ({ spent: state.spent + answer.cost }))
    // Shown before anything runs: a confirmation holds for as long as the person takes to read
    // it, and a modal saying nothing meanwhile reads as one that froze.
    patch(set, id, {
      answered: answer.say,
      lost: answer.say === '' && answer.calls.length === 0,
    })

    /**
     * One after another, never at once: `generator.prepare` fills the form that
     * `generator.submit` then sends, and a plan run in parallel would send an empty one.
     *
     * Inside a `try/finally`, and the `finally` is the point: every branch of `runAction`
     * reaches an IPC channel that genuinely rejects — the API client turns a 429, a missing key
     * or a dropped network into a thrown error. Unguarded, one such throw left the loop, left
     * `say`, and `busy` stayed true for the rest of the session: the field disabled, the spinner
     * turning, nothing on screen saying why. The assistant was dead until the window reloaded.
     */
    const steps: AssistantStep[] = []
    try {
      for (const call of answer.calls) {
        const outcome = await runConfirmedAction(call.action, call.input)
        steps.push({ action: call.action, refusal: outcome.ok ? null : outcome.refusal })
        patch(set, id, { steps: [...steps] })
      }
    } catch {
      // Said rather than swallowed: an action that threw did not run, and a turn showing only
      // the steps that worked would read as a plan that finished.
      patch(set, id, { lost: true })
    } finally {
      set({ busy: false })
    }

    /**
     * The model asking to be got out of the way, once its plan has run.
     *
     * The window is the surface that answered, and it is also the one covering the answer: a
     * space opened or a form filled is behind it. `chat.close` is how the model says "what I did
     * is now the thing to look at" — carried out here rather than in the executor, because the
     * window belongs to the conversation.
     *
     * Never while a question is on screen: closing IS declining, so a plan that asked for
     * something and then asked to be dismissed would refuse its own request.
     */
    if (answer.calls.some(call => call.action === 'chat.close') && !get().asked) {
      set({ open: false, listening: false })
    }

    // Read, if the window was there to be read: this is the other half of the `busy` guard in
    // `show`. A turn answered under an open window needs no toast afterwards.
    if (get().open) set({ seen: id })
  },

  setModel: model => {
    void useSettings.getState().setValue('assistant.model', model)
  },
}))

/**
 * Whether what is spoken belongs to the assistant rather than to the caret.
 *
 * The two ways in are one question: the window claims the words while it is up, and `listening` is
 * the same claim made without it. Read by the status line, which is the only thing on screen once
 * the window is closed — and saying "microphone on" without saying to WHOM is half an answer.
 *
 * Named for its domain, as every export of `stores/` is: `hears` alone would be one more bare word
 * for an editor's auto-import to pick the wrong one of.
 */
export function assistantHearsSpeech(state: Pick<AssistantState, 'open' | 'listening'>): boolean {
  return state.open || state.listening
}

/** The turn a reader would have taken in by looking — the last one there is. */
function lastSeen(state: Pick<AssistantState, 'turns'>): number {
  return state.turns.at(-1)?.id ?? 0
}

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
