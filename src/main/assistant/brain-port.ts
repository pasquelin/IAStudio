import type { ActionName } from '@shared/domain/assistant'

/**
 * What the assistant asks of whatever is doing its thinking.
 *
 * A port, because the studio ships one implementation and will not always: Scenario's own
 * catalogue model needs no second account and is therefore the right default, but nothing here
 * is specific to it. An implementation that spoke to Anthropic, to an OpenAI-compatible endpoint
 * or to a model on the machine would answer the same shape.
 */

/** One thing the assistant decided to do. Validated against the registry before it is run. */
export type BrainCall = { action: ActionName; input: Record<string, unknown> }

export type BrainReply = {
  /** What to say to the person. Empty when the actions speak for themselves. */
  say: string
  calls: readonly BrainCall[]
}

export type BrainRequest = {
  /** What the person just said, typed or spoken. */
  utterance: string
  /**
   * The turns before this one, oldest first, already rendered as lines. Rendered rather than
   * structured because that is what the model reads, and because the one implementation the
   * studio ships can only carry ten blocks of text.
   */
  history: readonly string[]
}

/**
 * What it cost to answer, in creative units.
 *
 * Carried on the reply rather than reported separately: the modal shows a running total, and a
 * figure that arrived by another route than the answer would drift from it the first time a
 * call failed halfway.
 */
export type BrainOutcome = { reply: BrainReply; cost: number }

export type AssistantBrain = {
  think: (request: BrainRequest) => Promise<BrainOutcome>
}
