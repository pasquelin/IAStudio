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
  turns: [],
  busy: false,
  asked: null,
  spent: 0,

  show: () => set({ open: true }),

  hide: () => {
    // Closing IS declining. A question left unanswered would hold `busy` for the rest of the
    // session, and the promise behind it belongs to an action that is about to spend something.
    get().answer(false)
    set({ open: false })
  },

  toggle: () => (get().open ? get().hide() : get().show()),

  ask: request =>
    new Promise<boolean>(resolve => {
      // Opened, not queued: a question nobody can see is not a question. It is what makes an
      // action arriving from outside this window — the MCP server — surface here rather than
      // wait behind a closed modal.
      set({ open: true, asked: { request, answer: resolve } })
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

    // One after another, never at once: `generator.prepare` fills the form that
    // `generator.submit` then sends, and a plan run in parallel would send an empty one.
    const steps: AssistantStep[] = []
    for (const call of answer.calls) {
      const outcome = await runConfirmedAction(call.action, call.input)
      steps.push({ action: call.action, refusal: outcome.ok ? null : outcome.refusal })
      patch(set, id, { steps: [...steps] })
    }

    set({ busy: false })
  },

  setModel: model => {
    void useSettings.getState().setValue('assistant.model', model)
  },
}))

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
