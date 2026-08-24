import type { WorkspaceId } from '@shared/domain/workspace'
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
  /**
   * `signal` stops a turn that nobody is waiting for any more — a window closed mid-answer.
   *
   * Optional because a cloud brain has nothing to stop that matters: the request is already paid
   * for. A turn run in THIS process is the one invariant 6 is about, and it is the one that would
   * otherwise generate to its ceiling with no reader.
   */
  think: (request: AssistantThought, signal?: AbortSignal) => Promise<AssistantAnswer>
}

/**
 * The spaces nothing can generate in, so the model says so before promising a picture. Resolved
 * once per turn, outside any retry: a complaint quotes an answer, and a second reading could ship
 * a different briefing than the one complained about.
 */
export type NotReady = () => Promise<readonly WorkspaceId[]>
