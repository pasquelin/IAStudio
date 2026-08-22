import type { WebContents } from 'electron'
import { CHANNELS, type AssistantActionResult } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import type { AssistantBrain } from './brainPort'
import { parseActionResult, parseThought } from './validation'

export type AssistantHandlerDeps = {
  brain: AssistantBrain
  /** Where a window's answer to an action asked for from outside goes — see `createRemoteActions`. */
  settleAction: (result: AssistantActionResult) => void
}

/**
 * A turn lives exactly as long as the window that asked for it — invariant 6: a local model
 * generates to its ceiling, and a window closed mid-answer leaves it running with no reader.
 *
 * ONE controller per window, not one per turn: `once` only detaches when it fires, so a listener
 * per turn piles up for as long as the window lives and Node warns at the eleventh.
 */
const lifetimes = new WeakMap<WebContents, AbortSignal>()

function whileAlive(sender: WebContents): AbortSignal {
  const held = lifetimes.get(sender)
  if (held) return held

  const abort = new AbortController()
  sender.once('destroyed', () => abort.abort())
  lifetimes.set(sender, abort.signal)

  return abort.signal
}

export function registerAssistantHandlers({ brain, settleAction }: AssistantHandlerDeps): void {
  // The channel is typed, but TypeScript is gone at runtime and the sender is a renderer: what
  // arrives is `unknown` until this says otherwise.
  handle(CHANNELS.assistantThink, (event, request) =>
    brain.think(parseThought(request), whileAlive(event.sender)),
  )

  handle(CHANNELS.assistantActionResult, (_event, result) => {
    settleAction(parseActionResult(result))
  })
}
