import { CHANNELS, type AssistantActionResult } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import type { AssistantBrain } from './brainPort'
import { parseActionResult, parseThought } from './validation'

export type AssistantHandlerDeps = {
  brain: AssistantBrain
  /** Where a window's answer to an action asked for from outside goes — see `createRemoteActions`. */
  settleAction: (result: AssistantActionResult) => void
}

export function registerAssistantHandlers({ brain, settleAction }: AssistantHandlerDeps): void {
  // The channel is typed, but TypeScript is gone at runtime and the sender is a renderer: what
  // arrives is `unknown` until this says otherwise.
  handle(CHANNELS.assistantThink, (_event, request) => brain.think(parseThought(request)))

  handle(CHANNELS.assistantActionResult, (_event, result) => {
    settleAction(parseActionResult(result))
  })
}
