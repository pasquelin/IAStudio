import type { AssistantAnswer, AssistantThought } from '@shared/domain/assistant'

/**
 * What the assistant asks of whatever is doing its thinking.
 *
 * A port, because the studio ships one implementation and will not always: Scenario's own
 * catalogue model needs no second account and is therefore the right default, but nothing here
 * is specific to it. An implementation that spoke to Anthropic, to an OpenAI-compatible endpoint
 * or to a model on the machine would answer the same shape.
 *
 * The shapes themselves are the shared ones, because they cross the IPC boundary unchanged: what
 * the brain answers is what the window is handed. A second pair of types here would be two to
 * keep in step, and the drift would be silent.
 */
export type AssistantBrain = {
  think: (request: AssistantThought) => Promise<AssistantAnswer>
}
