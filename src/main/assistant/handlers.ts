import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import type { AssistantBrain } from './brain-port'
import { parseThought } from './validation'

export type AssistantHandlerDeps = {
  brain: AssistantBrain
}

export function registerAssistantHandlers({ brain }: AssistantHandlerDeps): void {
  // The channel is typed, but TypeScript is gone at runtime and the sender is a renderer: what
  // arrives is `unknown` until this says otherwise.
  handle(CHANNELS.assistantThink, (_event, request) => brain.think(parseThought(request)))
}
