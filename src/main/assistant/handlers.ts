import type { WebContents } from 'electron'
import { CHANNELS, EVENTS, type AssistantActionResult } from '@shared/ipc'
import type { AssistantNote } from '@shared/domain/assistantNote'
import { handle } from '@main/ipc/handle'
import { log } from '@main/log'
import type { ActivityLog } from '@main/project/activityLog'
import type { RunningTasks } from '@main/task/runningTasks'
import { sendToSender } from '@main/ipc/broadcast'
import type { AssistantBrain } from './brainPort'
import { lineOfNote, reportOfNote } from './noteJournal'
import { parseActionResult, parseNote, parseThought } from './validation'

export type AssistantHandlerDeps = {
  brain: AssistantBrain
  /** Where a window's answer to an action asked for from outside goes — see `createRemoteActions`. */
  settleAction: (result: AssistantActionResult) => void
  /** The studio's one table of long tasks — the same the montage stop button reaches through. */
  running: RunningTasks
  /** Where a turn is written down. Read per call: a project can be closed mid-conversation. */
  journal: () => ActivityLog
}

/**
 * A turn lives exactly as long as the window that asked for it — invariant 6. ONE controller per
 * window, not one per turn: `once` only detaches when it fires, so a listener per turn piles up
 * for as long as the window lives and Node warns at the eleventh.
 */
const lifetimes = new WeakMap<WebContents, AbortSignal>()

/** One turn per window — `say` refuses a second sentence while one runs. */
const turnOf = (sender: WebContents): string => `assistant-turn-${sender.id}`

function whileAlive(sender: WebContents): AbortSignal {
  const held = lifetimes.get(sender)
  if (held) return held

  const abort = new AbortController()
  sender.once('destroyed', () => abort.abort())
  lifetimes.set(sender, abort.signal)

  return abort.signal
}

export function registerAssistantHandlers({
  brain,
  settleAction,
  running,
  journal,
}: AssistantHandlerDeps): void {
  /**
   * 🛑 The one funnel both sides pass through — see `AssistantNote`. Its blind spot: `say` holds
   * one turn per WINDOW, not per process, so two windows conversing at once interleave into one
   * journal with nothing naming which turn a line belongs to.
   */
  const note = (one: AssistantNote): void => {
    const report = reportOfNote(one)
    log[report.level]('assistant', lineOfNote(one))
    journal().record(report)
  }
  // The channel is typed, but TypeScript is gone at runtime and the sender is a renderer: what
  // arrives is `unknown` until this says otherwise.
  handle(CHANNELS.assistantThink, async (event, request) =>
    // Named by the window that asked, so a stop from that window reaches its turn and no other.
    // `say` refuses a second sentence while one runs, which is what keeps the name free.
    running.run(turnOf(event.sender), signal =>
      brain.think(parseThought(request), {
        signal: AbortSignal.any([whileAlive(event.sender), signal]),
        onNote: note,
        // To the sender alone: a second window watching this one's turn would show words nobody
        // there typed. `sendToSender` is what guards a window closed mid-answer.
        onProgress: progress => sendToSender(event.sender, EVENTS.assistantStream, progress),
      }),
    ),
  )

  handle(CHANNELS.assistantStop, event => {
    running.cancel(turnOf(event.sender))
    return Promise.resolve()
  })

  handle(CHANNELS.assistantActionResult, (_event, result) => {
    settleAction(parseActionResult(result))
  })

  handle(CHANNELS.assistantNote, (_event, one) => {
    note(parseNote(one))
  })
}
