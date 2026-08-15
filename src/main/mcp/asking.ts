import { randomUUID } from 'node:crypto'
import type { ActionOutcome, AssistantCall } from '@shared/domain/assistant'
import type { AssistantActionRequest, AssistantActionResult } from '@shared/ipc'

/**
 * Asking the window in front to run an action, and waiting for what it made of it.
 *
 * The studio has no round trip in this direction: `invoke` goes renderer to main, `broadcast`
 * goes back with no reply. So one is composed here out of the two, with a `callId` tying the
 * halves together — and every way it can fail answers something rather than hanging, because on
 * the other end of the wait there is an MCP client that would otherwise sit there.
 */

/**
 * How long a question may stand on screen.
 *
 * Two minutes, which is a person reading "this will spend 12 units" and deciding — not a
 * network timeout. Shorter would cancel a considered no; longer would leave a client believing
 * something is still happening long after the user walked away.
 */
export const ANSWER_TIMEOUT_MS = 120_000

export type RemoteActionDeps = {
  /** Sends to the window in front, answering `false` when there is none — see `sendToFront`. */
  send: (request: AssistantActionRequest) => boolean
  newCallId?: () => string
  timeoutMs?: number
}

export type RemoteActions = {
  run: (call: AssistantCall) => Promise<ActionOutcome>
  /** The window's answer, quoting the id it was asked under. Unknown ids are dropped. */
  settle: (result: AssistantActionResult) => void
}

export function createRemoteActions({
  send,
  newCallId = randomUUID,
  timeoutMs = ANSWER_TIMEOUT_MS,
}: RemoteActionDeps): RemoteActions {
  const waiting = new Map<string, (outcome: ActionOutcome) => void>()

  return {
    run: call =>
      new Promise<ActionOutcome>(resolve => {
        const callId = newCallId()

        // Refused rather than queued: an application with no window in front has nowhere to
        // show the question that a costly action would need, and a call held until one appears
        // would spend on a screen the person is no longer looking at.
        if (!send({ callId, call })) {
          resolve({ ok: false, refusal: 'noWindow' })
          return
        }

        const timer = setTimeout(() => {
          // Dropped from the map first, so an answer that arrives late finds nothing to resolve
          // rather than resolving a promise its caller already gave up on.
          waiting.delete(callId)
          resolve({ ok: false, refusal: 'timedOut' })
        }, timeoutMs)

        // The wait must not be a reason the application stays alive at quit.
        timer.unref()

        waiting.set(callId, outcome => {
          clearTimeout(timer)
          resolve(outcome)
        })
      }),

    settle: ({ callId, outcome }) => {
      const answer = waiting.get(callId)
      // Silently, and on purpose: an id nobody is waiting on is a call that already timed out,
      // or a window answering twice. Neither is worth a failure on this side.
      if (!answer) return

      waiting.delete(callId)
      answer(outcome)
    },
  }
}
